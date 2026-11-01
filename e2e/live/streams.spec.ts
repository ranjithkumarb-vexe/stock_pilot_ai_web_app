import { expect, test } from '@playwright/test';
import { apiGet, shot, signIn, token, watchErrors } from '../support/live';

/** Alerts, feed "why", Ask Pilot and Audit/evals against the real Stream D / Stream E endpoints (Priya). Serial: alert actions persist. */
test.describe.configure({ mode: 'serial' });

type Alert = {
  id: string;
  type: string;
  state: string;
  critical: boolean;
  symbol: string | null;
  title: string;
};
let tok = '';
test.beforeAll(async ({ request }) => {
  tok = await token(request, 'priya');
});

test('alerts: pinned rule breach cannot be dismissed; snooze / dismiss / restore persist server-side', async ({
  page,
  request,
}) => {
  const errors = watchErrors(page);
  const list = await apiGet<{ items: Alert[]; move_threshold: number }>(request, tok, '/alerts?limit=200');
  const breach = list.items.find(a => a.critical)!;
  const filing = list.items.find(a => a.type === 'filing' && a.state === 'new')!;
  const other = list.items.find(a => !a.critical && a.type !== 'filing' && a.state === 'new')!;
  expect(breach && filing && other).toBeTruthy();

  await signIn(page, 'priya');
  await page.goto('/alerts');
  await expect(page.getByTestId('screen-alerts')).toBeVisible();
  await expect(page.getByTestId(`alert-${breach.id}`)).toContainText('Position cap breached');
  await expect(page.getByTestId(`alert-dismiss-${breach.id}`)).toHaveCount(0); // rule breaches are never dismissible
  await expect(page.getByTestId('stat-threshold')).toContainText(list.move_threshold.toFixed(2));
  await shot(page, 'int-priya-alerts-1440');

  // filter by type
  await page
    .getByTestId('alerts-filter')
    .getByRole('radio', { name: /Filings/ })
    .click();
  await expect(page.getByTestId(`alert-${filing.id}`)).toBeVisible();
  await expect(page.getByTestId(`alert-${breach.id}`)).toHaveCount(0);
  await page.getByTestId('alerts-filter').getByRole('radio', { name: /^All/ }).click();

  // dismiss -> archived, persisted; restore brings it back
  await page.getByTestId(`alert-dismiss-${other.id}`).click();
  await expect(page.getByTestId(`alert-${other.id}`)).toHaveCount(0);
  expect(
    (await apiGet<{ items: Alert[] }>(request, tok, '/alerts?limit=200')).items.find(a => a.id === other.id)
      ?.state,
  ).toBe('dismissed');
  await page
    .getByTestId('alerts-filter')
    .getByRole('radio', { name: /Archived/ })
    .click();
  await expect(page.getByTestId(`alert-${other.id}`)).toBeVisible();
  await page.getByTestId(`alert-restore-${other.id}`).click();
  await expect(page.getByTestId(`alert-${other.id}`)).toHaveCount(0);
  expect(
    (await apiGet<{ items: Alert[] }>(request, tok, '/alerts?limit=200')).items.find(a => a.id === other.id)
      ?.state,
  ).toBe('new');

  // snooze 24h
  await page.getByTestId('alerts-filter').getByRole('radio', { name: /^All/ }).click();
  await page.getByTestId(`alert-snooze-${filing.id}`).click();
  await expect(page.getByTestId(`alert-${filing.id}`)).toHaveCount(0);
  expect(
    (await apiGet<{ items: Alert[] }>(request, tok, '/alerts?limit=200')).items.find(a => a.id === filing.id)
      ?.state,
  ).toBe('snoozed');

  // open -> navigates to the destination and marks it opened
  const openable = (await apiGet<{ items: Alert[] }>(request, tok, '/alerts?limit=200')).items.find(
    a => a.state === 'new' && !a.critical && a.symbol,
  )!;
  await page.getByTestId(`alert-open-${openable.id}`).click();
  await expect(page).toHaveURL(/\/brief\//);
  expect(
    (await apiGet<{ items: Alert[] }>(request, tok, '/alerts?limit=200')).items.find(
      a => a.id === openable.id,
    )?.state,
  ).toBe('opened');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('dashboard feed: "Why am I seeing this?" is built from the audit trail, never invented by the UI', async ({
  page,
  request,
}) => {
  const feed = await apiGet<{
    items: { id: string; kind: string; pinned: boolean; why: { summary: string; basis: string } }[];
  }>(request, tok, '/feed');
  expect(feed.items.length).toBeGreaterThan(0);
  await signIn(page, 'priya');
  await expect(page.getByTestId('dash-feed')).toBeVisible();
  const first = feed.items[0];
  await page.getByTestId(`feed-why-btn-${first.id}`).click();
  await expect(page.getByTestId(`why-${first.id}`)).toContainText(first.why.summary.slice(0, 30));
  await shot(page, 'int-priya-dashboard-why-1440');
  // thumbs feed the bandit: one acknowledgement, no error
  const rateable = feed.items.find(i => !i.pinned)!; // pinned rule breaches have no thumbs (design)
  await page.getByTestId(`feed-up-${rateable.id}`).click();
  await expect(page.getByTestId(`feed-up-${rateable.id}`)).toBeDisabled();
});

test('ask: grounded answer with sources, advice request refused with the educational redirect, text never rendered as HTML', async ({
  page,
}) => {
  await signIn(page, 'priya');
  await page.goto('/ask');
  await expect(page.getByTestId('screen-ask')).toBeVisible();

  await page.getByTestId('ask-input').fill('What is the debt to equity ratio of NVDA?');
  await page.getByTestId('ask-send').click();
  await expect(page.getByTestId('msg-ai').last()).toContainText('debt / equity');
  await expect(page.getByTestId('msg-ai').last()).toContainText('0.05x');
  await expect(page.getByTestId('msg-cites').last()).toBeVisible();
  await shot(page, 'int-priya-ask-grounded-1440');

  await page.getByTestId('ask-input').fill('Should I buy NVDA now?');
  await page.getByTestId('ask-send').click();
  await expect(page.getByTestId('msg-refused').last()).toBeVisible();
  await expect(page.getByTestId('refusal-redirect').last()).toBeVisible();
  await shot(page, 'int-priya-ask-refused-1440');

  // markup typed by the user is echoed (and stored) as plain text, never executed
  await page
    .getByTestId('ask-input')
    .fill('<img src=x onerror="window.__pwned=1"> what does my portfolio look like?');
  await page.getByTestId('ask-send').click();
  await expect(page.getByTestId('msg-ai').last()).toContainText('positions');
  expect(await page.evaluate('window.__pwned')).toBeUndefined();
  await expect(page.locator('[data-testid="screen-ask"] img[src="x"]')).toHaveCount(0);

  // history survives a reload
  await page.reload();
  await expect(page.getByTestId('msg-ai').first()).toBeVisible();
});

test('audit: traces list + detail waterfall and the evals scoreboard come from the API', async ({
  page,
  request,
}) => {
  const traces = await apiGet<{ items: { id: string; name: string }[] }>(request, tok, '/audit/traces');
  expect(traces.items.length).toBeGreaterThan(0);
  const evals = await apiGet<{ items: { id: string; status: string }[]; thresholds_met: boolean }>(
    request,
    tok,
    '/evals/latest',
  );
  await signIn(page, 'priya');
  await page.goto('/audit');
  await expect(page.getByTestId('screen-audit')).toBeVisible();
  await expect(page.getByTestId(`trace-${traces.items[0].id}`)).toBeVisible();
  await expect(page.getByTestId('trace-detail')).toBeVisible();
  await expect(page.getByTestId('trace-step').first()).toBeVisible();
  await shot(page, 'int-priya-audit-1440');

  await page.goto('/audit?tab=evals');
  await expect(page.getByTestId('evals')).toBeVisible();
  expect(
    evals.items.some(e => e.status === 'fail'),
    'the seeded run contains a real failing check',
  ).toBe(true);
  const failing = evals.items.find(e => e.status === 'fail')!;
  await expect(page.getByTestId(`eval-${failing.id}`)).toContainText('Fail');
  await expect(page.getByTestId('evals-not-measured')).toContainText('Not measured');
  for (const e of evals.items.slice(0, 3))
    await expect(page.getByTestId(`eval-${e.id}`)).toContainText(e.status === 'pass' ? /pass/i : /fail/i);
  await shot(page, 'int-priya-evals-1440');
});
