import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { __resetSession } from '@/auth/session';
import { installFetch, renderApp, type MockRoute } from '@/test/renderApp';

afterEach(() => {
  __resetSession();
  vi.unstubAllGlobals();
});

const checks = {
  pass: { key: 'cash', ok: true, severity: 'pass', label: 'Cash', detail: 'Enough paper cash' },
  note: {
    key: 'pos',
    ok: true,
    severity: 'note',
    label: 'Position size',
    detail: 'Would reach 14.1% of 15%',
  },
  blocked: {
    key: 'sec',
    ok: false,
    severity: 'blocked',
    label: 'Sector cap',
    detail: 'Technology would be 41% of 40%',
  },
};
const order = (over: Record<string, unknown> = {}) => ({
  id: 'o-1111-2222',
  symbol: 'AAPL',
  side: 'buy',
  type: 'market',
  qty: 1,
  status: 'filled',
  source: 'Manual',
  created_at: new Date().toISOString(),
  ...over,
});

type Opts = {
  previewChecks?: unknown[];
  blocked?: boolean;
  orders?: unknown[];
  create?: () => Response | unknown;
};
function api(opts: Opts = {}): MockRoute {
  return (path, init) => {
    const method = init.method ?? 'GET';
    if (path === '/v1/quotes')
      return {
        items: [
          {
            symbol: 'AAPL',
            price: 182.4,
            prev_close: 181,
            change_pct: 0.77,
            ts: new Date().toISOString(),
            source: 'iex',
            session: 'regular',
            freshness: 'live',
          },
        ],
      };
    if (path === '/v1/orders/preview')
      return {
        // real shape (verified live 2026-11-01): the estimate is on `order`, `fill` is null on a preview
        order: {
          symbol: 'AAPL',
          side: 'buy',
          type: 'market',
          qty: 1,
          limit_price: null,
          est_price: 182.49,
          est_cost: 182.49,
          est_cash_after: 99817.51,
          will: 'fill',
        },
        fill: null,
        checks: opts.previewChecks ?? [checks.pass],
        blocked: opts.blocked ?? false,
        hard_blocked: false,
        market_open: true,
      };
    if (path === '/v1/orders' && method === 'POST')
      return opts.create?.() ?? { order: order(), fill: { price: 182.49 }, checks: [], blocked: false };
    if (path === '/v1/orders') return { items: opts.orders ?? [], next_cursor: null };
    if (path === '/v1/portfolio/performance')
      return {
        series: [
          { ts: '2026-10-01T00:00:00Z', equity: 100000, spy_norm: 100000 },
          { ts: '2026-10-02T00:00:00Z', equity: 101000, spy_norm: 100400 },
        ],
        stats: {
          ytd_pct: 6.8,
          spy_pct: 4.1,
          vol_pct: 12,
          beta: 1,
          drawdown_pct: 1,
          max_drawdown_pct: 2,
          turnover_pct: 40,
          win_rate_pct: 58,
          realized_pnl: 1200,
        },
      };
    return undefined;
  };
}

const open = async (opts?: Opts) => {
  const f = installFetch(api(opts));
  renderApp('/trading');
  await screen.findByTestId('ticket');
  await waitFor(() => expect(screen.getByTestId('ticket-symbol')).toHaveValue('AAPL'));
  return f;
};

describe('trading ticket', () => {
  it('renders Pass / Note / Blocked checks from the preview and blocks the submit', async () => {
    await open({ previewChecks: [checks.pass, checks.note, checks.blocked], blocked: true });
    const list = await screen.findByTestId('check-sec');
    expect(within(list).getByText('Blocked')).toBeInTheDocument();
    expect(within(screen.getByTestId('check-pos')).getByText('Note')).toBeInTheDocument();
    expect(within(screen.getByTestId('check-cash')).getByText('Pass')).toBeInTheDocument();
    const btn = screen.getByTestId('ticket-submit');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('Blocked by your rules');
  });

  it('shows backend estimates and the last price', async () => {
    await open();
    expect(await screen.findByText('$182.49')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-px')).toHaveTextContent('$182.40');
  });

  it('a double click sends ONE order with one Idempotency-Key and shows the fill stamp', async () => {
    const { fn } = await open();
    const btn = screen.getByTestId('ticket-submit');
    await waitFor(() => expect(btn).toBeEnabled());
    const user = userEvent.setup();
    await Promise.all([user.dblClick(btn)]);
    await waitFor(() => expect(screen.getByTestId('stamp')).toHaveTextContent('FILLED'));
    const posts = fn.mock.calls.filter(
      ([u, i]) => new URL(String(u)).pathname === '/v1/orders' && (i as RequestInit)?.method === 'POST',
    );
    expect(posts).toHaveLength(1);
    const headers = (posts[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(String((posts[0]?.[1] as RequestInit).body))).toMatchObject({
      symbol: 'AAPL',
      side: 'buy',
      type: 'market',
      qty: 1,
    });
  });

  it('a queued order stamps QUEUED', async () => {
    await open({
      create: () => ({ order: order({ status: 'queued' }), fill: null, checks: [], blocked: false }),
    });
    const btn = screen.getByTestId('ticket-submit');
    await waitFor(() => expect(btn).toBeEnabled());
    await userEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('stamp')).toHaveTextContent('QUEUED'));
  });

  it('limit orders need a limit price and send it', async () => {
    const { fn } = await open();
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Limit' }));
    expect(await screen.findByTestId('check-limit_price')).toHaveTextContent('Enter a limit price above $0');
    expect(screen.getByTestId('ticket-submit')).toBeDisabled();
    await user.type(screen.getByTestId('ticket-limit'), '180.5');
    const btn = screen.getByTestId('ticket-submit');
    await waitFor(() => expect(btn).toBeEnabled());
    await user.click(btn);
    await waitFor(() => {
      const post = fn.mock.calls.find(
        ([u, i]) => new URL(String(u)).pathname === '/v1/orders' && (i as RequestInit)?.method === 'POST',
      );
      expect(JSON.parse(String((post?.[1] as RequestInit).body))).toMatchObject({
        type: 'limit',
        limit_price: 180.5,
      });
    });
  });

  it('maps a server rule_violation to an inline error and re-uses the key on retry of the same body', async () => {
    let n = 0;
    const keys: string[] = [];
    installFetch((path, init) => {
      const base = api()(path, init);
      if (path === '/v1/orders' && init.method === 'POST') {
        keys.push((init.headers as Record<string, string>)['Idempotency-Key'] ?? '');
        n++;
        if (n === 1)
          return new Response(
            JSON.stringify({
              code: 'rule_violation',
              message: 'Rule broken',
              trace_id: 'tr9',
              details: { violations: [{ message: 'Max position 15%' }] },
            }),
            { status: 422 },
          );
      }
      return base;
    });
    renderApp('/trading');
    const btn = await screen.findByTestId('ticket-submit');
    await waitFor(() => expect(btn).toBeEnabled());
    const user = userEvent.setup();
    await user.click(btn);
    const err = await screen.findByTestId('ticket-error');
    expect(err).toHaveTextContent('Max position 15%');
    expect(err).toHaveTextContent('tr9');
    await user.click(btn);
    await waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[0]).toBe(keys[1]);
  });

  it('shows an error row when the preview fails and offers a retry', async () => {
    installFetch((path, init) =>
      path === '/v1/orders/preview'
        ? new Response(JSON.stringify({ code: 'internal', message: 'boom', trace_id: 't' }), { status: 500 })
        : api()(path, init),
    );
    renderApp('/trading');
    expect(await screen.findByTestId('checks-error', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('ticket-submit')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Retry checks' })).toBeInTheDocument();
  });

  it('pauses orders while offline', async () => {
    await open();
    const btn = screen.getByTestId('ticket-submit');
    await waitFor(() => expect(btn).toBeEnabled());
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    await waitFor(() => expect(btn).toBeDisabled());
    expect(btn).toHaveTextContent('Offline: orders paused');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
  });

  it('has no axe violations', async () => {
    await open({ previewChecks: [checks.pass, checks.note] });
    await screen.findByTestId('check-pos');
    expect(await axe(document.body)).toHaveNoViolations();
  });
});

describe('order ledger', () => {
  it('lists orders and cancels a queued one', async () => {
    const orders = [
      order({ id: 'q-1', status: 'queued', symbol: 'MSFT', qty: 3 }),
      order({ id: 'f-1', status: 'filled', fill_price: 410.2 }),
    ];
    const { fn } = await open({ orders });
    const row = await screen.findByTestId('order-row-q-1');
    expect(within(row).getByText('Queued')).toBeInTheDocument();
    expect(within(screen.getByTestId('order-row-f-1')).queryByRole('button', { name: /cancel/i })).toBeNull();
    expect(within(screen.getByTestId('order-row-f-1')).getByText('$410.20')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('cancel-q-1'));
    await waitFor(() =>
      expect(
        fn.mock.calls.some(
          ([u, i]) =>
            new URL(String(u)).pathname === '/v1/orders/q-1' && (i as RequestInit)?.method === 'DELETE',
        ),
      ).toBe(true),
    );
  });

  it('shows the empty state', async () => {
    await open({ orders: [] });
    expect(await screen.findByTestId('ledger-empty')).toHaveTextContent('No orders yet');
  });

  it('shows an error panel with retry on 5xx', async () => {
    installFetch((path, init) =>
      path === '/v1/orders' && init.method !== 'POST'
        ? new Response(JSON.stringify({ code: 'internal', message: 'x', trace_id: 't' }), { status: 500 })
        : api()(path, init),
    );
    renderApp('/trading');
    expect(await screen.findByText('Could not load your orders', {}, { timeout: 6000 })).toBeInTheDocument();
  }, 10000);
});

describe('performance panel', () => {
  it('renders the API series and stats', async () => {
    await open();
    expect(await screen.findByTestId('perf-chart')).toBeInTheDocument();
    expect(screen.getByText('+6.80%')).toBeInTheDocument();
    expect(screen.getByText('+2.70%')).toBeInTheDocument();
    expect(screen.getByText('58%')).toBeInTheDocument();
  });
});
