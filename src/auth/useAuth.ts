import { useContext } from 'react';
import { AuthContext } from './AuthProvider';
import type { AuthApi } from './types';

/** The one auth interface for screens: dev personas or Supabase Google + TOTP, same shape. */
export function useAuth(): AuthApi {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
