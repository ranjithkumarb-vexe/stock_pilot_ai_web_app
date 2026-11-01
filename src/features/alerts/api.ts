import { useInfiniteQuery } from '@tanstack/react-query';
import { api, V1 } from '@/api/client';
import { qk } from '@/api/keys';
import type { Alert, AlertsPage } from '@/api/types';

export type { AlertsPage };

/** All alerts, newest first. Filtering and the "Archived" split happen client-side so the tab counts are exact. */
export const useAllAlerts = () =>
  useInfiniteQuery({
    // sits under qk.alerts.all so SSE `alert` events and actions invalidate it
    queryKey: [...qk.alerts.all, 'all'] as const,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.get<AlertsPage>(`${V1}/alerts`, { signal, query: { limit: 200, cursor: pageParam } }),
    getNextPageParam: p => p.next_cursor ?? undefined,
  });

export const ARCHIVED = new Set(['dismissed', 'snoozed']);
export const isArchived = (a: Alert): boolean => ARCHIVED.has(String(a.state));
/** API state enum: `new | opened | dismissed | snoozed`. */
export const isRead = (a: Alert): boolean => a.state === 'opened';

export const TYPE_META: Record<string, { label: string; tone: 'bad' | 'info' | 'warn' | 'n' }> = {
  breach: { label: 'Rule breach', tone: 'bad' },
  concentration: { label: 'Concentration', tone: 'bad' },
  filing: { label: '8-K filing', tone: 'info' },
  move: { label: 'Unusual move', tone: 'warn' },
  earnings: { label: 'Earnings', tone: 'n' },
  mirror: { label: 'Behaviour mirror', tone: 'warn' },
};

export const STATE_LABEL: Record<string, string> = {
  new: 'New',
  opened: 'Read',
  snoozed: 'Snoozed',
  dismissed: 'Dismissed',
};

export type FilterKey = 'all' | 'breach' | 'filing' | 'move' | 'earnings' | 'mirror' | 'archived';

export function matchesFilter(a: Alert, f: FilterKey): boolean {
  if (f === 'archived') return isArchived(a);
  if (isArchived(a)) return false;
  if (f === 'all') return true;
  if (f === 'breach') return a.type === 'breach' || a.type === 'concentration';
  return a.type === f;
}

/** Pinned (critical) first, then newest first. */
export function sortAlerts(list: Alert[]): Alert[] {
  return [...list].sort(
    (a, b) =>
      Number(b.critical) - Number(a.critical) ||
      (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0),
  );
}

export function destinationFor(a: Alert): string {
  if (a.type === 'breach' || a.type === 'concentration') return '/portfolio';
  if (a.type === 'mirror') return '/profile?tab=learned';
  if (a.symbol) return `/brief/${encodeURIComponent(a.symbol)}`;
  return '/portfolio';
}
