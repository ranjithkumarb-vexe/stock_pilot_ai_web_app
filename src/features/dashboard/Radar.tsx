import { useNavigate } from 'react-router-dom';
import { usePortfolio, usePortfolioRisk } from '@/api/hooks/portfolio';
import { Loop } from '@/motion';
import { useTrack } from '@/telemetry';
import { Pill } from '@/ui';
import { num1 } from './format';
import { ruleMeta, ruleStatus } from './labels';
import { card, Eyebrow, SectionError, SkeletonLines } from './panels';

const RADAR = 240;

/** Visual placement only: weight → distance from the centre (cap ring at 62 units), blip size from weight. */
function blips(positions: Array<{ symbol: string; weight_pct: number }>, cap: number | undefined) {
  const n = positions.length || 1;
  return positions.map((p, i) => {
    const a = ((-90 + (i * 360) / n) * Math.PI) / 180;
    const rr = Math.min(86, cap ? (p.weight_pct / cap) * 62 : 40);
    const rad = 4 + Math.sqrt(Math.max(0, p.weight_pct)) * 1.2;
    const lr = rr + rad + 10;
    const over = cap != null && p.weight_pct > cap;
    const near = cap != null && p.weight_pct / cap >= 0.85;
    return {
      symbol: p.symbol,
      weight: p.weight_pct,
      x: 120 + rr * Math.cos(a),
      y: 120 + rr * Math.sin(a),
      r: rad,
      lx: 120 + lr * Math.cos(a),
      ly: 120 + lr * Math.sin(a),
      hit: Math.max(24, Math.round(rad * 2 + 10)),
      color: over ? 'var(--loss)' : near ? 'var(--warn)' : 'var(--accent)',
      over,
    };
  });
}

/** Position radar + the rule rows (limits and current values come from GET /portfolio/risk). */
export function Radar() {
  const pfQ = usePortfolio();
  const riskQ = usePortfolioRisk();
  const navigate = useNavigate();
  const track = useTrack();
  const rules = riskQ.data?.rules ?? [];
  const cap = rules.find(r => r.key === 'pos')?.limit;
  const positions = pfQ.data?.positions ?? [];
  const points = blips(positions, cap);
  const okN = rules.filter(r => r.status === 'ok').length;

  const open = (symbol: string) => {
    track({ type: 'ticker_viewed', entity: { ticker: symbol }, props: { action: 'dashboard_radar' } });
    navigate(`/brief/${symbol}`);
  };

  return (
    <section
      aria-label="Position radar"
      data-testid="dash-radar"
      style={{
        ...card,
        flex: '1 1 320px',
        minWidth: 0,
        borderRadius: 18,
        padding: 22,
        display: 'grid',
        gap: 14,
        alignContent: 'start',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <Eyebrow>Position radar</Eyebrow>
        <span style={{ font: '500 12px var(--mono)', color: 'var(--ink-2)' }} data-testid="radar-summary">
          {riskQ.data ? `${okN}/${rules.length} rules within limits` : ''}
        </span>
      </div>

      {pfQ.isError && <SectionError error={pfQ.error} what="positions" onRetry={() => void pfQ.refetch()} />}
      {pfQ.isPending && <SkeletonLines rows={3} label="Loading positions" />}
      {pfQ.data && (
        <>
          <div
            style={{
              position: 'relative',
              justifySelf: 'center',
              width: '100%',
              maxWidth: 290,
              aspectRatio: '1',
            }}
          >
            <svg
              viewBox={`0 0 ${RADAR} ${RADAR}`}
              width="100%"
              height="100%"
              role="img"
              aria-label="Positions plotted by weight against your position cap"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="sw" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
                  <stop offset="1" stopColor="var(--accent)" stopOpacity=".28" />
                </linearGradient>
              </defs>
              <circle cx="120" cy="120" r="96" stroke="var(--line)" fill="none" />
              <circle cx="120" cy="120" r="31" stroke="var(--line)" fill="none" />
              {cap != null && (
                <circle
                  cx="120"
                  cy="120"
                  r="62"
                  stroke="var(--accent)"
                  strokeDasharray="3 4"
                  fill="none"
                  opacity=".8"
                />
              )}
              <line x1="120" y1="20" x2="120" y2="220" stroke="var(--line)" />
              <line x1="20" y1="120" x2="220" y2="120" stroke="var(--line)" />
              <Loop as="g" kind="sweep" duration={7} style={{ transformOrigin: '120px 120px' }}>
                <path d="M120 120 L120 20 A100 100 0 0 1 170 33.400 Z" fill="url(#sw)" />
              </Loop>
              {points.map(b => (
                <g key={b.symbol} aria-hidden="true">
                  <Loop
                    as="circle"
                    kind={b.over ? 'blip' : null}
                    cx={b.x}
                    cy={b.y}
                    r={b.r}
                    fill={b.color}
                    fillOpacity=".9"
                    style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                  />
                  <circle cx={b.x} cy={b.y} r={b.r + 4} stroke={b.color} fill="none" opacity=".35" />
                </g>
              ))}
            </svg>
            {cap != null && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '52%',
                  top: '20.5%',
                  font: '500 9px var(--mono)',
                  letterSpacing: '.08em',
                  color: 'var(--accent)',
                  pointerEvents: 'none',
                }}
              >
                CAP {num1(cap)}%
              </span>
            )}
            {points.map(b => (
              <span key={b.symbol}>
                <button
                  type="button"
                  data-nm="1"
                  data-testid={`radar-${b.symbol}`}
                  onClick={() => open(b.symbol)}
                  title={`${b.symbol}: ${b.weight.toFixed(1)}% of portfolio${cap != null ? `, cap ${num1(cap)}%` : ''}`}
                  aria-label={`${b.symbol}: ${b.weight.toFixed(1)}% of portfolio${cap != null ? `, cap ${num1(cap)}%` : ''}. Open brief`}
                  className="hv-ring"
                  style={{
                    position: 'absolute',
                    left: `${(b.x / 2.4).toFixed(2)}%`,
                    top: `${(b.y / 2.4).toFixed(2)}%`,
                    width: b.hit,
                    height: b.hit,
                    transform: 'translate(-50%,-50%)',
                    border: 0,
                    borderRadius: 6,
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: `${(b.lx / 2.4).toFixed(2)}%`,
                    top: `${(b.ly / 2.4).toFixed(2)}%`,
                    transform: 'translate(-50%,-50%)',
                    font: '500 10px var(--mono)',
                    color: 'var(--ink-2)',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {b.symbol}
                </span>
              </span>
            ))}
            {positions.length === 0 && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeContent: 'center',
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--ink-3)',
                }}
                data-testid="radar-empty"
              >
                No positions yet
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center' }}>
            Distance from centre is weight. Outside the dashed ring breaks your cap. Click a blip.
          </div>
        </>
      )}

      <div
        style={{ display: 'grid', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 12 }}
        data-testid="dash-rules"
      >
        {riskQ.isPending && <SkeletonLines rows={4} label="Loading your rules" />}
        {riskQ.isError && (
          <SectionError error={riskQ.error} what="your rule checks" onRetry={() => void riskQ.refetch()} />
        )}
        {rules.map(r => {
          const m = ruleMeta(r.key);
          const st = ruleStatus(r.status);
          return (
            <div
              key={r.key}
              data-testid={`rule-row-${r.key}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
              }}
            >
              <span style={{ color: 'var(--ink-2)' }}>{m.label}</span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {num1(r.current)}
                  {m.unit} / {num1(r.limit)}
                  {m.unit}
                </span>
                <Pill tone={st.tone}>{st.label}</Pill>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
