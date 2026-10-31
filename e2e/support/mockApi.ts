import type { Page, Route } from '@playwright/test';

/**
 * Minimal in-test backend for shell-level checks (no real API needed). Shapes follow docs/workflow/CONTRACT.md.
 * This is TEST SUPPORT only; nothing under src/ imports it. Cross-repo journeys (INT-02) use the real backend instead.
 */
const user = {
  user_id: '00000000-0000-4000-8000-000000000001',
  email: 'priya@example.com',
  display_name: 'Priya Nair',
  initials: 'PN',
  persona_id: 'priya',
};
const quote = (symbol: string, price: number) => ({
  symbol,
  price,
  prev_close: price - 1,
  change_pct: 0.5,
  ts: new Date().toISOString(),
  source: 'sim',
  session: 'regular',
  freshness: 'live',
});

export type MockOptions = { onboarded?: boolean; marketOpen?: boolean; feed?: string };

export async function installMockApi(page: Page, opts: MockOptions = {}): Promise<void> {
  const { onboarded = true, marketOpen = true, feed = 'live' } = opts;
  await page.route('**/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^\/v1/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: {
          'X-Trace-Id': 'mock-trace',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Expose-Headers': 'X-Trace-Id',
        },
        body: JSON.stringify(body),
      });
    if (route.request().method() === 'OPTIONS') return json({});
    if (p === '/auth/dev-login') return json({ access_token: 'mock-token', expires_in: 3600, user });
    if (p === '/me') return json({ ...user, onboarded });
    if (p === '/market/status')
      return json({ open: marketOpen, session: marketOpen ? 'regular' : 'closed', feed });
    if (p === '/portfolio')
      return json({
        portfolio_id: 'p1',
        cash: 25000,
        invested: 75000,
        equity: 100000,
        day_change: 420,
        day_change_pct: 0.42,
        positions: [{ symbol: 'JNJ' }],
        sectors: [],
        hhi: 0.2,
        effective_n: 5,
      });
    if (p === '/portfolio/risk')
      return json({
        metrics: {},
        rules: [
          { key: 'pos', limit: 15, current: 9, status: 'ok' },
          { key: 'sec', limit: 35, current: 30, status: 'warn' },
          { key: 'dd', limit: 10, current: 2, status: 'ok' },
          { key: 'trades', limit: 5, current: 1, status: 'ok' },
        ],
        violations: [],
      });
    if (p === '/proposals') return json({ items: [{ id: 'pr1' }], next_cursor: null });
    if (p === '/alerts') return json({ items: [{ id: 'a1' }, { id: 'a2' }], next_cursor: null });
    if (p === '/watchlist')
      return json({
        items: [
          { symbol: 'JNJ', quote: quote('JNJ', 160) },
          { symbol: 'AAPL', quote: quote('AAPL', 230) },
        ],
      });
    if (p === '/universe')
      return json({
        items: [
          {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            sector: 'Technology',
            industry: 'Hardware',
            exchange: 'NASDAQ',
          },
          {
            symbol: 'JNJ',
            name: 'Johnson & Johnson',
            sector: 'Healthcare',
            industry: 'Pharma',
            exchange: 'NYSE',
          },
          {
            symbol: 'KO',
            name: 'Coca-Cola',
            sector: 'Consumer Staples',
            industry: 'Beverages',
            exchange: 'NYSE',
          },
        ],
      });
    if (p === '/stream/token') return json({ token: 'stream-token', expires_in: 60 });
    if (p === '/events') return json({ accepted: 1, rejected: [] });
    if (p === '/stream') return route.abort();
    return json({ code: 'not_found', message: `mock: ${p}`, trace_id: 'mock-trace' }, 404);
  });
}
