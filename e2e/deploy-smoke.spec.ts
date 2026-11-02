import { expect, test, type Page } from '@playwright/test';
import { installMockApi } from './support/mockApi';

/**
 * Deployment smoke (FE-12 / INT-03), run by `npm run e2e:deploy` against PRODUCTION builds served by scripts/serve_dist.mjs
 * with the headers and rewrites of vercel.json (so the real Content-Security-Policy is enforced). Two builds:
 *   PROD = built with .env.production.example (Supabase auth mode, API origin https://stockpilot-api.onrender.com)
 *   DEV  = same env but VITE_AUTH_MODE=dev, so the demo sign-in + mocked API can drive every screen under the CSP.
 * Any `securitypolicyviolation` event or "Refused to ..." console line fails the test: fix vercel.json, not the app.
 * Third-party hosts are never really contacted: Google Fonts, the API origin and the Supabase origin are intercepted.
 */
const PROD = process.env.E2E_DEPLOY_PROD_URL;
const DEV = process.env.E2E_DEPLOY_DEV_URL;
const API_ORIGIN = 'https://stockpilot-api.onrender.com';
const SUPABASE_HOST = 'your-project-ref.supabase.co'; // URL hosts are lower-cased by the browser

type Seen = { csp: string[]; errors: string[]; consoleErrors: string[] };

async function watch(page: Page): Promise<Seen> {
  const seen: Seen = { csp: [], errors: [], consoleErrors: [] };
  // string script: the e2e tsconfig has no DOM lib
  await page.addInitScript(`
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', function (e) {
      window.__csp.push(e.violatedDirective + ' blocked ' + (e.blockedURI || '(inline)') + ' @ ' + (e.sourceFile || '') + ':' + e.lineNumber);
    });
  `);
  page.on('console', m => {
    const t = m.text();
    if (/Content Security Policy|Refused to (load|execute|apply|connect|frame)/i.test(t))
      seen.csp.push(t.slice(0, 300));
    else if (m.type() === 'error') seen.consoleErrors.push(t.slice(0, 200));
  });
  page.on('pageerror', e => seen.errors.push(String(e).slice(0, 300)));
  return seen;
}
const collectCsp = async (page: Page, seen: Seen) => {
  const fromEvents = (await page.evaluate('window.__csp || []')) as string[];
  return [...new Set([...seen.csp, ...fromEvents])];
};

/** Stand-ins for the third-party hosts the page legitimately talks to; the browser still enforces the CSP first. */
async function stubThirdParties(page: Page) {
  await page.route('https://fonts.googleapis.com/**', r =>
    r.fulfill({ status: 200, contentType: 'text/css', body: '/* stubbed google fonts css */' }),
  );
  await page.route('https://fonts.gstatic.com/**', r =>
    r.fulfill({ status: 200, contentType: 'font/woff2', body: '' }),
  );
}

test.describe('production build under the vercel.json headers', () => {
  test.skip(!PROD || !DEV, 'run through `npm run e2e:deploy`');

  test('security headers and SPA rewrites', async ({ request }) => {
    const root = await request.get(`${PROD}/`);
    expect(root.status()).toBe(200);
    const h = root.headers();
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['content-security-policy']).toContain("object-src 'none'");
    expect(h['content-security-policy']).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
    expect(h['content-security-policy']).toContain(API_ORIGIN);
    expect(h['strict-transport-security']).toMatch(/max-age=\d{7,}/);
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy']).toContain('camera=()');

    // deep links fall back to index.html; a missing hashed asset must 404 (not return HTML with a JS MIME mismatch)
    const deep = await request.get(`${PROD}/portfolio`);
    expect(deep.status()).toBe(200);
    expect(await deep.text()).toContain('<div id="root">');
    expect((await request.get(`${PROD}/assets/does-not-exist.js`)).status()).toBe(404);

    const html = await (await request.get(`${PROD}/`)).text();
    const asset = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
    expect(asset, 'entry script in index.html').toBeTruthy();
    const a = await request.get(`${PROD}${asset}`);
    expect(a.headers()['cache-control']).toContain('immutable');
    expect(a.headers()['content-type']).toContain('javascript');
    // no source maps are published
    expect((await request.get(`${PROD}${asset}.map`)).status()).toBe(404);
    expect(await a.text()).not.toContain('sourceMappingURL');
  });

  test('prod build (Supabase mode): sign-in renders, SDK chunk loads, OAuth redirect target is allowed', async ({
    page,
  }) => {
    const seen = await watch(page);
    await stubThirdParties(page);
    const supabaseCalls: string[] = [];
    await page.route(`https://${SUPABASE_HOST}/**`, r => {
      supabaseCalls.push(r.request().url());
      return r.fulfill({
        status: 200,
        contentType: 'text/html',
        headers: { 'access-control-allow-origin': '*' },
        body: '<!doctype html><title>stub supabase</title>',
      });
    });
    await page.goto(`${PROD}/`);
    await expect(page).toHaveURL(/\/signin$/);
    await expect(page.getByTestId('signin-google')).toBeVisible();
    await expect(page.getByTestId('signin-priya')).toHaveCount(0); // no demo accounts in a production build
    await page.getByTestId('signin-google').click();
    // the Supabase SDK is a lazy chunk; signInWithOAuth then navigates the window to the Supabase authorize URL
    await page.waitForURL(new RegExp(`${SUPABASE_HOST.replace(/\./g, '\\.')}/auth/v1/authorize`), {
      timeout: 15_000,
    });
    expect(supabaseCalls.length).toBeGreaterThan(0);
    const csp = await collectCsp(page, seen).catch(() => seen.csp); // page navigated away: events captured before are lost
    expect(csp, `CSP violations:\n${csp.join('\n')}`).toEqual([]);
    expect(seen.errors, seen.errors.join('\n')).toEqual([]);
  });

  test('prod build: unknown-session API call to the API origin passes connect-src', async ({ page }) => {
    const seen = await watch(page);
    await stubThirdParties(page);
    let apiHits = 0;
    await page.route(`${API_ORIGIN}/**`, r => {
      apiHits += 1;
      return r.fulfill({
        status: 401,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
        body: JSON.stringify({ code: 'unauthenticated', message: 'stub', trace_id: 't' }),
      });
    });
    // a real fetch from the page to the API origin: allowed by connect-src (route fulfils it), and a foreign origin is not
    await page.goto(`${PROD}/signin`);
    const ok = await page.evaluate(async origin => {
      try {
        const r = await fetch(`${origin}/healthz`);
        return r.status;
      } catch (e) {
        return String(e);
      }
    }, API_ORIGIN);
    expect(ok).toBe(401);
    expect(apiHits).toBeGreaterThan(0);
    const blocked = await page.evaluate(async () => {
      try {
        await fetch('https://evil.example.org/x');
        return 'allowed';
      } catch {
        return 'blocked';
      }
    });
    expect(blocked, 'connect-src must block foreign origins').toBe('blocked');
    const csp = await collectCsp(page, seen);
    // exactly one violation is expected here: the deliberate evil.example.org probe
    expect(csp.filter(c => !/evil\.example\.org/.test(c))).toEqual([]);
    expect(csp.some(c => /evil\.example\.org/.test(c))).toBe(true);
  });
});

test.describe('every screen under the CSP (demo sign-in build, mocked API)', () => {
  test.skip(!PROD || !DEV, 'run through `npm run e2e:deploy`');

  test('navigate all screens, theme toggle, palette, chart; zero CSP violations', async ({ page }) => {
    const seen = await watch(page);
    await stubThirdParties(page);
    await installMockApi(page);
    await page.route('**/v1/quotes/*/bars*', r => {
      const t0 = Date.UTC(2026, 9, 30, 14, 30) / 1000;
      const bars = Array.from({ length: 60 }, (_, i) => {
        const base = 100 + Math.sin(i / 6) * 3;
        return {
          time: new Date((t0 + i * 300) * 1000).toISOString(),
          open: base,
          high: base + 1,
          low: base - 1,
          close: base + 0.4,
          volume: 1000 + i,
        };
      });
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', 'x-trace-id': 't' },
        body: JSON.stringify({ symbol: 'JNJ', interval: '5m', source: 'simulated', bars }),
      });
    });

    await page.goto(`${DEV}/`);
    await expect(page).toHaveURL(/\/signin$/);
    await page.getByTestId('signin-priya').click();
    await expect(page).toHaveURL(/\/dashboard$/);

    for (const route of [
      'dashboard',
      'watchlist',
      'brief/JNJ',
      'portfolio',
      'proposals',
      'trading',
      'live',
      'alerts',
      'ask',
      'profile',
      'audit',
    ]) {
      await page.goto(`${DEV}/${route}`); // full load: also exercises the SPA rewrite for every deep link
      await expect(page.getByTestId('page-title')).toBeVisible();
      await page.waitForLoadState('networkidle');
    }
    // the candle chart (lightweight-charts) mounted on /live
    await page.goto(`${DEV}/live`);
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'light'); // pre-paint inline script ran under the hash
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByTestId('palette')).toBeVisible();

    const csp = await collectCsp(page, seen);
    expect(csp, `CSP violations:\n${csp.join('\n')}`).toEqual([]);
    expect(seen.errors, `uncaught page errors:\n${seen.errors.join('\n')}`).toEqual([]);
  });
});

test.describe('responsive widths on the production build (INT-03)', () => {
  test.skip(!PROD || !DEV, 'run through `npm run e2e:deploy`');

  for (const width of [360, 768]) {
    test(`no horizontal page scroll and no CSP violation at ${width}px`, async ({ page }) => {
      const seen = await watch(page);
      await stubThirdParties(page);
      await installMockApi(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${DEV}/signin`);
      await page.getByTestId('signin-priya').click();
      await expect(page).toHaveURL(/\/dashboard$/);
      const wide: string[] = [];
      for (const route of [
        'dashboard',
        'watchlist',
        'portfolio',
        'proposals',
        'trading',
        'live',
        'alerts',
        'ask',
        'profile',
        'audit',
      ]) {
        await page.goto(`${DEV}/${route}`);
        await expect(page.getByTestId('page-title')).toBeVisible();
        await page.waitForLoadState('networkidle');
        const over = (await page.evaluate(
          'document.documentElement.scrollWidth - document.documentElement.clientWidth',
        )) as number;
        if (over > 1) wide.push(`${route}: ${over}px wider than the viewport`);
      }
      expect(wide, wide.join('\n')).toEqual([]);
      const csp = await collectCsp(page, seen);
      expect(csp, csp.join('\n')).toEqual([]);
    });
  }
});
