import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PersonaId } from '@/api/types';
import { getAuthMode } from '@/lib/env';
import { devLogin } from './devAuth';
import { clearSession, getSession, restoreSession, subscribeSession } from './session';
import {
  getSupabase,
  signInWithGoogle,
  supabaseSignOut,
  syncSupabaseSession,
  verifyTotp,
} from './supabaseAuth';
import type { AuthApi, AuthStatus } from './types';

export const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = getAuthMode();
  const qc = useQueryClient();
  const snap = useSyncExternalStore(subscribeSession, getSession, getSession);
  const [booting, setBooting] = useState(true);
  const [mfaPending, setMfaPending] = useState(false);

  // start-up: restore the dev session, or attach to the Supabase session (handles the OAuth redirect too)
  useEffect(() => {
    let off: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      if (mode === 'dev') {
        restoreSession();
      } else {
        try {
          const sb = await getSupabase();
          const { data } = await sb.auth.getSession();
          const st = await syncSupabaseSession(sb, data.session);
          if (!cancelled) setMfaPending(st === 'mfa_required');
          const sub = sb.auth.onAuthStateChange((_evt, session) => {
            void syncSupabaseSession(sb, session).then(s => setMfaPending(s === 'mfa_required'));
          });
          off = () => sub.data.subscription.unsubscribe();
        } catch {
          clearSession('signed_out');
        }
      }
      if (!cancelled) setBooting(false);
    })();
    return () => {
      cancelled = true;
      off?.();
    };
  }, [mode]);

  // Leaving the session (sign out, 401, expiry) drops every cached query, and so does switching to a different user
  // (dev persona switch) - otherwise the previous user's /me (onboarded flag), portfolio etc. would be served from cache.
  const hasToken = !!snap.token;
  const userId = snap.user?.user_id ?? null;
  const lastUser = useRef<string | null>(null);
  useEffect(() => {
    if (!hasToken) {
      qc.clear();
      lastUser.current = null;
      return;
    }
    if (lastUser.current && userId && lastUser.current !== userId) void qc.resetQueries();
    if (userId) lastUser.current = userId;
  }, [hasToken, userId, qc]);

  const signInDev = useCallback(
    async (persona: PersonaId) => {
      if (mode !== 'dev') throw new Error('Dev sign-in is disabled when Supabase auth is configured.');
      await devLogin(persona);
    },
    [mode],
  );

  const signInGoogle = useCallback(async () => {
    if (mode !== 'supabase')
      throw new Error('Google sign-in needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    await signInWithGoogle();
  }, [mode]);

  const verifyMfa = useCallback(async (code: string) => {
    await verifyTotp(code);
    setMfaPending(false);
  }, []);

  const signOut = useCallback(async () => {
    if (mode === 'supabase') {
      try {
        await supabaseSignOut();
      } catch {
        /* still clear locally */
      }
    }
    setMfaPending(false);
    clearSession('signed_out');
  }, [mode]);

  const expireSession = useCallback(async () => {
    if (mode === 'supabase') {
      try {
        await supabaseSignOut();
      } catch {
        /* still clear locally */
      }
    }
    setMfaPending(false);
    clearSession('expired');
  }, [mode]);

  const status: AuthStatus = booting
    ? 'loading'
    : mfaPending
      ? 'mfa_required'
      : snap.token
        ? 'signed_in'
        : 'signed_out';

  const value = useMemo<AuthApi>(
    () => ({
      mode,
      status,
      user: snap.user,
      endedBy: snap.endedBy,
      signInDev,
      signInWithGoogle: signInGoogle,
      verifyMfa,
      signOut,
      expireSession,
    }),
    [mode, status, snap.user, snap.endedBy, signInDev, signInGoogle, verifyMfa, signOut, expireSession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
