import type { Bar } from '@/api/types';

/** Candle as lightweight-charts wants it: UNIX seconds. */
export type CBar = { time: number; open: number; high: number; low: number; close: number; volume: number };

export const STEP_SEC = 300; // 5 minute bars
export const MAX_BARS = 500;

/** `/bars` time may be UNIX seconds, UNIX milliseconds or an ISO string. */
export function toSeconds(t: number | string): number | null {
  if (typeof t === 'number')
    return Number.isFinite(t) ? (t > 1e11 ? Math.floor(t / 1000) : Math.floor(t)) : null;
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

/** Sorted ascending, de-duplicated by time, invalid rows dropped. */
export function normalizeBars(bars: Bar[] | undefined): CBar[] {
  const out = new Map<number, CBar>();
  for (const b of bars ?? []) {
    const time = toSeconds(b.time);
    if (time == null || ![b.open, b.high, b.low, b.close].every(Number.isFinite)) continue;
    out.set(time, { time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume ?? 0 });
  }
  return [...out.values()].sort((a, b) => a.time - b.time);
}

/** Folds one live tick into the 5 m series (pure; returns a new array when something changed). */
export function applyTick(bars: CBar[], price: number, tsSec: number, step = STEP_SEC): CBar[] {
  if (!Number.isFinite(price) || !Number.isFinite(tsSec)) return bars;
  const bucket = Math.floor(tsSec / step) * step;
  const last = bars[bars.length - 1];
  if (!last) return [{ time: bucket, open: price, high: price, low: price, close: price, volume: 0 }];
  if (bucket < last.time) return bars; // late tick for a closed bar: ignore
  if (bucket === last.time) {
    if (price === last.close && price <= last.high && price >= last.low) return bars;
    const next: CBar = {
      ...last,
      high: Math.max(last.high, price),
      low: Math.min(last.low, price),
      close: price,
    };
    return [...bars.slice(0, -1), next];
  }
  const fresh: CBar = {
    time: bucket,
    open: last.close,
    high: Math.max(last.close, price),
    low: Math.min(last.close, price),
    close: price,
    volume: 0,
  };
  const next = [...bars, fresh];
  return next.length > MAX_BARS ? next.slice(next.length - MAX_BARS) : next;
}

/** Chart palette: lightweight-charts cannot parse OKLCH, so these are the design's sRGB values (`lcc`). */
export const chartColors = (theme: 'light' | 'dark') =>
  theme === 'light'
    ? { bg: '#fcfcf8', text: '#5b6470', grid: '#ecebe3', up: '#1d7a5b', down: '#c0412f' }
    : { bg: '#1a1f27', text: '#aab2bd', grid: '#252c35', up: '#4fd9ac', down: '#f27766' };
