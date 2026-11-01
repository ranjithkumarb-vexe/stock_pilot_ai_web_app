import { feedOf } from '@/features/trading/api';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBars, useMarketStatus, useQuotes } from '@/api/hooks/quotes';
import { usePortfolio } from '@/api/hooks/portfolio';
import { useUniverse } from '@/api/hooks/watchlist';
import { useLiveQuote, useStream } from '@/realtime';
import { ErrorPanel } from '@/shell/ErrorBoundary';
import { useOnline } from '@/shell/hooks';
import { useTrack } from '@/telemetry';
import { Loop } from '@/motion';
import { Pill, Skeleton } from '@/ui';
import {
  clockTime,
  DASH,
  int,
  pct,
  signedUsd0,
  signedUsd2,
  toneVar,
  usd0,
  usd2,
} from '@/features/trading/format';
import '@/features/trading/shared.css';
import { feedView } from './feedView';
import { applyTick, normalizeBars, type CBar } from './chartData';
import { MiniTicket } from './MiniTicket';
import { SimulatePanel } from './SimulatePanel';
import './live.css';

const LiveChart = lazy(() => import('./LiveChart').then(m => ({ default: m.LiveChart })));

type Tick = { id: number; ts: number; price: number; up: boolean };
const DELAYED_EVERY_MS = 5000;
const TAPE_MAX = 8;

/** FE-08 · Live market: 5 m candles + volume (`/bars`), SSE ticks fold into the last candle, paper quick-ticket. */
export default function Screen() {
  const [params] = useSearchParams();
  const universe = useUniverse();
  const market = useMarketStatus();
  const online = useOnline();
  const track = useTrack();
  const [picked, setSymbol] = useState((params.get('symbol') ?? '').toUpperCase());
  const [showTable, setShowTable] = useState(false);
  const [chartFail, setChartFail] = useState(false);

  const items = universe.data?.items;
  const symbol = picked || items?.[0]?.symbol || '';
  useEffect(() => {
    if (symbol) track({ type: 'ticker_viewed', entity: { ticker: symbol }, props: { action: 'live' } });
  }, [symbol, track]);

  const barsQ = useBars(symbol, '5m', 200);
  const base = useMemo(() => normalizeBars(barsQ.data?.bars), [barsQ.data]);
  // ticks fold into an overlay that belongs to one (symbol, base series); a new base discards it
  const [overlay, setOverlay] = useState<{ base: CBar[]; bars: CBar[] } | null>(null);
  const [tapeState, setTapeState] = useState<{ symbol: string; rows: Tick[] }>({ symbol: '', rows: [] });
  const bars = overlay && overlay.base === base ? overlay.bars : base;
  const tape = tapeState.symbol === symbol ? tapeState.rows : [];

  const liveQ = useLiveQuote(symbol || undefined);
  const polled = useQuotes(symbol ? [symbol] : []);
  const quote = liveQ ?? polled.data?.items.find(q => q.symbol === symbol) ?? null;

  const open = market.data?.open ?? true;
  const mfeed = feedOf(market.data);
  const frozenMsg = !online
    ? 'Offline · chart paused'
    : !open
      ? 'Closed · last close'
      : mfeed === 'stale'
        ? 'Stale · updates paused'
        : mfeed === 'reconnecting'
          ? 'Reconnecting · updates paused'
          : mfeed === 'delayed'
            ? 'Delayed · updates every 5 s'
            : '';
  const paused = !online || !open || mfeed === 'stale' || mfeed === 'reconnecting';

  // SSE `quote` events (single connection owned by StreamProvider) fold into the last candle
  const { subscribe, state: streamState } = useStream();
  const feedV = feedView(!!market.data, open, mfeed, streamState);
  const live = useRef({ paused, delayed: mfeed === 'delayed', symbol, base });
  useEffect(() => {
    live.current = { paused, delayed: mfeed === 'delayed', symbol, base };
  });
  const lastApplied = useRef(0);
  const seq = useRef(0);
  useEffect(
    () =>
      subscribe(e => {
        if (e.type !== 'quote') return;
        const cur = live.current;
        const q = e.data;
        if (cur.paused || q.symbol !== cur.symbol) return;
        if (cur.delayed && Date.now() - lastApplied.current < DELAYED_EVERY_MS) return;
        lastApplied.current = Date.now();
        const ms = Date.parse(q.ts);
        const tsSec = Number.isNaN(ms) ? Math.floor(Date.now() / 1000) : Math.floor(ms / 1000);
        setOverlay(o => ({
          base: cur.base,
          bars: applyTick(o && o.base === cur.base ? o.bars : cur.base, q.price, tsSec),
        }));
        setTapeState(t => {
          const rows = t.symbol === cur.symbol ? t.rows : [];
          const prevPx = rows[0]?.price ?? q.prev_close ?? q.price;
          return {
            symbol: cur.symbol,
            rows: [{ id: ++seq.current, ts: tsSec, price: q.price, up: q.price >= prevPx }, ...rows].slice(
              0,
              TAPE_MAX,
            ),
          };
        });
      }),
    [subscribe],
  );

  const lastBar = bars[bars.length - 1];
  const price = quote?.price ?? lastBar?.close ?? null;
  const prevClose = quote?.prev_close ?? null;
  const chg = price != null && prevClose != null ? price - prevClose : null;
  const col = toneVar(quote?.change_pct ?? chg);
  const portfolio = usePortfolio();
  const pos = portfolio.data?.positions.find(p => p.symbol === symbol);

  const alt = `Candlestick chart of ${symbol || 'the selected symbol'} in 5 minute bars. ${
    price != null
      ? `Last price ${usd2(price)}${quote?.change_pct != null ? `, ${quote.change_pct >= 0 ? 'up' : 'down'} ${Math.abs(quote.change_pct).toFixed(2)} percent on the day` : ''}. `
      : ''
  }Open the data table for the latest bars.`;
  const rows = bars.slice(-8).reverse();

  return (
    <div data-testid="screen-live" style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--ink-2)',
          }}
        >
          Symbol
          <select
            className="s3-select"
            style={{ height: 36, font: '600 13px var(--mono)' }}
            data-testid="live-symbol"
            value={symbol}
            disabled={universe.isLoading}
            onChange={e => setSymbol(e.target.value)}
          >
            {(items ?? []).map(u => (
              <option key={u.symbol} value={u.symbol}>
                {u.symbol} · {u.name}
              </option>
            ))}
            {symbol && !(items ?? []).some(u => u.symbol === symbol) && (
              <option value={symbol}>{symbol}</option>
            )}
          </select>
        </label>
        <div style={{ font: '600 30px var(--mono)', color: col }} data-testid="live-price" aria-live="off">
          {usd2(price)}
        </div>
        <div style={{ font: '600 13px var(--mono)', color: col }} data-testid="live-change">
          {chg != null ? signedUsd2(chg).replace('$', '') : ''} {quote ? `(${pct(quote.change_pct)})` : ''}
        </div>
        <span style={{ flex: 1 }} />
        <Pill
          tone={feedV.tone}
          data-testid="live-feed"
          title={feedV.tip}
          style={{ height: 24, lineHeight: '24px', fontFamily: 'var(--mono)' }}
        >
          <Loop
            kind={feedV.loop}
            duration={1.2}
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'currentColor',
              marginRight: 6,
            }}
          />
          {feedV.label}
        </Pill>
        <span style={{ font: '600 11px var(--mono)', color: 'var(--ink-3)' }}>PAPER ONLY · SIMULATED</span>
      </div>

      <div className="live-layout">
        <div className="live-main">
          <div className="live-chart-box" role="figure" aria-label={alt} data-testid="live-chart-box">
            {symbol && !chartFail && !barsQ.isError && (
              <Suspense fallback={null}>
                <LiveChart symbol={symbol} bars={bars} onFail={setChartFail} />
              </Suspense>
            )}
            <span
              style={{
                position: 'absolute',
                left: 12,
                top: 8,
                zIndex: 2,
                pointerEvents: 'none',
                font: '600 10px var(--mono)',
                letterSpacing: '.08em',
                color: 'var(--ink-3)',
              }}
            >
              {symbol} · 5M · CANDLES + VOLUME
            </span>
            {frozenMsg && (
              <Pill
                tone={feedV.tone}
                data-testid="live-frozen"
                style={{ position: 'absolute', right: 12, top: 8, zIndex: 2 }}
              >
                {frozenMsg}
              </Pill>
            )}
            {barsQ.isLoading && (
              <div
                role="status"
                aria-busy="true"
                aria-label="Loading chart"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeContent: 'center',
                  gap: 10,
                  width: '60%',
                  margin: 'auto',
                  background: 'var(--surface)',
                }}
              >
                <Skeleton width={100} height={14} />
                <Skeleton width={80} height={14} />
                <Skeleton width={90} height={14} />
              </div>
            )}
            {barsQ.isError && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeContent: 'center',
                  background: 'var(--surface)',
                  padding: 16,
                }}
              >
                <ErrorPanel
                  error={barsQ.error}
                  title="Chart data could not load"
                  onRetry={() => void barsQ.refetch()}
                />
              </div>
            )}
            {!barsQ.isLoading && !barsQ.isError && !chartFail && symbol && bars.length === 0 && (
              <div
                data-testid="live-nobars"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeContent: 'center',
                  textAlign: 'center',
                  gap: 6,
                  color: 'var(--ink-2)',
                  fontSize: 13,
                }}
              >
                <b>No price bars yet</b>
                <span>Bars appear once the market data feed has history for {symbol}.</span>
              </div>
            )}
            {chartFail && (
              <div
                data-testid="live-chart-fail"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeContent: 'center',
                  textAlign: 'center',
                  gap: 6,
                  background: 'var(--surface)',
                  color: 'var(--ink-2)',
                  fontSize: 13,
                }}
              >
                <b>Chart could not load</b>
                <span>The chart library is unavailable. Use the data table below.</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="s3-btn-sm"
              data-testid="live-table-toggle"
              aria-expanded={showTable || chartFail}
              aria-controls="live-table"
              onClick={() => setShowTable(v => !v)}
            >
              {showTable || chartFail ? 'Hide chart data table' : 'Show chart data table'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              Prices from IEX may differ slightly from the consolidated market price.
            </span>
          </div>
          {(showTable || chartFail) && (
            <div
              id="live-table"
              className="s3-card s3-table-wrap"
              style={{ padding: 0 }}
              tabIndex={0}
              role="region"
              aria-label="Latest bars (scrollable)"
            >
              <table className="s3-table" style={{ minWidth: 420 }} data-testid="live-table">
                <caption className="sr-only">Latest 5 minute bars for {symbol}</caption>
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col" className="r">
                      Open
                    </th>
                    <th scope="col" className="r">
                      High
                    </th>
                    <th scope="col" className="r">
                      Low
                    </th>
                    <th scope="col" className="r">
                      Close
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.time}>
                      <td style={{ color: 'var(--ink-2)', fontFamily: 'var(--mono)' }}>
                        {clockTime(r.time)}
                      </td>
                      <td className="r">{r.open.toFixed(2)}</td>
                      <td className="r">{r.high.toFixed(2)}</td>
                      <td className="r">{r.low.toFixed(2)}</td>
                      <td className="r">{r.close.toFixed(2)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ color: 'var(--ink-3)' }}>
                        No bars to show.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))',
              gap: 14,
            }}
          >
            <section
              className="s3-card"
              style={{ padding: '12px 0', gap: 0 }}
              data-testid="live-tape"
              aria-label="Tick tape"
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0 14px 6px',
                  font: '600 10px var(--mono)',
                  letterSpacing: '.06em',
                  color: 'var(--ink-3)',
                }}
              >
                <span>TICKS</span>
                <span>PRICE</span>
              </div>
              {tape.map(t => (
                <div
                  key={t.id}
                  data-testid="tape-row"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '2px 14px',
                    font: '500 12px var(--mono)',
                  }}
                >
                  <span style={{ color: 'var(--ink-3)' }}>{clockTime(t.ts, true)}</span>
                  <span style={{ color: t.up ? 'var(--gain)' : 'var(--loss)' }}>{t.price.toFixed(2)}</span>
                </div>
              ))}
              {tape.length === 0 && (
                <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--ink-3)' }}>
                  Waiting for the first tick. The tape is paused when the market is closed or the feed is
                  stale.
                </div>
              )}
            </section>
            <section
              className="s3-card"
              style={{ padding: 14, gap: 6, alignContent: 'start' }}
              data-testid="live-position"
              aria-label={`Position ${symbol}`}
            >
              <div style={{ font: '600 10px var(--mono)', letterSpacing: '.08em', color: 'var(--ink-3)' }}>
                POSITION · {symbol}
              </div>
              {[
                ['Shares', pos ? int(pos.qty) : portfolio.isLoading ? DASH : '0', undefined],
                ['Average cost', pos ? usd2(pos.avg_cost) : 'n/a', undefined],
                ['Open P&L', pos ? signedUsd0(pos.pnl) : 'n/a', pos ? toneVar(pos.pnl) : undefined],
                ['Paper cash', usd0(portfolio.data?.cash), undefined],
              ].map(([l, v, c]) => (
                <div
                  key={l}
                  style={{ display: 'flex', justifyContent: 'space-between', font: '500 13px var(--mono)' }}
                >
                  <span style={{ color: 'var(--ink-2)' }}>{l}</span>
                  <b style={{ color: c ?? 'var(--ink)' }}>{v}</b>
                </div>
              ))}
            </section>
          </div>
        </div>

        <div className="live-side">
          {quote && quote.bid != null && quote.ask != null && (
            <section
              className="s3-card"
              style={{ padding: 14, gap: 6 }}
              data-testid="live-quote"
              aria-label="Bid and ask"
            >
              <div style={{ font: '600 10px var(--mono)', letterSpacing: '.08em', color: 'var(--ink-3)' }}>
                TOP OF BOOK
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 13px var(--mono)' }}>
                <span style={{ color: 'var(--ink-2)' }}>Bid</span>
                <span style={{ color: 'var(--gain)' }}>{usd2(quote.bid)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 13px var(--mono)' }}>
                <span style={{ color: 'var(--ink-2)' }}>Ask</span>
                <span style={{ color: 'var(--loss)' }}>{usd2(quote.ask)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  font: '500 13px var(--mono)',
                  borderTop: '1px solid var(--line)',
                  paddingTop: 6,
                }}
              >
                <span style={{ color: 'var(--ink-2)' }}>Spread</span>
                <span>{(quote.ask - quote.bid).toFixed(2)}</span>
              </div>
            </section>
          )}
          <MiniTicket symbol={symbol} quote={quote} />
          <SimulatePanel />
        </div>
      </div>
    </div>
  );
}
