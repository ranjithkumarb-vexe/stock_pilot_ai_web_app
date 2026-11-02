import { expect, test, type Page } from '@playwright/test';
import { API, shot, signIn } from '../support/live';

/** Profile controls on a throw-away account (so the seeded personas stay untouched): edit, rules, export, reset, delete. */
const sessionToken = async (page: Page) =>
  (
    JSON.parse((await page.evaluate(() => sessionStorage.getItem('sp-session'))) as string) as {
      token: string;
    }
  ).token;

/** Finish onboarding through the API (the UI path is covered by onboarding.spec.ts) and return the bearer token. */
async function onboardedNewUser(page: Page): Promise<string> {
  await signIn(page, 'new');
  const token = await sessionToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const q = await (await page.request.get(`${API}/v1/onboarding/questions`)).json();
  const done = await page.request.post(`${API}/v1/onboarding`, {
    headers,
    data: {
      answers: q.questions.map((x: { options: { score: number }[] }) => x.options[1]?.score),
      horizon: '3-10 years',
      goals: ['Growth'],
      experience: 'Intermediate',
      likes: ['Technology'],
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
  return token;
}

test('edit profile fields and rules (loosening warns), export, reset, then delete the account with typed confirmation', async ({
  page,
}) => {
  const token = await onboardedNewUser(page);
  const headers = { Authorization: `Bearer ${token}` };
  await page.goto('/profile');
  await expect(page.getByTestId('screen-profile')).toBeVisible();
  await expect(page.getByTestId('profile-told')).toContainText('Balanced');

  // style choice: Tone -> Direct is stored as an EXPLICIT choice (CR-13) and survives a reload
  await page.getByRole('radio', { name: 'Direct' }).click();
  await expect
    .poll(async () => {
      const p = await (await page.request.get(`${API}/v1/profile`, { headers })).json();
      return p.style_card.tone;
    })
    .toBe('Direct');

  // rules: tier 3 defaults pos 15 -> 20 loosens a rule: saved, but the app says so (reflective prompt)
  await page.getByTestId('rule-pos').fill('20');
  await page.getByTestId('rules-save').click();
  await expect(page.getByTestId('rules-warnings')).toBeVisible();
  await shot(page, 'int-new-profile-rules-warning-1440');
  const saved = await (await page.request.get(`${API}/v1/profile`, { headers })).json();
  expect(saved.rules.pos).toBe(20);

  // export / reset
  await page.goto('/profile?tab=privacy');
  await page.getByTestId('open-export').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-export').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  await page.keyboard.press('Escape');
  await page.getByTestId('open-reset').click();
  await page.getByTestId('confirm-reset').click();
  await expect(page.getByTestId('toast')).toBeVisible();
  const afterReset = await (await page.request.get(`${API}/v1/profile`, { headers })).json();
  expect(afterReset.rules.pos).toBe(20); // reset forgets what was LEARNED, never stated rules

  // delete: the confirm button needs the exact word
  await page.getByTestId('open-delete').click();
  await expect(page.getByTestId('confirm-delete')).toBeDisabled();
  await page.getByTestId('delete-confirm').fill('DELET');
  await expect(page.getByTestId('confirm-delete')).toBeDisabled();
  await page.getByTestId('delete-confirm').fill('DELETE');
  await shot(page, 'int-new-profile-delete-confirm-1440');
  await page.getByTestId('confirm-delete').click();
  await expect(page).toHaveURL(/\/signin$/);
  expect(await page.evaluate(() => sessionStorage.getItem('sp-session'))).toBeNull();

  // SEC-13: the deleted account's access token is dead (tombstone); it can no longer re-create a blank account
  const stale = await page.request.get(`${API}/v1/me`, { headers });
  expect(stale.status()).toBe(401);
  expect((await page.request.get(`${API}/v1/watchlist`, { headers })).status()).toBe(401);
});
