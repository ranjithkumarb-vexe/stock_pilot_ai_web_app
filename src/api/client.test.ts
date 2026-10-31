import { createApiClient, buildUrl, parseRetryAfter } from './client';
import { ApiError } from './errors';

type Init = { status?: number; headers?: Record<string, string>; body?: unknown; text?: string };
const res = ({ status = 200, headers = {}, body, text }: Init = {}) =>
  new Response(text ?? (body === undefined ? null : JSON.stringify(body)), { status, headers });

const make = (
  impl: (url: string, init: RequestInit) => Promise<Response> | Response,
  extra: Partial<Parameters<typeof createApiClient>[0]> = {},
) => {
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) =>
    impl(String(url), init ?? {}),
  );
  const client = createApiClient({
    baseUrl: 'http://api.test',
    fetchImpl: fetchImpl as unknown as typeof fetch,
    getToken: () => 'tok-123',
    sleep: async () => {},
    ...extra,
  });
  return { client, fetchImpl };
};
const lastInit = (f: ReturnType<typeof vi.fn>, i = 0) =>
  f.mock.calls[i]?.[1] as RequestInit & { headers: Record<string, string> };

describe('api client', () => {
  it('sends bearer, JSON and builds query strings', async () => {
    const { client, fetchImpl } = make(() => res({ body: { ok: 1 }, headers: { 'X-Trace-Id': 'tr-1' } }));
    const out = await client.get('/v1/quotes', {
      query: { symbols: ['AAPL', 'MSFT'], limit: 5, skip: undefined, empty: '' },
    });
    expect(out).toEqual({ ok: 1 });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://api.test/v1/quotes?symbols=AAPL%2CMSFT&limit=5');
    expect(lastInit(fetchImpl).headers.Authorization).toBe('Bearer tok-123');
    expect(client.getLastTraceId()).toBe('tr-1');
  });

  it('omits the bearer for public calls and sends JSON bodies + Idempotency-Key', async () => {
    const { client, fetchImpl } = make(() => res({ body: {} }));
    await client.post('/v1/orders', { symbol: 'A' }, { auth: false, idempotencyKey: 'k-1' });
    const h = lastInit(fetchImpl).headers;
    expect(h.Authorization).toBeUndefined();
    expect(h['Idempotency-Key']).toBe('k-1');
    expect(h['Content-Type']).toBe('application/json');
    expect(lastInit(fetchImpl).body).toBe('{"symbol":"A"}');
  });

  it('maps the error envelope to ApiError and captures trace id', async () => {
    const { client } = make(() =>
      res({
        status: 422,
        body: {
          code: 'rule_violation',
          message: 'NVDA over cap',
          trace_id: 'tr-9',
          details: { violations: [{ rule: 'pos' }] },
        },
      }),
    );
    const err = (await client.get('/v1/x').catch(e => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      code: 'rule_violation',
      status: 422,
      trace_id: 'tr-9',
      message: 'NVDA over cap',
    });
    expect((err.details?.violations as unknown[]).length).toBe(1);
  });

  it('falls back to status mapping for non-JSON errors and uses the X-Trace-Id header', async () => {
    const { client } = make(() =>
      res({ status: 503, text: '<html>bad gateway</html>', headers: { 'X-Trace-Id': 'tr-h' } }),
    );
    const err = await client.get('/v1/x').catch(e => e);
    expect(err).toMatchObject({ code: 'upstream_unavailable', status: 503, trace_id: 'tr-h' });
  });

  it('maps fetch rejections to network_error and aborts to timeout', async () => {
    const { client } = make(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(client.get('/v1/x')).rejects.toMatchObject({ code: 'network_error', status: 0 });

    vi.useFakeTimers();
    const slow = make(
      (_u, init) =>
        new Promise<Response>((_r, rej) =>
          init.signal?.addEventListener('abort', () => rej(new DOMException('x', 'AbortError'))),
        ),
    );
    const p = slow.client.get('/v1/x', { timeoutMs: 50 }).catch(e => e);
    await vi.advanceTimersByTimeAsync(60);
    expect(await p).toMatchObject({ code: 'timeout' });
    vi.useRealTimers();
  });

  it('rethrows caller aborts untouched (so TanStack Query can cancel)', async () => {
    const ctl = new AbortController();
    const { client } = make(
      (_u, init) =>
        new Promise<Response>((_r, rej) =>
          init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))),
        ),
    );
    const p = client.get('/v1/x', { signal: ctl.signal }).catch(e => e);
    ctl.abort();
    const e = await p;
    expect(e).not.toBeInstanceOf(ApiError);
    expect((e as DOMException).name).toBe('AbortError');
  });

  it('401 on an authenticated call invokes onUnauthorized once and throws', async () => {
    const onUnauthorized = vi.fn();
    const { client } = make(
      () => res({ status: 401, body: { code: 'unauthenticated', message: 'expired' } }),
      { onUnauthorized },
    );
    await expect(client.get('/v1/me')).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('401 on a public call (login) does not clear the session', async () => {
    const onUnauthorized = vi.fn();
    const { client } = make(() => res({ status: 401, body: { code: 'unauthenticated', message: 'bad' } }), {
      onUnauthorized,
    });
    await expect(client.post('/v1/auth/dev-login', {}, { auth: false })).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('429: GET retries after Retry-After then succeeds', async () => {
    const sleep = vi.fn(async () => {});
    let n = 0;
    const { client, fetchImpl } = make(
      () =>
        n++ === 0
          ? res({
              status: 429,
              headers: { 'Retry-After': '2' },
              body: { code: 'rate_limited', message: 'slow' },
            })
          : res({ body: { ok: true } }),
      { sleep },
    );
    await expect(client.get('/v1/x')).resolves.toEqual({ ok: true });
    expect(sleep).toHaveBeenCalledWith(2000, undefined);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('429: gives up after the retry budget and exposes retryAfterMs', async () => {
    const { client, fetchImpl } = make(() =>
      res({ status: 429, headers: { 'Retry-After': '1' }, body: { code: 'rate_limited', message: 'slow' } }),
    );
    const err = await client.get('/v1/x').catch(e => e);
    expect(err).toMatchObject({ code: 'rate_limited', retryAfterMs: 1000 });
    expect(fetchImpl).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });

  it('429: POST is never auto-retried; long waits are surfaced instead of slept', async () => {
    const post = make(() =>
      res({ status: 429, headers: { 'Retry-After': '1' }, body: { code: 'rate_limited', message: 'slow' } }),
    );
    await expect(post.client.post('/v1/orders', {})).rejects.toMatchObject({ retryAfterMs: 1000 });
    expect(post.fetchImpl).toHaveBeenCalledTimes(1);
    const long = make(() =>
      res({
        status: 429,
        headers: { 'Retry-After': '120' },
        body: { code: 'rate_limited', message: 'slow' },
      }),
    );
    await expect(long.client.get('/v1/x')).rejects.toMatchObject({ retryAfterMs: 120000 });
    expect(long.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reports replayed idempotent responses and handles 204', async () => {
    const { client } = make(() => res({ body: { order: {} }, headers: { 'Idempotent-Replay': 'true' } }));
    expect((await client.request('/v1/orders', { method: 'POST', body: {} })).replayed).toBe(true);
    const nc = make(() => new Response(null, { status: 204 }));
    expect(await nc.client.del('/v1/watchlist/A')).toBeUndefined();
  });

  it('rejects malformed success JSON as bad_response', async () => {
    const { client } = make(() => res({ text: '{nope' }));
    await expect(client.get('/v1/x')).rejects.toMatchObject({ code: 'bad_response' });
  });
});

describe('helpers', () => {
  it('parseRetryAfter handles seconds, dates and junk', () => {
    expect(parseRetryAfter('3')).toBe(3000);
    expect(parseRetryAfter('1.5')).toBe(1500);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4000)).toBe(6000);
    expect(parseRetryAfter('soon')).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
  });
  it('buildUrl normalises slashes', () => {
    expect(buildUrl('http://a', 'v1/x')).toBe('http://a/v1/x');
  });
});
