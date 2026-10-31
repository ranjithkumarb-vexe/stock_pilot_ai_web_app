import type { TelemetryEvent } from '@/api/types';
import { DwellTimer } from './dwell';
import { FLUSH_MS, MAX_BATCH, MAX_QUEUE, Tracker, deviceClass } from './tracker';

const mk = (
  send: ReturnType<typeof vi.fn>,
  extra: Partial<ConstructorParameters<typeof Tracker>[0]> = {},
) => {
  let i = 0;
  const tracker = new Tracker({
    transport: { send: send as never, unload: vi.fn(() => true) },
    sessionId: 'sess-1',
    uuid: () => `ev-${++i}`,
    now: () => new Date('2026-10-31T14:05:00Z'),
    tz: () => 'Asia/Kolkata',
    device: () => 'desktop',
    context: () => ({ market_session: 'regular' }),
    isOnline: () => true,
    ...extra,
  });
  return tracker;
};
const sent = (send: ReturnType<typeof vi.fn>, n: number) => send.mock.calls[n]?.[0] as TelemetryEvent[];

describe('telemetry tracker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('builds events per SPEC §10.2', () => {
    const t = mk(vi.fn());
    const e = t.track({ type: 'ticker_viewed', entity: { ticker: 'JNJ' }, props: { action: 'open' } });
    expect(e).toEqual({
      event_id: 'ev-1',
      ts: '2026-10-31T14:05:00.000Z',
      session_id: 'sess-1',
      type: 'ticker_viewed',
      entity: { ticker: 'JNJ' },
      props: { action: 'open' },
      context: { market_session: 'regular' },
      client: { device: 'desktop', tz: 'Asia/Kolkata' },
      schema_version: 1,
    });
  });

  it('flushes queued events every 5 s in one batch', async () => {
    const send = vi.fn().mockResolvedValue({ accepted: 3, rejected: [] });
    const t = mk(send);
    t.start();
    t.track({ type: 'ticker_viewed' });
    t.track({ type: 'brief_opened' });
    t.track({ type: 'thumbs_up' });
    await vi.advanceTimersByTimeAsync(FLUSH_MS - 1);
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(send).toHaveBeenCalledTimes(1);
    expect(sent(send, 0)).toHaveLength(3);
    expect(t.pending).toBe(0);
    t.stop();
  });

  it('splits into batches of at most 100 and flushes immediately at 100', async () => {
    const send = vi.fn().mockImplementation(async (b: unknown[]) => ({ accepted: b.length, rejected: [] }));
    const t = mk(send);
    t.start();
    for (let i = 0; i < 250; i++) t.track({ type: 'section_dwell' });
    await vi.advanceTimersByTimeAsync(0);
    // first immediate flush drains everything in <=100 chunks
    expect(send.mock.calls.length).toBeGreaterThanOrEqual(1);
    for (const c of send.mock.calls) expect((c[0] as unknown[]).length).toBeLessThanOrEqual(MAX_BATCH);
    await t.flush();
    const total = send.mock.calls.reduce((n, c) => n + (c[0] as unknown[]).length, 0);
    expect(total).toBe(250);
    expect(t.pending).toBe(0);
    t.stop();
  });

  it('keeps events queued while offline and sends them when back online', async () => {
    let online = false;
    const send = vi.fn().mockResolvedValue({ accepted: 1, rejected: [] });
    const t = mk(send, { isOnline: () => online });
    t.track({ type: 'ticker_viewed' });
    expect(await t.flush()).toBe(0);
    expect(send).not.toHaveBeenCalled();
    online = true;
    expect(await t.flush()).toBe(1);
    expect(t.pending).toBe(0);
  });

  it('keeps the batch on network/5xx/401/429 failures and retries later', async () => {
    for (const status of [0, 503, 401, 429]) {
      const send = vi.fn().mockRejectedValueOnce({ status }).mockResolvedValue({ accepted: 1, rejected: [] });
      const t = mk(send);
      t.track({ type: 'ticker_viewed' });
      await t.flush();
      expect(t.pending, `status ${status}`).toBe(1);
      await t.flush();
      expect(t.pending).toBe(0);
    }
  });

  it('drops a poison batch on 4xx validation errors so it cannot block newer events', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce({ status: 422 })
      .mockResolvedValue({ accepted: 1, rejected: [] });
    const t = mk(send);
    t.track({ type: 'ticker_viewed' });
    await t.flush();
    expect(t.pending).toBe(0);
  });

  it('caps the in-memory offline queue by dropping the oldest events', () => {
    const t = mk(vi.fn());
    for (let i = 0; i < MAX_QUEUE + 25; i++) t.track({ type: 'section_dwell', props: { delta: i } });
    expect(t.pending).toBe(MAX_QUEUE);
  });

  it('does not run concurrent flushes', async () => {
    let release: (v: unknown) => void = () => {};
    const send = vi.fn().mockImplementation(() => new Promise(r => (release = r)));
    const t = mk(send);
    t.track({ type: 'ticker_viewed' });
    const a = t.flush();
    const b = t.flush();
    expect(await b).toBe(0);
    release({ accepted: 1, rejected: [] });
    expect(await a).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('hands queued events to the unload transport on page hide', () => {
    const unload = vi.fn(() => true);
    const t = mk(vi.fn(), {});
    // rebuild with our own unload spy
    const t2 = new Tracker({ transport: { send: vi.fn(), unload }, sessionId: 's', isOnline: () => true });
    t2.track({ type: 'ticker_viewed' });
    t2.track({ type: 'brief_opened' });
    t2.flushOnUnload();
    expect(unload).toHaveBeenCalledTimes(1);
    expect((unload.mock.calls[0] as unknown as [unknown[]])[0]).toHaveLength(2);
    expect(t2.pending).toBe(0);
    expect(t.pending).toBe(0);
  });

  it('classifies device by width', () => {
    expect(deviceClass(390)).toBe('mobile');
    expect(deviceClass(800)).toBe('tablet');
    expect(deviceClass(1440)).toBe('desktop');
  });
});

describe('DwellTimer', () => {
  it('accumulates only while resumed', () => {
    let now = 0;
    const d = new DwellTimer({ now: () => now });
    d.resume();
    now = 1500;
    d.pause();
    now = 9000; // hidden time is not counted
    d.resume();
    now = 9500;
    expect(d.elapsed).toBe(2000);
    expect(d.finish()).toBe(2000);
  });
});
