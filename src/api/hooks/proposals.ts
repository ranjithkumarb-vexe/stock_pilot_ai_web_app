import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, V1 } from '../client';
import { qk } from '../keys';
import type { Order, Paged, Proposal, ProposalDecision } from '../types';

export const useProposals = (status?: string, opts: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: qk.proposals.list(status),
    queryFn: ({ signal }) => api.get<Paged<Proposal>>(`${V1}/proposals`, { signal, query: { status } }),
    enabled: opts.enabled ?? true,
  });

export const useProposal = (id: string | undefined) =>
  useQuery({
    queryKey: qk.proposals.detail(id ?? ''),
    queryFn: ({ signal }) => api.get<Proposal>(`${V1}/proposals/${encodeURIComponent(id ?? '')}`, { signal }),
    enabled: !!id,
  });

/** approve / reject (+reason) / modify (+qty). Approve creates a paper order, so orders + portfolio refresh too. */
export function useDecideProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['proposals', 'decide'],
    mutationFn: ({ id, ...body }: { id: string } & ProposalDecision) =>
      api.post<{ proposal: Proposal; order: Order | null }>(
        `${V1}/proposals/${encodeURIComponent(id)}/decision`,
        body,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.proposals.all });
      void qc.invalidateQueries({ queryKey: qk.orders.all });
      void qc.invalidateQueries({ queryKey: qk.portfolio.all });
      void qc.invalidateQueries({ queryKey: qk.feed });
    },
  });
}
