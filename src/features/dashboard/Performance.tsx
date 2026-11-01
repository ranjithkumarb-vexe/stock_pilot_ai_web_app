import { useMemo } from 'react';
import { usePortfolioPerformance } from '@/api/hooks/portfolio';
import type { PortfolioPerformance } from '@/api/types';
import { pct, pctPlain, signColor } from './format';
import { Panel, SectionError, SkeletonLines } from './panels';

const W = 600;
const H = 170;
const PAD = { l: 8, r: 8, t: 10, b: 10 };

type Pt = { x: number; y: number };

/**
 * Both series are drawn as "% since the first point" so they share one axis whatever unit the backend normalised
 * SPY to. This is chart geometry only; the headline figures come straight from `stats`.
 */
export function chartPaths(series: PortfolioPerformance['series']) {
  const base = (k: 'equity' | 'spy_norm') => series.find(p => p[k] > 0)?.[k] ?? 0;
  const e0 = base('equity');
  const s0 = base('spy_norm');
  const rel = (v: number, b: number) => (b > 0 ? (v / b - 1) * 100 : 0);
  const eq = series.map(p => rel(p.equity, e0));
  const spy = series.map(p => rel(p.spy_norm, s0));
  const all = [...eq, ...spy];
  const lo = Math.min(...all, 0);
  const hi = Math.max(...all, 0);
  const span = hi - lo || 1;
  const n = series.length;
  const pt = (v: number, i: number): Pt => ({
    x: PAD.l + (n > 1 ? (i / (n - 1)) * (W - PAD.l - PAD.r) : 0),
    y: PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b),
  });
  const line = (vs: number[]) =>
    vs.map((v, i) => `${i ? 'L' : 'M'}${pt(v, i).x.toFixed(1)} ${pt(v, i).y.toFixed(1)}`).join(' ');
  return {
    equity: line(eq),
    spy: line(spy),
    zeroY: pt(0, 0).y,
    last: { equity: eq[eq.length - 1] ?? 0, spy: spy[spy.length - 1] ?? 0 },
  };
}

const dateLabel = (iso?: string) =>
  iso && !Number.isNaN(Date.parse(iso))
    ? new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'America/New_York',
      })
    : '';

export function Performance() {
  const q = usePortfolioPerformance();
  const series = q.data?.series;
  const paths = useMemo(() => (series && series.length >= 2 ? chartPaths(series) : null), [series]);
  const s = q.data?.stats;

  return (
    <Panel title="Performance vs S&P 500" testId="dash-performance" padding={20}>
      {q.isPending && <SkeletonLines rows={4} label="Loading performance" />}
      {q.isError && <SectionError error={q.error} what="performance" onRetry={() => void q.refetch()} />}
      {q.data && (
        <>
          {paths && series ? (
            <figure style={{ margin: 0, display: 'grid', gap: 6 }}>
              <svg
                viewBox={`0 0 ${W} ${H}`}
                width="100%"
                height={H}
                role="img"
                aria-label={`Portfolio ${pct(paths.last.equity)} versus S&P 500 ${pct(paths.last.spy)} since ${dateLabel(series[0]?.ts)}`}
                style={{ display: 'block', maxHeight: 200 }}
                preserveAspectRatio="none"
              >
                <line
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={paths.zeroY}
                  y2={paths.zeroY}
                  stroke="var(--line-strong)"
                  strokeDasharray="3 4"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={paths.spy}
                  fill="none"
                  stroke="var(--ink-3)"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={paths.equity}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <figcaption
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                  fontSize: 12,
                  color: 'var(--ink-3)',
                }}
              >
                <span style={{ display: 'flex', gap: 14 }}>
                  <span>
                    <span aria-hidden="true" style={{ color: 'var(--accent)' }}>
                      ━
                    </span>{' '}
                    Your portfolio
                  </span>
                  <span>
                    <span aria-hidden="true">╍</span> S&P 500
                  </span>
                </span>
                <span style={{ fontFamily: 'var(--mono)' }}>
                  {dateLabel(series[0]?.ts)} – {dateLabel(series[series.length - 1]?.ts)}
                </span>
              </figcaption>
            </figure>
          ) : (
            <div
              data-testid="perf-empty"
              style={{
                border: '1px dashed var(--line-strong)',
                borderRadius: 12,
                padding: 20,
                textAlign: 'center',
                color: 'var(--ink-2)',
                fontSize: 13,
              }}
            >
              The comparison chart appears after your portfolio has at least two days of history.
            </div>
          )}
          {s && (
            <dl
              style={{
                margin: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))',
                gap: 12,
              }}
              data-testid="perf-stats"
            >
              <Stat label="YTD" value={pct(s.ytd_pct)} color={signColor(s.ytd_pct)} />
              <Stat label="S&P 500 YTD" value={pct(s.spy_pct)} color={signColor(s.spy_pct)} />
              <Stat label="Volatility" value={pctPlain(s.vol_pct)} />
              <Stat label="Beta" value={s.beta.toFixed(2)} />
              <Stat label="Max drawdown" value={pctPlain(s.max_drawdown_pct)} />
              <Stat label="Win rate" value={pctPlain(s.win_rate_pct, 0)} />
            </dl>
          )}
        </>
      )}
    </Panel>
  );
}

function Stat({ label, value, color = 'var(--ink)' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
      <dt
        style={{
          font: '600 10px var(--mono)',
          letterSpacing: '.08em',
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0, font: '500 16px var(--mono)', color }}>{value}</dd>
    </div>
  );
}
