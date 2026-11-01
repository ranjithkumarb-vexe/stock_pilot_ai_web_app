/** Presentation-only formatters shared by Portfolio, Proposals and Brief (design `$0`, `$2`, `pc`). No figure is computed here. */

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const money0 = (n: number | null | undefined): string => (n == null ? '–' : usd0.format(n));
export const money2 = (n: number | null | undefined): string => (n == null ? '–' : usd2.format(n));
/** `+1.2%` / `-0.4%` / `0.0%` */
export const signedPct = (n: number | null | undefined, digits = 1): string =>
  n == null ? '–' : `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`;
export const pct = (n: number | null | undefined, digits = 1): string =>
  n == null ? '–' : `${n.toFixed(digits)}%`;
/** `+$1,234` / `-$56` */
export const signedMoney0 = (n: number | null | undefined): string =>
  n == null ? '–' : `${n >= 0 ? '+' : '-'}${usd0.format(Math.abs(n))}`;

/** Weight against a cap: the bar scale is 1.6 x cap so the ink tick sits at 62.5% (design `bar`). */
export const barWidth = (value: number, cap: number): number =>
  Math.max(0, Math.min(100, cap > 0 ? (value / (cap * 1.6)) * 100 : 0));

export type CapState = 'above' | 'near' | 'within';
/** design `bcs`/status thresholds: above the cap, within 85%..100% ("near"), else within. */
export const capState = (value: number, cap: number): CapState => {
  const r = cap > 0 ? value / cap : 0;
  return r > 1 ? 'above' : r >= 0.85 ? 'near' : 'within';
};
export const CAP_BAR_COLOR: Record<CapState, string> = {
  above: 'var(--loss)',
  near: 'var(--warn)',
  within: 'var(--accent)',
};

/** "5 min ago", "2 h ago", "3 d ago". */
export function ago(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** "expires in 22 h" / "expires in 35 min" / "expired". */
export function expiresIn(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const ms = t - now;
  if (ms <= 0) return 'expired';
  const m = Math.round(ms / 60000);
  if (m < 60) return `expires in ${Math.max(1, m)} min`;
  return `expires in ${Math.round(m / 60)} h`;
}

export const dateTime = (iso: string | null | undefined): string => {
  if (!iso) return '–';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '–'
    : d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

/** Only http(s) links are ever rendered as hrefs (the URL comes from the API). */
export const safeHttpUrl = (u: string | null | undefined): string | null => {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
};
