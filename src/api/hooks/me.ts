import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { api, V1 } from '../client';
import { qk } from '../keys';
import type { Me } from '../types';

/** GET /v1/me. Only runs when signed in. `onboarded` drives the onboarding guard. */
export function useMe() {
  const { status } = useAuth();
  return useQuery({
    queryKey: qk.me,
    queryFn: ({ signal }) => api.get<Me>(`${V1}/me`, { signal }),
    enabled: status === 'signed_in',
    staleTime: 5 * 60_000,
  });
}
