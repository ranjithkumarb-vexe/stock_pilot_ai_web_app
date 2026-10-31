/**
 * API types. Session/me/stream-token/dev-login come from the generated schema (`npm run gen:api` →
 * src/api/schema.d.ts). Everything else is HAND-WRITTEN from docs/workflow/CONTRACT.md because the backend's
 * OpenAPI only covered /healthz, /readyz and the auth/me/account/stream-token endpoints when FE-02 landed. As the
 * backend publishes more endpoints, migrate each type to `components['schemas'][...]` and keep the exported names
 * so hooks and screens do not change.
 *
 * Fields marked UNVERIFIED are not pinned by CONTRACT.md and need a backend confirmation (see HANDOFF change requests).
 * Conventions: snake_case keys, ISO-8601 UTC timestamps, percentages are percent numbers (6.8 = 6.8%).
 */

import type { components } from './schema';

export type ISODateTime = string;
export type Uuid = string;

/* ---------------- errors ---------------- */
export const SERVER_ERROR_CODES = [
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'validation_error',
  'rate_limited',
  'rule_violation',
  'stale_quote',
  'market_closed',
  'insufficient_cash',
  'insufficient_shares',
  'unsupported_symbol',
  'guardrail_blocked',
  'upstream_unavailable',
  'internal',
] as const;
export type ServerErrorCode = (typeof SERVER_ERROR_CODES)[number];
/** Codes the client synthesises when there is no (valid) server body. */
export type ClientErrorCode = 'network_error' | 'timeout' | 'bad_response';
export type ErrorCode = ServerErrorCode | ClientErrorCode;

export type ApiErrorBody = {
  code: string;
  message: string;
  trace_id?: string;
  details?: Record<string, unknown> | null;
};

export type RuleViolation = {
  rule?: string;
  key?: string;
  message?: string;
  limit?: number;
  current?: number;
  [k: string]: unknown;
};

/* ---------------- session / me ---------------- */
export type PersonaId = 'priya' | 'alex' | 'sam' | 'new';
/** Generated from the backend OpenAPI (contracts/openapi.json) where the backend has published the endpoint. */
export type DevLoginResponse = components['schemas']['DevLoginResponse'];
export type Me = components['schemas']['MeResponse'];

/* ---------------- quotes / market ---------------- */
export type Session = 'pre' | 'regular' | 'post' | 'closed';
export type Freshness = 'live' | 'delayed' | 'stale' | 'closed';
export type Quote = {
  symbol: string;
  price: number;
  prev_close: number;
  change_pct: number;
  bid?: number | null;
  ask?: number | null;
  ts: ISODateTime;
  source: string;
  session: Session;
  freshness: Freshness;
};
export type FeedState = 'live' | 'delayed' | 'stale' | 'reconnecting';
/** UNVERIFIED shape: CONTRACT.md lists `GET /market/status` without a body. */
export type MarketStatus = { open: boolean; session: Session; feed?: FeedState; as_of?: ISODateTime };
export type Bar = {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
export type BarsResponse = { symbol: string; interval: '5m' | '1d'; bars: Bar[]; source: string };
export type StreamToken = components['schemas']['StreamTokenResponse'];

/* ---------------- universe / watchlist ---------------- */
export type UniverseItem = {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  exchange: string;
};
export type WatchlistItem = { symbol: string; name?: string; sector?: string; quote: Quote | null };

/* ---------------- onboarding / profile ---------------- */
export type OnboardingQuestions = {
  questions: Array<{ id: string; text: string; options: Array<{ label: string; score: number }> }>;
  tiers: Array<{ tier: number; label: string }>;
  horizons: string[];
  experience_levels: string[];
  sectors: string[];
};
export type RulesObject = { pos: number; sec: number; dd: number; trades: number; cash: number };
export type OnboardingBody = {
  answers: number[];
  horizon: string;
  goals: string[];
  experience: string;
  likes: string[];
  excludes: string[];
  esg_exclusions: string[];
  watchlist: string[];
  region: string;
  currency: string;
  starting_cash: number;
  disclaimer_ack: true;
};
export type OnboardingResult = {
  profile: Record<string, unknown>;
  risk_tier: number;
  tier_label: string;
  explanation: string;
  rules: RulesObject;
  watchlist: string[];
};
export type Interest = { dim: string; weight: number; baseline: number };
export type Memory = { id: Uuid; kind: string; text: string; confidence: number; source: string };
export type BiasMirror = {
  name: string;
  metric: string;
  value: number | string;
  state: 'ok' | 'watch' | 'flag';
};
export type ProfileResponse = {
  profile: Record<string, unknown>;
  style_card: Record<string, unknown>;
  rules: RulesObject;
  interests: Interest[];
  memories: Memory[];
  bias: BiasMirror[];
  stated_tier: number;
  revealed_tier: number;
  gap_days: number;
  recent_events: Array<{ id: string; ts: ISODateTime; type: string; text: string }>;
};

/* ---------------- portfolio ---------------- */
export type Position = {
  symbol: string;
  name: string;
  sector: string;
  qty: number;
  avg_cost: number;
  price: number;
  change_pct: number;
  value: number;
  weight_pct: number;
  pnl: number;
  pnl_pct: number;
};
export type Portfolio = {
  portfolio_id: Uuid;
  cash: number;
  invested: number;
  equity: number;
  day_change: number;
  day_change_pct: number;
  positions: Position[];
  sectors: Array<{ sector: string; value: number; weight_pct: number }>;
  hhi: number;
  effective_n: number;
};
export type RuleStatus = 'ok' | 'breach' | 'warn';
export type PortfolioRisk = {
  metrics: {
    hhi: number;
    effective_n: number;
    vol_60d: number;
    beta: number;
    max_drawdown_pct: number;
    drawdown_pct: number;
    trades_7d: number;
  };
  rules: Array<{ key: string; limit: number; current: number; status: RuleStatus }>;
  violations: RuleViolation[];
};
export type PortfolioPerformance = {
  series: Array<{ ts: ISODateTime; equity: number; spy_norm: number }>;
  stats: {
    ytd_pct: number;
    spy_pct: number;
    vol_pct: number;
    beta: number;
    drawdown_pct: number;
    max_drawdown_pct: number;
    turnover_pct: number;
    win_rate_pct: number;
    realized_pnl: number;
  };
};

/* ---------------- proposals ---------------- */
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'modified' | 'expired' | (string & {});
export type Why = {
  summary: string;
  top_features: Array<{ name: string; weight: number; detail: string }>;
  rules_checked: Array<{ rule: string; passed: boolean }>;
  sources: string[];
  basis: 'profile' | 'behaviour' | 'cold_start';
};
export type Proposal = {
  id: Uuid;
  kind: 'trade' | 'review';
  symbol: string | null;
  side: 'buy' | 'sell' | null;
  rule: string | null;
  title: string;
  body: string;
  rationale: string[];
  rules_checked: Array<{ rule: string; passed: boolean } | string>;
  suggested_qty: number;
  current_weight_pct: number;
  after_weight_pct: number;
  cap_pct: number;
  sources: string[];
  status: ProposalStatus;
  expires_at: ISODateTime;
  created_at: ISODateTime;
  disclaimer: string;
  why?: Why;
};
export type RejectReason = 'too_risky' | 'disagree' | 'timing' | 'already_know';
export type ProposalDecision = {
  decision: 'approve' | 'reject' | 'modify';
  reason?: RejectReason;
  qty?: number;
};

/* ---------------- orders ---------------- */
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus = 'queued' | 'working' | 'filled' | 'cancelled' | 'expired' | 'rejected';
export type OrderRequest = {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  limit_price?: number;
  proposal_id?: Uuid;
  override?: boolean;
};
export type Order = {
  id: Uuid;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  limit_price?: number | null;
  status: OrderStatus;
  source?: string;
  created_at: ISODateTime;
  [k: string]: unknown;
};
export type OrderCheck = {
  key: string;
  ok: boolean;
  severity: 'pass' | 'note' | 'blocked';
  label: string;
  detail: string;
};
export type OrderResponse = {
  order: Order | null;
  fill: Record<string, unknown> | null;
  checks: OrderCheck[];
  blocked: boolean;
};

/* ---------------- alerts / feed ---------------- */
export type AlertType = 'breach' | 'filing' | 'move' | 'earnings' | 'mirror' | 'concentration';
export type AlertState = 'new' | 'read' | 'dismissed' | 'snoozed' | (string & {});
export type Alert = {
  id: Uuid;
  type: AlertType;
  symbol: string | null;
  critical: boolean;
  materiality: number;
  title: string;
  body: string;
  source_label: string;
  state: AlertState;
  created_at: ISODateTime;
  why?: Why;
};
export type AlertAction = 'open' | 'dismiss' | 'snooze';
export type FeedItem =
  | { kind: 'alert'; id: Uuid; pinned: boolean; score: number; item: Alert; why: Why }
  | { kind: 'proposal'; id: Uuid; pinned: boolean; score: number; item: Proposal; why: Why }
  | { kind: 'briefing'; id: Uuid; pinned: boolean; score: number; item: Record<string, unknown>; why: Why };

/* ---------------- briefs ---------------- */
export type BriefSection = {
  key: 'trend' | 'bal' | 'val' | 'moat' | 'risk' | 'cat' | 'bb' | (string & {});
  title: string;
  source_label: string;
  claims: Array<{ text: string; citation_ids: Uuid[]; ledger_refs: string[] }>;
  rows: Array<{ label: string; value: string; source: string }>;
  plain_hint: string | null;
};
export type Brief = {
  id: Uuid;
  symbol: string;
  name: string;
  as_of: ISODateTime;
  generated_at: ISODateTime;
  status: 'ok' | 'degraded';
  stale: boolean;
  stale_reason: string | null;
  style_card: Record<string, unknown>;
  section_order: string[];
  sections: BriefSection[];
  bull: { text: string; citation_ids: Uuid[] };
  bear: { text: string; citation_ids: Uuid[] };
  ledger: Record<
    string,
    { label: string; value: number | string; display: string; unit: string; source: string }
  >;
  citations_summary: { coverage_pct: number; unverified_numbers: number };
  disclaimer: string;
  trace_id: string;
};
export type Citation = {
  id: Uuid;
  kind: 'chunk' | 'xbrl' | 'price';
  title: string;
  company: string;
  doc_label: string;
  accession_no: string;
  filed_at: ISODateTime | null;
  fetched_at: ISODateTime;
  sha256: string;
  url: string;
  excerpt: string;
  rows: Array<{ label: string; value: string; source: string }>;
};

/* ---------------- chat ---------------- */
export type ChatRequest = { message: string; thread_id?: Uuid };
export type ChatResponse = {
  id: Uuid;
  thread_id: Uuid;
  answer: string;
  citations: unknown[];
  refused: boolean;
  refusal_reason: string | null;
  trace_id: string;
};
/** UNVERIFIED: CONTRACT.md names `GET /chat/history` without a shape. */
export type ChatHistory = {
  items: Array<{
    id: Uuid;
    thread_id: Uuid;
    role: 'user' | 'assistant';
    text: string;
    created_at: ISODateTime;
    refused?: boolean;
  }>;
};

/* ---------------- audit ---------------- */
export type AuditTrace = {
  id: string;
  name: string;
  model: string;
  mode: string;
  duration_ms: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  outcome: 'ok' | 'blocked' | 'error';
  steps: Array<{ name: string; ms: number; outcome: string; detail: string }>;
};
export type EvalsLatest = {
  generated_at: ISODateTime;
  thresholds_met: boolean;
  items: Array<{
    id: string;
    description: string;
    target: number | string;
    actual: number | string;
    status: 'pass' | 'fail';
  }>;
};

/* ---------------- events (telemetry, SPEC §10.2) ---------------- */
export type TelemetryEventType =
  | 'ticker_viewed'
  | 'brief_opened'
  | 'section_expanded'
  | 'section_dwell'
  | 'metric_clicked'
  | 'glossary_clicked'
  | 'chat_query'
  | 'alert_opened'
  | 'alert_dismissed'
  | 'alert_snoozed'
  | 'proposal_approved'
  | 'proposal_rejected'
  | 'proposal_modified'
  | 'order_placed'
  | 'order_filled'
  | 'thumbs_up'
  | 'thumbs_down'
  | 'rule_edited'
  | 'rule_override'
  | 'session_started';

export type TelemetryEvent = {
  event_id: Uuid;
  ts: ISODateTime;
  session_id: string;
  type: TelemetryEventType;
  entity: { ticker?: string; section?: string; alert_id?: string; proposal_id?: string; metric?: string };
  props: {
    dwell_ms?: number;
    action?: string;
    reason?: string;
    delta?: number;
    query_text_hash?: string;
    [k: string]: unknown;
  };
  context: { market_session?: Session; vix_band?: string; earnings_season?: boolean };
  client: { device: 'desktop' | 'tablet' | 'mobile'; tz: string };
  schema_version: number;
};
export type EventsResponse = { accepted: number; rejected: Array<{ index: number; reason: string }> };

/* ---------------- lists ---------------- */
export type Paged<T> = { items: T[]; next_cursor: string | null };
export type Items<T> = { items: T[] };

/* ---------------- stream (SSE) events: shapes UNVERIFIED beyond the event names ---------------- */
export type StreamEvent =
  | { type: 'quote'; id: string | null; data: Quote }
  | { type: 'alert'; id: string | null; data: Alert }
  | { type: 'proposal'; id: string | null; data: Proposal }
  | { type: 'heartbeat'; id: string | null; data: { ts?: ISODateTime } };
