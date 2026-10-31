/**
 * Session store (module singleton, framework-free so the API client can use it).
 * Token lives in memory and is mirrored to sessionStorage (key `sp-session`) so a reload keeps the dev session.
 * It is never put in localStorage and never in a URL.
 */
export type SessionUser = {
  user_id: string;
  email: string;
  display_name: string;
  initials: string;
  persona_id?: string | null;
};

export type SessionSnapshot = {
  token: string | null;
  user: SessionUser | null;
  /** epoch ms; null when unknown */
  expiresAt: number | null;
  /** why the session ended, for the sign-in screen / expired dialog */
  endedBy: 'signed_out' | 'expired' | null;
};

const KEY = 'sp-session';
const EMPTY: SessionSnapshot = { token: null, user: null, expiresAt: null, endedBy: null };

let state: SessionSnapshot = EMPTY;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach(l => l());

const persist = () => {
  try {
    if (state.token)
      sessionStorage.setItem(
        KEY,
        JSON.stringify({ token: state.token, user: state.user, expiresAt: state.expiresAt }),
      );
    else sessionStorage.removeItem(KEY);
  } catch {
    /* sessionStorage unavailable: session stays in memory only */
  }
};

/** Restore a non-expired session from sessionStorage. Call once at start-up. */
export function restoreSession(now: number = Date.now()): SessionSnapshot {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SessionSnapshot>;
      if (p.token && (!p.expiresAt || p.expiresAt > now)) {
        state = { token: p.token, user: p.user ?? null, expiresAt: p.expiresAt ?? null, endedBy: null };
        emit();
        return state;
      }
      sessionStorage.removeItem(KEY);
    }
  } catch {
    /* corrupt or blocked storage: start signed out */
  }
  return state;
}

export const getSession = (): SessionSnapshot => state;
export const getToken = (): string | null => state.token;

export function setSession(
  token: string,
  user: SessionUser | null,
  expiresInSec?: number,
  now: number = Date.now(),
): void {
  state = { token, user, expiresAt: expiresInSec ? now + expiresInSec * 1000 : null, endedBy: null };
  persist();
  emit();
}

export function setSessionUser(user: SessionUser): void {
  if (!state.token) return;
  state = { ...state, user };
  persist();
  emit();
}

export function clearSession(endedBy: 'signed_out' | 'expired' = 'signed_out'): void {
  state = { ...EMPTY, endedBy };
  persist();
  emit();
}

export const subscribeSession = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Test helper. */
export function __resetSession(): void {
  state = EMPTY;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  emit();
}
