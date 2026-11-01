import { Stagger } from '@/motion';
import { useFeed } from '@/api/hooks/feed';
import { FeedCard } from './FeedCard';
import { card, SectionError } from './panels';
import { Skeleton } from '@/ui';

const MAX_CARDS = 7;

/** "For you today": the server-ranked feed. Rule breaches are pinned by the backend, the UI never re-ranks. */
export function Feed() {
  const feed = useFeed();
  const items = feed.data?.items.slice(0, MAX_CARDS) ?? [];
  return (
    <section
      style={{ display: 'grid', gap: 12, minWidth: 0 }}
      aria-label="For you today"
      data-testid="dash-feed"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ font: "600 16px 'Geist'", margin: 0 }}>For you today</h2>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          Ranked by materiality, learned preference and interest. Rule breaches are pinned.
        </span>
      </div>
      {feed.isPending && (
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading your feed"
          style={{ display: 'grid', gap: 12 }}
        >
          {[0, 1, 2].map(i => (
            <div key={i} style={{ ...card, padding: 18, display: 'grid', gap: 10 }}>
              <Skeleton width={30} height={14} />
              <Skeleton width={80} height={16} />
              <Skeleton width={60} height={12} />
            </div>
          ))}
        </div>
      )}
      {feed.isError && (
        <SectionError error={feed.error} what="your feed" onRetry={() => void feed.refetch()} />
      )}
      {feed.data && items.length === 0 && (
        <div
          data-testid="feed-empty"
          style={{
            border: '1px dashed var(--line-strong)',
            borderRadius: 14,
            padding: 32,
            textAlign: 'center',
            color: 'var(--ink-2)',
          }}
        >
          Nothing new. You are caught up.
        </div>
      )}
      {items.length > 0 && (
        <Stagger style={{ display: 'grid', gap: 12 }}>
          {items.map(f => (
            <FeedCard key={`${f.kind}-${f.id}`} f={f} />
          ))}
        </Stagger>
      )}
    </section>
  );
}
