import { api, V1 } from '@/api/client';
import type { DevLoginResponse, Me, PersonaId } from '@/api/types';
import { setSession, type SessionUser } from './session';

/** MeResponse allows null email/display_name; the UI always needs a string. */
export const toSessionUser = (u: Me | DevLoginResponse['user']): SessionUser => ({
  user_id: u.user_id,
  email: u.email ?? '',
  display_name: u.display_name ?? u.email?.split('@')[0] ?? 'You',
  initials: u.initials,
  persona_id: u.persona_id ?? null,
});

/** POST /v1/auth/dev-login {persona} → token kept in memory + sessionStorage. Only valid when the backend runs AUTH_MODE=dev. */
export async function devLogin(persona: PersonaId): Promise<void> {
  const res = await api.post<DevLoginResponse>(`${V1}/auth/dev-login`, { persona }, { auth: false });
  setSession(res.access_token, toSessionUser(res.user), res.expires_in);
}
