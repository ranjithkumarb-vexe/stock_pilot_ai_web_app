import { expect, test, type Page } from '@playwright/test';
import { API, apiGet, resetSimulators, shot, signIn, token, watchErrors } from '../support/live';

/**
 * Priya (conservative, tier 2, income): the journey an established persona takes through the real backend.
 * Serial on purpose: proposals / orders mutate Priya's paper account (scripts/e2e.sh re-seeds before the run).
 */
test.describe.configure({ mode: 'serial' });

type Brief = {
  section_order: string[];
  sections: { key: string; claims: { citation_ids: string[] }[] }[];
  citations_summary: { unverified_numbers: number };
};
type Proposal = {
  id: string;
  symbol: string | null;
  rule: string | null;
  status: string;
  suggested_qty: number;
};

const openApp = async (page: Page, path: string, testId: string) => {
  await page.goto(path);
  await expect(page.getByTestId(testId)).toBeVisible();
};

let tok = '';
test.beforeAll(async ({ request }) => {
  tok = await token(request, 'priya');
  await resetSimulators(request, tok);
});
test.afterAll(async ({ request }) => {
  await resetSimulators(request, tok);
});

test('dashboard: real portfolio health, rule breaches, proposals badge, feed with "why"', async ({
  page,
}) => {
  const errors = watchErrors(page, [/404 GET \/v1\/(alerts|audit|evals)/]);
  await signIn(page, 'priya');
  await expect(page.getByTestId('dash-hero')).toBeVisible();
  await expect(page.getByTestId('dash-headline-text')).toContainText('$99,9');
  await expect(page.getByTestId('dash-tiles')).toContainText('$22,014'); // cash
  // Priya is over her 10% position cap (JNJ) and 25% sector cap (Consumer Staples)
  await expect(page.getByTestId('rule-row-pos')).toContainText('Breached');
  await expect(page.getByTestId('rule-row-sec')).toContainText('Breached');
  await expect(page.getByTestId('rule-row-dd')).toContainText('Within');
  await expect(page.getByTestId('nav-badge-proposals')).toHaveText('3');
  await expect(page.getByTestId('radar-JNJ')).toBeVisible();
  await expect(page.getByTestId('dash-performance')).toBeVisible();
  await expect(page.getByTestId('dash-risk')).toContainText('0.113');
  await expect(page.getByTestId('market-chip')).toContainText('closed');
  await shot(page, 'int-priya-dashboard-1440');

  // the feed (Stream D) carries "Why am I seeing this?" built from personalization_audit
  const feed = await apiGet<{ items: { id: string; kind: string }[] }>(page.request, tok, '/feed');
  if (feed.items.length) {
    const first = feed.items[0];
    await expect(page.getByTestId(`feed-${first.id}`)).toBeVisible();
    await page.getByTestId(`feed-why-btn-${first.id}`).click();
    await expect(page.getByTestId(`why-${first.id}`)).toBeVisible();
  }
  await page.waitForTimeout(500);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('watchlist: live quotes with freshness badges, add and remove persist', async ({ page, request }) => {
  await signIn(page, 'priya');
  await page.getByTestId('nav-watchlist').click();
  await expect(page.getByTestId('wl-row-JNJ')).toBeVisible();
  await expect(page.getByTestId('wl-row-JNJ').getByTestId('freshness')).toHaveAttribute(
    'data-freshness',
    'closed',
  );
  await expect(page.getByTestId('wl-count')).toContainText('10');
  await expect(page.getByTestId('wl-row-TSLA')).toHaveCount(0);

  await page.getByTestId('wl-search').fill('tesla');
  await page.getByTestId('wl-option-TSLA').click(); // choosing a suggestion adds it
  await expect(page.getByTestId('wl-row-TSLA')).toBeVisible();
  expect(
    (await apiGet<{ items: { symbol: string }[] }>(request, tok, '/watchlist')).items.map(i => i.symbol),
  ).toContain('TSLA');
  await shot(page, 'int-priya-watchlist-1440');

  await page.reload();
  await expect(page.getByTestId('wl-row-TSLA')).toBeVisible(); // persisted server-side
  await page.getByTestId('wl-remove-TSLA').click();
  await expect(page.getByTestId('wl-row-TSLA')).toHaveCount(0);
  expect(
    (await apiGet<{ items: { symbol: string }[] }>(request, tok, '/watchlist')).items.map(i => i.symbol),
  ).not.toContain('TSLA');
});

for (const symbol of ['NVDA', 'JNJ']) {
  test(`brief ${symbol}: income-persona section order, citations open real source detail`, async ({
    page,
    request,
  }) => {
    const brief = await apiGet<Brief>(request, tok, `/briefs/${symbol}`);
    // Priya (tier 2, income, beginner): balance sheet / risk first
    expect(brief.section_order.slice(0, 3)).toEqual(['bal', 'risk', 'moat']);
    await signIn(page, 'priya');
    await openApp(page, `/brief/${symbol}`, 'screen-brief');
    await expect(page.getByTestId('brief-name')).toBeVisible();
    await expect(page.getByTestId('verified-badge')).toBeVisible();
    await expect(page.getByTestId('unverified-badge')).toHaveCount(0);
    const keys = await page
      .locator('[data-testid^="section-"]')
      .evaluateAll(els =>
        els
          .map(e => e.getAttribute('data-testid')!.replace('section-', ''))
          .filter(k => /^[a-z]{2,5}$/.test(k)),
      );
    expect(keys.filter(k => brief.section_order.includes(k))).toEqual(brief.section_order);
    await shot(page, `int-priya-brief-${symbol}-1440`);

    // telemetry: expanding a section is recorded server-side (batched every 5 s) and shows up in the learned profile
    const before = Date.now();
    const toggle = page.getByTestId('section-toggle-risk');
    if ((await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click(); // collapse first: only EXPANDING is an event
    await toggle.click();
    await expect
      .poll(
        async () => {
          const p = await apiGet<{ recent_events: { type: string; ts: string }[] }>(request, tok, '/profile');
          return p.recent_events.some(
            e => e.type === 'section_expanded' && Date.parse(e.ts) >= before - 1000,
          );
        },
        { timeout: 20_000, intervals: [1000] },
      )
      .toBe(true);

    // open the first citation: the drawer shows the real accession, hash and excerpt from GET /citations/{id}
    const firstCitation = brief.sections[0].claims[0].citation_ids[0];
    const detail = await apiGet<{ accession_no: string; sha256: string; kind: string }>(
      request,
      tok,
      `/citations/${firstCitation}`,
    );
    await page.getByTestId('cite-1').first().click();
    await expect(page.getByTestId('citation-drawer')).toBeVisible();
    await expect(page.getByTestId('citation-accession')).toContainText(detail.accession_no);
    await expect(page.getByTestId('citation-hash')).toContainText(detail.sha256.slice(0, 8));
    await shot(page, `int-priya-brief-${symbol}-citation-1440`);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('citation-drawer')).toBeHidden();
    expect(brief.citations_summary.unverified_numbers).toBe(0);
  });
}

type Order = {
  id: string;
  symbol: string;
  side: string;
  qty: number;
  status: string;
  source: string;
  proposal_id: string | null;
};

test('proposals: rejecting with a reason stores it and creates NO paper order', async ({ page, request }) => {
  const before = (await apiGet<{ items: Order[] }>(request, tok, '/orders')).items.length;
  const list = await apiGet<{ items: Proposal[] }>(request, tok, '/proposals?status=pending');
  const jnj = list.items.find(p => p.symbol === 'JNJ' && p.rule === 'pos');
  expect(jnj, 'seeded JNJ position-cap proposal').toBeTruthy();

  await signIn(page, 'priya');
  await openApp(page, '/proposals', 'screen-proposals');
  await page.getByTestId(`proposal-item-${jnj!.id}`).click();
  await expect(page.getByTestId('proposal-detail')).toContainText('Position above your 10% cap');
  await expect(page.getByTestId('proposal-checks')).toBeVisible(); // pre-trade checks from POST /orders/preview
  await shot(page, 'int-priya-proposal-detail-1440');
  await page.getByTestId('proposal-reject').click();
  await page.getByTestId('reason-too_risky').click();
  await page.getByTestId('reject-confirm').click();
  await expect(page.getByTestId('proposal-resolved').or(page.getByTestId('proposal-result'))).toBeVisible();

  const after = await apiGet<Proposal & { reject_reason: string; order_id: string | null }>(
    request,
    tok,
    `/proposals/${jnj!.id}`,
  );
  expect(after.status).toBe('rejected');
  expect(after.reject_reason).toBe('too_risky');
  expect(after.order_id).toBeNull();
  expect((await apiGet<{ items: Order[] }>(request, tok, '/orders')).items.length).toBe(before);
  await expect(page.getByTestId('nav-badge-proposals')).toHaveText('2');
});

test('proposals: approving a trade proposal creates a paper order visible in Trading', async ({
  page,
  request,
}) => {
  const list = await apiGet<{ items: Proposal[] }>(request, tok, '/proposals?status=pending');
  const pep = list.items.find(p => p.symbol === 'PEP' && p.rule === 'sec');
  expect(pep, 'seeded PEP sector proposal').toBeTruthy();

  await signIn(page, 'priya');
  await openApp(page, '/proposals', 'screen-proposals');
  await page.getByTestId(`proposal-item-${pep!.id}`).click();
  await expect(page.getByTestId('proposal-order')).toContainText('Sell 11 PEP');
  await page.getByTestId('proposal-approve').focus();
  await page.keyboard.press('Enter'); // keyboard / AT activation approves at once (mouse needs the 900 ms hold)
  await expect(page.getByTestId('proposal-result')).toBeVisible();
  await shot(page, 'int-priya-proposal-approved-1440');

  const orders = (await apiGet<{ items: Order[] }>(request, tok, '/orders')).items;
  const created = orders.find(o => o.proposal_id === pep!.id);
  expect(created, 'paper order created from the proposal').toBeTruthy();
  expect(created).toMatchObject({ symbol: 'PEP', side: 'sell', qty: 11, source: 'proposal' });
  expect(['queued', 'filled']).toContain(created!.status);

  await page.getByTestId('nav-trading').click();
  await expect(page.getByTestId(`order-row-${created!.id}`)).toBeVisible();
});

test('trading: preview checks, a double click submits exactly ONE order (idempotent), cancel works', async ({
  page,
  request,
}) => {
  await signIn(page, 'priya');
  await openApp(page, '/trading?symbol=AAPL&side=buy&qty=1', 'ticket');
  await expect(page.getByTestId('ticket-symbol')).toHaveValue('AAPL');
  await expect(page.getByTestId('check-funds')).toContainText('Pass');
  await expect(page.getByTestId('check-session')).toContainText('Note'); // market closed -> queued
  await expect(page.getByTestId('ticket-px')).not.toHaveText('—');
  await shot(page, 'int-priya-trading-1440');

  const posts: string[] = [];
  page.on('request', r => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/v1/orders')
      posts.push(r.headers()['idempotency-key'] ?? '');
  });
  await page.getByTestId('ticket-submit').dblclick();
  await expect(page.getByTestId('stamp')).toBeVisible();
  await page.waitForTimeout(1200);
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatch(/^[0-9a-f-]{36}$/);

  const orders = (await apiGet<{ items: Order[] }>(request, tok, '/orders')).items.filter(
    o => o.symbol === 'AAPL' && o.source === 'manual',
  );
  expect(orders).toHaveLength(1);
  expect(orders[0].status).toBe('queued');

  // replaying the same Idempotency-Key against the API returns the SAME order (200 + Idempotent-Replay)
  const replay = await request.post(`${API}/v1/orders`, {
    headers: { Authorization: `Bearer ${tok}`, 'Idempotency-Key': posts[0] },
    data: { symbol: 'AAPL', side: 'buy', type: 'market', qty: 1 },
  });
  expect(replay.status()).toBe(200);
  expect(replay.headers()['idempotent-replay']).toBe('true');
  expect((await replay.json()).order.id).toBe(orders[0].id);

  await page.getByTestId(`cancel-${orders[0].id}`).click();
  await expect(page.getByTestId(`order-status-${orders[0].id}`)).toContainText(/cancel/i);
});

test('live market: opening the market via the dev control streams SSE ticks into the chart and tape', async ({
  page,
  request,
}) => {
  await signIn(page, 'priya');
  await openApp(page, '/live', 'screen-live');
  await expect(page.getByTestId('live-chart-box')).toBeVisible();
  await expect(page.getByTestId('live-frozen')).toBeVisible(); // market closed: frozen at the last close
  await page.getByTestId('sim-market').click();
  await expect(page.getByTestId('live-frozen')).toBeHidden({ timeout: 15_000 });
  await expect(page.getByTestId('tape-row').first()).toBeVisible({ timeout: 20_000 });
  const n = await page.getByTestId('tape-row').count();
  await page.waitForTimeout(3000);
  expect(await page.getByTestId('tape-row').count()).toBeGreaterThan(n - 1);
  await shot(page, 'int-priya-live-open-1440');
  await resetSimulators(request, tok);
});

test('profile: stated tier, learned interests, export is valid JSON, reset keeps the account', async ({
  page,
  request,
}) => {
  await signIn(page, 'priya');
  await openApp(page, '/profile', 'screen-profile');
  await expect(page.getByTestId('profile-told')).toContainText('Conservative');
  await shot(page, 'int-priya-profile-1440');
  await page
    .getByRole('button', { name: 'Data and privacy' })
    .or(page.getByText('Data and privacy', { exact: true }))
    .first()
    .click();
  await page.getByTestId('open-export').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-export').click(),
  ]);
  const path = await download.path();
  const { readFileSync } = await import('node:fs');
  const json = JSON.parse(readFileSync(path!, 'utf8'));
  expect(json.format).toBe('stockpilot-export/1');
  expect(Object.keys(json.tables).length).toBeGreaterThan(10);
  expect(json.user.email ?? json.user.id).toBeTruthy();
  await page.keyboard.press('Escape');

  await page.getByTestId('open-reset').click();
  await page.getByTestId('confirm-reset').click();
  await expect(page.getByTestId('toast')).toBeVisible();
  const me = await apiGet<{ onboarded: boolean }>(request, tok, '/me');
  expect(me.onboarded).toBe(true);
});
