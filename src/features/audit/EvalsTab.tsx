import { isApiError } from '@/api/errors';
import { useEvalsLatest } from '@/api/hooks/audit';
import { ErrorPanel } from '@/shell/ErrorBoundary';
import { Pill, SkeletonBlock } from '@/ui';
import { Stagger } from '@/motion';

export function EvalsTab() {
  const q = useEvalsLatest();
  if (q.isLoading) return <SkeletonBlock label="Loading evals" widths={[40, 100, 90, 80]} />;
  if (q.isError) {
    if (isApiError(q.error) && q.error.status === 404)
      return (
        <div className="s3-empty" data-testid="evals-unavailable">
          No eval run has been recorded yet. Results appear here after the first CI run.
        </div>
      );
    return (
      <ErrorPanel
        error={q.error}
        title="Could not load the eval scoreboard"
        onRetry={() => void q.refetch()}
      />
    );
  }
  const items = q.data?.items ?? [];
  const pass = items.filter(e => e.status === 'pass').length;
  const when = q.data?.generated_at ? new Date(q.data.generated_at) : null;
  return (
    <section className="s3-card" style={{ padding: 0, gap: 0 }} aria-labelledby="evals-h" data-testid="evals">
      <div
        style={{
          padding: '18px 18px 8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h2 id="evals-h" className="s3-h2">
          Eval scoreboard
        </h2>
        <span className="s3-sub" data-testid="evals-summary">
          {pass} of {items.length} passing ·{' '}
          {q.data?.thresholds_met ? 'thresholds met' : 'thresholds not met'}
          {when && !Number.isNaN(when.getTime())
            ? ` · last run ${when.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`
            : ''}
        </span>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-2)' }}>
          No eval results in the latest run.
        </div>
      ) : (
        <div className="s3-table-wrap">
          <table className="s3-table" style={{ minWidth: 720 }}>
            <caption className="sr-only">Latest eval results</caption>
            <thead>
              <tr>
                <th scope="col">Test</th>
                <th scope="col">Scenario</th>
                <th scope="col">Target</th>
                <th scope="col">Result</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <Stagger as="tbody">
              {items.map(e => (
                <tr key={e.id} data-testid={`eval-${e.id}`} data-status={e.status}>
                  <td style={{ font: '500 12px var(--mono)', color: 'var(--info)' }}>{e.id}</td>
                  <td>{e.description}</td>
                  <td style={{ font: '400 12px var(--mono)', color: 'var(--ink-2)' }}>{String(e.target)}</td>
                  <td style={{ font: '500 12px var(--mono)' }}>{String(e.actual)}</td>
                  <td>
                    <Pill
                      tone={e.status === 'pass' ? 'ok' : 'bad'}
                      style={{ minWidth: 52, textAlign: 'center' }}
                    >
                      {e.status === 'pass' ? 'Pass' : 'Fail'}
                    </Pill>
                  </td>
                </tr>
              ))}
            </Stagger>
          </table>
        </div>
      )}
    </section>
  );
}
