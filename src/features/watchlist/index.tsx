import { useMemo } from 'react';
import { describeError } from '@/api/errors';
import { useProfile } from '@/api/hooks/profile';
import { usePortfolio } from '@/api/hooks/portfolio';
import { useUniverse } from '@/api/hooks/watchlist';
import { Stagger } from '@/motion';
import { ErrorPanel } from '@/shell/ErrorBoundary';
import { IEX_FOOTNOTE } from '@/shell/disclaimer';
import { useShellStatus } from '@/shell/useShellStatus';
import { Button, Pill, SkeletonBlock, useToast } from '@/ui';
import { AddTicker } from './AddTicker';
import { useRemoveTicker, useWatchlistLive, WATCHLIST_LIMIT } from './api';
import { hasIexSource, useMergedQuotes } from './quotes';
import { Row } from './Row';
import './watchlist.css';

/** Watchlist (FE-05): CRUD against the supported universe, live quotes with freshness badges, held weight, learned interest. */
export default function Screen() {
  const wl = useWatchlistLive();
  const universe = useUniverse();
  const portfolio = usePortfolio();
  const profile = useProfile();
  const remove = useRemoveTicker();
  const { say } = useToast();
  const { feed } = useShellStatus();

  const items = wl.data?.items;
  const quotes = useMergedQuotes(items);
  const taken = useMemo(() => new Set((items ?? []).map(i => i.symbol)), [items]);
  const heldBy = useMemo(
    () => new Map((portfolio.data?.positions ?? []).map(p => [p.symbol, p.weight_pct])),
    [portfolio.data],
  );
  const interestBy = useMemo(
    () => new Map((profile.data?.interests ?? []).map(i => [i.dim.toLowerCase(), i.weight])),
    [profile.data],
  );
  const count = items?.length ?? 0;
  const full = count >= WATCHLIST_LIMIT;
  const iex = hasIexSource(quotes.values());

  const onRemove = (symbol: string) =>
    remove.mutate(symbol, {
      onSuccess: () => say(`Removed ${symbol} from your watchlist`),
      onError: e => {
        const d = describeError(e);
        say(`Could not remove ${symbol}. ${d.message}`);
      },
    });

  return (
    <div data-testid="screen-watchlist" style={{ display: 'grid', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: 'var(--ink-2)' }}
        >
          <span data-testid="wl-count">
            {count} of {WATCHLIST_LIMIT} tickers. US large caps only for the MVP.
          </span>
          <Pill tone={feed.tone} title={feed.tip} data-testid="wl-feed">
            {feed.label}
          </Pill>
        </div>
        <AddTicker
          universe={universe.data?.items}
          universeLoading={universe.isPending}
          taken={taken}
          full={full}
          onAdded={s => say(`Added ${s} to your watchlist`)}
        />
      </div>
      {universe.isError && (
        <div role="alert" data-testid="wl-universe-error" style={{ fontSize: 13, color: 'var(--loss)' }}>
          The supported-ticker list could not be loaded, so search is limited.{' '}
          <Button variant="link" onClick={() => void universe.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {wl.isPending && <SkeletonBlock label="Loading your watchlist" widths={[100, 100, 100, 70]} />}
      {wl.isError && (
        <ErrorPanel
          error={wl.error}
          title="Could not load your watchlist"
          onRetry={() => void wl.refetch()}
        />
      )}

      {items && items.length > 0 && (
        <div className="wl-wrap">
          <table className="wl-table" data-testid="wl-table">
            <caption className="sr-only">Your watchlist with live prices and freshness</caption>
            <thead>
              <tr>
                <th scope="col">Company</th>
                <th scope="col">Sector</th>
                <th scope="col" className="wl-num">
                  Price
                </th>
                <th scope="col" className="wl-num">
                  Day
                </th>
                <th scope="col">Feed</th>
                <th scope="col">Trend</th>
                <th scope="col" className="wl-num">
                  Held
                </th>
                <th scope="col" className="wl-num">
                  Interest
                </th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <Stagger as="tbody">
              {items.map(it => (
                <Row
                  key={it.symbol}
                  item={it}
                  quote={quotes.get(it.symbol) ?? null}
                  held={heldBy.get(it.symbol)}
                  interest={
                    profile.isSuccess ? (interestBy.get((it.sector ?? '').toLowerCase()) ?? null) : null
                  }
                  removing={remove.isPending && remove.variables === it.symbol}
                  onRemove={onRemove}
                />
              ))}
            </Stagger>
          </table>
        </div>
      )}
      {items && items.length === 0 && (
        <div
          data-testid="wl-empty"
          style={{
            border: '1px dashed var(--line-strong)',
            borderRadius: 14,
            padding: 32,
            textAlign: 'center',
            color: 'var(--ink-2)',
          }}
        >
          Your watchlist is empty. Add a ticker above to generate a brief.
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--ink-3)', display: 'grid', gap: 4 }}>
        <span>
          Interest is how closely a company's sector matches the interest vector learned from your actions. It
          only changes ordering, never recommendations.
        </span>
        {iex && <span data-testid="wl-iex">{IEX_FOOTNOTE}</span>}
      </div>
    </div>
  );
}
