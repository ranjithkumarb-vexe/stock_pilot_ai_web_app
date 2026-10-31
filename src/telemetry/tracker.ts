import type { EventsResponse, Session, TelemetryEvent, TelemetryEventType } from '@/api/types';

/**
 * Telemetry tracker (SPEC §10.2). Events are queued in memory, flushed in batches of <= 100 every 5 s (or as soon as
 * 100 are queued) to POST /v1/events. Failures keep the batch queued (offline queue, capped); permanently rejected
 * events are dropped. On page hide a final flush uses fetch keepalive (see `unload` transport note below).
 */
export const MAX_BATCH = 100;
export const FLUSH_MS = 5000;
export const MAX_QUEUE = 1000;
export const SCHEMA_VERSION = 1;

export type TrackInput = {
  type: TelemetryEventType;
  entity?: TelemetryEvent['entity'];
  props?: TelemetryEvent['props'];
};

export type Transport = {
  /** normal batch send. Throw an error with numeric `status` (0 = network) on failure. */
  send: (events: TelemetryEvent[]) => Promise<EventsResponse | undefined>;
  /**
   * Best-effort send while the page is going away. Default wiring uses fetch({keepalive:true}) because
   * navigator.sendBeacon cannot carry the Authorization header the API requires (CR-FE-3 asks the backend for a
   * beacon-friendly variant). Returns true when handed to the browser.
   */
  unload?: (events: TelemetryEvent[]) => boolean;
};

export type TrackerDeps = {
  transport: Transport;
  sessionId: string;
  isOnline?: () => boolean;
  now?: () => Date;
  uuid?: () => string;
  context?: () => TelemetryEvent['context'];
  device?: () => TelemetryEvent['client']['device'];
  tz?: () => string;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (h: unknown) => void;
};

const failedStatus = (e: unknown): number =>
  e && typeof e === 'object' && 'status' in e ? Number((e as { status: unknown }).status) : 0;
/** retry later: network, 5xx, 401 (re-login), 429. Everything else (400/422…) is poison and dropped. */
const retryable = (status: number) => status === 0 || status >= 500 || status === 401 || status === 429;

export class Tracker {
  private queue: TelemetryEvent[] = [];
  private timer: unknown = null;
  private flushing = false;
  private enabled = false;

  constructor(private readonly d: TrackerDeps) {}

  get pending(): number {
    return this.queue.length;
  }

  /** Begin periodic flushing. Idempotent. */
  start(): void {
    this.enabled = true;
    if (this.timer != null) return;
    this.timer = (this.d.setInterval ?? ((f, m) => setInterval(f, m)))(() => void this.flush(), FLUSH_MS);
  }

  /** Stop the timer and drop nothing (a later start() resumes). Call `clear()` on sign-out. */
  stop(): void {
    this.enabled = false;
    if (this.timer != null)
      (this.d.clearInterval ?? ((h: unknown) => clearInterval(h as ReturnType<typeof setInterval>)))(
        this.timer,
      );
    this.timer = null;
  }

  clear(): void {
    this.queue = [];
  }

  track(input: TrackInput): TelemetryEvent {
    const ev: TelemetryEvent = {
      event_id: (this.d.uuid ?? (() => crypto.randomUUID()))(),
      ts: (this.d.now ?? (() => new Date()))().toISOString(),
      session_id: this.d.sessionId,
      type: input.type,
      entity: input.entity ?? {},
      props: input.props ?? {},
      context: this.d.context?.() ?? {},
      client: {
        device: this.d.device?.() ?? 'desktop',
        tz: this.d.tz?.() ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      schema_version: SCHEMA_VERSION,
    };
    this.queue.push(ev);
    if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE); // drop oldest
    if (this.enabled && this.queue.length >= MAX_BATCH) void this.flush();
    return ev;
  }

  /** Send queued events in <= 100 batches. Returns number accepted. Safe to call concurrently. */
  async flush(): Promise<number> {
    if (this.flushing || this.queue.length === 0) return 0;
    if (this.d.isOnline && !this.d.isOnline()) return 0; // offline queue: wait
    this.flushing = true;
    let accepted = 0;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.slice(0, MAX_BATCH);
        try {
          const res = await this.d.transport.send(batch);
          this.queue.splice(0, batch.length);
          accepted += res?.accepted ?? batch.length;
        } catch (e) {
          if (retryable(failedStatus(e))) break; // keep the batch queued for the next tick
          this.queue.splice(0, batch.length); // poison batch: drop so it cannot block newer events
        }
      }
    } finally {
      this.flushing = false;
    }
    return accepted;
  }

  /** Page hide / unload: hand the first batches to the browser synchronously. */
  flushOnUnload(): void {
    const { unload } = this.d.transport;
    if (!unload) return;
    while (this.queue.length > 0) {
      const batch = this.queue.slice(0, MAX_BATCH);
      if (!unload(batch)) break;
      this.queue.splice(0, batch.length);
    }
  }
}

/** Per-tab session id (sessionStorage), falling back to a fresh uuid when storage is blocked. */
export function getSessionId(): string {
  try {
    let id = sessionStorage.getItem('sp-tsid');
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('sp-tsid', id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export const deviceClass = (width: number): 'desktop' | 'tablet' | 'mobile' =>
  width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';

export type { Session };
