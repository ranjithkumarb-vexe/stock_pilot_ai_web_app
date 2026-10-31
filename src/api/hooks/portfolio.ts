import { useQuery } from '@tanstack/react-query';
import { api, V1 } from '../client';
import { qk } from '../keys';
import type { Portfolio, PortfolioPerformance, PortfolioRisk } from '../types';

export const usePortfolio = (opts: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: qk.portfolio.summary,
    queryFn: ({ signal }) => api.get<Portfolio>(`${V1}/portfolio`, { signal }),
    staleTime: 30_000,
    enabled: opts.enabled ?? true,
  });

export const usePortfolioRisk = (opts: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: qk.portfolio.risk,
    queryFn: ({ signal }) => api.get<PortfolioRisk>(`${V1}/portfolio/risk`, { signal }),
    staleTime: 30_000,
    enabled: opts.enabled ?? true,
  });

export const usePortfolioPerformance = () =>
  useQuery({
    queryKey: qk.portfolio.performance,
    queryFn: ({ signal }) => api.get<PortfolioPerformance>(`${V1}/portfolio/performance`, { signal }),
    staleTime: 60_000,
  });
