/** Display formatting only. Every figure shown on the dashboard is computed by the backend. */
export const usd0 = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n)
    ? '—'
    : `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;

export const usd2 = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n)
    ? '—'
    : `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Percent numbers from the API (6.8 = 6.8%) with an explicit sign for gains, as in the design's `pc`. */
export const pct = (n: number | null | undefined, digits = 1): string =>
  n == null || !Number.isFinite(n) ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`;

/** unsigned percent, e.g. a weight */
export const pctPlain = (n: number | null | undefined, digits = 1): string =>
  n == null || !Number.isFinite(n) ? '—' : `${n.toFixed(digits)}%`;

/** colour token for a signed number */
export const signColor = (n: number | null | undefined): string =>
  n == null || n >= 0 ? 'var(--gain)' : 'var(--loss)';

/** "5m ago", "3h ago", "2d ago", or a short date for older items. */
export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return 'Just now';
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  if (s < 7 * 86_400) return `${Math.round(s / 86_400)}d ago`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const clockTime = (iso: string): string => {
  const t = Date.parse(iso);
  return Number.isNaN(t)
    ? ''
    : new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const firstName = (displayName: string | null | undefined): string =>
  (displayName ?? '').trim().split(/\s+/)[0] ?? '';

export function dayPart(d: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = d.getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}

/** 15 → "15", 17.24 → "17.2" */
export const num1 = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));
