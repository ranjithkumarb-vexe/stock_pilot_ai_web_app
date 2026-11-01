import { expect, test, type Page, type Route } from '@playwright/test';
import { API, resetSimulators, shot, signIn, token } from '../support/live';

/**
 * Error scenarios against the REAL backend, with the failure injected in the browser (page.route) where the real
 * server cannot be made to fail on demand: 401 token expiry, offline, 429 (+ Retry-After), 503. The forged-token 401
 * is real.
 */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
  'access-control-expose-headers': 'x-trace-id, retry-after, idempotent-replay',
};
const fail = (
  route: Route,
  status: number,
  code: string,
  message: string,
  headers: Record<string, string> = {},
) =>
  route.request().method() === 'OPTIONS'
    ? route.fulfill({ status: 204, headers: CORS })
    : route.fulfill({
        status,
        contentType: 'application/json',
        headers: { ...CORS, 'x-trace-id': 'e2e-trace-1', ...headers },
        body: JSON.stringify({ code, message, trace_id: 'e2e-trace-1' }),
      });

const signedInPriya = async (page: Page) => {
  await signIn(page, 'priya');
  await expect(page.getByTestId('dash-hero')).toBeVisible();
};

test.afterEach(async ({ request }) => {
  await resetSimulators(request, await token(request, 'priya'));
});

test('401 with a forged/expired token: the real API answers 401, the app signs out and shows "Session expired"', async ({
  page,
}) => {
  await page.goto('/signin');
  await page.evaluate(() =>
    sessionStorage.setItem(
      'sp-session',
      JSON.stringify({
        token: 'forged.token.value',
        user: { user_id: 'x', email: 'x@x', display_name: 'X', initials: 'X' },
        expiresAt: Date.now() + 3_600_000,
      }),
    ),
  );
  await page.goto('/dashboard');
  await expect(page.getByTestId('session-expired')).toBeVisible();
  await shot(page, 'int-error-401-session-expired-1440');
  await page.getByTestId('session-expired-signin').click();
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByTestId('signin-priya')).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('sp-session'))).toBeNull();
});

test('401 in the middle of a session (token revoked): next request signs the user out', async ({ page }) => {
  await signedInPriya(page);
  await page.route(`${API}/v1/briefs/JNJ`, route =>
    fail(route, 401, 'unauthenticated', 'Invalid or expired token'),
  );
  await page.getByTestId('nav-watchlist').click();
  await page.getByTestId('wl-brief-JNJ').click(); // first request of a not-yet-cached resource
  await expect(page.getByTestId('session-expired')).toBeVisible();
  await page.getByTestId('session-expired-signin').click();
  await expect(page).toHaveURL(/\/signin$/);
});

test('offline: the OFFLINE banner appears and goes away when the connection returns; data survives', async ({
  page,
  context,
}) => {
  await signedInPriya(page);
  await context.setOffline(true);
  await expect(page.getByTestId('banner-offline')).toContainText('offline');
  await shot(page, 'int-error-offline-banner-1440');
  await context.setOffline(false);
  await expect(page.getByTestId('banner-offline')).toBeHidden();
  await expect(page.getByTestId('dash-hero')).toBeVisible();
});

test('429 on a GET is retried automatically after Retry-After and the screen recovers', async ({ page }) => {
  await signedInPriya(page);
  let calls = 0;
  await page.route(`${API}/v1/briefs/JNJ`, route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    calls += 1;
    return calls <= 2
      ? fail(route, 429, 'rate_limited', 'Too many requests', { 'retry-after': '1' })
      : route.continue();
  });
  await page.goto('/brief/JNJ');
  await expect(page.getByTestId('verified-badge')).toBeVisible({ timeout: 20_000 });
  expect(calls).toBe(3); // two 429s honoured (Retry-After: 1), then the real answer
});

test('429 on a write (add to watchlist) is NOT retried silently: the user sees "slow down" copy', async ({
  page,
}) => {
  await signedInPriya(page);
  await page.getByTestId('nav-watchlist').click();
  await expect(page.getByTestId('wl-row-JNJ')).toBeVisible();
  let puts = 0;
  await page.route(`${API}/v1/watchlist/*`, route => {
    if (route.request().method() === 'PUT') {
      puts += 1;
      return fail(route, 429, 'rate_limited', 'Too many requests', { 'retry-after': '30' });
    }
    return route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.continue();
  });
  await page.getByTestId('wl-search').fill('tesla');
  await page.getByTestId('wl-option-TSLA').click(); // choosing a suggestion adds it
  await expect(page.getByTestId('wl-add-error')).toContainText(/slow down|too many/i);
  await shot(page, 'int-error-429-1440');
  expect(puts).toBe(1);
  await expect(page.getByTestId('wl-row-TSLA')).toHaveCount(0);
});

test('503 on the brief shows the error card with the trace reference and "Try again" recovers', async ({
  page,
}) => {
  await signedInPriya(page);
  let blocked = true;
  await page.route(`${API}/v1/briefs/NVDA`, route =>
    blocked ? fail(route, 503, 'upstream_unavailable', 'Service temporarily unavailable') : route.continue(),
  );
  await page.goto('/brief/NVDA');
  const panel = page.getByTestId('error-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('e2e-trace-1');
  await shot(page, 'int-error-503-brief-1440');
  blocked = false;
  await panel.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('brief-name')).toBeVisible();
});

test('422 rule_violation on an order shows the broken rule inline (no order is created)', async ({
  page,
  request,
}) => {
  await signedInPriya(page);
  // KO buy pushes Consumer Staples over Priya's 25% cap: the API refuses with rule_violation unless overridden
  await page.goto('/trading?symbol=KO&side=buy&qty=1');
  await expect(page.getByTestId('ticket')).toBeVisible();
  await expect(page.getByTestId('check-sec')).toContainText('Blocked');
  await expect(page.getByTestId('ticket-submit')).toBeDisabled();
  await shot(page, 'int-error-rule-blocked-1440');
  const t = await token(request, 'priya');
  const r = await request.post(`${API}/v1/orders`, {
    headers: { Authorization: `Bearer ${t}`, 'Idempotency-Key': crypto.randomUUID() },
    data: { symbol: 'KO', side: 'buy', type: 'market', qty: 1 },
  });
  expect(r.status()).toBe(422);
  const body = await r.json();
  expect(body.code).toBe('rule_violation');
  expect(body.details.violations[0].rule).toBe('sec');
});

test('the REAL rate limiter answers 429 with Retry-After and the error body the UI maps', async ({
  request,
}) => {
  const t = await token(request, 'priya');
  await new Promise(r => setTimeout(r, 12_000)); // let the user bucket refill completely after the previous tests
  const rs = await Promise.all(
    Array.from({ length: Number(process.env.E2E_USER_BURST ?? 120) + 40 }, () =>
      request.get(`${API}/v1/me`, { headers: { Authorization: `Bearer ${t}` } }),
    ),
  );
  const limited = rs.filter(r => r.status() === 429);
  expect(limited.length, 'user bucket must run dry').toBeGreaterThan(0);
  expect(Number(limited[0].headers()['retry-after'])).toBeGreaterThan(0);
  const body = await limited[0].json();
  expect(body.code).toBe('rate_limited');
  expect(body.details.retry_after_s).toBeGreaterThan(0);
  await new Promise(r => setTimeout(r, 12_000)); // do not leak the throttle into later specs
});
