import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, V1 } from '../client';
import { qk } from '../keys';
import type { Alert, AlertAction, AlertsPage } from '../types';

export const useAlerts = (filter: { type?: string; state?: string } = {}, opts: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: qk.alerts.list(filter),
    queryFn: ({ signal }) => api.get<AlertsPage>(`${V1}/alerts`, { signal, query: filter }),
    enabled: opts.enabled ?? true,
  });

export function useAlertAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['alerts', 'action'],
    mutationFn: ({ id, action }: { id: string; action: AlertAction }) =>
      api.post<Alert>(`${V1}/alerts/${encodeURIComponent(id)}/action`, { action }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.alerts.all });
      void qc.invalidateQueries({ queryKey: qk.feed });
    },
  });
}
