/** Typed access to Vite env. Read once; tests can mock `import.meta.env` through vi.stubEnv. */
export type AuthMode = 'dev' | 'supabase';

const clean = (v: string | undefined): string => (v ?? '').trim();

export const getApiBaseUrl = (): string =>
  (clean(import.meta.env.VITE_API_BASE_URL) || 'http://localhost:8000').replace(/\/+$/, '');

export const getSupabaseConfig = (): { url: string; anonKey: string } | null => {
  const url = clean(import.meta.env.VITE_SUPABASE_URL);
  const anonKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY);
  return url && anonKey ? { url, anonKey } : null;
};

/** Supabase mode only when both VITE_SUPABASE_* are set (and VITE_AUTH_MODE is not forcing dev); otherwise dev-login. */
export const getAuthMode = (): AuthMode => {
  const forced = clean(import.meta.env.VITE_AUTH_MODE).toLowerCase();
  if (forced === 'dev') return 'dev';
  if (getSupabaseConfig()) return 'supabase';
  return 'dev';
};
