import { expect, test } from '@playwright/test';
import { API, shot, signIn, watchErrors } from '../support/live';

/** FE-04 acceptance: a brand-new user completes onboarding in under 3 minutes against the real API. */
test('new user: sign in, onboarding to completion in < 3 min, lands on a working dashboard', async ({
  page,
}) => {
  const errors = watchErrors(page, [/404 GET \/v1\/(alerts|audit|evals)/]);
  const t0 = Date.now();
  await signIn(page, 'new'); // a fresh un-onboarded user is created by dev-login and the guard sends it to /onboarding
  await expect(page.getByTestId('screen-onboarding')).toBeVisible();

  // step 1: the verbatim disclaimer must be acknowledged before continuing
  await expect(page.getByTestId('onboarding-disclaimer')).toContainText(
    'educational research and decision-support tool',
  );
  await page.getByTestId('onboarding-next').click(); // refused without the acknowledgement
  await expect(page.getByTestId('onboarding-error')).toBeVisible();
  await expect(page.getByTestId('screen-onboarding')).toContainText('Step 1 of 5');
  await page.getByTestId('onboarding-ack').check();
  await shot(page, 'int-onboarding-1-welcome-1440');
  await page.getByTestId('onboarding-next').click();

  // step 2: six scenarios (option 2 of each = a middle-of-the-road investor)
  for (let q = 1; q <= 6; q++) {
    await page.getByTestId(`question-${q}`).getByRole('radio').nth(1).click();
  }
  await shot(page, 'int-onboarding-2-risk-1440');
  await page.getByTestId('onboarding-next').click();

  // step 3: horizon / goals / experience / likes
  await page.getByTestId('onboarding-horizon').getByRole('radio', { name: '3-10 years' }).click();
  // the design pre-selects Growth, Intermediate and a 3-10 year horizon
  await expect(page.getByRole('button', { name: 'Growth', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByTestId('onboarding-experience').getByRole('radio', { name: 'Intermediate' }).click();
  await page.getByRole('button', { name: 'Technology', exact: true }).first().click();
  await page.getByTestId('onboarding-cash').getByRole('radio', { name: '$100,000' }).click();
  await shot(page, 'int-onboarding-3-goals-1440');
  await page.getByTestId('onboarding-next').click();

  // step 4: watchlist (the design pre-selects a few starters; need at least 3)
  await expect(page.getByTestId('onboarding-wl-chips')).toBeVisible();
  await shot(page, 'int-onboarding-4-watchlist-1440');
  await page.getByTestId('onboarding-next').click();

  // step 5: result comes from the real API: tier, explanation, five rules
  await expect(page.getByTestId('onboarding-result')).toBeVisible();
  await expect(page.getByTestId('onboarding-tier')).toContainText(/Balanced|Conservative|Growth/);
  await expect(page.getByTestId('onboarding-explanation')).toContainText('answers');
  for (const k of ['pos', 'sec', 'dd', 'trades', 'cash'])
    await expect(page.getByTestId(`rule-${k}`)).toBeVisible();
  await shot(page, 'int-onboarding-5-result-1440');
  await page.getByTestId('onboarding-finish').click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId('page-title')).toHaveText('Dashboard');
  const seconds = (Date.now() - t0) / 1000;
  test.info().annotations.push({ type: 'onboarding-seconds', description: seconds.toFixed(1) });
  expect(seconds).toBeLessThan(180);

  // a brand-new account: cash only, no positions, no crash
  await expect(page.getByTestId('dash-hero')).toBeVisible();
  await expect(page.getByTestId('dash-hero')).toContainText('$100,000');
  await page.getByTestId('nav-watchlist').click();
  await expect(page.getByTestId('screen-watchlist')).toBeVisible();
  await expect(page.getByTestId('wl-table')).toBeVisible();
  await page.waitForTimeout(500);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('onboarding: when the account was already set up elsewhere the UI shows the 409 and offers the dashboard', async ({
  page,
}) => {
  await signIn(page, 'new');
  await page.getByTestId('onboarding-ack').check();
  await page.getByTestId('onboarding-next').click();
  for (let q = 1; q <= 6; q++) await page.getByTestId(`question-${q}`).getByRole('radio').nth(1).click();
  await page.getByTestId('onboarding-next').click();
  await page.getByTestId('onboarding-horizon').getByRole('radio', { name: '1-3 years' }).click();
  await page.getByRole('button', { name: 'Income', exact: true }).first().click();
  await page.getByTestId('onboarding-experience').getByRole('radio', { name: 'Beginner' }).click();
  await page.getByTestId('onboarding-next').click();
  await expect(page.getByTestId('onboarding-wl-chips')).toBeVisible();

  // meanwhile "another tab" finishes the onboarding of this very user through the API
  const sess = JSON.parse((await page.evaluate(() => sessionStorage.getItem('sp-session'))) as string) as {
    token: string;
  };
  const headers = { Authorization: `Bearer ${sess.token}` };
  const questions = await (await page.request.get(`${API}/v1/onboarding/questions`)).json();
  const done = await page.request.post(`${API}/v1/onboarding`, {
    headers,
    data: {
      answers: questions.questions.map((q: { options: { score: number }[] }) => q.options[1]?.score),
      horizon: '1-3 years',
      goals: ['Income'],
      experience: 'Beginner',
      likes: [],
      excludes: [],
      esg_exclusions: [],
      watchlist: ['NVDA', 'JNJ', 'KO'],
      region: 'US',
      currency: 'USD',
      starting_cash: 100000,
      disclaimer_ack: true,
    },
  });
  expect(done.status()).toBe(200);

  await page.getByTestId('onboarding-next').click(); // the UI's own POST now answers 409 conflict
  await expect(page.getByTestId('onboarding-already')).toBeVisible();
  await shot(page, 'int-onboarding-409-1440');
  await page.getByTestId('onboarding-already').click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('onboarding: server-side validation (422) is reported with the field message and the draft is kept', async ({
  page,
}) => {
  await signIn(page, 'new');
  // make the first POST fail with a 422 the way the API reports a bad answer, then let the retry through
  let failed = false;
  await page.route('**/v1/onboarding', async route => {
    if (route.request().method() === 'POST' && !failed) {
      failed = true;
      return route.fulfill({
        status: 422,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', 'x-trace-id': 'e2e-422' },
        body: JSON.stringify({
          code: 'validation_error',
          message: 'Answer 3 is not one of the offered options',
          trace_id: 'e2e-422',
          details: { question: 3 },
        }),
      });
    }
    return route.continue();
  });
  await page.getByTestId('onboarding-ack').check();
  await page.getByTestId('onboarding-next').click();
  for (let q = 1; q <= 6; q++) await page.getByTestId(`question-${q}`).getByRole('radio').nth(1).click();
  await page.getByTestId('onboarding-next').click();
  await page.getByTestId('onboarding-horizon').getByRole('radio', { name: '3-10 years' }).click();
  // the design pre-selects Growth, Intermediate and a 3-10 year horizon
  await expect(page.getByRole('button', { name: 'Growth', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByTestId('onboarding-experience').getByRole('radio', { name: 'Advanced' }).click();
  await page.getByTestId('onboarding-next').click();
  await page.getByTestId('onboarding-next').click();
  await expect(page.getByTestId('onboarding-error-region')).toContainText(
    'Answer 3 is not one of the offered options',
  );
  await expect(page.getByTestId('onboarding-error-region')).toContainText('e2e-422');
  await page.getByTestId('onboarding-next').click(); // retry with the same draft succeeds
  await expect(page.getByTestId('onboarding-result')).toBeVisible();
});
