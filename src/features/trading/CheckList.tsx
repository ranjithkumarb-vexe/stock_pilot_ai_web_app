import { describeError } from '@/api/errors';
import type { OrderCheck } from '@/api/types';
import { Pill, Skeleton } from '@/ui';
import { SEVERITY } from './api';

/** Pre-trade risk checks from `POST /orders/preview`: Pass / Note / Blocked, each with the rule's own wording. */
export function CheckList({
  checks,
  loading,
  error,
  onRetry,
  idle,
  extra = [],
}: {
  checks: OrderCheck[] | null;
  loading: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** nothing to preview yet (e.g. no quantity) */
  idle?: string;
  /** client-side UX rows (e.g. limit price missing) shown first */
  extra?: OrderCheck[];
}) {
  const rows = [...extra, ...(checks ?? [])];
  return (
    <div style={{ display: 'grid', gap: 6 }} data-testid="ticket-checks">
      <div style={{ fontSize: 13, fontWeight: 600 }} id="checks-h">
        Pre-trade risk checks
      </div>
      {error != null && rows.length === 0 ? (
        <div role="alert" className="s3-alert" data-testid="checks-error">
          {describeError(error).message}{' '}
          {onRetry && (
            <button type="button" className="s3-btn-sm" onClick={onRetry}>
              Retry checks
            </button>
          )}
        </div>
      ) : loading && rows.length === 0 ? (
        <div
          role="status"
          aria-busy="true"
          aria-label="Checking your rules"
          style={{ display: 'grid', gap: 8 }}
        >
          {[80, 64, 72].map(w => (
            <Skeleton key={w} width={w} height={16} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
          {idle ?? 'Enter a quantity to run the checks.'}
        </span>
      ) : (
        <ul
          aria-labelledby="checks-h"
          aria-busy={loading}
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}
        >
          {rows.map(c => {
            const s = SEVERITY[c.severity];
            return (
              <li
                key={c.key}
                data-testid={`check-${c.key}`}
                data-severity={c.severity}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13 }}
              >
                <Pill tone={s.tone} style={{ flex: 'none', width: 62, textAlign: 'center' }}>
                  {s.mark}
                </Pill>
                <span>
                  <b>{c.label}</b> <span style={{ color: 'var(--ink-2)' }}>{c.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
