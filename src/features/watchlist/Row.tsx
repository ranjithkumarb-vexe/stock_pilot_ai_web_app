import { useNavigate } from 'react-router-dom';
import type { Quote, WatchlistItem } from '@/api/types';
import { useTrack } from '@/telemetry';
import { Pill, Sparkline } from '@/ui';
import { pct, signColor, usd2 } from '../dashboard/format';
import { useTrend } from './api';
import { FreshnessBadge } from './quotes';

type Props = {
  item: WatchlistItem;
  quote: Quote | null;
  /** portfolio weight in percent, or null when not held */
  held: number | null | undefined;
  /** learned interest 0..1 for this sector, or null when unknown */
  interest: number | null;
  removing: boolean;
  onRemove: (symbol: string) => void;
};

export function Row({ item, quote, held, interest, removing, onRemove }: Props) {
  const navigate = useNavigate();
  const track = useTrack();
  const trend = useTrend(item.symbol);
  const up = (quote?.change_pct ?? 0) >= 0;
  const im = interest == null ? null : Math.round(interest * 100);

  return (
    <tr className="wl-row" data-testid={`wl-row-${item.symbol}`}>
      <td className="c-co">
        <b style={{ font: '600 13px var(--mono)' }}>{item.symbol}</b>{' '}
        <span style={{ color: 'var(--ink-2)' }}>{item.name}</span>
      </td>
      <td className="c-sec" style={{ color: 'var(--ink-2)' }}>
        {item.sector}
      </td>
      <td className="c-px wl-num" data-testid={`wl-px-${item.symbol}`}>
        {quote ? usd2(quote.price) : '—'}
      </td>
      <td className="c-day wl-num" style={{ color: quote ? signColor(quote.change_pct) : 'var(--ink-3)' }}>
        {quote ? pct(quote.change_pct, 2) : '—'}
      </td>
      <td className="c-fresh">
        <FreshnessBadge quote={quote} />
      </td>
      <td className="c-trend">
        {trend.data && trend.data.length > 1 ? (
          <Sparkline values={trend.data} positive={up} label={`${item.symbol} 20-day trend`} />
        ) : (
          <span aria-label="No trend available" style={{ color: 'var(--ink-3)' }}>
            —
          </span>
        )}
      </td>
      <td className="c-held wl-num" data-label="Held">
        {held != null ? `${held.toFixed(1)}%` : '—'}
      </td>
      <td className="c-int wl-num" data-label="Interest">
        {im == null ? (
          '—'
        ) : (
          <Pill tone={im >= 60 ? 'ok' : im >= 35 ? 'n' : 'warn'} style={{ fontFamily: 'var(--mono)' }}>
            {im}%
          </Pill>
        )}
      </td>
      <td className="c-act">
        <div className="wl-actions">
          <button
            type="button"
            className="sp-btn sp-btn--primary sp-btn--sm"
            style={{ height: 28 }}
            data-testid={`wl-brief-${item.symbol}`}
            aria-label={`Open ${item.symbol} brief`}
            onClick={() => {
              track({
                type: 'ticker_viewed',
                entity: { ticker: item.symbol },
                props: { action: 'watchlist_brief' },
              });
              navigate(`/brief/${item.symbol}`);
            }}
          >
            Brief
          </button>
          <button
            type="button"
            className="sp-btn sp-btn--secondary sp-btn--sm"
            style={{ height: 28 }}
            data-testid={`wl-trade-${item.symbol}`}
            aria-label={`Trade ${item.symbol}`}
            onClick={() => navigate('/trading', { state: { symbol: item.symbol, side: 'buy' } })}
          >
            Trade
          </button>
          <button
            type="button"
            className="wl-remove"
            data-testid={`wl-remove-${item.symbol}`}
            aria-label={`Remove ${item.symbol} from watchlist`}
            disabled={removing}
            onClick={() => onRemove(item.symbol)}
          >
            Remove
          </button>
        </div>
      </td>
    </tr>
  );
}
