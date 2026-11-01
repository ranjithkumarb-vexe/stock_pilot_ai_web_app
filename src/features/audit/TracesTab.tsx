import { useMemo, useState } from 'react';
import { isApiError } from '@/api/errors';
import { useAuditTrace, useAuditTraces } from '@/api/hooks/audit';
import type { AuditTrace } from '@/api/types';
import { ErrorPanel } from '@/shell/ErrorBoundary';
import { Pill, SkeletonBlock, type Tone } from '@/ui';
import { Stagger } from '@/motion';
import { DASH, int, shortId } from '@/features/trading/format';

const OUTCOME: Record<string, { label: string; tone: Tone }> = {
  ok: { label: 'OK', tone: 'ok' },
  blocked: { label: 'Blocked', tone: 'bad' },
  error: { label: 'Error', tone: 'bad' },
};
const out = (o: string) => OUTCOME[o] ?? { label: o, tone: 'n' as Tone };

const meta = (t: AuditTrace) =>
  !t.model || t.model === 'n/a' ? t.mode : `${t.model} · ${(t.duration_ms / 1000).toFixed(1)}s`;

/** Waterfall geometry. Presentation only: offsets are cumulative step durations from the API. */
export function waterfall(steps: AuditTrace['steps']): Array<{ left: number; width: number }> {
  const total = steps.reduce((a, s) => a + (Number(s.ms) || 0), 0) || 1;
  let off = 0;
  return steps.map(s => {
    const left = (off / total) * 100;
    const width = Math.max(1.5, ((Number(s.ms) || 0) / total) * 100);
    off += Number(s.ms) || 0;
    return { left, width };
  });
}

export function TracesTab() {
  const list = useAuditTraces();
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const [picked, setSel] = useState<string>('');
  const sel = picked || items[0]?.id || '';
  const detail = useAuditTrace(sel || undefined);
  const tr = detail.data ?? items.find(t => t.id === sel);

  if (list.isLoading) return <SkeletonBlock label="Loading traces" widths={[40, 100, 70]} />;
  if (list.isError) {
    if (isApiError(list.error) && list.error.status === 404)
      return (
        <div className="s3-empty" data-testid="traces-unavailable">
          Traces are not available yet. They appear here once the audit service is running.
        </div>
      );
    return (
      <ErrorPanel error={list.error} title="Could not load traces" onRetry={() => void list.refetch()} />
    );
  }
  if (items.length === 0)
    return (
      <div className="s3-empty" data-testid="traces-empty">
        No traces yet. Every brief, chat answer and proposal records one.
      </div>
    );

  const geo = tr ? waterfall(tr.steps ?? []) : [];
  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}
      data-testid="traces"
    >
      <Stagger
        as="ul"
        style={{
          flex: '1 1 280px',
          maxWidth: '100%',
          display: 'grid',
          gap: 8,
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
        aria-label="Traces"
      >
        {items.map(t => {
          const o = out(t.outcome);
          const active = t.id === sel;
          return (
            <li key={t.id}>
              <button
                type="button"
                data-testid={`trace-${t.id}`}
                aria-pressed={active}
                onClick={() => setSel(t.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  borderRadius: 14,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'grid',
                  gap: 4,
                  color: 'var(--ink)',
                  background: active ? 'var(--accent-soft)' : 'var(--surface)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
                }}
              >
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ font: '600 11px var(--mono)', color: 'var(--ink-3)' }}>{shortId(t.id)}</span>
                  <Pill tone={o.tone}>{o.label}</Pill>
                </span>
                <b style={{ fontSize: 13 }}>{t.name}</b>
                <span style={{ font: '400 11px var(--mono)', color: 'var(--ink-3)' }}>{meta(t)}</span>
              </button>
            </li>
          );
        })}
      </Stagger>

      {tr && (
        <section
          className="s3-card"
          style={{ flex: '3 1 440px', minWidth: 0 }}
          aria-labelledby="trace-h"
          data-testid="trace-detail"
        >
          <div>
            <div
              style={{
                font: '600 11px var(--mono)',
                color: 'var(--ink-3)',
                marginBottom: 4,
                overflowWrap: 'anywhere',
              }}
            >
              {tr.id}
            </div>
            <h2 id="trace-h" style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 24, margin: 0 }}>
              {tr.name}
            </h2>
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}
          >
            <div className="s3-stat">
              <div className="s3-stat-l">Model</div>
              <div style={{ font: '500 12px var(--mono)', overflowWrap: 'anywhere' }}>{tr.model || DASH}</div>
            </div>
            <div className="s3-stat">
              <div className="s3-stat-l">Routing</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{tr.mode || DASH}</div>
            </div>
            <div className="s3-stat">
              <div className="s3-stat-l">Latency</div>
              <div style={{ font: '500 16px var(--mono)' }} data-testid="trace-latency">
                {(tr.duration_ms / 1000).toFixed(2)} s
              </div>
            </div>
            <div className="s3-stat">
              <div className="s3-stat-l">Tokens / cost</div>
              <div style={{ font: '500 12px var(--mono)' }} data-testid="trace-tokens">
                {tr.tokens_in || tr.tokens_out
                  ? `${int(tr.tokens_in)} in / ${int(tr.tokens_out)} out · $${tr.cost_usd.toFixed(3)}`
                  : `none · $${(tr.cost_usd ?? 0).toFixed(3)}`}
              </div>
            </div>
          </div>
          {detail.isError && (
            <div role="alert" className="s3-alert">
              Could not refresh this trace. Showing the summary from the list.
            </div>
          )}
          <Stagger
            as="ol"
            style={{ display: 'grid', gap: 8, listStyle: 'none', margin: 0, padding: 0 }}
            aria-label="Trace steps"
          >
            {(tr.steps ?? []).map((s, i) => {
              const bad = s.outcome !== 'ok';
              const g = geo[i];
              return (
                <li
                  key={`${s.name}-${i}`}
                  data-testid="trace-step"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr) 90px',
                    gap: 14,
                    alignItems: 'center',
                    fontSize: 13,
                  }}
                >
                  <span>{s.name}</span>
                  <span
                    style={{
                      position: 'relative',
                      height: 10,
                      borderRadius: 5,
                      background: 'var(--surface-2)',
                    }}
                    aria-hidden="true"
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        borderRadius: 5,
                        left: `${g?.left ?? 0}%`,
                        width: `${g?.width ?? 0}%`,
                        background: bad ? 'var(--loss)' : 'var(--accent)',
                      }}
                    />
                  </span>
                  <span style={{ font: '500 12px var(--mono)', textAlign: 'right' }}>{s.ms} ms</span>
                  <span
                    style={{
                      gridColumn: '1 / -1',
                      font: '400 11px var(--mono)',
                      marginTop: -6,
                      color: bad ? 'var(--loss)' : 'var(--ink-3)',
                    }}
                  >
                    {bad ? 'Blocked' : 'Result'}: {s.detail}
                  </span>
                </li>
              );
            })}
          </Stagger>
        </section>
      )}
    </div>
  );
}
