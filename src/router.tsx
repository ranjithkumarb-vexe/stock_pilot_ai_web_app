import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, ScrollRestoration, type RouteObject } from 'react-router-dom';
import { AppShell } from '@/shell/AppShell';
import { ErrorBoundary, ErrorPanel } from '@/shell/ErrorBoundary';
import { FullScreenLoader, OnboardingOnly, PublicOnly, RequireAuth, RequireOnboarded } from '@/shell/Guards';
import { NotFound } from '@/shell/NotFound';
import { SessionExpiredDialog } from '@/shell/SessionExpiredDialog';
import { Splash } from '@/shell/Splash';
import { useRouteError } from 'react-router-dom';

/** One lazy chunk per feature module (src/features/<screen>/index.tsx → default export `Screen`). */
const Signin = lazy(() => import('@/features/signin'));
const Onboarding = lazy(() => import('@/features/onboarding'));
const Dashboard = lazy(() => import('@/features/dashboard'));
const Watchlist = lazy(() => import('@/features/watchlist'));
const Brief = lazy(() => import('@/features/brief'));
const Portfolio = lazy(() => import('@/features/portfolio'));
const Proposals = lazy(() => import('@/features/proposals'));
const Trading = lazy(() => import('@/features/trading'));
const Live = lazy(() => import('@/features/live'));
const Alerts = lazy(() => import('@/features/alerts'));
const Ask = lazy(() => import('@/features/ask'));
const Profile = lazy(() => import('@/features/profile'));
const Audit = lazy(() => import('@/features/audit'));

const full = (node: ReactNode) => <Suspense fallback={<FullScreenLoader />}>{node}</Suspense>;

function RootLayout() {
  return (
    <>
      <a href="#main" className="skip-link" data-testid="skip-link">
        Skip to content
      </a>
      <Splash />
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
      <SessionExpiredDialog />
      {/* new navigations scroll to top, back/forward restores the position */}
      <ScrollRestoration />
    </>
  );
}

function RouteError() {
  const error = useRouteError();
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <ErrorPanel error={error} />
    </div>
  );
}

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      { element: <PublicOnly />, children: [{ path: '/signin', element: full(<Signin />) }] },
      {
        element: <RequireAuth />,
        children: [
          { element: <OnboardingOnly />, children: [{ path: '/onboarding', element: full(<Onboarding />) }] },
          {
            element: <RequireOnboarded />,
            children: [
              {
                element: <AppShell />,
                children: [
                  { path: '/dashboard', element: <Dashboard /> },
                  { path: '/watchlist', element: <Watchlist /> },
                  { path: '/brief/:symbol?', element: <Brief /> },
                  { path: '/portfolio', element: <Portfolio /> },
                  { path: '/proposals/:id?', element: <Proposals /> },
                  { path: '/trading', element: <Trading /> },
                  { path: '/live', element: <Live /> },
                  { path: '/alerts', element: <Alerts /> },
                  { path: '/ask', element: <Ask /> },
                  { path: '/profile', element: <Profile /> },
                  { path: '/audit', element: <Audit /> },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
