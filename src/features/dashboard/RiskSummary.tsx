import { Link } from 'react-router-dom';
import { usePortfolioRisk } from '@/api/hooks/portfolio';
import { pctPlain } from './format';
import { Panel, SectionError, SkeletonLines } from './panels';

/** Portfolio risk metrics from GET /portfolio/risk plus any active rule violations. */
export function RiskSummary() {
  const q = usePortfolioRisk();
  const m = q.data?.metrics;
  const violations = q.data?.violations ?? [];
  const rows: Array<[string, string]> = m
    ? [
        ['Concentration (HHI)', m.hhi.toFixed(3)],
        ['Effective holdings', m.effective_n.toFixed(1)],
        ['Volatility (60d)', pctPlain(m.vol_60d)],
        ['Beta', m.beta.toFixed(2)],
        ['Drawdown now', pctPlain(m.drawdown_pct)],
        ['Max drawdown', pctPlain(m.max_drawdown_pct)],
        ['Trades, 7 days', String(m.trades_7d)],
      ]
    : [];
  return (
    <Panel
      title="Risk summary"
      testId="dash-risk"
      padding={20}
      aside={
        <Link to="/portfolio" style={{ fontSize: 12 }}>
          Portfolio and risk
        </Link>
      }
    >
      {q.isPending && <SkeletonLines rows={5} label="Loading risk metrics" />}
      {q.isError && <SectionError error={q.error} what="risk metrics" onRetry={() => void q.refetch()} />}
      {m && (
        <dl style={{ margin: 0, display: 'grid', gap: 8 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
              <dt style={{ color: 'var(--ink-2)' }}>{k}</dt>
              <dd style={{ margin: 0, fontFamily: 'var(--mono)' }}>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {violations.length > 0 && (
        <ul
          data-testid="risk-violations"
          style={{
            margin: 0,
            padding: '10px 12px',
            listStyle: 'none',
            borderRadius: 10,
            background: 'var(--loss-soft)',
            color: 'var(--loss)',
            display: 'grid',
            gap: 4,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {violations.map((v, i) => (
            <li key={i}>{v.message ?? v.rule ?? v.key ?? 'Rule violation'}</li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
