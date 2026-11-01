import type { OrderCheck, Proposal, RejectReason } from '@/api/types';
import type { Tone } from '@/ui';

export type Tab = 'pending' | 'history';

export const REJECT_REASONS: ReadonlyArray<{ value: RejectReason; label: string }> = [
  { value: 'too_risky', label: 'Too risky' },
  { value: 'disagree', label: 'Disagree with thesis' },
  { value: 'timing', label: 'Timing' },
  { value: 'already_know', label: 'Already know' },
];

/** Short display id (the API id is a UUID). */
export const shortId = (id: string): string => `P-${id.replace(/-/g, '').slice(0, 4).toUpperCase()}`;

export const isExpired = (p: Proposal, now: number = Date.now()): boolean =>
  p.status === 'pending' && Date.parse(p.expires_at) <= now;

/** open for a decision: pending and not past its expiry */
export const isOpen = (p: Proposal, now: number = Date.now()): boolean =>
  p.status === 'pending' && !isExpired(p, now);

/** A pending trade whose rule is already satisfied (suggested size 0): the design's "Resolved" state. */
export const isResolved = (p: Proposal): boolean =>
  p.kind === 'trade' && p.status === 'pending' && p.suggested_qty === 0;

export const inTab = (p: Proposal, tab: Tab): boolean =>
  tab === 'pending' ? p.status === 'pending' && !isExpired(p) : !(p.status === 'pending' && !isExpired(p));

export type StatusChip = { word: string; tone: Tone };
export function statusChip(p: Proposal, now: number = Date.now()): StatusChip {
  if (isExpired(p, now) || p.status === 'expired') return { word: 'Expired', tone: 'n' };
  if (isResolved(p)) return { word: 'Resolved', tone: 'ok' };
  switch (p.status) {
    case 'pending':
      return { word: 'Pending', tone: 'info' };
    case 'approved':
      return { word: 'Approved', tone: 'ok' };
    case 'modified':
      return { word: 'Modified', tone: 'ok' };
    case 'rejected':
      return { word: 'Rejected', tone: 'n' };
    case 'reviewed':
      return { word: 'Reviewed', tone: 'ok' };
    default:
      return { word: p.status.charAt(0).toUpperCase() + p.status.slice(1), tone: 'n' };
  }
}

export const sideWord = (p: Pick<Proposal, 'side'>): string => (p.side === 'buy' ? 'Buy' : 'Sell');

export function subline(p: Proposal): string {
  if (p.kind === 'trade')
    return `${sideWord(p)} ${p.suggested_qty || ''} ${p.symbol ?? ''}`.replace(/\s+/g, ' ').trim();
  return p.symbol ? `Review · ${p.symbol}` : 'Review prompt';
}

/** Closing sentence for a decided proposal when there is no fresher response text. */
export function decidedText(p: Proposal): string {
  switch (p.status) {
    case 'approved':
      return p.kind === 'trade'
        ? `Approved. ${sideWord(p) === 'Buy' ? 'Bought' : 'Sold'} ${p.suggested_qty} ${p.symbol ?? ''} in the paper simulator.`.replace(
            /\s+/g,
            ' ',
          )
        : 'Marked as reviewed.';
    case 'modified':
      return 'Modified and approved. Executed in the paper simulator.';
    case 'rejected':
      return 'Rejected. Proposal-type items now rank lower for you.';
    case 'reviewed':
      return 'Marked as reviewed.';
    case 'expired':
      return 'Expired. No decision was made in time. A new proposal is created if the rule is still breached.';
    default:
      return '';
  }
}

export type CheckRow = { key: string; mark: 'Pass' | 'Note' | 'Blocked'; label: string; detail: string };

export const fromOrderChecks = (checks: OrderCheck[]): CheckRow[] =>
  checks.map(c => ({
    key: c.key,
    mark: c.severity === 'blocked' ? 'Blocked' : c.severity === 'note' ? 'Note' : 'Pass',
    label: c.label,
    detail: c.detail,
  }));

/** Fallback when the pre-trade preview is unavailable: the proposal's own `rules_checked`. */
export function fromRulesChecked(list: Proposal['rules_checked']): CheckRow[] {
  return (list ?? []).map((r, i) =>
    typeof r === 'string'
      ? { key: `r${i}`, mark: 'Pass' as const, label: r, detail: '' }
      : {
          key: `r${i}`,
          mark: r.passed ? ('Pass' as const) : ('Blocked' as const),
          label: r.rule,
          detail: '',
        },
  );
}

export const MARK_TONE: Record<CheckRow['mark'], Tone> = { Pass: 'ok', Note: 'warn', Blocked: 'bad' };

const num = (o: Record<string, unknown> | null | undefined, keys: string[]): number | null => {
  for (const k of keys) {
    const v = o?.[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
};
/** UNVERIFIED field names: the preview `fill` object is not pinned by CONTRACT.md. */
export const fillPrice = (fill: Record<string, unknown> | null | undefined): number | null =>
  num(fill, ['price', 'fill_price', 'avg_price', 'est_price']);
export const fillNotional = (fill: Record<string, unknown> | null | undefined): number | null =>
  num(fill, ['notional', 'proceeds', 'value', 'est_proceeds', 'amount']);

/** "Expires in 22 h" for an open proposal. */
export function expiresLabel(p: Proposal, now: number = Date.now()): string {
  const ms = Date.parse(p.expires_at) - now;
  if (Number.isNaN(ms)) return '';
  if (ms <= 0) return 'Expired';
  const m = Math.round(ms / 60000);
  return m < 60 ? `Expires in ${Math.max(1, m)} min` : `Expires in ${Math.round(m / 60)} h`;
}
