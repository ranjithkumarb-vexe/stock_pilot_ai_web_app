import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, V1 } from '@/api/client';
import { qk } from '@/api/keys';
import type { BarsResponse, Items, WatchlistItem } from '@/api/types';
import { useStream } from '@/realtime';

export const WATCHLIST_LIMIT = 20;

/**
 * The watchlist with quotes. Shares the foundation cache key, but polls every 20 s while the SSE stream is not
 * delivering ticks so freshness badges still move (REST fallback, SPEC §6.4).
 */
export function useWatchlistLive() {
  const { state } = useStream();
  return useQuery({
    queryKey: qk.watchlist,
    queryFn: ({ signal }) => api.get<Items<WatchlistItem>>(`${V1}/watchlist`, { signal }),
    refetchInterval: state === 'connected' ? 60_000 : 20_000,
  });
}

/** PUT /watchlist/{symbol}. The caller shows the error (422 unsupported_symbol, 409 duplicate/limit). */
export function useAddTicker() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['watchlist', 'add'],
    mutationFn: (symbol: string) =>
      api.put<WatchlistItem>(`${V1}/watchlist/${encodeURIComponent(symbol.toUpperCase())}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.watchlist }),
  });
}

/** DELETE /watchlist/{symbol} with an optimistic removal that rolls back if the server refuses. */
export function useRemoveTicker() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['watchlist', 'remove'],
    mutationFn: (symbol: string) =>
      api.del<void>(`${V1}/watchlist/${encodeURIComponent(symbol.toUpperCase())}`),
    onMutate: async (symbol: string) => {
      await qc.cancelQueries({ queryKey: qk.watchlist });
      const prev = qc.getQueryData<Items<WatchlistItem>>(qk.watchlist);
      if (prev)
        qc.setQueryData<Items<WatchlistItem>>(qk.watchlist, {
          ...prev,
          items: prev.items.filter(i => i.symbol !== symbol),
        });
      return { prev };
    },
    onError: (_e, _s, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.watchlist, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.watchlist }),
  });
}

/** Recent daily closes for the Trend sparkline. A missing/failed chart endpoint just leaves the cell empty. */
export function useTrend(symbol: string) {
  return useQuery({
    queryKey: ['watchlist', 'trend', symbol],
    queryFn: ({ signal }) =>
      api.get<BarsResponse>(`${V1}/quotes/${encodeURIComponent(symbol)}/bars`, {
        signal,
        query: { interval: '1d', limit: 20 },
      }),
    select: (r): number[] => r.bars.map(b => b.close),
    staleTime: 10 * 60_000,
    retry: false,
  });
}
