import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { describeError } from '@/api/errors';
import { useMarketStatus, useQuotes } from '@/api/hooks/quotes';
import { useUniverse } from '@/api/hooks/watchlist';
import type { OrderCheck, OrderRequest, OrderSide, OrderType } from '@/api/types';
import { useLiveQuote } from '@/realtime';
import { useOnline } from '@/shell/hooks';
import { useTrack } from '@/telemetry';
import { Pill, SegmentedControl, type Tone } from '@/ui';
import { CheckList } from './CheckList';
import { feedOf, useOrderPreview, useOrderSubmit } from './api';
import { DASH, usd0, usd2 } from './format';
import './shared.css';

type Seed = { symbol?: string; side?: OrderSide; qty?: number };

/** Deep links: `?symbol=AAPL&side=buy&qty=5` or router state `{ tkt: { t, side, q } }` (design) / `{ ticket: {...} }`. */
function useSeed(): Seed {
  const loc = useLocation();
  const [params] = useSearchParams();
  return useMemo(() => {
    const st = (loc.state ?? {}) as { tkt?: { t?: string; side?: string; q?: number }; ticket?: Seed };
    const symbol = params.get('symbol') ?? st.tkt?.t ?? st.ticket?.symbol;
    const side = params.get('side') ?? st.tkt?.side ?? st.ticket?.side;
    const qty = Number(params.get('qty') ?? st.tkt?.q ?? st.ticket?.qty);
    return {
      symbol: symbol ? symbol.toUpperCase() : undefined,
      side: side === 'sell' ? 'sell' : side === 'buy' ? 'buy' : undefined,
      qty: Number.isFinite(qty) && qty >= 1 ? Math.floor(qty) : undefined,
    };
    // read once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const FRESH: Record<string, { label: string; tone: Tone }> = {
  live: { label: 'Live', tone: 'ok' },
  delayed: { label: 'Delayed', tone: 'warn' },
  stale: { label: 'Stale', tone: 'bad' },
  closed: { label: 'Closed', tone: 'n' },
};

const onlyDigits = (v: string) => v.replace(/\D/g, '');
const onlyDecimal = (v: string) => v.replace(/[^0-9.]/g, '');
const dd = { margin: 0, textAlign: 'right', fontFamily: 'var(--mono)' } as const;

export function OrderTicket() {
  const seed = useSeed();
  const universe = useUniverse();
  const market = useMarketStatus();
  const online = useOnline();
  const track = useTrack();
  const [picked, setPicked] = useState(seed.symbol ?? '');
  const [side, setSide] = useState<OrderSide>(seed.side ?? 'buy');
  const [type, setType] = useState<OrderType>('market');
  const [qtyText, setQtyText] = useState(String(seed.qty ?? 1));
  const [limitText, setLimitText] = useState('');
  const [submitError, setSubmitError] = useState<unknown>(null);

  const items = universe.data?.items;
  const symbol = picked || items?.[0]?.symbol || '';
  useEffect(() => {
    if (symbol) track({ type: 'ticker_viewed', entity: { ticker: symbol }, props: { action: 'ticket' } });
  }, [symbol, track]);

  const qty = Math.max(0, Math.floor(Number(qtyText) || 0));
  const limit = Number(limitText) || 0;
  const limitBad = type === 'limit' && !(limit > 0);

  const liveQ = useLiveQuote(symbol || undefined);
  const polled = useQuotes(symbol ? [symbol] : []);
  const quote = liveQ ?? polled.data?.items.find(q => q.symbol === symbol) ?? null;

  const req: OrderRequest | null =
    symbol && qty >= 1 && !limitBad
      ? { symbol, side, type, qty, ...(type === 'limit' ? { limit_price: limit } : {}) }
      : null;
  const preview = useOrderPreview(req);
  const { submit, pending } = useOrderSubmit();

  const open = market.data?.open ?? true;
  const staleMarket =
    type === 'market' && open && (feedOf(market.data) === 'stale' || quote?.freshness === 'stale');

  const extra: OrderCheck[] = [];
  if (limitBad)
    extra.push({
      key: 'limit_price',
      ok: false,
      severity: 'blocked',
      label: 'Limit price',
      detail: 'Enter a limit price above $0',
    });
  if (staleMarket && !(preview.checks ?? []).some(c => /stale|fresh/i.test(c.key)))
    extra.push({
      key: 'quote_fresh',
      ok: false,
      severity: 'blocked',
      label: 'Quote freshness',
      detail: 'Quote is stale. Market orders are blocked until the feed recovers.',
    });

  const blockedByChecks = preview.blocked || extra.some(c => c.severity === 'blocked');
  const disabled = !req || pending || preview.loading || blockedByChecks || !online || !!preview.error;
  const verb = side === 'buy' ? 'Buy' : 'Sell';
  const label = !online
    ? 'Offline: orders paused'
    : blockedByChecks
      ? 'Blocked by your rules'
      : preview.loading && req
        ? 'Checking your rules'
        : `${type === 'limit' ? 'Place limit order' : open ? 'Place paper order' : 'Queue paper order'}: ${verb} ${qty} ${symbol}`;

  const onSubmit = async () => {
    if (!req || disabled) return;
    setSubmitError(null);
    const out = await submit(req, { source: 'ticket' });
    if (out?.kind === 'error') setSubmitError(out.error);
  };

  const fresh = quote ? FRESH[quote.freshness] : null;
  const err = submitError ? describeError(submitError) : null;

  return (
    <section className="s3-card" data-testid="ticket" aria-labelledby="ticket-h">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 id="ticket-h" className="s3-h2">
          Order ticket
        </h2>
        <span style={{ font: '600 11px var(--mono)', color: 'var(--ink-3)' }}>PAPER ONLY</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
        <label className="s3-field">
          Ticker
          <select
            className="s3-select"
            data-testid="ticket-symbol"
            value={symbol}
            disabled={universe.isLoading}
            onChange={e => {
              setPicked(e.target.value);
              setSubmitError(null);
            }}
          >
            {universe.isLoading && <option value="">Loading tickers</option>}
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
        <SegmentedControl
          aria-label="Side"
          testId="ticket-side"
          value={side}
          onChange={v => setSide(v)}
          options={[
            { value: 'buy', label: 'Buy' },
            { value: 'sell', label: 'Sell' },
          ]}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
        <div className="s3-field">
          <label htmlFor="ticket-qty">Shares</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="s3-stepper"
              aria-label="Fewer shares"
              onClick={() => setQtyText(String(Math.max(1, qty - 1)))}
            >
              &#8722;
            </button>
            <input
              id="ticket-qty"
              data-testid="ticket-qty"
              className="s3-input s3-input--num"
              style={{ width: 90 }}
              inputMode="numeric"
              value={qtyText}
              onChange={e => setQtyText(onlyDigits(e.target.value))}
            />
            <button
              type="button"
              className="s3-stepper"
              aria-label="More shares"
              onClick={() => setQtyText(String(qty + 1))}
            >
              +
            </button>
          </div>
        </div>
        <div className="s3-field">
          <span>Order type</span>
          <SegmentedControl
            aria-label="Order type"
            testId="ticket-type"
            value={type}
            onChange={v => setType(v)}
            options={[
              { value: 'market', label: 'Market' },
              { value: 'limit', label: 'Limit' },
            ]}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {type === 'limit' && (
          <label className="s3-field">
            Limit price
            <input
              data-testid="ticket-limit"
              className="s3-input s3-input--num"
              style={{ width: 140 }}
              inputMode="decimal"
              placeholder="0.00"
              value={limitText}
              onChange={e => setLimitText(onlyDecimal(e.target.value))}
            />
          </label>
        )}
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {type === 'limit'
            ? 'Day limit order. Fills at your limit price when the last price crosses it. Expires at the close.'
            : 'Market order. Fills at the last price plus or minus 5 bps slippage. Day order.'}
        </span>
      </div>

      <dl
        data-testid="ticket-summary"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px 16px',
          background: 'var(--surface-2)',
          borderRadius: 10,
          padding: 14,
          fontSize: 13,
          margin: 0,
        }}
      >
        <dt style={{ color: 'var(--ink-2)' }}>
          Last price{' '}
          {fresh && (
            <Pill tone={fresh.tone} style={{ marginLeft: 4 }} data-testid="ticket-fresh">
              {fresh.label}
            </Pill>
          )}
        </dt>
        <dd style={dd} data-testid="ticket-px">
          {usd2(quote?.price)}
        </dd>
        <dt style={{ color: 'var(--ink-2)' }}>Est. fill</dt>
        <dd style={dd}>{type === 'limit' && limit > 0 ? usd2(limit) : usd2(preview.estimate.fillPrice)}</dd>
        <dt style={{ color: 'var(--ink-2)' }}>Order value</dt>
        <dd style={dd}>{usd0(preview.estimate.value)}</dd>
        <dt style={{ color: 'var(--ink-2)' }}>Cash after</dt>
        <dd style={dd}>{preview.estimate.cashAfter == null ? DASH : usd0(preview.estimate.cashAfter)}</dd>
      </dl>

      <CheckList
        checks={preview.checks}
        loading={preview.loading && !!req}
        error={preview.error}
        onRetry={preview.retry}
        extra={extra}
        idle={qty < 1 ? 'Enter a quantity to run the checks.' : 'Choose a ticker to run the checks.'}
      />

      <button
        type="button"
        data-testid="ticket-submit"
        className="sp-btn sp-btn--primary sp-btn--lg"
        style={{ width: '100%' }}
        disabled={disabled}
        aria-busy={pending}
        onClick={() => void onSubmit()}
      >
        {pending ? 'Placing paper order' : label}
      </button>

      {err && (
        <div role="alert" className="s3-alert" data-testid="ticket-error">
          <b>{err.title}.</b> {err.serverMessage ?? err.message}
          {err.violations.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontWeight: 400 }}>
              {err.violations.map((v, i) => (
                <li key={i}>{v.message ?? v.rule ?? v.key ?? 'Rule limit'}</li>
              ))}
            </ul>
          )}
          {err.traceId && (
            <div style={{ font: '400 11px var(--mono)', marginTop: 4 }}>Reference: {err.traceId}</div>
          )}
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
        Rule limits cannot be overridden here. Change them on the Portfolio screen, where each change is
        logged. Duplicate clicks are ignored (one idempotency key per order).
      </div>
    </section>
  );
}
