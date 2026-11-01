import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '@/router';
import { AppProviders } from '@/providers';
import { __resetSession, setSession } from '@/auth/session';

export type MockRoute = (path: string, init: RequestInit) => unknown | Response | undefined;

const user = {
  user_id: 'u1',
  email: 'priya@example.com',
  display_name: 'Priya Nair',
  initials: 'PN',
  persona_id: 'priya',
};

/** Default responses for the endpoints the shell calls. Return a Response for custom status codes. */
export const defaultApi: MockRoute = path => {
  if (path === '/v1/me') return { ...user, onboarded: true };
  if (path === '/v1/market/status') return { open: true, session: 'regular', feed_state: 'live' };
  if (path === '/v1/portfolio')
    return {
      portfolio_id: 'p',
      cash: 1,
      invested: 1,
      equity: 100000,
      day_change: 1,
      day_change_pct: 0.42,
      positions: [],
      sectors: [],
      hhi: 0,
      effective_n: 0,
    };
  if (path === '/v1/portfolio/risk')
    return { metrics: {}, rules: [{ key: 'pos', limit: 15, current: 9, status: 'ok' }], violations: [] };
  if (path === '/v1/proposals') return { items: [{ id: 'p1' }], next_cursor: null };
  if (path === '/v1/alerts') return { items: [{ id: 'a1' }, { id: 'a2' }], next_cursor: null };
  if (path === '/v1/watchlist') return { items: [{ symbol: 'JNJ', quote: null }] };
  if (path === '/v1/universe')
    return {
      items: [
        { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', industry: 'x', exchange: 'NASDAQ' },
        { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', industry: 'x', exchange: 'NYSE' },
      ],
    };
  if (path === '/v1/stream/token') return { token: 't', expires_in: 60 };
  if (path === '/v1/events') return { accepted: 1, rejected: [] };
  return undefined;
};

export function installFetch(handler: MockRoute = defaultApi) {
  const calls: string[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = new URL(String(input)).pathname;
    calls.push(`${init.method ?? 'GET'} ${path}`);
    const out = handler(path, init) ?? defaultApi(path, init);
    if (out instanceof Response) return out;
    if (out === undefined)
      return new Response(JSON.stringify({ code: 'not_found', message: `unmocked ${path}`, trace_id: 't' }), {
        status: 404,
      });
    return new Response(JSON.stringify(out), { status: 200, headers: { 'X-Trace-Id': 'tr' } });
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls };
}

export function renderApp(path: string, opts: { signedIn?: boolean } = {}) {
  __resetSession();
  if (opts.signedIn ?? true) setSession('test-token', user, 3600);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, ...utils };
}
