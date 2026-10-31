import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, V1 } from '../client';
import { qk } from '../keys';
import type { Brief, Citation } from '../types';

export const useBrief = (symbol: string | undefined) =>
  useQuery({
    queryKey: qk.briefs.detail(symbol ?? ''),
    queryFn: ({ signal }) =>
      api.get<Brief>(`${V1}/briefs/${encodeURIComponent((symbol ?? '').toUpperCase())}`, { signal }),
    enabled: !!symbol,
    staleTime: 60_000,
    // a missing brief is a normal state (offer "Generate"), not something to retry
    retry: (n, e) =>
      e instanceof Error && 'status' in e && (e as { status: number }).status === 404 ? false : n < 2,
  });

/** POST /v1/briefs/{symbol}/generate. mutationKey is watched by the shell to show "Pilot is reading". */
export function useGenerateBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['briefs', 'generate'],
    mutationFn: (symbol: string) =>
      api.post<Brief>(`${V1}/briefs/${encodeURIComponent(symbol.toUpperCase())}/generate`, undefined, {
        timeoutMs: 120_000,
      }),
    onSuccess: (brief, symbol) => qc.setQueryData(qk.briefs.detail(symbol), brief),
  });
}

export const useCitation = (id: string | null | undefined) =>
  useQuery({
    queryKey: qk.briefs.citation(id ?? ''),
    queryFn: ({ signal }) => api.get<Citation>(`${V1}/citations/${encodeURIComponent(id ?? '')}`, { signal }),
    enabled: !!id,
    staleTime: Infinity,
  });
