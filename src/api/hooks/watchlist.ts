import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, V1 } from '../client';
import { qk } from '../keys';
import type { Items, UniverseItem, WatchlistItem } from '../types';

export const useWatchlist = () =>
  useQuery({
    queryKey: qk.watchlist,
    queryFn: ({ signal }) => api.get<Items<WatchlistItem>>(`${V1}/watchlist`, { signal }),
  });

/** Public universe list (used by the command palette, watchlist search, onboarding). */
export const useUniverse = () =>
  useQuery({
    queryKey: qk.universe,
    queryFn: ({ signal }) => api.get<Items<UniverseItem>>(`${V1}/universe`, { signal, auth: false }),
    staleTime: 60 * 60_000,
  });

export function useAddToWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['watchlist', 'add'],
    mutationFn: (symbol: string) =>
      api.put<WatchlistItem>(`${V1}/watchlist/${encodeURIComponent(symbol.toUpperCase())}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.watchlist }),
  });
}

export function useRemoveFromWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['watchlist', 'remove'],
    mutationFn: (symbol: string) =>
      api.del<void>(`${V1}/watchlist/${encodeURIComponent(symbol.toUpperCase())}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.watchlist }),
  });
}
