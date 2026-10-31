import { clearSession, getToken } from '@/auth/session';
import { getApiBaseUrl } from '@/lib/env';
import { ApiError, codeForStatus, isErrorBody } from './errors';

export type Query = Record<
  string,
  string | number | boolean | null | undefined | ReadonlyArray<string | number>
>;

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  /** JSON body (object) */
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** adds the `Idempotency-Key` header (required by POST /v1/orders) */
  idempotencyKey?: string;
  /** default true. false for public endpoints (login, universe, onboarding questions) */
  auth?: boolean;
  /** abort after this many ms (default 20 000) */
  timeoutMs?: number;
  /** let the browser finish the request during page unload */
  keepalive?: boolean;
  /** 429 auto-retries for safe requests (GET). default 2; 0 disables */
  maxRateLimitRetries?: number;
};

export type ApiResponse<T> = {
  data: T;
  status: number;
  traceId: string | null;
  /** `Idempotent-Replay: true` on POST /orders replays */
  replayed: boolean;
};

export type ClientConfig = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  getToken?: () => string | null;
  /** called for every 401 from an authenticated request (default: clear the session as 'expired') */
  onUnauthorized?: (e: ApiError) => void;
  /** observe every trace id (success and failure) */
  onTrace?: (traceId: string) => void;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

const MAX_AUTO_WAIT_MS = 10_000;

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });

/** Parse a `Retry-After` header (delta-seconds or HTTP-date) to milliseconds. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  if (!value) return null;
  const s = value.trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 1000);
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : Math.max(0, t - now);
}

export function buildUrl(base: string, path: string, query?: Query): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const qs = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v == null || v === '') continue;
      qs.set(k, Array.isArray(v) ? v.join(',') : String(v));
    }
  }
  const s = qs.toString();
  return `${base}${p}${s ? `?${s}` : ''}`;
}

export function createApiClient(config: ClientConfig = {}) {
  const fetchImpl = config.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const sleep = config.sleep ?? defaultSleep;
  const tokenOf = config.getToken ?? getToken;
  const onUnauthorized = config.onUnauthorized ?? (() => clearSession('expired'));
  let lastTraceId: string | null = null;

  async function execute<T>(path: string, opts: RequestOptions, attempt: number): Promise<ApiResponse<T>> {
    const { method = 'GET', body, signal, auth = true } = opts;
    const url = buildUrl(config.baseUrl ?? getApiBaseUrl(), path, opts.query);
    const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
    const token = auth ? tokenOf() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    // timeout + caller abort share one controller; remember who aborted for the error mapping
    const ctl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctl.abort();
    }, opts.timeoutMs ?? 20_000);
    const onAbort = () => ctl.abort(signal?.reason);
    if (signal) {
      if (signal.aborted) ctl.abort(signal.reason);
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    let res: Response;
    try {
      res = await fetchImpl(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctl.signal,
        keepalive: opts.keepalive,
        credentials: 'omit',
      });
    } catch (e) {
      if (signal?.aborted) throw e; // caller cancelled: let TanStack Query treat it as a cancellation
      if (timedOut) throw new ApiError({ code: 'timeout', message: 'The request timed out.', status: 0 });
      throw new ApiError({
        code: 'network_error',
        message: e instanceof Error ? e.message : 'Network error',
        status: 0,
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }

    const traceId = res.headers.get('X-Trace-Id');
    if (traceId) {
      lastTraceId = traceId;
      config.onTrace?.(traceId);
    }

    if (res.ok) {
      if (res.status === 204) return { data: undefined as T, status: 204, traceId, replayed: false };
      const text = await res.text();
      let data: unknown = undefined;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new ApiError({
            code: 'bad_response',
            message: 'Response was not valid JSON.',
            status: res.status,
            trace_id: traceId,
          });
        }
      }
      return {
        data: data as T,
        status: res.status,
        traceId,
        replayed: res.headers.get('Idempotent-Replay') === 'true',
      };
    }

    // ---- error path ----
    const retryAfterMs = parseRetryAfter(res.headers.get('Retry-After'));
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      /* non-JSON error bodies fall back to the status mapping */
    }
    const err = isErrorBody(parsed)
      ? new ApiError({
          code: parsed.code,
          message: parsed.message,
          status: res.status,
          trace_id: parsed.trace_id ?? traceId,
          details: parsed.details ?? null,
          retryAfterMs,
        })
      : new ApiError({
          code: codeForStatus(res.status),
          message: res.statusText || `HTTP ${res.status}`,
          status: res.status,
          trace_id: traceId,
          retryAfterMs,
        });

    if (res.status === 401 && auth) onUnauthorized(err);

    // 429: honour Retry-After for safe requests, bounded so the UI never hangs
    const maxRetries = opts.maxRateLimitRetries ?? 2;
    if (
      res.status === 429 &&
      method === 'GET' &&
      attempt < maxRetries &&
      retryAfterMs != null &&
      retryAfterMs <= MAX_AUTO_WAIT_MS
    ) {
      await sleep(retryAfterMs, signal);
      return execute<T>(path, opts, attempt + 1);
    }
    throw err;
  }

  const request = <T>(path: string, opts: RequestOptions = {}): Promise<ApiResponse<T>> =>
    execute<T>(path, opts, 0);

  return {
    request,
    get: async <T>(path: string, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
      (await request<T>(path, { ...opts, method: 'GET' })).data,
    post: async <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
      (await request<T>(path, { ...opts, method: 'POST', body })).data,
    put: async <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
      (await request<T>(path, { ...opts, method: 'PUT', body })).data,
    patch: async <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
      (await request<T>(path, { ...opts, method: 'PATCH', body })).data,
    del: async <T>(path: string, opts: Omit<RequestOptions, 'method'> = {}) =>
      (await request<T>(path, { ...opts, method: 'DELETE' })).data,
    /** trace id of the most recent response (shown in error details / support) */
    getLastTraceId: () => lastTraceId,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** App-wide singleton: bearer from the session store, 401 clears the session (AuthProvider redirects to /signin). */
export const api: ApiClient = createApiClient();

/** All endpoints live under /v1. */
export const V1 = '/v1';
