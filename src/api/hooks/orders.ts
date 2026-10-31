import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, V1 } from '../client';
import { qk } from '../keys';
import type { Order, OrderRequest, OrderResponse, Paged } from '../types';

export const useOrders = () =>
  useQuery({
    queryKey: qk.orders.list,
    queryFn: ({ signal }) => api.get<Paged<Order>>(`${V1}/orders`, { signal }),
  });

/** Dry-run checks (Pass / Note / Blocked) shown in the ticket before submitting. */
export const usePreviewOrder = () =>
  useMutation({
    mutationKey: ['orders', 'preview'],
    mutationFn: (body: OrderRequest) => api.post<OrderResponse>(`${V1}/orders/preview`, body),
  });

/**
 * Submit a paper order. `idempotencyKey` must be generated ONCE per ticket (e.g. `newIdempotencyKey()` when the
 * ticket opens or after a successful submit) and reused on retries/double-clicks so the backend de-duplicates.
 */
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['orders', 'create'],
    mutationFn: ({ body, idempotencyKey }: { body: OrderRequest; idempotencyKey: string }) =>
      api.request<OrderResponse>(`${V1}/orders`, { method: 'POST', body, idempotencyKey }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.orders.all });
      void qc.invalidateQueries({ queryKey: qk.portfolio.all });
      void qc.invalidateQueries({ queryKey: qk.proposals.all });
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['orders', 'cancel'],
    mutationFn: (id: string) => api.del<Order>(`${V1}/orders/${encodeURIComponent(id)}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.orders.all });
      void qc.invalidateQueries({ queryKey: qk.portfolio.all });
    },
  });
}

export const newIdempotencyKey = (): string => crypto.randomUUID();
