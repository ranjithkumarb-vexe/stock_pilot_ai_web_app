import { useState } from 'react';
import { describeError } from '@/api/errors';
import type { OrderCheck, OrderRequest, OrderSide, OrderType, Quote } from '@/api/types';
import { useOnline } from '@/shell/hooks';
import { SegmentedControl } from '@/ui';
import { useOrderPreview, useOrderSubmit } from '@/features/trading/api';
import { DASH, usd0, usd2 } from '@/features/trading/format';
import '@/features/trading/shared.css';

const onlyDigits = (v: string) => v.replace(/\D/g, '');
const onlyDecimal = (v: string) => v.replace(/[^0-9.]/g, '');

type Note = { side: string; col: string; label: string; detail: string };

const notesFrom = (side: string, checks: OrderCheck[] | null): Note[] =>
  (checks ?? [])
    .filter(c => c.severity !== 'pass')
    .map(c => ({
      side,
      col: c.severity === 'note' ? 'var(--warn)' : 'var(--loss)',
      label: c.label,
      detail: c.detail,
    }));

/** Compact Buy / Sell panel under the chart (design right column). Same preview + idempotent submit as the ticket. */
export function MiniTicket({ symbol, quote }: { symbol: string; quote: Quote | null }) {
  const online = useOnline();
  const [type, setType] = useState<OrderType>('market');
  const [qtyText, setQtyText] = useState('10');
  const [limitText, setLimitText] = useState('');
  const [error, setError] = useState<unknown>(null);
  const qty = Math.max(0, Math.floor(Number(qtyText) || 0));
  const limit = Number(limitText) || 0;
  const limitBad = type === 'limit' && !(limit > 0);

  const mk = (side: OrderSide): OrderRequest | null =>
    symbol && qty >= 1 && !limitBad
      ? { symbol, side, type, qty, ...(type === 'limit' ? { limit_price: limit } : {}) }
      : null;
  const buyReq = mk('buy');
  const sellReq = mk('sell');
  const buy = useOrderPreview(buyReq);
  const sell = useOrderPreview(sellReq);
  const { submit, pending } = useOrderSubmit();

  const notes: Note[] = [];
  if (limitBad)
    notes.push({ side: 'Limit', col: 'var(--loss)', label: 'Limit price', detail: 'Enter a price above $0' });
  const buyNotes = notesFrom('Buy', buy.checks);
  notes.push(...buyNotes);
  notes.push(
    ...notesFrom('Sell', sell.checks).filter(
      n => !buyNotes.some(b => b.label === n.label && b.detail === n.detail),
    ),
  );
  const checking = (buy.loading || sell.loading) && !!buyReq;
  const allPass = !limitBad && !checking && !!buy.checks && !!sell.checks && notes.length === 0;

  const run = async (side: OrderSide) => {
    const req = side === 'buy' ? buyReq : sellReq;
    if (!req) return;
    setError(null);
    const out = await submit(req, { source: 'live' });
    if (out?.kind === 'error') setError(out.error);
  };

  const buyOff = !buyReq || buy.blocked || buy.loading || !!buy.error || pending || !online;
  const sellOff = !sellReq || sell.blocked || sell.loading || !!sell.error || pending || !online;
  const priceLabel = (v: number | null | undefined) =>
    type === 'limit' ? (limit > 0 ? `Limit ${usd2(limit)}` : 'Set limit') : v != null ? usd2(v) : 'Market';
  const err = error ? describeError(error) : null;

  return (
    <section
      className="s3-card"
      style={{ padding: 14, gap: 10 }}
      data-testid="live-ticket"
      aria-label="Quick paper order"
    >
      <SegmentedControl
        aria-label="Order type"
        value={type}
        onChange={v => setType(v)}
        options={[
          { value: 'market', label: 'Market' },
          { value: 'limit', label: 'Limit' },
        ]}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          className="s3-stepper"
          style={{ width: 34, height: 36 }}
          aria-label="Fewer shares"
          onClick={() => setQtyText(String(Math.max(1, qty - 1)))}
        >
          &#8722;
        </button>
        <input
          className="s3-input s3-input--num"
          style={{ flex: 1, height: 36, fontSize: 14 }}
          aria-label="Shares"
          inputMode="numeric"
          data-testid="live-qty"
          value={qtyText}
          onChange={e => setQtyText(onlyDigits(e.target.value))}
        />
        <button
          type="button"
          className="s3-stepper"
          style={{ width: 34, height: 36 }}
          aria-label="More shares"
          onClick={() => setQtyText(String(qty + 1))}
        >
          +
        </button>
      </div>
      {type === 'limit' && (
        <label className="s3-field">
          Limit price
          <input
            className="s3-input s3-input--num"
            style={{ height: 36, fontSize: 14 }}
            inputMode="decimal"
            placeholder="0.00"
            data-testid="live-limit"
            value={limitText}
            onChange={e => setLimitText(onlyDecimal(e.target.value))}
          />
        </label>
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          font: '500 12px var(--mono)',
          color: 'var(--ink-2)',
        }}
      >
        <span>{type === 'limit' ? 'Est. value at limit' : 'Est. value'}</span>
        <span>{buy.estimate.value != null ? usd0(buy.estimate.value) : DASH}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          data-testid="live-buy"
          className="live-trade live-trade--buy"
          disabled={buyOff}
          onClick={() => void run('buy')}
        >
          Buy<span>{priceLabel(quote?.ask)}</span>
        </button>
        <button
          type="button"
          data-testid="live-sell"
          className="live-trade live-trade--sell"
          disabled={sellOff}
          onClick={() => void run('sell')}
        >
          Sell<span>{priceLabel(quote?.bid)}</span>
        </button>
      </div>
      <div style={{ display: 'grid', gap: 4 }} aria-live="polite" data-testid="live-notes">
        {notes.map((n, i) => (
          <div key={i} style={{ fontSize: 12, lineHeight: 1.4 }}>
            <b style={{ color: n.col }}>{n.side}</b> {n.label}:{' '}
            <span style={{ color: 'var(--ink-2)' }}>{n.detail}</span>
          </div>
        ))}
        {(buy.error || sell.error) && notes.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--loss)' }}>
            Could not run the pre-trade checks. Try again.
          </div>
        )}
        {allPass && (
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
            <span style={{ color: 'var(--gain)' }}>&#10003;</span> All pre-trade risk checks pass
          </div>
        )}
        {err && (
          <div
            role="alert"
            style={{ fontSize: 12, color: 'var(--loss)', fontWeight: 600 }}
            data-testid="live-error"
          >
            {err.title}. {err.serverMessage ?? err.message}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
        Paper trade. No real order is placed. Duplicate clicks are ignored. Rule limits cannot be overridden
        here.
      </div>
    </section>
  );
}
