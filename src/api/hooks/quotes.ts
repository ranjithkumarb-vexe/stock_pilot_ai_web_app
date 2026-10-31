import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, V1 } from '../client';
import { qk } from '../keys';
import type { BarsResponse, FeedState, Items, MarketStatus, Quote, StreamToken } from '../types';

export const useQuotes = (symbols: readonly string[]) =>
  useQuery({
    queryKey: qk.quotes.list(symbols),
    queryFn: ({ signal }) => api.get<Items<Quote>>(`${V1}/quotes`, { signal, query: { symbols } }),
    enabled: symbols.length > 0,
    staleTime: 10_000,
  });

export const useBars = (symbol: string, interval: '5m' | '1d' = '5m', limit?: number) =>
  useQuery({
    queryKey: qk.quotes.bars(symbol, interval, limit),
    queryFn: ({ signal }) =>
      api.get<BarsResponse>(`${V1}/quotes/${encodeURIComponent(symbol)}/bars`, {
        signal,
        query: { interval, limit },
      }),
    enabled: !!symbol,
  });

export const useMarketStatus = () =>
  useQuery({
    queryKey: qk.market,
    queryFn: ({ signal }) => api.get<MarketStatus>(`${V1}/market/status`, { signal }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

/** POST /v1/stream/token → short-lived token for GET /v1/stream (see src/realtime). */
export const fetchStreamToken = (signal?: AbortSignal) =>
  api.post<StreamToken>(`${V1}/stream/token`, undefined, { signal });

/* ---- dev-only market controls (backend AUTH_MODE=dev) ---- */
export function useDevMarket() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['dev', 'market'],
    mutationFn: (open: boolean) => api.post<unknown>(`${V1}/dev/market`, { open }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.market });
      void qc.invalidateQueries({ queryKey: qk.quotes.all });
    },
  });
}
export function useDevFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['dev', 'feed'],
    mutationFn: (state: FeedState) => api.post<unknown>(`${V1}/dev/feed`, { state }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.market });
      void qc.invalidateQueries({ queryKey: qk.quotes.all });
    },
  });
}
