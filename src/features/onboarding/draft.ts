import type { OnboardingBody, OnboardingQuestions } from '@/api/types';

/** Everything the user enters across the steps. `null` = not answered yet. */
export type Draft = {
  ack: boolean;
  answers: Array<number | null>;
  horizon: string | null;
  goals: string[];
  experience: string | null;
  likes: string[];
  excludes: string[];
  esg: string[];
  watchlist: string[];
  startingCash: number;
};

/** Design copy: the goals and values-based exclusions are fixed choices, sectors/horizons/experience come from the API. */
export const GOALS = ['Growth', 'Income', 'Preservation'] as const;
export const ESG_EXCLUSIONS = ['Tobacco', 'Weapons', 'Fossil fuels', 'Gambling'] as const;
export const CASH_PRESETS = [25_000, 100_000, 250_000, 1_000_000] as const;
export const WATCHLIST_MIN = 3;
export const WATCHLIST_MAX = 20;
/** A few well-known starters pre-selected when they exist in the supported universe (design default). */
export const STARTER_SYMBOLS = ['AAPL', 'MSFT', 'JNJ', 'KO', 'NVDA'] as const;

export const STEPS = ['Welcome', 'Risk', 'Goals', 'Watchlist', 'Your rules'] as const;
export type StepIndex = 0 | 1 | 2 | 3 | 4;
/** Index of the step shown after the workspace is created. */
export const RESULT_STEP: StepIndex = 4;

export const emptyDraft = (q: OnboardingQuestions | undefined): Draft => ({
  ack: false,
  answers: (q?.questions ?? Array.from({ length: 6 })).map(() => null),
  horizon: q ? (q.horizons[Math.floor(q.horizons.length / 2)] ?? null) : null,
  goals: ['Growth'],
  experience: q ? (q.experience_levels[Math.floor(q.experience_levels.length / 2)] ?? null) : null,
  likes: [],
  excludes: [],
  esg: [],
  watchlist: [],
  startingCash: 100_000,
});

export const toggle = (arr: readonly string[], v: string): string[] =>
  arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

/** UX-only gate per step (the server validates again). Returns the message shown when the user tries to continue. */
export function stepProblem(step: number, d: Draft): string | null {
  switch (step) {
    case 0:
      return d.ack ? null : 'Acknowledge the disclaimer to continue.';
    case 1:
      return d.answers.every(a => a != null) ? null : 'Answer all 6 questions to continue.';
    case 2:
      if (d.goals.length === 0) return 'Pick at least one goal to continue.';
      if (!d.horizon || !d.experience) return 'Choose your horizon and experience to continue.';
      return null;
    case 3:
      return d.watchlist.length >= WATCHLIST_MIN
        ? null
        : `Choose at least ${WATCHLIST_MIN} tickers for your watchlist.`;
    default:
      return null;
  }
}

/** Contract body for POST /v1/onboarding. Throws if called before the steps are complete (programmer error). */
export function toBody(d: Draft): OnboardingBody {
  if (!d.ack || !d.horizon || !d.experience || d.answers.some(a => a == null))
    throw new Error('Onboarding draft is incomplete');
  return {
    answers: d.answers.map(a => a as number),
    // values come from the questionnaire lists served by GET /onboarding/questions
    horizon: d.horizon as OnboardingBody['horizon'],
    goals: d.goals as OnboardingBody['goals'],
    experience: d.experience as OnboardingBody['experience'],
    likes: d.likes,
    excludes: d.excludes,
    esg_exclusions: d.esg,
    watchlist: d.watchlist,
    region: 'US',
    currency: 'USD',
    starting_cash: d.startingCash,
    disclaimer_ack: true,
  };
}
