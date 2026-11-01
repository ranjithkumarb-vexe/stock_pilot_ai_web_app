import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { shot, signIn, type Persona } from '../support/live';

/**
 * Every screen with REAL data: axe-core in a real Chromium (incl. colour contrast), no horizontal page scroll, at the
 * three design widths and in both themes. axe-core comes with jest-axe (no extra dependency).
 */
const require = createRequire(import.meta.url);
const AXE = readFileSync(
  require.resolve('axe-core/axe.min.js', { paths: [require.resolve('jest-axe')] }),
  'utf8',
);

const ROUTES = [
  'dashboard',
  'watchlist',
  'brief/NVDA',
  'portfolio',
  'proposals',
  'trading',
  'live',
  'alerts',
  'ask',
  'profile',
  'profile?tab=learned',
  'profile?tab=memory',
  'profile?tab=privacy',
  'audit',
  'audit?tab=evals',
];

const COMBOS: Array<{
  persona: Exclude<Persona, 'new'>;
  width: number;
  theme: 'dark' | 'light';
  routes: string[];
}> = [
  { persona: 'priya', width: 1440, theme: 'dark', routes: ROUTES },
  { persona: 'alex', width: 1440, theme: 'light', routes: ROUTES },
  { persona: 'priya', width: 768, theme: 'dark', routes: ROUTES },
  { persona: 'alex', width: 360, theme: 'light', routes: ROUTES },
];

for (const c of COMBOS) {
  test(`axe + no horizontal scroll on every screen: ${c.persona}, ${c.width}px, ${c.theme}`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: c.width, height: 900 });
    await signIn(page, c.persona);
    if (c.theme === 'light') await page.getByTestId('theme-toggle').click();
    const problems: string[] = [];
    for (const r of c.routes) {
      await page.goto(`/${r}`);
      await expect(page.getByTestId('page-title')).toBeVisible();
      await page.waitForTimeout(2500); // let entrance animations finish: axe judges colour contrast on the painted pixels
      await page.evaluate(AXE);
      const violations = (await page.evaluate(
        `axe.run(document).then(r => r.violations.map(v => v.id + ' (' + v.impact + ') ' + v.nodes[0].target.join(' ')))`,
      )) as string[];
      const hscroll = (await page.evaluate(
        'document.documentElement.scrollWidth > document.documentElement.clientWidth + 1',
      )) as boolean;
      if (violations.length) problems.push(`${r}: ${violations.join('; ')}`);
      if (hscroll) problems.push(`${r}: horizontal page scroll at ${c.width}px`);
      if (r === 'dashboard') await shot(page, `int-${c.persona}-dashboard-${c.width}-${c.theme}`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}
