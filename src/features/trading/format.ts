/** Display formatting only. Figures themselves come from the API; nothing here derives a financial number. */
const NF0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const NF2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUM = new Intl.NumberFormat('en-US');

export const DASH = '—';

const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export const usd0 = (n: unknown): string => (ok(n) ? NF0.format(n) : DASH);
export const usd2 = (n: unknown): string => (ok(n) ? NF2.format(n) : DASH);
export const int = (n: unknown): string => (ok(n) ? NUM.format(n) : DASH);

/** +1.23% / -0.40% (percent numbers: 6.8 means 6.8%). */
export const pct = (n: unknown, dp = 2): string => {
  if (!ok(n)) return DASH;
  const s = n.toFixed(dp);
  return `${n > 0 ? '+' : ''}${s}%`;
};

export const signedUsd0 = (n: unknown): string => {
  if (!ok(n)) return DASH;
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${NF0.format(Math.abs(n))}`;
};

export const signedUsd2 = (n: unknown): string => {
  if (!ok(n)) return DASH;
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${NF2.format(Math.abs(n))}`;
};

export const toneVar = (n: number | null | undefined): string =>
  ok(n) && n < 0 ? 'var(--loss)' : 'var(--gain)';

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Today" or "Oct 29". */
export function shortDate(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  if (sameDay(d, now)) return 'Today';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function clockTime(iso: string | number | null | undefined, seconds = false): string {
  if (iso == null) return DASH;
  const d = typeof iso === 'number' ? new Date(iso * 1000) : new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: seconds ? '2-digit' : undefined,
    hour12: false,
  });
}

/** "5 min ago", "3 h ago", "2 d ago". */
export function ago(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return DASH;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return DASH;
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export const shortId = (id: string): string => (id.length > 10 ? id.slice(0, 8) : id);

export const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};
