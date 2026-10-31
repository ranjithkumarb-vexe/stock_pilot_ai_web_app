import type { StreamEvent } from '@/api/types';

/**
 * Reconnecting SSE client as a small, fully injectable state machine (no React, no globals) so the backoff and
 * transitions are unit-testable with fake timers.
 *
 * States exposed to the UI: `connected` | `reconnecting` | `offline`.
 *   start()                 -> reconnecting (or offline when the browser is offline)
 *   EventSource open        -> connected, backoff reset
 *   error / silence > 45 s  -> reconnecting, exponential backoff with jitter (1 s .. 30 s)
 *   >= OFFLINE_AFTER fails  -> offline (keeps retrying at the max delay and flips back on success)
 *   browser 'offline'       -> offline;  'online' -> immediate retry
 *   token 401 / stop()      -> offline (no retry on auth failure; the 401 handler signs the user out)
 *
 * Why a new EventSource per attempt: the stream token lives 60 s, so the browser's built-in auto-reconnect would
 * re-send an expired URL. Native Last-Event-ID only works on that built-in reconnect, so for our manual reconnects
 * we also pass `last_event_id` as a query param (backend change request CR-FE-2).
 */
export type StreamState = 'connected' | 'reconnecting' | 'offline';

export interface EventSourceLike {
  readyState: number;
  close(): void;
  addEventListener(type: string, listener: (e: MessageEvent) => void): void;
  onopen: ((e: Event) => void) | null;
  onerror: ((e: Event) => void) | null;
}

export type StreamDeps = {
  /** POST /v1/stream/token → token string. Reject with an object having `status: 401` to stop retrying. */
  fetchToken: (signal: AbortSignal) => Promise<string>;
  /** absolute URL builder, e.g. (token, lastId) => `${base}/v1/stream?token=…` */
  buildUrl: (token: string, lastEventId: string | null) => string;
  createEventSource?: (url: string) => EventSourceLike;
  onEvent: (e: StreamEvent) => void;
  onState?: (s: StreamState) => void;
  isOnline?: () => boolean;
  random?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (h: unknown) => void;
  now?: () => number;
};

export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_MAX_MS = 30_000;
/** heartbeats arrive every 15 s; three missed ones = dead connection */
export const SILENCE_MS = 45_000;
export const OFFLINE_AFTER = 6;
export const STREAM_EVENT_TYPES = ['quote', 'alert', 'proposal', 'heartbeat'] as const;

/** Exponential backoff with equal jitter: half fixed + half random, capped. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const cap = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempt));
  return Math.round(cap / 2 + random() * (cap / 2));
}

const isAuthFailure = (e: unknown): boolean =>
  !!e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 401;

export class StreamClient {
  private state: StreamState = 'offline';
  private es: EventSourceLike | null = null;
  private attempt = 0;
  private lastEventId: string | null = null;
  private running = false;
  private retryTimer: unknown = null;
  private watchdog: unknown = null;
  private abort: AbortController | null = null;
  private generation = 0;

  constructor(private readonly deps: StreamDeps) {}

  get current(): StreamState {
    return this.state;
  }
  get lastId(): string | null {
    return this.lastEventId;
  }
  get failures(): number {
    return this.attempt;
  }

  private setTimer = (fn: () => void, ms: number) =>
    (this.deps.setTimer ?? ((f, m) => setTimeout(f, m)))(fn, ms);
  private clearTimer = (h: unknown) =>
    (this.deps.clearTimer ?? ((x: unknown) => clearTimeout(x as ReturnType<typeof setTimeout>)))(h);
  private online = () =>
    this.deps.isOnline
      ? this.deps.isOnline()
      : typeof navigator === 'undefined' || navigator.onLine !== false;

  private set(s: StreamState) {
    if (s === this.state) return;
    this.state = s;
    this.deps.onState?.(s);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.attempt = 0;
    if (!this.online()) {
      this.set('offline');
      return;
    }
    this.set('reconnecting');
    void this.connect();
  }

  stop(): void {
    this.running = false;
    this.generation++;
    this.teardown();
    this.set('offline');
  }

  /** Browser went offline: drop the connection without counting it as a failure. */
  handleOffline(): void {
    if (!this.running) return;
    this.generation++;
    this.teardown();
    this.set('offline');
  }

  /** Browser came back (or the user pressed "Reconnect now"): retry immediately. */
  handleOnline(): void {
    if (!this.running) return;
    this.generation++;
    this.teardown();
    this.attempt = 0;
    this.set('reconnecting');
    void this.connect();
  }

  private teardown() {
    if (this.retryTimer != null) this.clearTimer(this.retryTimer);
    if (this.watchdog != null) this.clearTimer(this.watchdog);
    this.retryTimer = this.watchdog = null;
    this.abort?.abort();
    this.abort = null;
    if (this.es) {
      this.es.onopen = null;
      this.es.onerror = null;
      this.es.close();
      this.es = null;
    }
  }

  private armWatchdog(gen: number) {
    if (this.watchdog != null) this.clearTimer(this.watchdog);
    this.watchdog = this.setTimer(() => {
      if (gen !== this.generation) return;
      this.fail(gen);
    }, SILENCE_MS);
  }

  private async connect(): Promise<void> {
    const gen = ++this.generation;
    this.abort = new AbortController();
    let token: string;
    try {
      token = await this.deps.fetchToken(this.abort.signal);
    } catch (e) {
      if (gen !== this.generation) return;
      if (isAuthFailure(e)) {
        this.running = false;
        this.teardown();
        this.set('offline');
        return;
      }
      this.fail(gen);
      return;
    }
    if (gen !== this.generation || !this.running) return;

    const make =
      this.deps.createEventSource ?? ((u: string) => new EventSource(u) as unknown as EventSourceLike);
    let es: EventSourceLike;
    try {
      es = make(this.deps.buildUrl(token, this.lastEventId));
    } catch {
      this.fail(gen); // EventSource unavailable or URL rejected: count it as a failed attempt
      return;
    }
    this.es = es;
    es.onopen = () => {
      if (gen !== this.generation) return;
      this.attempt = 0;
      this.set('connected');
      this.armWatchdog(gen);
    };
    es.onerror = () => {
      if (gen !== this.generation) return;
      this.fail(gen);
    };
    for (const type of STREAM_EVENT_TYPES) {
      es.addEventListener(type, (m: MessageEvent) => {
        if (gen !== this.generation) return;
        this.armWatchdog(gen);
        if (m.lastEventId) this.lastEventId = m.lastEventId;
        let data: unknown = {};
        try {
          data = m.data ? JSON.parse(m.data as string) : {};
        } catch {
          return; // ignore malformed frames
        }
        this.deps.onEvent({ type, id: m.lastEventId || null, data } as StreamEvent);
      });
    }
  }

  /** One failed attempt or a dropped connection → schedule the next try. */
  private fail(gen: number) {
    if (gen !== this.generation || !this.running) return;
    this.teardown();
    this.attempt += 1;
    this.set(!this.online() || this.attempt >= OFFLINE_AFTER ? 'offline' : 'reconnecting');
    if (!this.online()) return; // wait for the 'online' event instead of polling
    const delay = backoffDelay(this.attempt - 1, this.deps.random);
    const myGen = ++this.generation;
    this.retryTimer = this.setTimer(() => {
      if (myGen !== this.generation || !this.running) return;
      this.retryTimer = null;
      this.set(this.attempt >= OFFLINE_AFTER ? 'offline' : 'reconnecting');
      void this.connect();
    }, delay);
  }
}
