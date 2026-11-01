import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { __resetSession } from '@/auth/session';
import { installFetch, renderApp, type MockRoute } from '@/test/renderApp';

const HOUR = 3600_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

const proposal = (over: Record<string, unknown> = {}) => ({
  id: '11111111-aaaa-bbbb-cccc-000000000001',
  kind: 'trade',
  symbol: 'JNJ',
  side: 'sell',
  rule: 'pos',
  title: 'JNJ is above your 10% position limit',
  body: 'JNJ is 12.5% of your portfolio. Reducing it by 8 shares brings it back inside your rule.',
  rationale: ['Position cap is 10%', 'You set this rule during onboarding'],
  rules_checked: [{ rule: 'Position cap', passed: true }],
  suggested_qty: 8,
  current_weight_pct: 12.5,
  after_weight_pct: 9.6,
  cap_pct: 10,
  sources: ['Your rules', 'Paper ledger'],
  status: 'pending',
  expires_at: iso(22 * HOUR),
  created_at: iso(-2 * HOUR),
  disclaimer: 'Proposal disclaimer from the API.',
  ...over,
});

const P1 = proposal();
const P2 = proposal({
  id: '22222222-aaaa-bbbb-cccc-000000000002',
  kind: 'review',
  symbol: null,
  side: null,
  rule: 'trades',
  title: 'You traded 3 times this week',
  body: 'A review prompt about trade frequency.',
  suggested_qty: 0,
  rationale: [],
  sources: [],
});
const H1 = proposal({
  id: '33333333-aaaa-bbbb-cccc-000000000003',
  status: 'approved',
  title: 'KO above sector limit',
  symbol: 'KO',
  suggested_qty: 5,
});
const EXP = proposal({
  id: '44444444-aaaa-bbbb-cccc-000000000004',
  title: 'An old proposal',
  expires_at: iso(-HOUR),
  created_at: iso(-26 * HOUR),
});

const previewOk = {
  order: null,
  fill: { price: 152.32, notional: 1218.56 },
  checks: [
    { key: 'cap', ok: true, severity: 'pass', label: 'Position cap', detail: 'Stays under 10%' },
    { key: 'cash', ok: true, severity: 'note', label: 'Cash buffer', detail: 'Cash rises to 23%' },
  ],
  blocked: false,
};

const err = (status: number, code: string, details?: unknown) =>
  new Response(JSON.stringify({ code, message: 'server says no', trace_id: 'tr-7', details }), { status });

type Opts = { items?: unknown[]; preview?: unknown; decision?: MockRoute; extra?: MockRoute };
const api =
  (o: Opts = {}): MockRoute =>
  (path, init) => {
    const x = o.extra?.(path, init);
    if (x !== undefined) return x;
    if (path === '/v1/proposals' && init.method !== 'POST')
      return { items: o.items ?? [P1, P2, H1, EXP], next_cursor: null };
    if (path.endsWith('/decision')) return o.decision?.(path, init);
    if (path === '/v1/orders/preview') return o.preview ?? previewOk;
    if (path === '/v1/portfolio')
      return {
        portfolio_id: 'p',
        cash: 1,
        invested: 1,
        equity: 1,
        day_change: 0,
        day_change_pct: 0,
        positions: [
          {
            symbol: 'JNJ',
            name: 'J',
            sector: 'H',
            qty: 62,
            avg_cost: 1,
            price: 1,
            change_pct: 0,
            value: 1,
            weight_pct: 1,
            pnl: 0,
            pnl_pct: 0,
          },
        ],
        sectors: [],
        hhi: 0,
        effective_n: 0,
      };
    return undefined;
  };

const open = async (o: Opts = {}, path = '/proposals') => {
  const f = installFetch(api(o));
  const r = renderApp(path);
  await screen.findByTestId('proposal-list');
  return { ...f, ...r };
};

const bodyOf = (fn: ReturnType<typeof installFetch>['fn'], suffix: string) => {
  const c = fn.mock.calls.find(
    ([u, i]) => String(u).endsWith(suffix) && (i as RequestInit)?.method === 'POST',
  );
  return c ? JSON.parse(String((c[1] as RequestInit).body)) : null;
};

afterEach(() => {
  vi.restoreAllMocks();
  __resetSession();
  vi.unstubAllGlobals();
});

describe('proposals (FE-07)', () => {
  it('lists Pending and History with counts and opens the first pending proposal', async () => {
    await open();
    expect(screen.getByRole('radio', { name: 'Pending (2)' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'History (2)' })).toBeInTheDocument();
    const list = screen.getByTestId('proposal-list');
    expect(within(list).getByText('JNJ is above your 10% position limit')).toBeInTheDocument();
    expect(within(list).getByText('Sell 8 JNJ')).toBeInTheDocument();
    expect(within(list).getByText('Review prompt')).toBeInTheDocument();
    expect(await screen.findByTestId('proposal-detail')).toHaveAttribute('data-proposal-id', P1.id);
    expect(screen.getByTestId('proposal-expiry')).toHaveTextContent('Expires in 22 h');
  });

  it('shows rationale, weight before/after against the cap, and the pre-trade checks from the API', async () => {
    const { calls, fn } = await open();
    expect(screen.getByTestId('proposal-rationale')).toHaveTextContent('You set this rule during onboarding');
    expect(screen.getByTestId('proposal-order')).toHaveTextContent('Sell 8 JNJ');
    const weights = screen.getByTestId('proposal-weights');
    expect(weights).toHaveTextContent('against your 10% rule');
    expect(within(weights).getByRole('meter', { name: 'Now' })).toHaveAttribute('aria-valuenow', '12.5');
    expect(within(weights).getByRole('meter', { name: 'After' })).toHaveAttribute('aria-valuenow', '9.6');
    expect(weights).toHaveTextContent('12.5%');
    expect(weights).toHaveTextContent('9.6%');
    expect(await screen.findByTestId('check-cap')).toHaveTextContent('Pass');
    expect(screen.getByTestId('check-cash')).toHaveTextContent('Note');
    expect(screen.getByTestId('check-cash')).toHaveTextContent('Cash rises to 23%');
    expect(screen.getByTestId('proposal-detail')).toHaveTextContent('$152.32');
    expect(bodyOf(fn, '/v1/orders/preview')).toMatchObject({
      symbol: 'JNJ',
      side: 'sell',
      qty: 8,
      proposal_id: P1.id,
    });
    expect(calls).toContain('POST /v1/orders/preview');
    expect(screen.getByTestId('proposal-disclaimer')).toHaveTextContent('Proposal disclaimer from the API.');
    expect(screen.getByTestId('proposal-sources')).toHaveTextContent('Paper ledger');
  });

  it('blocked checks disable approval and explain why, but allow modify and reject', async () => {
    await open({
      preview: {
        ...previewOk,
        blocked: true,
        checks: [
          {
            key: 'trades',
            ok: false,
            severity: 'blocked',
            label: 'Trades per week',
            detail: 'Limit of 3 reached',
          },
        ],
      },
    });
    expect(await screen.findByTestId('check-trades')).toHaveTextContent('Blocked');
    expect(screen.getByTestId('proposal-approve')).toBeDisabled();
    expect(screen.getByTestId('proposal-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('proposal-modify')).toBeEnabled();
    expect(screen.getByTestId('proposal-reject')).toBeEnabled();
  });

  it('falls back to the proposal rules_checked when the preview is unavailable', async () => {
    await open({ preview: err(503, 'upstream_unavailable') });
    expect(await screen.findByTestId('proposal-preview-error')).toBeInTheDocument();
    expect(screen.getByTestId('check-r0')).toHaveTextContent('Position cap');
  });

  it('approve by keyboard: posts the decision, shows the paper order result and records telemetry', async () => {
    const user = userEvent.setup();
    const { fn, calls } = await open({
      decision: () => ({
        proposal: { ...P1, status: 'approved' },
        order: {
          id: 'o1',
          symbol: 'JNJ',
          side: 'sell',
          type: 'market',
          qty: 8,
          status: 'filled',
          created_at: iso(0),
        },
      }),
    });
    const btn = await screen.findByTestId('proposal-approve');
    await waitFor(() => expect(btn).toBeEnabled());
    expect(btn).toHaveAccessibleName(/Approve \(paper trade\)\. Press and hold, or press Enter\./);
    btn.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(calls).toContain(`POST /v1/proposals/${P1.id}/decision`));
    expect(bodyOf(fn, '/decision')).toEqual({ decision: 'approve' });
    expect(await screen.findByTestId('proposal-result')).toHaveTextContent(
      'Approved. Sold 8 JNJ. Executed in the paper simulator.',
    );
    expect(await screen.findByTestId('stamp')).toHaveTextContent('FILLED');
    // stays on the decided proposal and moved to History
    expect(screen.getByRole('radio', { name: /History/ })).toBeChecked();
    expect(screen.getByTestId('proposal-detail')).toHaveAttribute('data-proposal-id', P1.id);
    expect(screen.queryByTestId('proposal-actions')).toBeNull();
  });

  it('approve by press-and-hold: completes after the hold, is cancelled when released early', async () => {
    const { calls } = await open({
      decision: () => ({
        proposal: { ...P1, status: 'approved' },
        order: {
          id: 'o1',
          symbol: 'JNJ',
          side: 'sell',
          type: 'market',
          qty: 8,
          status: 'queued',
          created_at: iso(0),
        },
      }),
    });
    const btn = await screen.findByTestId('proposal-approve');
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.pointerDown(btn);
    expect(btn).toHaveAttribute('data-holding', 'true');
    expect(btn).toHaveTextContent('Keep holding');
    fireEvent.pointerUp(btn);
    await new Promise(r => setTimeout(r, 1000));
    expect(calls.filter(c => c.endsWith('/decision'))).toHaveLength(0);
    fireEvent.pointerDown(btn);
    await waitFor(() => expect(calls.filter(c => c.endsWith('/decision'))).toHaveLength(1), {
      timeout: 2500,
    });
    expect(await screen.findByTestId('proposal-result')).toHaveTextContent('Queued for the next market open');
    expect(await screen.findByTestId('stamp')).toHaveTextContent('QUEUED');
  });

  it('modify size: stepper bounds by the held shares and posts decision=modify with qty', async () => {
    const user = userEvent.setup();
    const { fn } = await open({
      decision: () => ({
        proposal: { ...P1, status: 'modified' },
        order: {
          id: 'o2',
          symbol: 'JNJ',
          side: 'sell',
          type: 'market',
          qty: 10,
          status: 'filled',
          created_at: iso(0),
        },
      }),
    });
    await user.click(await screen.findByTestId('proposal-modify'));
    expect(screen.getByTestId('modify-qty')).toHaveTextContent('8');
    expect(screen.getByTestId('proposal-modify-panel')).toHaveTextContent('Suggested 8. Held 62.');
    await user.click(screen.getByTestId('modify-inc'));
    await user.click(screen.getByTestId('modify-inc'));
    expect(screen.getByTestId('modify-qty')).toHaveTextContent('10');
    await user.click(screen.getByTestId('modify-confirm'));
    expect(await screen.findByTestId('proposal-result')).toHaveTextContent(
      'Modified and approved. Sold 10 JNJ',
    );
    expect(bodyOf(fn, '/decision')).toEqual({ decision: 'modify', qty: 10 });
  });

  it('reject needs a reason chip, then posts it and shows the history state', async () => {
    const user = userEvent.setup();
    const { fn } = await open({
      decision: () => ({ proposal: { ...P1, status: 'rejected' }, order: null }),
    });
    await user.click(await screen.findByTestId('proposal-reject'));
    const confirm = screen.getByTestId('reject-confirm');
    expect(confirm).toBeDisabled();
    expect(screen.getAllByRole('button', { pressed: false }).map(b => b.textContent)).toEqual(
      expect.arrayContaining(['Too risky', 'Disagree with thesis', 'Timing', 'Already know']),
    );
    await user.click(screen.getByTestId('reason-too_risky'));
    expect(screen.getByTestId('reason-too_risky')).toHaveAttribute('aria-pressed', 'true');
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(await screen.findByTestId('proposal-result')).toHaveTextContent('Rejected.');
    expect(bodyOf(fn, '/decision')).toEqual({ decision: 'reject', reason: 'too_risky' });
  });

  it('cancel returns to the actions without calling the API', async () => {
    const user = userEvent.setup();
    const { calls } = await open();
    await user.click(await screen.findByTestId('proposal-reject'));
    await user.click(
      within(screen.getByTestId('proposal-reject-panel')).getByRole('button', { name: 'Cancel' }),
    );
    expect(screen.getByTestId('proposal-actions')).toBeInTheDocument();
    expect(calls.filter(c => c.endsWith('/decision'))).toHaveLength(0);
  });

  it('review proposals can be marked as reviewed (no size or order)', async () => {
    const user = userEvent.setup();
    const { fn } = await open({
      decision: () => ({ proposal: { ...P2, status: 'approved' }, order: null }),
    });
    await user.click(screen.getByTestId(`proposal-item-${P2.id}`));
    expect(screen.getByRole('heading', { name: 'You traded 3 times this week' })).toBeInTheDocument();
    expect(screen.queryByTestId('proposal-modify')).toBeNull();
    expect(screen.getByTestId('proposal-approve')).toHaveTextContent('Hold to mark reviewed');
    screen.getByTestId('proposal-approve').focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByTestId('proposal-result')).toHaveTextContent('Marked as reviewed.');
    expect(bodyOf(fn, '/decision')).toEqual({ decision: 'approve' });
  });

  it('surfaces a rule_violation (422) with the violations list and keeps the proposal actionable', async () => {
    const user = userEvent.setup();
    await open({
      decision: () =>
        err(422, 'rule_violation', { violations: [{ rule: 'cash', message: 'Cash would fall below 10%.' }] }),
    });
    const btn = await screen.findByTestId('proposal-approve');
    await waitFor(() => expect(btn).toBeEnabled());
    btn.focus();
    await user.keyboard('{Enter}');
    const e = await screen.findByTestId('proposal-error');
    expect(e).toHaveTextContent('Blocked by your rules');
    expect(e).toHaveTextContent('Cash would fall below 10%.');
    expect(e).toHaveTextContent('Reference: tr-7');
    expect(screen.getByTestId('proposal-actions')).toBeInTheDocument();
  });

  it('409 conflict (already decided / expired) shows the conflict message', async () => {
    const user = userEvent.setup();
    await open({ decision: () => err(409, 'conflict') });
    await user.click(await screen.findByTestId('proposal-reject'));
    await user.click(screen.getByTestId('reason-timing'));
    await user.click(screen.getByTestId('reject-confirm'));
    expect(await screen.findByTestId('proposal-error')).toHaveTextContent('Already done');
  });

  it('expired proposals are History items with no actions', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('radio', { name: /History/ }));
    const list = screen.getByTestId('proposal-list');
    expect(within(list).getByText('An old proposal')).toBeInTheDocument();
    expect(within(list).getAllByText('Expired').length).toBeGreaterThan(0);
    await user.click(screen.getByTestId(`proposal-item-${EXP.id}`));
    expect(await screen.findByTestId('proposal-expired')).toBeInTheDocument();
    expect(screen.queryByTestId('proposal-actions')).toBeNull();
  });

  it('a pending trade with nothing left to sell is "Resolved"', async () => {
    await open({ items: [proposal({ suggested_qty: 0 })] });
    expect(await screen.findByTestId('proposal-resolved')).toHaveTextContent('This is resolved.');
    expect(screen.queryByTestId('proposal-actions')).toBeNull();
    expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0);
  });

  it('deep link to a decided proposal opens on History with the decision shown', async () => {
    await open({}, `/proposals/${H1.id}`);
    expect(screen.getByRole('radio', { name: 'History (2)' })).toBeChecked();
    expect(await screen.findByTestId('proposal-result')).toHaveTextContent('Approved.');
  });

  it('empty states for both tabs', async () => {
    const user = userEvent.setup();
    await open({ items: [] });
    expect(screen.getByTestId('proposal-empty')).toHaveTextContent(
      'No pending proposals. New ones appear when a rule is breached.',
    );
    await user.click(screen.getByRole('radio', { name: 'History (0)' }));
    expect(screen.getByTestId('proposal-empty')).toHaveTextContent('No decisions yet.');
  });

  it('shows an error panel when the list fails (500) and recovers on retry', async () => {
    const user = userEvent.setup();
    let fail = true;
    installFetch(api({ extra: p => (p === '/v1/proposals' && fail ? err(500, 'internal') : undefined) }));
    renderApp('/proposals');
    expect(await screen.findByTestId('error-panel', undefined, { timeout: 6000 })).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('proposal-list')).toBeInTheDocument();
  }, 12000);

  it('has no axe violations', async () => {
    const user = userEvent.setup();
    await open();
    await screen.findByTestId('check-cap');
    expect(
      await axe(document.body, { rules: { 'color-contrast': { enabled: false } } }),
    ).toHaveNoViolations();
    await user.click(screen.getByTestId('proposal-reject'));
    expect(
      await axe(document.body, { rules: { 'color-contrast': { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
