import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { describeError } from '@/api/errors';
import { useAlertAction } from '@/api/hooks/alerts';
import { useMarketStatus } from '@/api/hooks/quotes';
import type { Alert, AlertAction } from '@/api/types';
import { ErrorPanel } from '@/shell/ErrorBoundary';
import { useTrack } from '@/telemetry';
import { SegmentedControl, SkeletonBlock, useToast } from '@/ui';
import { Stagger } from '@/motion';
import '@/features/trading/shared.css';
import './alerts.css';
import { AlertCard } from './AlertCard';
import {
  destinationFor,
  isArchived,
  isRead,
  matchesFilter,
  sortAlerts,
  TYPE_META,
  useAllAlerts,
  type FilterKey,
} from './api';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'breach', label: 'Rule breaches' },
  { key: 'filing', label: 'Filings' },
  { key: 'move', label: 'Moves' },
  { key: 'earnings', label: 'Earnings' },
  { key: 'mirror', label: 'Behaviour' },
  { key: 'archived', label: 'Archived' },
];

const TELEMETRY = { open: 'alert_opened', dismiss: 'alert_dismissed', snooze: 'alert_snoozed' } as const;

/** FE-09 · Alerts: filters, Open / Snooze 24h / Dismiss (persisted through the API), materiality and sources. */
export default function Screen() {
  const q = useAllAlerts();
  const act = useAlertAction();
  const toast = useToast();
  const track = useTrack();
  const navigate = useNavigate();
  const market = useMarketStatus();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const all = useMemo(() => q.data?.pages.flatMap(p => p.items) ?? [], [q.data]);
  const counts = useMemo(() => {
    const live = all.filter(a => !isArchived(a)).length;
    return { all: live, archived: all.length - live };
  }, [all]);
  const list = useMemo(() => sortAlerts(all.filter(a => matchesFilter(a, filter))), [all, filter]);

  const dismissed = all.filter(a => a.state === 'dismissed').length;
  const read = all.filter(isRead).length;
  const fatigue = dismissed + read ? (dismissed / (dismissed + read)).toFixed(2) : '0.00';
  const firstPage = q.data?.pages[0];
  const threshold = firstPage?.move_threshold ?? firstPage?.meta?.move_threshold ?? null;
  const stale = market.data?.open && market.data?.feed === 'stale';

  const run = (a: Alert, action: AlertAction, after?: () => void, okMsg?: string) => {
    setBusyId(a.id);
    act.mutate(
      { id: a.id, action },
      {
        onSuccess: () => {
          track({
            type: TELEMETRY[action],
            entity: { alert_id: a.id, ticker: a.symbol ?? undefined },
            props: { action },
          });
          if (okMsg) toast.say(okMsg);
        },
        onError: e => toast.say(describeError(e).message),
        onSettled: () => {
          setBusyId(null);
          after?.(); // "Open" navigates even if marking it read failed: the user still wants to look
        },
      },
    );
  };

  const label = (a: Alert) => TYPE_META[a.type]?.label ?? String(a.type);

  return (
    <div className="s3-screen" style={{ gap: 16 }} data-testid="screen-alerts">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        <div className="s3-card s3-card--tight" data-testid="stat-fatigue">
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>Fatigue index (dismissed / acted on)</div>
          <div style={{ font: '500 22px var(--mono)' }}>{fatigue}</div>
        </div>
        <div className="s3-card s3-card--tight" data-testid="stat-threshold">
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>Unusual-move threshold</div>
          <div style={{ font: '500 22px var(--mono)' }}>
            {threshold != null ? `|z| > ${threshold.toFixed(2)}` : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            Rises 0.25 per dismissal, max 3.0. {stale ? 'Paused while quotes are stale.' : ''}
          </div>
        </div>
        <div className="s3-card s3-card--tight">
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>Rule breaches</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Always pinned. They cannot be dismissed or learned away.
          </div>
        </div>
      </div>

      <div className="alerts-seg">
        <SegmentedControl
          aria-label="Alert filter"
          testId="alerts-filter"
          value={filter}
          onChange={setFilter}
          options={FILTERS.map(f => ({
            value: f.key,
            label: `${f.label}${f.key === 'all' ? ` (${counts.all})` : f.key === 'archived' ? ` (${counts.archived})` : ''}`,
          }))}
        />
      </div>

      {q.isLoading ? (
        <SkeletonBlock label="Loading alerts" widths={[40, 100, 80, 60]} />
      ) : q.isError ? (
        <ErrorPanel error={q.error} title="Could not load your alerts" onRetry={() => void q.refetch()} />
      ) : (
        <Stagger style={{ display: 'grid', gap: 10 }} data-testid="alerts-list">
          {list.map(a => (
            <AlertCard
              key={a.id}
              alert={a}
              busy={busyId === a.id}
              onOpen={x => run(x, 'open', () => navigate(destinationFor(x)))}
              onSnooze={x => run(x, 'snooze', undefined, 'Snoozed for 24 hours')}
              onDismiss={x => run(x, 'dismiss', undefined, `Dismissed. ${label(x)} alerts rank lower.`)}
            />
          ))}
          {list.length === 0 && (
            <div className="s3-empty" data-testid="alerts-empty">
              No alerts in this view.
            </div>
          )}
          {q.hasNextPage && (
            <button
              type="button"
              className="s3-btn-sm"
              style={{ justifySelf: 'center' }}
              disabled={q.isFetchingNextPage}
              onClick={() => void q.fetchNextPage()}
            >
              {q.isFetchingNextPage ? 'Loading' : 'Load more alerts'}
            </button>
          )}
        </Stagger>
      )}
    </div>
  );
}
