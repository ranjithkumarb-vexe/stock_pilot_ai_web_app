import { useAuth } from '@/auth/useAuth';
import { useMarketStatus, useDevFeed, useDevMarket } from '@/api/hooks/quotes';
import type { FeedState } from '@/api/types';
import { isApiError } from '@/api/errors';
import { feedOf } from '@/features/trading/api';
import { SegmentedControl } from '@/ui';
import '@/features/trading/shared.css';

const FEEDS: Array<{ value: FeedState; label: string }> = [
  { value: 'live', label: 'Live' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'stale', label: 'Stale' },
  { value: 'reconnecting', label: 'Reconnecting' },
];

/**
 * Developer controls (design: click the market/feed chips to simulate). Rendered ONLY in dev auth mode and only while
 * the backend dev endpoints exist: a 404 from `POST /v1/dev/*` removes the panel.
 */
export function SimulatePanel() {
  const { mode } = useAuth();
  const market = useMarketStatus();
  const devMarket = useDevMarket();
  const devFeed = useDevFeed();
  const missing = [devMarket.error, devFeed.error].some(e => isApiError(e) && e.status === 404);
  if (mode !== 'dev' || missing) return null;
  const open = market.data?.open;
  return (
    <section
      className="s3-card"
      style={{ padding: 14, gap: 10 }}
      data-testid="simulate-panel"
      aria-label="Simulate market and feed"
    >
      <div className="s3-eyebrow">Simulate (dev only)</div>
      <button
        type="button"
        className="s3-btn-sm"
        data-testid="sim-market"
        disabled={open == null || devMarket.isPending}
        aria-pressed={open === true}
        onClick={() => devMarket.mutate(!open)}
      >
        {open == null
          ? 'Market status unknown'
          : open
            ? 'Market open: click to close'
            : 'Market closed: click to open'}
      </button>
      <SegmentedControl
        aria-label="Feed state"
        testId="sim-feed"
        value={(feedOf(market.data) ?? 'live') as FeedState}
        onChange={v => devFeed.mutate(v)}
        options={FEEDS}
      />
      {(devMarket.isError || devFeed.isError) && !missing && (
        <div role="alert" style={{ fontSize: 12, color: 'var(--loss)' }}>
          The simulate request failed.
        </div>
      )}
    </section>
  );
}
