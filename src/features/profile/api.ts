import { useQuery } from '@tanstack/react-query';
import { exportProfile, useOnboardingQuestions, usePatchProfile } from '@/api/hooks/profile';
import { useToast } from '@/ui';
import { describeError } from '@/api/errors';
import type { ProfileResponse } from '@/api/types';

/* ------------------------------------------------------------------------------------------------------------------
 * ProfileResponse.profile / style_card are free-form in CONTRACT.md. Keys below follow the onboarding body and the DB
 * (`profiles` table); anything the API does not send falls back to "not set". UNVERIFIED until the profile module
 * publishes OpenAPI.
 * ---------------------------------------------------------------------------------------------------------------- */
export const strOf = (v: unknown): string => (typeof v === 'string' ? v : '');
export const arrOf = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** Public onboarding payload fields the generated/hand types do not list (verified against the live backend). */
export type QuestionsExt = {
  tier_rules?: Record<string, { pos: number; sec: number; dd: number; trades: number; cash: number }>;
  goals?: string[];
  esg_exclusions?: string[];
};

export type ProfileView = {
  horizon: string;
  goals: string[];
  exclusions: string[];
  experience: string;
  tone: string;
  metric: string;
  region: string;
  currency: string;
  tierLabel: string;
};

export function readProfile(p: ProfileResponse): ProfileView {
  const prof = p.profile ?? {};
  const style = p.style_card ?? {};
  return {
    horizon: strOf(prof.horizon),
    goals: arrOf(prof.goals),
    exclusions: arrOf(prof.esg_exclusions),
    experience: strOf(prof.experience),
    tone: strOf(style.tone),
    metric: strOf(style.metric),
    region: strOf(prof.region),
    currency: strOf(prof.currency),
    tierLabel: strOf(prof.tier_label),
  };
}

export const FALLBACK_HORIZONS = ['Under 1 year', '1-3 years', '3-10 years', '10+ years'];
export const FALLBACK_EXPERIENCE = ['Beginner', 'Intermediate', 'Advanced'];
export const GOALS = ['Growth', 'Income', 'Preservation'];
export const EXCLUSIONS = ['Tobacco', 'Weapons', 'Fossil fuels', 'Gambling'];
export const TONES = ['Plain language', 'Direct', 'Neutral'];
export const JARGON: Record<string, number> = { Beginner: 1, Intermediate: 2, Advanced: 3 };
export const METRICS = ['P/E', 'Dividend yield', 'Revenue growth'];

/** Enumerations come from the public onboarding endpoint when available. */
export function useProfileOptions() {
  const q = useOnboardingQuestions();
  const ext = (q.data ?? {}) as QuestionsExt;
  return {
    goals: ext.goals?.length ? ext.goals : GOALS,
    exclusions: ext.esg_exclusions?.length ? ext.esg_exclusions : EXCLUSIONS,
    tierRules: ext.tier_rules ?? null,
    horizons: q.data?.horizons?.length ? q.data.horizons : FALLBACK_HORIZONS,
    experience: q.data?.experience_levels?.length ? q.data.experience_levels : FALLBACK_EXPERIENCE,
    tierLabel: (tier: number) => q.data?.tiers.find(t => t.tier === tier)?.label ?? `Tier ${tier}`,
  };
}

/** Save one or more profile fields; shows a toast either way. Resolves true on success. */
export function useSaveProfile() {
  const patch = usePatchProfile();
  const toast = useToast();
  return {
    pending: patch.isPending,
    save: async (fields: Record<string, unknown>, ok = 'Saved'): Promise<boolean> => {
      try {
        await patch.mutateAsync(fields);
        toast.say(ok);
        return true;
      } catch (e) {
        toast.say(describeError(e).message);
        return false;
      }
    },
  };
}

/** Raw JSON text for the export modal / download. Disabled until the modal opens; never cached. */
export const useExportJson = (enabled: boolean) =>
  useQuery({
    queryKey: ['profile', 'export'] as const,
    enabled,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    queryFn: async () => JSON.stringify(await exportProfile(), null, 2),
  });

export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function humanizeKey(k: string): string {
  const s = k.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtValue(v: unknown): string {
  if (v == null || v === '') return 'Not set';
  if (Array.isArray(v)) return v.length ? v.map(x => fmtValue(x)).join(' > ') : 'Not set';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
