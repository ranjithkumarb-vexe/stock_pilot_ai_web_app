import { expect, test } from '@playwright/test';
import { apiGet, apiPost, resetSimulators, shot, signIn, token, watchErrors } from '../support/live';

/** Alex (growth, tier 4, advanced, 9 trades this week, NVDA ~40% of the book). Serial: proposals mutate his account. */
test.describe.configure({ mode: 'serial' });

type Brief = { section_order: string[]; style_card: { depth: string; metric: string | null } };
type Proposal = {
  id: string;
  kind: string;
  symbol: string | null;
  rule: string | null;
  status: string;
  suggested_qty: number;
};
type Order = {
  id: string;
  symbol: string;
  qty: number;
  side: string;
  status: string;
  source: string;
  proposal_id: string | null;
};

let tok = '';
let priyaTok = '';
test.beforeAll(async ({ request }) => {
  tok = await token(request, 'alex');
  priyaTok = await token(request, 'priya');
  await resetSimulators(request, tok);
});
test.afterAll(async ({ request }) => {
  await resetSimulators(request, tok);
});

test('dashboard: aggressive profile shows its own breaches and the overtrading review', async ({ page }) => {
  const errors = watchErrors(page, [/404 GET \/v1\/(alerts|audit|evals)/]);
  await signIn(page, 'alex');
  await expect(page.getByTestId('dash-hero')).toContainText('Alex');
  await expect(page.getByTestId('rule-row-pos')).toContainText('Breached'); // NVDA 39.9% vs 25%
  await expect(page.getByTestId('rule-row-trades')).toContainText('9 / 10');
  await expect(page.getByTestId('nav-badge-proposals')).toHaveText('3');
  await expect(page.getByTestId('dash-risk')).toContainText('1.73'); // beta
  await shot(page, 'int-alex-dashboard-1440');
  await page.waitForTimeout(500);
  expect(errors, errors.join('\n')).toEqual([]);
});

for (const symbol of ['NVDA', 'JNJ']) {
  test(`brief ${symbol}: growth-persona section order differs from Priya's, deep by default`, async ({
    page,
    request,
  }) => {
    const alexBrief = await apiGet<Brief>(request, tok, `/briefs/${symbol}`);
    const priyaBrief = await apiGet<Brief>(request, priyaTok, `/briefs/${symbol}`);
    expect(alexBrief.section_order.slice(0, 3)).toEqual(['trend', 'cat', 'val']);
    expect(alexBrief.section_order).not.toEqual(priyaBrief.section_order);
    expect(alexBrief.style_card.depth).toBe('deep');

    await signIn(page, 'alex');
    await page.goto(`/brief/${symbol}`);
    await expect(page.getByTestId('screen-brief')).toBeVisible();
    await expect(page.getByTestId('brief-depth').getByRole('radio', { name: 'Deep' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByTestId('brief-ledger')).toBeVisible(); // source ledger only in Deep
    const keys = await page
      .locator('[data-testid^="section-"]')
      .evaluateAll(els =>
        els
          .map(e => e.getAttribute('data-testid')!.replace('section-', ''))
          .filter(k => /^[a-z]{2,5}$/.test(k)),
      );
    expect(keys.filter(k => alexBrief.section_order.includes(k))).toEqual(alexBrief.section_order);
    await expect(page.getByTestId('brief-position')).toBeVisible();
    await shot(page, `int-alex-brief-${symbol}-1440`);
  });
}

test('proposals: modify the size, the paper order carries the MODIFIED quantity', async ({
  page,
  request,
}) => {
  const list = await apiGet<{ items: Proposal[] }>(request, tok, '/proposals?status=pending');
  const nvda = list.items.find(p => p.symbol === 'NVDA' && p.rule === 'pos')!;
  expect(nvda.suggested_qty).toBe(82);

  await signIn(page, 'alex');
  await page.goto(`/proposals/${nvda.id}`);
  await expect(page.getByTestId('proposal-detail')).toContainText('Position above your 25% cap');
  await page.getByTestId('proposal-modify').click();
  for (let i = 0; i < 8; i++) await page.getByTestId('modify-inc').click(); // stepper: 82 -> 90
  await expect(page.getByTestId('modify-qty')).toHaveText('90');
  await shot(page, 'int-alex-proposal-modify-1440');
  await page.getByTestId('modify-confirm').click();
  await expect(page.getByTestId('proposal-result')).toBeVisible();

  const done = await apiGet<Proposal & { modified_qty: number; order_id: string }>(
    request,
    tok,
    `/proposals/${nvda.id}`,
  );
  expect(done.status).toBe('modified');
  expect(done.modified_qty).toBe(90);
  const order = (await apiGet<{ items: Order[] }>(request, tok, '/orders')).items.find(
    o => o.proposal_id === nvda.id,
  );
  expect(order).toMatchObject({ symbol: 'NVDA', side: 'sell', qty: 90, source: 'proposal' });
});

test('proposals: a review prompt (overtrading) is acknowledged without placing any order', async ({
  page,
  request,
}) => {
  const before = (await apiGet<{ items: Order[] }>(request, tok, '/orders')).items.length;
  const list = await apiGet<{ items: Proposal[] }>(request, tok, '/proposals?status=pending');
  const review = list.items.find(p => p.kind === 'review')!;
  expect(review.rule).toBe('overtrading');

  await signIn(page, 'alex');
  await page.goto(`/proposals/${review.id}`);
  await expect(page.getByTestId('proposal-detail')).toContainText('trading pace');
  await expect(page.getByTestId('proposal-modify')).toHaveCount(0); // review prompts cannot be modified
  await page.getByTestId('proposal-approve').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('proposal-result')).toBeVisible();
  expect((await apiGet<{ items: Order[] }>(request, tok, '/orders')).items.length).toBe(before);
});

test('feed state STALE blocks market orders (limit orders stay possible); the shell shows the stale banner', async ({
  page,
  request,
}) => {
  await apiPost(request, tok, '/dev/market', { open: true });
  await apiPost(request, tok, '/dev/feed', { state: 'stale' });
  await signIn(page, 'alex');
  await page.goto('/trading?symbol=AMD&side=buy&qty=1');
  await expect(page.getByTestId('ticket')).toBeVisible();
  await expect(page.getByTestId('banner-stale')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('feed-chip')).toContainText('Stale');
  await expect(page.getByTestId('ticket-submit')).toBeDisabled();
  await expect(page.getByText(/stale/i).first()).toBeVisible();
  await shot(page, 'int-alex-stale-blocks-market-order-1440');

  // the watchlist shows the same truth: quotes are badged Stale while the feed is stale during market hours
  await page.goto('/watchlist');
  await expect(page.getByTestId('wl-row-NVDA').getByTestId('freshness')).toHaveAttribute(
    'data-freshness',
    'stale',
    {
      timeout: 20_000,
    },
  );
  await page.goto('/trading?symbol=AMD&side=buy&qty=1');
  await expect(page.getByTestId('ticket')).toBeVisible();

  // the same order through the API is refused with the contract error
  const r = await request.post('http://localhost:8010/v1/orders', {
    headers: { Authorization: `Bearer ${tok}`, 'Idempotency-Key': crypto.randomUUID() },
    data: { symbol: 'AMD', side: 'buy', type: 'market', qty: 1 },
  });
  expect(r.status()).toBe(409);
  expect((await r.json()).code).toBe('stale_quote');

  // a limit order does not depend on a fresh quote
  await page.getByTestId('ticket-type').getByRole('radio', { name: 'Limit' }).click();
  await expect(page.getByTestId('ticket-limit')).toBeVisible();
  await resetSimulators(request, tok);
});
