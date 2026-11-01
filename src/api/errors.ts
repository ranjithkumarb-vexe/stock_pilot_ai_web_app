import type { ApiErrorBody, ErrorCode, RuleViolation } from './types';

/**
 * The single place that maps API error codes to user-facing copy (WORKFLOW.md §4).
 * Every code in docs/workflow/CONTRACT.md is covered; the unit test enforces that.
 * Copy follows SPEC §11.4: educational, no urgency, no advice. Where the design already has wording it is reused.
 */
export class ApiError extends Error {
  readonly code: ErrorCode | (string & {});
  readonly status: number;
  readonly trace_id: string | null;
  readonly details: Record<string, unknown> | null;
  /** milliseconds to wait before retrying (429 Retry-After), when provided */
  readonly retryAfterMs: number | null;

  constructor(init: {
    code: string;
    message: string;
    status: number;
    trace_id?: string | null;
    details?: Record<string, unknown> | null;
    retryAfterMs?: number | null;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.code = init.code;
    this.status = init.status;
    this.trace_id = init.trace_id ?? null;
    this.details = init.details ?? null;
    this.retryAfterMs = init.retryAfterMs ?? null;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

export type ErrorCopy = {
  title: string;
  message: string;
  /** safe to offer a "Try again" button */
  retryable: boolean;
  /** visual tone, matches <Pill tone> */
  tone: 'bad' | 'warn' | 'info';
};

export const ERROR_COPY: Record<ErrorCode, ErrorCopy> = {
  unauthenticated: {
    title: 'Session expired',
    message:
      'For your security you were signed out. Your paper ledger, rules and drafts are saved. Sign in again to continue.',
    retryable: false,
    tone: 'warn',
  },
  forbidden: {
    title: 'Not allowed',
    message: 'You do not have access to this. If that seems wrong, sign out and back in.',
    retryable: false,
    tone: 'bad',
  },
  not_found: {
    title: 'Not found',
    message: 'We could not find that. It may have been removed or the link is out of date.',
    retryable: false,
    tone: 'info',
  },
  conflict: {
    title: 'Already done',
    message:
      'This changed while you were working (for example it was already submitted or decided). Refresh to see the latest state.',
    retryable: false,
    tone: 'warn',
  },
  validation_error: {
    title: 'Check your input',
    message: 'Some fields need attention. Fix them and try again.',
    retryable: false,
    tone: 'warn',
  },
  rate_limited: {
    title: 'Slow down a moment',
    message: 'Too many requests. Please wait a few seconds and try again.',
    retryable: true,
    tone: 'warn',
  },
  rule_violation: {
    title: 'Blocked by your rules',
    message:
      'This would break one of the rules you set. Review the checks, adjust the size, or edit the rule on purpose.',
    retryable: false,
    tone: 'bad',
  },
  stale_quote: {
    title: 'Quote is stale',
    message: 'Quote is older than 15 minutes. Market orders are blocked until the feed recovers.',
    retryable: true,
    tone: 'warn',
  },
  market_closed: {
    title: 'Market is closed',
    message: 'Market is closed. The order will be queued for the next open.',
    retryable: false,
    tone: 'info',
  },
  insufficient_cash: {
    title: 'Not enough paper cash',
    message: 'This order costs more than the paper cash available. Reduce the quantity.',
    retryable: false,
    tone: 'bad',
  },
  insufficient_shares: {
    title: 'Not enough shares',
    message: 'You hold fewer shares than this sell order needs. Shorting is not available in this app.',
    retryable: false,
    tone: 'bad',
  },
  unsupported_symbol: {
    title: 'Ticker not supported',
    message: 'That ticker is not in the supported universe yet. Pick one from the list.',
    retryable: false,
    tone: 'warn',
  },
  guardrail_blocked: {
    title: 'Pilot cannot answer that',
    message:
      'StockPilot is an educational tool and does not give personal buy or sell advice. Try asking about what a filing says or how a metric is defined.',
    retryable: false,
    tone: 'info',
  },
  upstream_unavailable: {
    title: 'Service temporarily unavailable',
    message:
      'A data or model provider is not responding. Cached content is shown where possible. We will retry; numbers are unchanged because they come from code.',
    retryable: true,
    tone: 'warn',
  },
  method_not_allowed: {
    title: 'Not supported',
    message: 'This action is not supported here. Refresh the page and try again.',
    retryable: false,
    tone: 'warn',
  },
  payload_too_large: {
    title: 'Too much data',
    message: 'What you sent is larger than the server accepts. Shorten it and try again.',
    retryable: false,
    tone: 'warn',
  },
  internal: {
    title: 'Something went wrong',
    message:
      'An unexpected error occurred on our side. Please try again. If it keeps happening, share the reference below.',
    retryable: true,
    tone: 'bad',
  },
  network_error: {
    title: 'Cannot reach StockPilot',
    message:
      'Check your connection. Saved data stays readable; orders and rule changes are paused until the connection returns.',
    retryable: true,
    tone: 'warn',
  },
  timeout: {
    title: 'Taking too long',
    message: 'The server did not respond in time. Please try again.',
    retryable: true,
    tone: 'warn',
  },
  bad_response: {
    title: 'Unexpected response',
    message: 'The server sent a reply we could not read. Please try again.',
    retryable: true,
    tone: 'bad',
  },
};

const FALLBACK: ErrorCopy = ERROR_COPY.internal;

export type DescribedError = ErrorCopy & {
  code: string;
  status: number;
  /** server-provided message (shown beneath the friendly copy when it adds information) */
  serverMessage: string | null;
  traceId: string | null;
  /** seconds to wait, for rate limits */
  retryAfterSec: number | null;
  fieldErrors: Record<string, string>;
  violations: RuleViolation[];
};

/** Best-effort extraction of per-field messages from validation_error details (FastAPI/Pydantic style or `{fields:{}}`). */
export function fieldErrorsFrom(details: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!details) return out;
  const fields = details.fields;
  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    for (const [k, v] of Object.entries(fields as Record<string, unknown>))
      out[k] = String(Array.isArray(v) ? v[0] : v);
  }
  const list = (details.errors ?? details.detail) as unknown;
  if (Array.isArray(list)) {
    for (const e of list as Array<{ loc?: unknown[]; msg?: string; field?: string; message?: string }>) {
      const key = e.field ?? (Array.isArray(e.loc) ? e.loc.filter(p => p !== 'body').join('.') : '');
      const msg = e.msg ?? e.message;
      if (key && msg && !(key in out)) out[key] = msg;
    }
  }
  return out;
}

export function violationsFrom(details: Record<string, unknown> | null | undefined): RuleViolation[] {
  const v = details?.violations;
  return Array.isArray(v) ? (v as RuleViolation[]) : [];
}

/** Turn anything thrown into UX copy. Unknown codes fall back to the generic message but keep the server text. */
export function describeError(err: unknown): DescribedError {
  if (isApiError(err)) {
    const known = (ERROR_COPY as Record<string, ErrorCopy | undefined>)[err.code] ?? FALLBACK;
    const retry = err.retryAfterMs != null ? Math.max(1, Math.ceil(err.retryAfterMs / 1000)) : null;
    return {
      ...known,
      message:
        err.code === 'rate_limited' && retry
          ? `Too many requests. Please wait ${retry} second${retry === 1 ? '' : 's'} and try again.`
          : known.message,
      code: err.code,
      status: err.status,
      serverMessage: err.message && err.message !== known.message ? err.message : null,
      traceId: err.trace_id,
      retryAfterSec: retry,
      fieldErrors: err.code === 'validation_error' ? fieldErrorsFrom(err.details) : {},
      violations: err.code === 'rule_violation' ? violationsFrom(err.details) : [],
    };
  }
  const msg = err instanceof Error ? err.message : null;
  return {
    ...FALLBACK,
    code: 'internal',
    status: 0,
    serverMessage: msg,
    traceId: null,
    retryAfterSec: null,
    fieldErrors: {},
    violations: [],
  };
}

/** Status -> code, used when the body is missing or not JSON. */
export function codeForStatus(status: number): ErrorCode {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 422) return 'validation_error';
  if (status === 429) return 'rate_limited';
  if (status === 502 || status === 503 || status === 504) return 'upstream_unavailable';
  return 'internal';
}

export const isErrorBody = (b: unknown): b is ApiErrorBody =>
  !!b &&
  typeof b === 'object' &&
  typeof (b as ApiErrorBody).code === 'string' &&
  typeof (b as ApiErrorBody).message === 'string';
