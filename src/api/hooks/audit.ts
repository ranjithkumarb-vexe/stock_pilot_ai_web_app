import { useQuery } from '@tanstack/react-query';
import { api, V1 } from '../client';
import { qk } from '../keys';
import type { AuditTrace, EvalsLatest, Paged } from '../types';

export const useAuditTraces = () =>
  useQuery({
    queryKey: qk.audit.traces,
    queryFn: ({ signal }) => api.get<Paged<AuditTrace>>(`${V1}/audit/traces`, { signal }),
  });

export const useAuditTrace = (id: string | undefined) =>
  useQuery({
    queryKey: qk.audit.trace(id ?? ''),
    queryFn: ({ signal }) =>
      api.get<AuditTrace>(`${V1}/audit/traces/${encodeURIComponent(id ?? '')}`, { signal }),
    enabled: !!id,
  });

export const useEvalsLatest = () =>
  useQuery({
    queryKey: qk.audit.evals,
    queryFn: ({ signal }) => api.get<EvalsLatest>(`${V1}/evals/latest`, { signal }),
  });
