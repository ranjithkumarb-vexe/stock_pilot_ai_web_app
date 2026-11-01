import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, V1 } from '@/api/client';
import { qk } from '@/api/keys';
import type { OnboardingBody, OnboardingResult } from '@/api/types';

/**
 * POST /v1/onboarding. Unlike the shared `useSubmitOnboarding` this does NOT invalidate `/me` on success: the
 * router's OnboardingOnly guard would immediately redirect to the dashboard and the tier result (the last onboarding
 * step) would never be shown. `finish()` refreshes the session state when the user leaves the result step.
 */
export function useCreateWorkspace() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationKey: ['onboarding', 'create'],
    mutationFn: (body: OnboardingBody) => api.post<OnboardingResult>(`${V1}/onboarding`, body),
  });
  const finish = async () => {
    void qc.invalidateQueries({ queryKey: qk.watchlist });
    void qc.invalidateQueries({ queryKey: qk.profile });
    void qc.invalidateQueries({ queryKey: qk.portfolio.all });
    await qc.invalidateQueries({ queryKey: qk.me });
  };
  return { ...mutation, finish };
}
