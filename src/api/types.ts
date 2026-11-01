/**
 * API types. Wherever the backend OpenAPI publishes a response/request model (quotes, market status, bars,
 * onboarding, orders, briefs, citations, events, dev controls, auth) the type is DERIVED from the generated
 * schema (`npm run gen:api` -> src/api/schema.d.ts); keep the exported names so hooks and screens do not change.
 * The trading-domain routes (portfolio, profile, proposals, watchlist, universe) return untyped objects in
 * the OpenAPI (`additionalProperties: true`), so those types stay HAND-WRITTEN here, verified against real
 * responses on 2026-11-01 (docs/workflow/CONTRACT.md). Feed / alerts / chat / audit / evals are not built in the
 * backend yet: their types are the planned contract shapes (UNVERIFIED).
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
  'method_not_allowed',
  'payload_too_large',
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
type Schemas = components['schemas'];
export type Session = Schemas['QuoteOut']['session'];
export type Freshness = Schemas['QuoteOut']['freshness'];
/** `prev_close` / `change_pct` are null until the first reference price exists. */
export type Quote = Schemas['QuoteOut'];
export type FeedState = Schemas['MarketStatus']['feed_state'];
export type MarketStatus = Schemas['MarketStatus'];
/** The backend sends `time` as an ISO-8601 UTC string; the chart normaliser also accepts unix seconds. */
export type Bar = Omit<Schemas['BarOut'], 'time'> & { time: string | number };
export type BarsResponse = Omit<Schemas['BarsResponse'], 'bars'> & { bars: Bar[] };
export type QuotesResponse = Schemas['QuotesResponse'];
export type DevMarketResponse = Schemas['DevMarketResponse'];
export type StreamToken = components['schemas']['StreamTokenResponse'];

/* ---------------- universe / watchlist ---------------- */
export type UniverseItem = {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  exchange: string;
};
export type WatchlistItem = {
  symbol: string;
  name: string;
  sector: string;
  industry?: string;
  exchange?: string;
  added_at?: ISODateTime;
  quote: Quote | null;
};

/* ---------------- onboarding / profile ---------------- */
export type OnboardingQuestions = {
  questions: Array<{ id: number; text: string; options: Array<{ label: string; score: number }> }>;
  tiers: Array<{ tier: number; label: string }>;
  /** keyed by tier number as a string ("1".."5") */
  tier_rules: Record<string, RulesObject>;
  horizons: string[];
  experience_levels: string[];
  goals: string[];
  sectors: string[];
  esg_exclusions: string[];
  disclaimer: string;
};
export type RulesObject = { pos: number; sec: number; dd: number; trades: number; cash: number };
export type OnboardingBody = Omit<Schemas['OnboardingRequest'], 'disclaimer_ack'> & { disclaimer_ack: true };
/** `watchlist` is the list of watchlist ITEMS (same shape as GET /watchlist), not symbols. */
export type OnboardingResult = Omit<Schemas['OnboardingResponse'], 'rules' | 'watchlist'> & {
  rules: RulesObject;
  watchlist: WatchlistItem[];
};
export type Interest = { dim: string; label: string; weight: number; baseline: number };
export type Memory = { id: Uuid; kind: string; text: string; confidence: number; source: string };
export type BiasMirror = {
  name: string;
  metric: string;
  /** display string, e.g. "9 (rule 10)" */
  value: string;
  raw?: number | null;
  n?: number;
  state: 'ok' | 'watch' | 'flag';
};
export type ProfileFields = {
  display_name: string | null;
  email: string;
  risk_tier_stated: number;
  tier_label: string;
  horizon: string;
  goals: string[];
  experience: string;
  region: string;
  currency: string;
  esg_exclusions: string[];
  likes: string[];
  excludes: string[];
  starting_cash: number;
  disclaimer_ack_at: ISODateTime | null;
  onboarded_at: ISODateTime | null;
  created_at: ISODateTime;
};
export type StyleCard = {
  tone?: string;
  depth?: 'tldr' | 'standard' | 'deep';
  jargon?: 1 | 2 | 3;
  length?: string;
  metric?: string | null;
  metrics?: string[];
  language?: string;
  order?: string[];
  section_order?: string[];
  quant_vs_narrative?: number;
  explicit?: Record<string, unknown>;
  [k: string]: unknown;
};
export type ProfileResponse = {
  profile: ProfileFields;
  style_card: StyleCard;
  rules: RulesObject;
  rule_sources?: Record<string, string>;
  interests: Interest[];
  memories: Memory[];
  bias: BiasMirror[];
  stated_tier: number;
  revealed_tier: number;
  gap_days: number;
  gap_flag?: boolean;
  pinned_metrics?: string[];
  recent_events: Array<{ id: string; ts: ISODateTime; type: string; text: string }>;
};
export type ProfilePatch = Schemas['ProfilePatch'];

/* ---------------- portfolio ---------------- */
export type Position = {
  symbol: string;
  name: string;
  sector: string;
  qty: number;
  avg_cost: number;
  price: number;
  change_pct: number | null;
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
  /** fraction (0.25 = concentrated) */
  hhi: number;
  effective_n: number;
  as_of?: ISODateTime;
  /** null for an account without positions */
  price_source?: string | null;
};
export type RuleStatus = 'ok' | 'breach' | 'warn';
export type PortfolioRisk = {
  metrics: {
    hhi: number | null;
    effective_n: number | null;
    vol_60d: number | null;
    beta: number | null;
    max_drawdown_pct: number;
    drawdown_pct: number;
    trades_7d: number;
  };
  rules: Array<{
    key: string;
    limit: number;
    current: number;
    status: RuleStatus;
    subject?: string | null;
  }>;
  violations: RuleViolation[];
  flags?: string[];
};
export type PortfolioPerformance = {
  /** `equity` and `spy_norm` are both indexed to the starting equity (not 100) */
  series: Array<{ ts: ISODateTime; equity: number; spy_norm: number }>;
  stats: {
    ytd_pct: number | null;
    spy_pct: number | null;
    vol_pct: number | null;
    beta: number | null;
    drawdown_pct: number | null;
    max_drawdown_pct: number | null;
    turnover_pct: number | null;
    win_rate_pct: number | null;
    realized_pnl: number | null;
  };
  window?: { start: ISODateTime; end: ISODateTime; points: number };
  flags?: string[];
};

/* ---------------- proposals ---------------- */
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'modified' | 'expired' | (string & {});
export type Why = Schemas['WhyOut'];
export type Proposal = {
  id: Uuid;
  kind: 'trade' | 'review';
  symbol: string | null;
  side: 'buy' | 'sell' | null;
  rule: string | null;
  title: string;
  body: string;
  rationale: string[];
  rules_checked: Array<{ rule: string; passed: boolean; detail?: string } | string>;
  suggested_qty: number;
  current_weight_pct: number | null;
  after_weight_pct: number | null;
  cap_pct: number | null;
  sources: string[];
  status: ProposalStatus;
  expires_at: ISODateTime;
  created_at: ISODateTime;
  decided_at?: ISODateTime | null;
  reject_reason?: RejectReason | null;
  modified_qty?: number | null;
  executed_qty?: number | null;
  order_id?: Uuid | null;
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
export type OrderSide = Schemas['OrderRequest']['side'];
export type OrderType = Schemas['OrderRequest']['type'];
export type OrderStatus = Schemas['OrderOut']['status'];
export type OrderRequest = Omit<Schemas['OrderRequest'], 'override' | 'limit_price' | 'proposal_id'> & {
  limit_price?: number;
  proposal_id?: Uuid;
  override?: boolean;
};
export type Order = Schemas['OrderOut'];
export type Fill = Schemas['FillOut'];
export type OrderCheck = Schemas['CheckOut'];
/** `POST /orders` response. The preview has the same envelope plus `hard_blocked`/`market_open` (see `OrderPreview`). */
export type OrderResponse = Schemas['PlaceResponse'];
export type OrderPreview = Schemas['PreviewResponse'];

/* ---------------- alerts / feed ---------------- */
export type AlertType = Schemas['AlertOut']['type'];
/** `opened` once the user opened it (the FE used to guess `read`). */
export type AlertState = Schemas['AlertOut']['state'];
export type Alert = Omit<Schemas['AlertOut'], 'why'> & { why?: Why | null };
export type AlertAction = Schemas['AlertActionIn']['action'];
/** `GET /alerts`: `move_threshold` (unusual-move %), `fatigue_index` and `min_materiality` come from the server. */
export type AlertsPage = Omit<Schemas['AlertsPage'], 'items'> & { items: Alert[] };
export type FeedItem =
  | { kind: 'alert'; id: Uuid; pinned: boolean; score: number; item: Alert; why: Why }
  | { kind: 'proposal'; id: Uuid; pinned: boolean; score: number; item: Proposal; why: Why }
  | { kind: 'briefing'; id: Uuid; pinned: boolean; score: number; item: Record<string, unknown>; why: Why };

/* ---------------- briefs ---------------- */
export type BriefSection = Schemas['SectionOut'];
export type Brief = Schemas['BriefOut'];
export type Citation = Schemas['CitationOut'];

/* ---------------- chat ---------------- */
export type ChatRequest = Schemas['ChatRequest'];
/** `citations` items are free-form objects, see `ChatCitation` (ids are NOT uuids: `xbrl:NVDA:equity:<accession>`, `portfolio:paper`). */
export type ChatResponse = Schemas['ChatResponse'];
export type ChatCitation = {
  id: string;
  kind: string;
  n?: number;
  label?: string;
  symbol?: string;
  doc_label?: string;
  accession_no?: string;
  period_end?: string;
  url?: string;
  route?: string;
};
export type ChatHistory = {
  items: Array<{
    id: Uuid;
    thread_id: Uuid;
    role: 'user' | 'assistant';
    text: string;
    created_at: ISODateTime;
    refused?: boolean;
    refusal_reason?: string | null;
    citations?: ChatCitation[];
    trace_id?: string | null;
  }>;
  next_cursor?: string | null;
};

/* ---------------- audit ---------------- */
export type AuditTrace = Schemas['TraceOut'];
export type EvalsLatest = Schemas['EvalsLatest'];

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
export type EventsResponse = Schemas['EventsResponse'];

/* ---------------- lists ---------------- */
export type Paged<T> = { items: T[]; next_cursor: string | null };
export type Items<T> = { items: T[] };

/* ---------------- stream (SSE) events: shapes UNVERIFIED beyond the event names ---------------- */
export type StreamEvent =
  | { type: 'quote'; id: string | null; data: Quote }
  | { type: 'alert'; id: string | null; data: Alert }
  | { type: 'proposal'; id: string | null; data: Proposal }
  | { type: 'heartbeat'; id: string | null; data: { ts?: ISODateTime } };
