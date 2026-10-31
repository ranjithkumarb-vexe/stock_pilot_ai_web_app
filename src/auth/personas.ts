import type { PersonaId } from '@/api/types';

/**
 * Labels for the backend's built-in dev personas (POST /v1/auth/dev-login). Only ever shown when the auth mode is
 * "dev". Copy comes from the design's sign-in screen; the data itself lives in the backend seed.
 */
export const DEV_PERSONAS: ReadonlyArray<{
  id: PersonaId;
  name: string;
  initials: string;
  tag: string;
  tone: 'acc' | 'info' | 'n';
}> = [
  {
    id: 'priya',
    name: 'Priya Nair',
    initials: 'PN',
    tag: 'Conservative income · 10-year horizon',
    tone: 'acc',
  },
  {
    id: 'alex',
    name: 'Alex Rivera',
    initials: 'AR',
    tag: 'Aggressive growth · 2-year horizon · trades often',
    tone: 'info',
  },
  { id: 'new', name: 'New user', initials: '+', tag: 'Start the onboarding questionnaire', tone: 'n' },
];
