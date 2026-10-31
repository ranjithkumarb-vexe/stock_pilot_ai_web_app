import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { SkeletonBlock } from '@/ui/Skeleton';
import { Banners } from './Banners';
import { CommandPalette } from './CommandPalette';
import { ErrorBoundary } from './ErrorBoundary';
import { Footer } from './Footer';
import { MobileNav } from './MobileNav';
import { PageTransition } from './PageTransition';
import { ShellUiProvider } from './ShellUi';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MOBILE_QUERY, useIdleTimeout, useMediaQuery } from './hooks';
import { SCREENS, screenFromPath, type NavId } from './screens';

const IDLE_MS = 30 * 60_000;

/** Authenticated layout: sidebar (drawer < 900px), sticky top bar, banners, animated outlet, disclaimer footer, command palette. */
export function AppShell() {
  return (
    <ShellUiProvider>
      <ShellInner />
    </ShellUiProvider>
  );
}

function ShellInner() {
  const { pathname } = useLocation();
  const screen = screenFromPath(pathname);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const { expireSession } = useAuth();

  // design: signed out after 30 minutes of inactivity, with the "Session expired" message
  useIdleTimeout(IDLE_MS, () => void expireSession());

  const title = screen && screen in SCREENS ? SCREENS[screen as NavId].title : '';
  useEffect(() => {
    document.title = title ? `${title} · StockPilot AI` : 'StockPilot AI';
  }, [title]);

  return (
    <div className="shell" data-testid="app-shell">
      {!mobile && (
        <aside className="shell__sidebar" aria-label="Sidebar">
          <Sidebar />
        </aside>
      )}
      <div className="shell__col">
        <Topbar />
        <main id="main" tabIndex={-1} className="shell__main" data-testid="main">
          <div className="sr-only" role="status" aria-live="polite" data-testid="route-announcer">
            {title}
          </div>
          <Banners />
          <ErrorBoundary resetKey={pathname}>
            <PageTransition screen={screen}>
              <Suspense fallback={<SkeletonBlock widths={[30, 100, 80, 60]} label="Loading screen" />}>
                <Outlet />
              </Suspense>
            </PageTransition>
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
      {mobile && <MobileNav />}
      <CommandPalette />
    </div>
  );
}
