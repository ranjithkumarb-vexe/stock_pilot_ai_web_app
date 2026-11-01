import { Navigate, useParams } from 'react-router-dom';
import { useWatchlist } from '@/api';
import { ErrorPanel } from '@/shell/ErrorBoundary';
import { useLastTicker } from '@/shell/lastTicker';
import { SkeletonBlock } from '@/ui';
import { BriefView } from './BriefView';
import { SYMBOL_RE } from './helpers';

/** Research brief (FE-06). `/brief/:symbol?` — without a symbol it opens the last viewed ticker, else the first watchlist ticker. */
export default function Screen() {
  const { symbol } = useParams();
  const [last] = useLastTicker();
  const watch = useWatchlist();

  if (symbol) {
    if (!SYMBOL_RE.test(symbol))
      return (
        <div data-testid="screen-brief">
          <div className="sp-empty" data-testid="brief-bad-symbol">
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>That is not a ticker</div>
            <div style={{ color: 'var(--ink-2)' }}>Pick one from your watchlist or the search palette.</div>
          </div>
        </div>
      );
    return <BriefView key={symbol.toUpperCase()} symbol={symbol.toUpperCase()} />;
  }

  const fallback = last || watch.data?.items[0]?.symbol;
  if (fallback) return <Navigate to={`/brief/${fallback}`} replace />;
  if (watch.isLoading) return <SkeletonBlock label="Loading your tickers" widths={[40, 90, 70]} />;
  if (watch.isError && !last)
    return (
      <div data-testid="screen-brief">
        <ErrorPanel error={watch.error} onRetry={() => void watch.refetch()} />
      </div>
    );
  return (
    <div data-testid="screen-brief">
      <div className="sp-empty" data-testid="brief-pick" style={{ padding: 40 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>Pick a ticker to read</div>
        <div style={{ color: 'var(--ink-2)' }}>
          Your watchlist is empty. Add a ticker from the Watchlist screen, or press Ctrl+K and search for one.
        </div>
      </div>
    </div>
  );
}
