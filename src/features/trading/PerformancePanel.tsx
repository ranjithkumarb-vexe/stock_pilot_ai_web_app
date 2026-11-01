import { useId } from 'react';
import { usePortfolioPerformance, usePortfolioRisk } from '@/api/hooks/portfolio';
import type { PortfolioPerformance } from '@/api/types';
import { ErrorPanel } from '@/shell/ErrorBoundary';
import { SkeletonBlock } from '@/ui';
import { DASH, int, pct, signedUsd0, toneVar } from './format';
import './shared.css';

const W = 620;
const H = 190;
const PAD = 8;

type Pt = { x: number; y: number };

/** Presentation only: maps the API series onto the SVG box. */
function toPoints(series: PortfolioPerformance['series']): { pf: Pt[]; spy: Pt[] } {
  if (series.length < 2) return { pf: [], spy: [] };
  const vals = series.flatMap(s => [s.equity, s.spy_norm]).filter(Number.isFinite);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (v: number) => H - PAD - ((v - lo) / span) * (H - PAD * 2);
  return {
    pf: series.map((s, i) => ({ x: x(i), y: y(s.equity) })),
    spy: series.map((s, i) => ({ x: x(i), y: y(s.spy_norm) })),
  };
}
const poly = (p: Pt[]) => p.map(q => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');

export function PerformancePanel() {
  const perf = usePortfolioPerformance();
  const risk = usePortfolioRisk();
  const gid = useId();
  const stats = perf.data?.stats;
  const { pf, spy } = toPoints(perf.data?.series ?? []);
  const area = pf.length ? `${poly(pf)} ${W},${H} 0,${H}` : '';

  const metrics: Array<{ l: string; v: string; col: string }> = stats
    ? [
        { l: 'Total return', v: pct(stats.ytd_pct), col: toneVar(stats.ytd_pct) },
        {
          l: 'vs S&P 500',
          v: pct(stats.ytd_pct - stats.spy_pct),
          col: toneVar(stats.ytd_pct - stats.spy_pct),
        },
        { l: 'Win rate', v: `${stats.win_rate_pct}%`, col: 'var(--ink)' },
        { l: 'Realized P&L', v: signedUsd0(stats.realized_pnl), col: toneVar(stats.realized_pnl) },
        { l: 'Turnover (annual)', v: `${stats.turnover_pct}%`, col: 'var(--ink)' },
        { l: 'Trades, 7 days', v: risk.data ? int(risk.data.metrics.trades_7d) : DASH, col: 'var(--ink)' },
      ]
    : [];

  return (
    <section className="s3-card" data-testid="perf-panel" aria-labelledby="perf-h">
      <h2 id="perf-h" className="s3-h2">
        Performance
      </h2>
      {perf.isLoading ? (
        <SkeletonBlock label="Loading performance" widths={[100, 100, 70, 90]} />
      ) : perf.isError ? (
        <ErrorPanel
          error={perf.error}
          title="Could not load performance"
          onRetry={() => void perf.refetch()}
        />
      ) : (
        <>
          {pf.length ? (
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              style={{ display: 'block' }}
              role="img"
              aria-label="Equity curve against SPY"
              data-testid="perf-chart"
            >
              <defs>
                <linearGradient id={`${gid}ag`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--accent)" stopOpacity=".38" />
                  <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={area} fill={`url(#${gid}ag)`} />
              <polyline
                points={poly(spy)}
                stroke="var(--ink-3)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                fill="none"
              />
              <polyline
                points={poly(pf)}
                stroke="var(--accent)"
                strokeWidth="2.4"
                fill="none"
                style={{ filter: 'drop-shadow(0 0 6px var(--accent))' }}
              />
            </svg>
          ) : (
            <div className="s3-empty" data-testid="perf-empty">
              Not enough history yet. The equity curve appears after a few snapshots.
            </div>
          )}
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}
          >
            {metrics.map(m => (
              <div key={m.l} className="s3-stat">
                <div className="s3-stat-l">{m.l}</div>
                <div className="s3-stat-v" style={{ color: m.col }}>
                  {m.v}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
        Simulated results over a short window. They say nothing about future results or skill.
      </div>
    </section>
  );
}
