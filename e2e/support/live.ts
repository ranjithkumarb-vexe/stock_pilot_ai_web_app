import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Helpers for the LIVE journeys (real backend, dev auth mode). Nothing here is imported by src/. */
export const API = process.env.E2E_API_URL ?? 'http://localhost:8010';
export const SCREENS = fileURLToPath(new URL('../../docs/screens', import.meta.url));
mkdirSync(SCREENS, { recursive: true });

export type Persona = 'priya' | 'alex' | 'new';

/** Sign in through the UI with a demo account and wait for the first guarded screen. */
export async function signIn(page: Page, persona: Persona): Promise<void> {
  await page.goto('/signin');
  await page.getByTestId(`signin-${persona}`).click();
  await expect(page).toHaveURL(persona === 'new' ? /\/onboarding$/ : /\/dashboard$/);
}

/** Bearer token for direct API calls (same user as the UI persona: ids are deterministic). */
export async function token(request: APIRequestContext, persona: 'priya' | 'alex'): Promise<string> {
  const r = await request.post(`${API}/v1/auth/dev-login`, { data: { persona } });
  expect(r.ok()).toBeTruthy();
  return (await r.json()).access_token as string;
}

export async function apiGet<T>(request: APIRequestContext, tok: string, path: string): Promise<T> {
  const r = await request.get(`${API}/v1${path}`, { headers: { Authorization: `Bearer ${tok}` } });
  expect(r.ok(), `GET ${path} -> ${r.status()}`).toBeTruthy();
  return (await r.json()) as T;
}

export async function apiPost(
  request: APIRequestContext,
  tok: string,
  path: string,
  data?: unknown,
): Promise<{ status: number; body: unknown }> {
  const r = await request.post(`${API}/v1${path}`, { headers: { Authorization: `Bearer ${tok}` }, data });
  return { status: r.status(), body: await r.json().catch(() => null) };
}

/** Put the dev simulators back to "calendar market, live feed" so one journey never leaks into the next. */
export async function resetSimulators(request: APIRequestContext, tok: string): Promise<void> {
  await apiPost(request, tok, '/dev/market', { open: null });
  await apiPost(request, tok, '/dev/feed', { state: 'live' });
}

export async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(SCREENS, `${name}.png`) });
}

/** Collects console errors / failed same-origin API calls so a journey can assert "no unexpected errors". */
export function watchErrors(page: Page, ignore: RegExp[] = []) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // browsers log every non-2xx fetch as a console error; HTTP failures are tracked via `response` below
    if (/Failed to load resource/.test(t)) return;
    errors.push(`console: ${t.slice(0, 200)}`);
  });
  page.on('response', r => {
    if (!r.url().startsWith(API) || r.status() < 400) return;
    const line = `${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`;
    if (!ignore.some(re => re.test(line))) errors.push(line);
  });
  return errors;
}
