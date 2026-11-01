import type { AlertType, FeedItem, RuleStatus } from '@/api/types';
import type { Tone } from '@/ui';

/** Feed card labels and edge colours (design `G` + the edge map). */
export const ALERT_META: Record<AlertType, { label: string; tone: Tone; edge: string }> = {
  breach: { label: 'Rule breach', tone: 'bad', edge: 'var(--loss)' },
  concentration: { label: 'Concentration', tone: 'warn', edge: 'var(--warn)' },
  filing: { label: '8-K filing', tone: 'info', edge: 'var(--info)' },
  move: { label: 'Unusual move', tone: 'warn', edge: 'var(--warn)' },
  earnings: { label: 'Earnings', tone: 'n', edge: 'var(--ink-3)' },
  mirror: { label: 'Behaviour mirror', tone: 'warn', edge: 'var(--warn)' },
};
export const KIND_META: Record<
  Exclude<FeedItem['kind'], 'alert'>,
  { label: string; tone: Tone; edge: string }
> = {
  proposal: { label: 'Proposal', tone: 'acc', edge: 'var(--accent)' },
  briefing: { label: 'Daily briefing', tone: 'n', edge: 'var(--accent)' },
};

/** Rule keys from GET /portfolio/risk (CONTRACT: pos, sec, dd, trades, cash) → design labels and units. */
export const RULE_META: Record<string, { label: string; unit: string }> = {
  pos: { label: 'Max position', unit: '%' },
  sec: { label: 'Max sector', unit: '%' },
  dd: { label: 'Drawdown', unit: '%' },
  trades: { label: 'Trades this week', unit: '' },
  cash: { label: 'Min cash buffer', unit: '%' },
};
export const ruleMeta = (key: string) => RULE_META[key] ?? { label: key, unit: '' };

export const RULE_STATUS: Record<RuleStatus, { label: string; tone: Tone }> = {
  ok: { label: 'Within', tone: 'ok' },
  warn: { label: 'Near limit', tone: 'warn' },
  breach: { label: 'Breached', tone: 'bad' },
};
export const ruleStatus = (s: string) => RULE_STATUS[s as RuleStatus] ?? { label: s, tone: 'n' as Tone };

export const BASIS_LABEL: Record<string, string> = {
  profile: 'Based on your profile',
  behaviour: 'Based on how you use the app',
  cold_start: 'Based on your setup (not enough activity yet)',
};
