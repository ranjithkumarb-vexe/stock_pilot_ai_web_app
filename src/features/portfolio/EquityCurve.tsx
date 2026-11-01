import { useId } from 'react';
import type { PortfolioPerformance } from '@/api/types';
import { signedPct } from './format';

const W = 620;
const H = 190;

const poly = (s: number[], mn: number, mx: number) =>
  s
    .map(
      (v, i) =>
        `${((i / (s.length - 1)) * W).toFixed(1)},${(H - 8 - ((v - mn) / (mx - mn || 1)) * (H - 16)).toFixed(1)}`,
    )
    .join(' ');

/** Index a series to 100 at its first positive value. The API indexes BOTH `equity` and `spy_norm` to the starting equity (not 100). */
export const rebase100 = (values: number[]): number[] => {
  const base = values.find(v => v > 0) ?? 1;
  return values.map(v => (v / base) * 100);
};

/** Design equity-curve card. Series come from the API; both lines are rebased to 100 so they share one axis. */
export function EquityCurve({ perf }: { perf: PortfolioPerformance }) {
  const gid = `ag${useId().replace(/:/g, '')}`;
  const series = perf.series ?? [];
  const a = rebase100(series.map(p => p.equity));
  const b = rebase100(series.map(p => p.spy_norm));
  const all = [...a, ...b];
  const mn = Math.min(...all);
  const mx = Math.max(...all);
  const ok = series.length >= 2;
  const pf = ok ? poly(a, mn, mx) : '';
  return (
    <section className="pf-card" style={{ padding: 18, display: 'grid', gap: 12 }} data-testid="pf-curve">
      <h2 style={{ font: "600 14px 'Geist'", margin: 0 }}>Equity curve vs S&amp;P 500</h2>
      {ok ? (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: 'block' }}
          role="img"
          aria-label={`Equity curve of the paper portfolio against SPY: portfolio ${signedPct(perf.stats.ytd_pct)} year to date, S&P 500 ${signedPct(perf.stats.spy_pct)}`}
        >
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity=".38" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`${pf} ${W},${H} 0,${H}`} fill={`url(#${gid})`} />
          <polyline
            points={poly(b, mn, mx)}
            stroke="var(--ink-3)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            fill="none"
          />
          <polyline
            points={pf}
            stroke="var(--accent)"
            strokeWidth="2.4"
            fill="none"
            style={{ filter: 'drop-shadow(0 0 6px var(--accent))' }}
          />
        </svg>
      ) : (
        <div className="sp-empty" data-testid="pf-curve-empty" style={{ padding: 20 }}>
          <div style={{ color: 'var(--ink-2)' }}>
            The equity curve appears after your first trading day in the paper simulator.
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--ink-2)', flexWrap: 'wrap' }}>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 2,
              background: 'var(--accent)',
              verticalAlign: 'middle',
            }}
          />{' '}
          Portfolio {signedPct(perf.stats?.ytd_pct)} YTD
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 0,
              borderTop: '2px dashed var(--ink-3)',
              verticalAlign: 'middle',
            }}
          />{' '}
          S&amp;P 500 {signedPct(perf.stats?.spy_pct)} YTD
        </span>
      </div>
    </section>
  );
}
