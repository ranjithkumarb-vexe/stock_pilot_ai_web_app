import { Link, useNavigate } from 'react-router-dom';
import { usePortfolio, usePortfolioPerformance, usePortfolioRisk } from '@/api';
import type { Portfolio, PortfolioRisk, Position } from '@/api/types';
import { Enter, Stagger } from '@/motion';
import { ErrorPanel } from '@/shell/ErrorBoundary';
import { Button, Pill, SkeletonBlock, type Tone } from '@/ui';
import { EquityCurve } from './EquityCurve';
import { RulesPanel } from './RulesPanel';
import {
  CAP_BAR_COLOR,
  barWidth,
  capState,
  money0,
  money2,
  pct,
  signedMoney0,
  signedPct,
  type CapState,
} from './format';
import { limitFor } from './rules';
import './portfolio.css';

const CAP_PILL: Record<CapState, { tone: Tone; word: string }> = {
  above: { tone: 'bad', word: 'Above cap' },
  near: { tone: 'warn', word: 'Near cap' },
  within: { tone: 'ok', word: 'Within' },
};

type Kpi = { label: string; value: string; note: string; tone: Tone; id: string };

function kpis(p: Portfolio, r: PortfolioRisk | undefined): Kpi[] {
  const cashRule = r?.rules.find(x => x.key === 'cash');
  const cashPct = cashRule?.current ?? (p.equity > 0 ? (p.cash / p.equity) * 100 : 0);
  const empty = p.positions.length === 0;
  const dd = limitFor(r, 'dd');
  const ddNow = r ? Math.abs(r.metrics.drawdown_pct) : null;
  const ddTone: Tone =
    dd && ddNow != null ? (ddNow / dd > 1 ? 'bad' : ddNow / dd >= 0.8 ? 'warn' : 'ok') : 'n';
  const out: Kpi[] = [
    {
      id: 'value',
      label: 'Total value',
      value: money0(p.equity),
      note: `${signedPct(p.day_change_pct, 2)} today`,
      tone: p.day_change_pct >= 0 ? 'ok' : 'bad',
    },
    { id: 'cash', label: 'Cash', value: pct(cashPct), note: money0(p.cash), tone: 'n' },
    {
      id: 'hhi',
      label: 'HHI (effective N)',
      value: empty ? '-' : p.hhi.toFixed(2),
      note: empty
        ? 'No positions'
        : `${p.hhi > 0.25 ? 'Concentrated' : 'Diversified'}, N = ${p.effective_n.toFixed(1)}`,
      tone: empty ? 'n' : p.hhi > 0.25 ? 'bad' : 'ok',
    },
  ];
  if (r)
    out.push(
      {
        id: 'dd',
        label: 'Drawdown from peak',
        value: pct(ddNow),
        note: dd != null ? `Alert at ${dd}%` : 'From equity peak',
        tone: ddTone,
      },
      {
        id: 'vol',
        label: 'Volatility, 60d',
        value: r.metrics.vol_60d ? pct(r.metrics.vol_60d) : '-',
        note: 'Annualized',
        tone: 'n',
      },
      {
        id: 'beta',
        label: 'Beta vs SPY',
        value: r.metrics.beta ? r.metrics.beta.toFixed(2) : '-',
        note: 'Realized, 60d',
        tone: 'n',
      },
    );
  return out;
}

function Row({ p, cap }: { p: Position; cap: number | undefined }) {
  const navigate = useNavigate();
  const state = cap != null ? capState(p.weight_pct, cap) : null;
  return (
    <tr data-testid={`pos-${p.symbol}`} onClick={() => navigate(`/brief/${p.symbol}`)}>
      <td>
        <Link
          to={`/brief/${p.symbol}`}
          className="pf-tick"
          aria-label={`${p.symbol}, open brief`}
          onClick={e => e.stopPropagation()}
        >
          {p.symbol}
        </Link>
      </td>
      <td className="num pf-mono">{p.qty}</td>
      <td className="num pf-mono">{money2(p.price)}</td>
      <td className="num pf-mono">{money0(p.value)}</td>
      <td>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="pf-bar" aria-hidden="true">
            <span
              className="fill"
              style={{
                width: `${cap != null ? barWidth(p.weight_pct, cap) : Math.min(100, p.weight_pct)}%`,
                background: state ? CAP_BAR_COLOR[state] : 'var(--accent)',
              }}
            />
            {cap != null && <span className="cap" />}
          </span>
          <span style={{ font: '500 12px var(--mono)', width: 44, textAlign: 'right' }}>
            {pct(p.weight_pct)}
          </span>
        </span>
      </td>
      <td className="num pf-mono" style={{ color: p.pnl >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
        {signedMoney0(p.pnl)}
      </td>
      <td>
        {state && (
          <Pill tone={CAP_PILL[state].tone} style={{ height: 20, lineHeight: '20px' }}>
            {CAP_PILL[state].word}
          </Pill>
        )}
      </td>
    </tr>
  );
}

function Skeletons() {
  return (
    <div data-testid="pf-loading" style={{ display: 'grid', gap: 20 }}>
      <SkeletonBlock label="Loading portfolio" widths={[30, 100, 80]} />
      <SkeletonBlock label="Loading positions" widths={[100, 90, 95, 85, 70]} />
    </div>
  );
}

/** Portfolio and risk (FE-07): KPIs, positions vs cap, sector weights, equity curve vs SPY, rule status + editor. */
export default function Screen() {
  const pq = usePortfolio();
  const rq = usePortfolioRisk();
  const perfQ = usePortfolioPerformance();
  const navigate = useNavigate();
  const p = pq.data;
  const r = rq.data;

  if (pq.isLoading)
    return (
      <div data-testid="screen-portfolio">
        <Skeletons />
      </div>
    );
  if (pq.isError || !p)
    return (
      <div data-testid="screen-portfolio">
        <ErrorPanel error={pq.error} onRetry={() => void pq.refetch()} />
      </div>
    );

  const capPos = limitFor(r, 'pos');
  const capSec = limitFor(r, 'sec');
  const positions = [...p.positions].sort((a, b) => b.weight_pct - a.weight_pct);
  const sectors = [...p.sectors].sort((a, b) => b.weight_pct - a.weight_pct);
  const violations = r?.violations ?? [];

  return (
    <Enter
      kind="fade"
      data-testid="screen-portfolio"
      style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20 }}
    >
      {violations.length > 0 && (
        <div
          role="alert"
          data-testid="pf-violations"
          style={{
            background: 'var(--loss-soft)',
            border: '1px solid var(--loss-line)',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 13,
          }}
        >
          <b style={{ color: 'var(--loss)' }}>Rules currently breached</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {violations.map((v, i) => (
              <li key={i}>{v.message ?? v.rule ?? v.key ?? 'A rule is breached'}</li>
            ))}
          </ul>
          <Link to="/proposals" style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 12 }}>
            See proposals
          </Link>
        </div>
      )}

      <Stagger className="pf-kpis" data-testid="pf-kpis">
        {kpis(p, r).map(k => (
          <div
            key={k.id}
            className="pf-card"
            data-testid={`kpi-${k.id}`}
            style={{ padding: 14, display: 'grid', gap: 4 }}
          >
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{k.label}</span>
            <span style={{ font: '500 22px var(--mono)' }}>{k.value}</span>
            <Pill
              tone={k.tone}
              style={{ justifySelf: 'start', height: 18, lineHeight: '18px', padding: '0 6px' }}
            >
              {k.note}
            </Pill>
          </div>
        ))}
      </Stagger>
      {rq.isError && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }} data-testid="pf-risk-error">
          Risk metrics are unavailable right now.{' '}
          <Button variant="link" size="sm" onClick={() => void rq.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {positions.length === 0 ? (
        <div
          className="sp-empty"
          data-testid="pf-empty"
          style={{ padding: 40, justifyItems: 'center', gap: 12 }}
        >
          <div style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>No positions yet</div>
          <div style={{ color: 'var(--ink-2)', maxWidth: 420 }}>
            Your paper portfolio holds only cash. Place a simulated trade and the risk engine will track
            weights, concentration and your rules here.
          </div>
          <Button variant="primary" onClick={() => navigate('/trading')}>
            Open order ticket
          </Button>
        </div>
      ) : (
        <div className="pf-main">
          <section className="pf-card" style={{ overflow: 'hidden' }} aria-labelledby="pf-pos-h">
            <div style={{ padding: '16px 16px 4px' }}>
              <h2 id="pf-pos-h" style={{ font: "600 14px 'Geist'", margin: 0 }}>
                Positions
              </h2>
            </div>
            <div className="pf-table-wrap" tabIndex={0} role="region" aria-label="Positions (scrollable)">
              <table className="pf-table" data-testid="pf-positions">
                <thead>
                  <tr>
                    <th scope="col">Ticker</th>
                    <th scope="col" className="num">
                      Qty
                    </th>
                    <th scope="col" className="num">
                      Price
                    </th>
                    <th scope="col" className="num">
                      Value
                    </th>
                    <th scope="col" style={{ minWidth: 150 }}>
                      Weight vs cap
                    </th>
                    <th scope="col" className="num">
                      P&amp;L
                    </th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map(pos => (
                    <Row key={pos.symbol} p={pos} cap={capPos} />
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--ink-3)' }}>
              {capPos != null && <>The black tick marks your {capPos}% maximum position. </>}Click a row to
              open its brief.
            </div>
          </section>

          <div style={{ display: 'grid', gap: 24 }}>
            <section
              className="pf-card"
              style={{ padding: 18, display: 'grid', gap: 12 }}
              data-testid="pf-sectors"
              aria-labelledby="pf-sec-h"
            >
              <h2 id="pf-sec-h" style={{ font: "600 14px 'Geist'", margin: 0 }}>
                Sector weights
              </h2>
              {sectors.map(s => {
                const state = capSec != null ? capState(s.weight_pct, capSec) : null;
                return (
                  <div key={s.sector} style={{ display: 'grid', gap: 4 }} data-testid={`sector-${s.sector}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{s.sector}</span>
                      <span style={{ font: '500 12px var(--mono)' }}>{pct(s.weight_pct)}</span>
                    </div>
                    <span
                      className="pf-bar"
                      role="img"
                      aria-label={`${s.sector} ${pct(s.weight_pct)}${capSec != null ? ` of ${capSec}% limit` : ''}`}
                    >
                      <span
                        className="fill"
                        style={{
                          width: `${capSec != null ? barWidth(s.weight_pct, capSec) : Math.min(100, s.weight_pct)}%`,
                          background: state ? CAP_BAR_COLOR[state] : 'var(--accent)',
                        }}
                      />
                      {capSec != null && <span className="cap" />}
                    </span>
                  </div>
                );
              })}
              {capSec != null && (
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  Black tick: your {capSec}% sector limit.
                </div>
              )}
            </section>
            {perfQ.isLoading ? (
              <SkeletonBlock label="Loading equity curve" widths={[100, 100, 60]} />
            ) : perfQ.data ? (
              <EquityCurve perf={perfQ.data} />
            ) : (
              <div
                className="pf-card"
                style={{ padding: 18, display: 'grid', gap: 8 }}
                data-testid="pf-curve-error"
              >
                <h2 style={{ font: "600 14px 'Geist'", margin: 0 }}>Equity curve vs S&amp;P 500</h2>
                <ErrorPanel error={perfQ.error} onRetry={() => void perfQ.refetch()} />
              </div>
            )}
          </div>
        </div>
      )}

      {r ? (
        <RulesPanel risk={r} />
      ) : rq.isLoading ? (
        <SkeletonBlock label="Loading rules" widths={[40, 100]} />
      ) : (
        <section className="pf-card" style={{ padding: 20 }}>
          <ErrorPanel error={rq.error} title="Rule status is unavailable" onRetry={() => void rq.refetch()} />
        </section>
      )}
    </Enter>
  );
}
