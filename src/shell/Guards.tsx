import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMe } from '@/api/hooks/me';
import { useAuth } from '@/auth/useAuth';
import { SkeletonBlock } from '@/ui/Skeleton';
import { ErrorPanel } from './ErrorBoundary';

export function FullScreenLoader({ label = 'Loading StockPilot' }: { label?: string }) {
  return (
    <div
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}
      data-testid="loader"
    >
      <div style={{ width: 'min(360px,100%)' }}>
        <SkeletonBlock label={label} widths={[40, 100, 70]} />
      </div>
    </div>
  );
}

/**
 * Only ever navigate to same-origin absolute paths. Mitigates the react-router 6 open-redirect advisory
 * (backslash handling in <Link>/navigate, GHSA-wrjc-x8rr-h8h6) for the one place we navigate to a stored value.
 */
export function safeInternalPath(p: unknown, fallback = '/dashboard'): string {
  if (
    typeof p !== 'string' ||
    !p.startsWith('/') ||
    p.startsWith('//') ||
    p.includes('\\') ||
    Array.from(p).some(ch => ch.charCodeAt(0) < 32)
  )
    return fallback;
  return p === '/signin' ? fallback : p;
}

/** Signed-out (and MFA-pending) users go to /signin, remembering where they were headed. */
export function RequireAuth() {
  const { status } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <FullScreenLoader />;
  if (status !== 'signed_in')
    return <Navigate to="/signin" replace state={{ from: `${loc.pathname}${loc.search}` }} />;
  return <Outlet />;
}

/** Signed-in but not onboarded users go to /onboarding. */
export function RequireOnboarded() {
  const me = useMe();
  if (me.isPending) return <FullScreenLoader label="Loading your workspace" />;
  if (me.isError)
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <ErrorPanel error={me.error} onRetry={() => void me.refetch()} />
      </div>
    );
  if (!me.data.onboarded) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/** /onboarding is only for users who have not finished it. */
export function OnboardingOnly() {
  const me = useMe();
  if (me.isPending) return <FullScreenLoader label="Loading your workspace" />;
  if (me.isError)
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <ErrorPanel error={me.error} onRetry={() => void me.refetch()} />
      </div>
    );
  if (me.data.onboarded) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** /signin is only for signed-out (or MFA-pending) users. */
export function PublicOnly() {
  const { status } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'signed_in') {
    return <Navigate to={safeInternalPath((loc.state as { from?: string } | null)?.from)} replace />;
  }
  return <Outlet />;
}
