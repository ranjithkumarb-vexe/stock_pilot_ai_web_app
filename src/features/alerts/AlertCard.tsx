import { useId } from 'react';
import type { Alert } from '@/api/types';
import { ago } from '@/features/trading/format';
import { Pill } from '@/ui';
import { isArchived, isRead, STATE_LABEL, TYPE_META } from './api';

type Props = {
  alert: Alert;
  busy: boolean;
  onOpen: (a: Alert) => void;
  onSnooze: (a: Alert) => void;
  onDismiss: (a: Alert) => void;
};

/** Everything below is rendered as React text nodes: alert title/body/source come from fetched content and are never HTML. */
export function AlertCard({ alert: a, busy, onOpen, onSnooze, onDismiss }: Props) {
  const id = useId();
  const meta = TYPE_META[a.type] ?? { label: String(a.type), tone: 'n' as const };
  const archived = isArchived(a);
  const canAct = !a.critical && !archived;
  const mat = Math.max(0, Math.min(1, Number(a.materiality) || 0));
  const why = a.why;
  return (
    <article
      className="s3-card"
      style={{ padding: '16px 18px', gap: 8, opacity: archived ? 0.6 : isRead(a) ? 0.85 : 1 }}
      data-testid={`alert-${a.id}`}
      data-state={a.state}
      aria-labelledby={`${id}-t`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pill tone={meta.tone}>{meta.label}</Pill>
        {a.symbol && <span style={{ font: '600 12px var(--mono)', color: 'var(--ink-2)' }}>{a.symbol}</span>}
        {a.critical && (
          <span style={{ font: '600 11px var(--mono)', color: 'var(--ink-3)' }} data-testid="alert-pinned">
            PINNED
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {ago(a.created_at)} · {STATE_LABEL[a.state] ?? a.state}
        </span>
      </div>
      <div>
        <b id={`${id}-t`} style={{ fontSize: 15 }}>
          {a.title}
        </b>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{a.body}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ font: '400 11px var(--mono)', color: 'var(--ink-3)' }}>Source: {a.source_label}</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            font: '400 11px var(--mono)',
            color: 'var(--ink-3)',
          }}
          title="Materiality score (0 to 1), computed by the alert engine"
        >
          Materiality
          <span
            role="meter"
            aria-label="Materiality"
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={mat}
            style={{
              width: 54,
              height: 5,
              borderRadius: 3,
              background: 'var(--surface-2)',
              overflow: 'hidden',
              display: 'inline-block',
            }}
          >
            <span
              style={{
                display: 'block',
                height: '100%',
                width: `${mat * 100}%`,
                background: 'var(--accent)',
              }}
            />
          </span>
          <span data-testid="alert-materiality">{mat.toFixed(2)}</span>
        </div>
      </div>
      {why && (
        <details style={{ fontSize: 12, color: 'var(--ink-2)' }} data-testid="alert-why">
          <summary style={{ cursor: 'pointer', color: 'var(--info)', fontWeight: 600 }}>
            Why am I seeing this?
          </summary>
          <div style={{ display: 'grid', gap: 4, paddingTop: 6 }}>
            <div>{why.summary}</div>
            {why.top_features?.slice(0, 3).map(f => (
              <div key={f.name} style={{ fontFamily: 'var(--mono)' }}>
                {f.name}: {f.detail}
              </div>
            ))}
            {why.rules_checked?.length > 0 && (
              <div>
                Rules checked:{' '}
                {why.rules_checked.map(r => `${r.rule} ${r.passed ? 'pass' : 'flag'}`).join(', ')}
              </div>
            )}
          </div>
        </details>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="s3-btn-primary"
          disabled={busy}
          onClick={() => onOpen(a)}
          data-testid={`alert-open-${a.id}`}
        >
          Open
        </button>
        {canAct && (
          <>
            <button
              type="button"
              className="s3-btn-sm"
              disabled={busy}
              onClick={() => onSnooze(a)}
              data-testid={`alert-snooze-${a.id}`}
            >
              Snooze 24h
            </button>
            <button
              type="button"
              className="s3-btn-sm"
              disabled={busy}
              onClick={() => onDismiss(a)}
              data-testid={`alert-dismiss-${a.id}`}
            >
              Dismiss
            </button>
          </>
        )}
      </div>
    </article>
  );
}
