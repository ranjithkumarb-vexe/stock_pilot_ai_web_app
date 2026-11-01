import { forwardRef, useMemo, useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Items, UniverseItem } from '@/api/types';
import { ErrorPanel } from '@/shell/ErrorBoundary';
import { Stagger } from '@/motion';
import { SkeletonBlock } from '@/ui';
import { WATCHLIST_MAX, WATCHLIST_MIN, toggle, type Draft } from './draft';
import { StepHeading } from './parts';

type Props = {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  universe: UseQueryResult<Items<UniverseItem>>;
};

/** Step 4: starter watchlist picked from the supported universe (GET /universe), with search. */
export const WatchlistStep = forwardRef<HTMLHeadingElement, Props>(function WatchlistStep(
  { draft, set, universe },
  ref,
) {
  const [q, setQ] = useState('');
  const items = universe.data?.items;
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!items) return [];
    return needle
      ? items.filter(u => `${u.symbol} ${u.name} ${u.sector}`.toLowerCase().includes(needle))
      : items;
  }, [items, q]);
  const full = draft.watchlist.length >= WATCHLIST_MAX;

  return (
    <Stagger style={{ display: 'grid', gap: 22 }}>
      <StepHeading ref={ref} eyebrow="Step 4 of 5" title="Pick your starter watchlist">
        Tickers you follow get briefs and alerts first. US large caps only for the MVP.
      </StepHeading>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ fontWeight: 600 }} id="wl-count" role="status">
          Starter watchlist{' '}
          <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>
            ({draft.watchlist.length} selected, at least {WATCHLIST_MIN}, up to {WATCHLIST_MAX})
          </span>
        </div>
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by ticker, company or sector"
          aria-label="Search the supported universe"
          data-testid="onboarding-wl-search"
          style={{
            height: 38,
            maxWidth: 360,
            borderRadius: 8,
            border: '1px solid var(--line-strong)',
            background: 'var(--surface)',
            padding: '0 12px',
            fontSize: 14,
          }}
        />
        {universe.isPending && <SkeletonBlock label="Loading supported tickers" widths={[100, 100, 60]} />}
        {universe.isError && <ErrorPanel error={universe.error} onRetry={() => void universe.refetch()} />}
        {items && shown.length === 0 && (
          <div style={{ color: 'var(--ink-2)', fontSize: 13 }}>No ticker matches “{q}”.</div>
        )}
        <div
          role="group"
          aria-labelledby="wl-count"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
          data-testid="onboarding-wl-chips"
        >
          {shown.map(u => {
            const on = draft.watchlist.includes(u.symbol);
            return (
              <button
                key={u.symbol}
                type="button"
                aria-pressed={on}
                disabled={!on && full}
                title={`${u.name} · ${u.sector}`}
                data-testid={`wl-${u.symbol}`}
                onClick={() => set({ watchlist: toggle(draft.watchlist, u.symbol) })}
                style={{
                  height: 34,
                  padding: '0 12px',
                  borderRadius: 8,
                  font: '600 12px var(--mono)',
                  cursor: !on && full ? 'not-allowed' : 'pointer',
                  opacity: !on && full ? 0.5 : 1,
                  background: on ? 'var(--grad)' : 'var(--surface)',
                  color: on ? 'var(--accent-ink)' : 'var(--ink-2)',
                  border: on ? '1px solid var(--accent)' : '1px solid var(--line-strong)',
                }}
              >
                {u.symbol}
              </button>
            );
          })}
        </div>
      </div>
    </Stagger>
  );
});
