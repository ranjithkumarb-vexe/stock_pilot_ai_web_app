import {
  BACKOFF_MAX_MS,
  OFFLINE_AFTER,
  SILENCE_MS,
  StreamClient,
  backoffDelay,
  type EventSourceLike,
  type StreamState,
} from './sseClient';
import type { StreamEvent } from '@/api/types';

class FakeES implements EventSourceLike {
  static all: FakeES[] = [];
  readyState = 0;
  closed = false;
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  listeners = new Map<string, Array<(e: MessageEvent) => void>>();
  constructor(public url: string) {
    FakeES.all.push(this);
  }
  close() {
    this.closed = true;
  }
  addEventListener(t: string, fn: (e: MessageEvent) => void) {
    this.listeners.set(t, [...(this.listeners.get(t) ?? []), fn]);
  }
  open() {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }
  error() {
    this.onerror?.(new Event('error'));
  }
  emit(type: string, data: unknown, id = '') {
    this.listeners
      .get(type)
      ?.forEach(fn => fn({ data: JSON.stringify(data), lastEventId: id } as MessageEvent));
  }
}

const setup = (over: Partial<ConstructorParameters<typeof StreamClient>[0]> = {}) => {
  FakeES.all = [];
  const states: StreamState[] = [];
  const events: StreamEvent[] = [];
  let tokenN = 0;
  const client = new StreamClient({
    fetchToken: async () => `tok-${++tokenN}`,
    buildUrl: (t, id) => `http://x/v1/stream?token=${t}${id ? `&last_event_id=${id}` : ''}`,
    createEventSource: u => new FakeES(u),
    onEvent: e => events.push(e),
    onState: s => states.push(s),
    isOnline: () => true,
    random: () => 0.5,
    ...over,
  });
  return { client, states, events, es: () => FakeES.all[FakeES.all.length - 1] as FakeES };
};
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('SSE reconnect state machine', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('offline → reconnecting → connected on open, using a fresh token in the URL', async () => {
    const { client, states, es } = setup();
    expect(client.current).toBe('offline');
    client.start();
    expect(client.current).toBe('reconnecting');
    await flush();
    expect(es().url).toBe('http://x/v1/stream?token=tok-1');
    es().open();
    expect(client.current).toBe('connected');
    expect(states).toEqual(['reconnecting', 'connected']);
  });

  it('dispatches typed events and remembers the last event id for resume', async () => {
    const { client, events, es } = setup();
    client.start();
    await flush();
    es().open();
    es().emit('quote', { symbol: 'AAPL', price: 1 }, '41');
    es().emit('heartbeat', { ts: 'now' }, '42');
    es().emit('alert', { id: 'a' }, '43');
    expect(events.map(e => e.type)).toEqual(['quote', 'heartbeat', 'alert']);
    expect(client.lastId).toBe('43');
    // drop → reconnect carries last_event_id
    es().error();
    expect(client.current).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(2000);
    expect(es().url).toContain('last_event_id=43');
    expect(es().url).toContain('token=tok-2');
  });

  it('ignores malformed frames', async () => {
    const { client, events, es } = setup();
    client.start();
    await flush();
    es().open();
    es()
      .listeners.get('quote')
      ?.forEach(fn => fn({ data: '{bad', lastEventId: '' } as MessageEvent));
    expect(events).toHaveLength(0);
  });

  it('backs off exponentially with jitter and resets after a successful open', async () => {
    const { client, es } = setup({ random: () => 0 }); // equal-jitter floor = cap/2
    client.start();
    await flush();
    es().error(); // fail 1 → wait 500 (cap 1000)
    expect(client.failures).toBe(1);
    await vi.advanceTimersByTimeAsync(499);
    expect(FakeES.all).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2);
    expect(FakeES.all).toHaveLength(2);
    es().error(); // fail 2 → wait 1000 (cap 2000)
    await vi.advanceTimersByTimeAsync(999);
    expect(FakeES.all).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2);
    expect(FakeES.all).toHaveLength(3);
    es().open();
    expect(client.failures).toBe(0);
    expect(client.current).toBe('connected');
  });

  it('flips to offline after repeated failures, keeps retrying, and recovers to connected', async () => {
    const { client, es } = setup({ random: () => 0 });
    client.start();
    await flush();
    for (let i = 0; i < OFFLINE_AFTER; i++) {
      es().error();
      await vi.advanceTimersByTimeAsync(BACKOFF_MAX_MS);
    }
    expect(client.current).toBe('offline');
    expect(FakeES.all.length).toBeGreaterThan(OFFLINE_AFTER);
    es().open();
    expect(client.current).toBe('connected');
  });

  it('browser offline/online events', async () => {
    const { client, states, es } = setup();
    client.start();
    await flush();
    es().open();
    const first = es();
    client.handleOffline();
    expect(client.current).toBe('offline');
    expect(first.closed).toBe(true);
    client.handleOnline();
    expect(client.current).toBe('reconnecting');
    await flush();
    es().open();
    expect(states).toEqual(['reconnecting', 'connected', 'offline', 'reconnecting', 'connected']);
  });

  it('starts offline (no connection attempt) when the browser is offline', async () => {
    const { client } = setup({ isOnline: () => false });
    client.start();
    await flush();
    expect(client.current).toBe('offline');
    expect(FakeES.all).toHaveLength(0);
  });

  it('treats a silent connection (no heartbeat for 45 s) as dropped', async () => {
    const { client, es } = setup({ random: () => 0 });
    client.start();
    await flush();
    es().open();
    es().emit('heartbeat', {}, '1');
    await vi.advanceTimersByTimeAsync(SILENCE_MS - 1000);
    expect(client.current).toBe('connected');
    await vi.advanceTimersByTimeAsync(1500);
    expect(client.current).toBe('reconnecting');
  });

  it('a 401 from the token endpoint stops retrying (the 401 handler signs out)', async () => {
    const { client } = setup({ fetchToken: async () => Promise.reject({ status: 401 }) });
    client.start();
    await flush();
    expect(client.current).toBe('offline');
    await vi.advanceTimersByTimeAsync(BACKOFF_MAX_MS * 2);
    expect(FakeES.all).toHaveLength(0);
  });

  it('a transient token failure is retried with backoff', async () => {
    let n = 0;
    const { client, es } = setup({
      random: () => 0,
      fetchToken: async () => (n++ === 0 ? Promise.reject({ status: 503 }) : 'tok-ok'),
    });
    client.start();
    await flush();
    expect(client.current).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(600);
    expect(es().url).toContain('tok-ok');
  });

  it('stop() closes the stream and prevents further reconnects', async () => {
    const { client, es } = setup();
    client.start();
    await flush();
    es().open();
    const cur = es();
    client.stop();
    expect(cur.closed).toBe(true);
    expect(client.current).toBe('offline');
    await vi.advanceTimersByTimeAsync(BACKOFF_MAX_MS);
    expect(FakeES.all).toHaveLength(1);
  });
});

describe('backoffDelay', () => {
  it('doubles up to the cap and stays within [cap/2, cap]', () => {
    expect(backoffDelay(0, () => 0)).toBe(500);
    expect(backoffDelay(0, () => 1)).toBe(1000);
    expect(backoffDelay(3, () => 1)).toBe(8000);
    expect(backoffDelay(20, () => 1)).toBe(BACKOFF_MAX_MS);
    expect(backoffDelay(20, () => 0)).toBe(BACKOFF_MAX_MS / 2);
  });
});
