import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '@/lib/env';
import { clearSession, setSession, type SessionUser } from './session';

/**
 * Supabase mode: Google OAuth then TOTP MFA (AAL2). The SDK is imported lazily so dev builds without
 * Supabase never load it. Only the public anon key is used.
 */
let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient> {
  const cfg = getSupabaseConfig();
  if (!cfg)
    return Promise.reject(
      new Error('Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).'),
    );
  clientPromise ??= import('@supabase/supabase-js').then(m =>
    m.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  );
  return clientPromise;
}

const userFrom = (s: Session): SessionUser => {
  const email = s.user.email ?? '';
  const meta = (s.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const display = meta.full_name ?? meta.name ?? (email.split('@')[0] || 'You');
  const initials = display
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p.charAt(0).toUpperCase())
    .join('');
  return { user_id: s.user.id, email, display_name: display, initials: initials || 'U', persona_id: null };
};

export type SupabaseState = { status: 'signed_out' | 'mfa_required' | 'signed_in' };

/** Mirror a Supabase session into the shared session store, honouring the MFA assurance level. */
export async function syncSupabaseSession(
  sb: SupabaseClient,
  session: Session | null,
): Promise<SupabaseState['status']> {
  if (!session) {
    clearSession('signed_out');
    return 'signed_out';
  }
  const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') return 'mfa_required';
  const exp = session.expires_at
    ? Math.max(1, session.expires_at - Math.floor(Date.now() / 1000))
    : undefined;
  setSession(session.access_token, userFrom(session), exp);
  return 'signed_in';
}

export async function signInWithGoogle(): Promise<void> {
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/signin` },
  });
  if (error) throw new Error(error.message);
}

/** Challenge + verify the first verified TOTP factor. Returns after the session is upgraded to AAL2. */
export async function verifyTotp(code: string): Promise<void> {
  const sb = await getSupabase();
  const { data: factors, error: fe } = await sb.auth.mfa.listFactors();
  if (fe) throw new Error(fe.message);
  const factor = factors?.totp?.[0];
  if (!factor) throw new Error('No authenticator is set up for this account yet.');
  const { data: ch, error: ce } = await sb.auth.mfa.challenge({ factorId: factor.id });
  if (ce || !ch) throw new Error(ce?.message ?? 'Could not start verification. Try again.');
  const { error: ve } = await sb.auth.mfa.verify({ factorId: factor.id, challengeId: ch.id, code });
  if (ve) throw new Error('That code is not valid.');
  const { data } = await sb.auth.getSession();
  await syncSupabaseSession(sb, data.session);
}

export async function supabaseSignOut(): Promise<void> {
  const sb = await getSupabase();
  await sb.auth.signOut();
}
