import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, V1 } from '../client';
import { qk } from '../keys';
import type {
  Memory,
  OnboardingBody,
  OnboardingQuestions,
  OnboardingResult,
  ProfileResponse,
  RulesObject,
} from '../types';

export const useProfile = () =>
  useQuery({
    queryKey: qk.profile,
    queryFn: ({ signal }) => api.get<ProfileResponse>(`${V1}/profile`, { signal }),
  });

export function usePatchProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['profile', 'patch'],
    mutationFn: (patch: Record<string, unknown>) => api.patch<ProfileResponse>(`${V1}/profile`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profile }),
  });
}

export function useUpdateRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['profile', 'rules'],
    mutationFn: (rules: RulesObject) => api.put<RulesObject>(`${V1}/profile/rules`, rules),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.profile });
      void qc.invalidateQueries({ queryKey: qk.portfolio.all });
    },
  });
}

export function useResetProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['profile', 'reset'],
    mutationFn: () => api.post<void>(`${V1}/profile/reset`),
    onSuccess: () => qc.invalidateQueries(),
  });
}

/** GET /v1/profile/export → portable JSON (caller turns it into a download). */
export const exportProfile = () => api.get<Record<string, unknown>>(`${V1}/profile/export`);

export function useForgetMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['profile', 'forget'],
    mutationFn: (id: Memory['id']) => api.del<void>(`${V1}/profile/memories/${encodeURIComponent(id)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profile }),
  });
}

/** DELETE /v1/account `{confirm:"DELETE"}`. The caller signs out afterwards. */
export const useDeleteAccount = () =>
  useMutation({
    mutationKey: ['account', 'delete'],
    mutationFn: () => api.del<void>(`${V1}/account`, { body: { confirm: 'DELETE' } }),
  });

/** Public (no bearer). */
export const useOnboardingQuestions = () =>
  useQuery({
    queryKey: qk.onboardingQuestions,
    queryFn: ({ signal }) =>
      api.get<OnboardingQuestions>(`${V1}/onboarding/questions`, { signal, auth: false }),
    staleTime: Infinity,
  });

export function useSubmitOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['onboarding', 'submit'],
    mutationFn: (body: OnboardingBody) => api.post<OnboardingResult>(`${V1}/onboarding`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.me });
      void qc.invalidateQueries({ queryKey: qk.watchlist });
      void qc.invalidateQueries({ queryKey: qk.profile });
    },
  });
}
