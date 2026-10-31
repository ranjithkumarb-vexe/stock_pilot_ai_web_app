import { useQuery } from '@tanstack/react-query';
import { api, V1 } from '../client';
import { qk } from '../keys';
import type { FeedItem, Paged, Why } from '../types';

export const useFeed = () =>
  useQuery({
    queryKey: qk.feed,
    queryFn: ({ signal }) => api.get<Paged<FeedItem>>(`${V1}/feed`, { signal }),
  });

/** "Why am I seeing this?" built from personalization_audit (never LLM text). */
export const useWhy = (outputType: string, id: string, enabled = true) =>
  useQuery({
    queryKey: qk.why(outputType, id),
    queryFn: ({ signal }) =>
      api.get<Why>(`${V1}/why/${encodeURIComponent(outputType)}/${encodeURIComponent(id)}`, { signal }),
    enabled,
    staleTime: 5 * 60_000,
  });
