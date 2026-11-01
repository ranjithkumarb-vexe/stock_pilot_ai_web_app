import { Link, useNavigate } from 'react-router-dom';
import { useAlerts } from '@/api/hooks/alerts';
import { useProfile } from '@/api/hooks/profile';
import { useWatchlist } from '@/api/hooks/watchlist';
import { Stagger } from '@/motion';
import { AiGlyph } from '@/motion/AiGlyph';
import { useTrack } from '@/telemetry';
import { FreshnessBadge, useMergedQuotes } from '../watchlist/quotes';
import { clockTime, pct, signColor, timeAgo, usd2 } from './format';
import { Panel, SectionError, SkeletonLines } from './panels';

export function PilotActivity() {
  const q = useProfile();
  const events = q.data?.recent_events.slice(0, 5) ?? [];
  return (
    <Panel
      title="Pilot activity"
      testId="dash-activity"
      padding={16}
      aside={<AiGlyph size={22} label="Pilot" />}
    >
      {q.isPending && <SkeletonLines rows={4} label="Loading activity" />}
      {q.isError && <SectionError error={q.error} what="activity" onRetry={() => void q.refetch()} />}
      {q.data && events.length === 0 && (
        <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
          No activity yet. It fills in as you use the app.
        </span>
      )}
      {events.length > 0 && (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 7 }}>
          {events.map(e => (
            <li
              key={e.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '46px minmax(0,1fr)',
                gap: 8,
                font: '500 11px/1.45 var(--mono)',
                color: 'var(--ink-3)',
              }}
            >
              <span>{clockTime(e.ts)}</span>
              <span style={{ color: 'var(--ink)' }}>{e.text}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/** Top five watchlist names by absolute day move. Prices prefer the SSE stream and fall back to the polled quote. */
export function Movers() {
  const q = useWatchlist();
  const quotes = useMergedQuotes(q.data?.items);
  const navigate = useNavigate();
  const track = useTrack();
  const rows = (q.data?.items ?? [])
    .map(it => ({ it, quote: quotes.get(it.symbol) ?? null }))
    .sort((a, b) => Math.abs(b.quote?.change_pct ?? 0) - Math.abs(a.quote?.change_pct ?? 0))
    .slice(0, 5);
  return (
    <Panel
      title="Watchlist movers"
      testId="dash-movers"
      aside={
        <Link to="/watchlist" style={{ fontSize: 12 }}>
          Manage
        </Link>
      }
    >
      {q.isPending && <SkeletonLines rows={4} label="Loading movers" />}
      {q.isError && <SectionError error={q.error} what="your watchlist" onRetry={() => void q.refetch()} />}
      {q.data && rows.length === 0 && (
        <span data-testid="movers-empty" style={{ fontSize: 13, color: 'var(--ink-3)' }}>
          Your watchlist is empty. <Link to="/watchlist">Add a ticker</Link> to follow it here.
        </span>
      )}
      {rows.length > 0 && (
        <Stagger>
          {rows.map(({ it, quote }) => (
            <button
              key={it.symbol}
              type="button"
              className="dash-mover"
              data-testid={`mover-${it.symbol}`}
              onClick={() => {
                track({
                  type: 'ticker_viewed',
                  entity: { ticker: it.symbol },
                  props: { action: 'dashboard_mover' },
                });
                navigate(`/brief/${it.symbol}`);
              }}
              aria-label={`${it.symbol}${it.name ? ` ${it.name}` : ''}, ${quote ? `${usd2(quote.price)}, ${pct(quote.change_pct, 2)}` : 'no quote'}. Open brief`}
            >
              <b style={{ font: '600 13px var(--mono)' }}>{it.symbol}</b>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)' }}>
                  {quote ? usd2(quote.price) : '—'}
                </span>
                <FreshnessBadge quote={quote} />
              </span>
              <span
                style={{
                  font: '500 12px var(--mono)',
                  color: quote ? signColor(quote.change_pct) : 'var(--ink-3)',
                }}
              >
                {quote ? pct(quote.change_pct, 2) : '—'}
              </span>
            </button>
          ))}
        </Stagger>
      )}
    </Panel>
  );
}

export function Upcoming() {
  const q = useAlerts({ type: 'earnings' });
  const items = (q.data?.items ?? []).filter(a => a.state !== 'dismissed');
  return (
    <Panel title="Upcoming" testId="dash-upcoming">
      {q.isPending && <SkeletonLines rows={2} label="Loading upcoming events" />}
      {q.isError && <SectionError error={q.error} what="upcoming events" onRetry={() => void q.refetch()} />}
      {q.data && items.length === 0 && (
        <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>No dated events for your holdings.</span>
      )}
      {items.slice(0, 4).map(a => (
        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
          <span>{a.title}</span>
          <span style={{ color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
            {a.source_label || timeAgo(a.created_at)}
          </span>
        </div>
      ))}
    </Panel>
  );
}
