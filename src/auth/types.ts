import type { PersonaId } from '@/api/types';
import type { AuthMode } from '@/lib/env';
import type { SessionUser } from './session';

/** loading: restoring/validating a session; mfa_required: Supabase signed in at AAL1, TOTP step pending. */
export type AuthStatus = 'loading' | 'signed_out' | 'mfa_required' | 'signed_in';

/** One interface for both modes; screens never branch on the provider. */
export interface AuthApi {
  mode: AuthMode;
  status: AuthStatus;
  user: SessionUser | null;
  /** why the last session ended (shown on sign-in / expired dialog) */
  endedBy: 'signed_out' | 'expired' | null;
  /** dev mode only: POST /v1/auth/dev-login. Rejects with ApiError. */
  signInDev: (persona: PersonaId) => Promise<void>;
  /** supabase mode only: redirects to Google */
  signInWithGoogle: () => Promise<void>;
  /** supabase mode: verify a 6-digit TOTP code for the pending challenge. Rejects with an Error whose message is user-safe. */
  verifyMfa: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** idle timeout / forced expiry: signs out and records `endedBy: 'expired'` so the "Session expired" dialog shows */
  expireSession: () => Promise<void>;
}
