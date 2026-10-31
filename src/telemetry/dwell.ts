/**
 * Pure dwell timer: accumulates the time a section is "active" (mounted, tab visible, optionally in view) and
 * reports it once on stop. Separate from React so it is testable with an injected clock.
 */
export type DwellOptions = { now?: () => number };

export class DwellTimer {
  private total = 0;
  private since: number | null = null;
  private readonly now: () => number;

  constructor(opts: DwellOptions = {}) {
    this.now = opts.now ?? (() => performance.now());
  }

  /** begin counting (no-op if already counting) */
  resume(): void {
    if (this.since == null) this.since = this.now();
  }
  /** pause (tab hidden, scrolled out of view) */
  pause(): void {
    if (this.since != null) {
      this.total += this.now() - this.since;
      this.since = null;
    }
  }
  get elapsed(): number {
    return Math.round(this.total + (this.since != null ? this.now() - this.since : 0));
  }
  /** stop and return total dwell in ms */
  finish(): number {
    this.pause();
    return Math.round(this.total);
  }
}
