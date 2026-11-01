import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { __resetSession } from '@/auth/session';
import { installFetch, renderApp, type MockRoute } from '@/test/renderApp';
import { rebase100 } from './EquityCurve';

const pos = (symbol: string, weight: number, over: Record<string, unknown> = {}) => ({
  symbol,
  name: symbol,
  sector: 'Healthcare',
  qty: 10,
  avg_cost: 100,
  price: 110,
  change_pct: 0.5,
  value: 1100,
  weight_pct: weight,
  pnl: 100,
  pnl_pct: 10,
  ...over,
});

const base = (positions: unknown[]) => ({
  portfolio_id: 'pf',
  cash: 22014,
  invested: 77986,
  equity: 100000,
  day_change: 420,
  day_change_pct: 0.42,
  positions,
  sectors: [
    { sector: 'Healthcare', value: 30000, weight_pct: 30 },
    { sector: 'Technology', value: 10000, weight_pct: 10 },
  ],
  hhi: 0.31,
  effective_n: 3.2,
});

const risk = (over: Record<string, unknown> = {}) => ({
  metrics: {
    hhi: 0.31,
    effective_n: 3.2,
    vol_60d: 11.24,
    beta: 0.62,
    max_drawdown_pct: 5.1,
    drawdown_pct: 9.2,
    trades_7d: 1,
  },
  rules: [
    { key: 'pos', limit: 10, current: 12.5, status: 'breach' },
    { key: 'sec', limit: 25, current: 30, status: 'breach' },
    { key: 'dd', limit: 10, current: 9.2, status: 'warn' },
    { key: 'trades', limit: 3, current: 1, status: 'ok' },
    { key: 'cash', limit: 10, current: 22, status: 'ok' },
  ],
  violations: [{ rule: 'pos', message: 'JNJ is 12.5% of your portfolio, above your 10% limit.' }],
  ...over,
});

const perf = {
  series: [
    { ts: '2026-10-01T00:00:00Z', equity: 100000, spy_norm: 100000 },
    { ts: '2026-10-15T00:00:00Z', equity: 102000, spy_norm: 101000 },
    { ts: '2026-10-30T00:00:00Z', equity: 104000, spy_norm: 100500 },
  ],
  stats: {
    ytd_pct: 4,
    spy_pct: 0.5,
    vol_pct: 11,
    beta: 0.6,
    drawdown_pct: 1,
    max_drawdown_pct: 3,
    turnover_pct: 5,
    win_rate_pct: 55,
    realized_pnl: 120,
  },
};

const err = (status: number, code: string) =>
  new Response(JSON.stringify({ code, message: 'm', trace_id: 'tr-9' }), { status });

const POSITIONS = [pos('KO', 6.2), pos('JNJ', 12.5, { value: 12500, pnl: -300 }), pos('PG', 9)];

const api =
  (o: { portfolio?: unknown; risk?: unknown; perf?: unknown; extra?: MockRoute } = {}): MockRoute =>
  (path, init) => {
    const x = o.extra?.(path, init);
    if (x !== undefined) return x;
    if (path === '/v1/portfolio') return o.portfolio ?? base(POSITIONS);
    if (path === '/v1/portfolio/risk') return o.risk ?? risk();
    if (path === '/v1/portfolio/performance') return o.perf ?? perf;
    return undefined;
  };

const open = async (o: Parameters<typeof api>[0] = {}) => {
  const f = installFetch(api(o));
  const r = renderApp('/portfolio');
  await screen.findByTestId('pf-kpis');
  return { ...f, ...r };
};

afterEach(() => {
  vi.restoreAllMocks();
  __resetSession();
  vi.unstubAllGlobals();
});

describe('portfolio and risk (FE-07)', () => {
  it('renders KPIs from the API without recomputing them', async () => {
    await open();
    expect(screen.getByTestId('kpi-value')).toHaveTextContent('$100,000');
    expect(screen.getByTestId('kpi-value')).toHaveTextContent('+0.42% today');
    expect(screen.getByTestId('kpi-cash')).toHaveTextContent('22.0%'); // risk rule `cash.current`
    expect(screen.getByTestId('kpi-cash')).toHaveTextContent('$22,014');
    expect(screen.getByTestId('kpi-hhi')).toHaveTextContent('0.31');
    expect(screen.getByTestId('kpi-hhi')).toHaveTextContent('Concentrated, N = 3.2');
    expect(screen.getByTestId('kpi-dd')).toHaveTextContent('9.2%');
    expect(screen.getByTestId('kpi-dd')).toHaveTextContent('Alert at 10%');
    expect(screen.getByTestId('kpi-vol')).toHaveTextContent('11.2%');
    expect(screen.getByTestId('kpi-beta')).toHaveTextContent('0.62');
  });

  it('lists positions by weight with cap status and links to the brief', async () => {
    const user = userEvent.setup();
    const { router } = await open();
    const rows = within(screen.getByTestId('pf-positions')).getAllByRole('row').slice(1);
    expect(rows.map(r => within(r).getAllByRole('cell')[0]?.textContent)).toEqual(['JNJ', 'PG', 'KO']);
    expect(screen.getByTestId('pos-JNJ')).toHaveTextContent('Above cap');
    expect(screen.getByTestId('pos-PG')).toHaveTextContent('Near cap');
    expect(screen.getByTestId('pos-KO')).toHaveTextContent('Within');
    expect(screen.getByTestId('pos-JNJ')).toHaveTextContent('-$300');
    await user.click(screen.getByTestId('pos-PG'));
    expect(router.state.location.pathname).toBe('/brief/PG');
  });

  it('shows sector bars against the sector limit and the violations banner', async () => {
    await open();
    expect(screen.getByTestId('sector-Healthcare')).toHaveTextContent('30.0%');
    expect(screen.getByTestId('pf-sectors')).toHaveTextContent('your 25% sector limit');
    expect(screen.getByTestId('pf-violations')).toHaveTextContent('JNJ is 12.5% of your portfolio');
  });

  it('draws the equity curve vs SPY with the YTD stats from the API', async () => {
    await open();
    const curve = await screen.findByTestId('pf-curve');
    expect(within(curve).getByRole('img')).toHaveAccessibleName(
      /portfolio \+4.0% year to date, S&P 500 \+0.5%/,
    );
    expect(curve).toHaveTextContent('Portfolio +4.0% YTD');
    expect(curve).toHaveTextContent('S&P 500 +0.5% YTD');
  });

  it('rebases BOTH series to 100 (the API indexes equity and spy_norm to the starting equity, not 100)', () => {
    expect(rebase100([100000, 102000, 104000])).toEqual([100, 102, 104]);
    expect(rebase100([93850.43, 94000, 0, 95000])[0]).toBe(100);
    expect(rebase100([])).toEqual([]);
  });

  it('says so when there is no equity history yet', async () => {
    await open({ perf: { ...perf, series: [] } });
    expect(await screen.findByTestId('pf-curve-empty')).toBeInTheDocument();
  });

  it('shows rule status next to each rule and edits a rule through PUT /profile/rules', async () => {
    const user = userEvent.setup();
    let put: unknown = null;
    let limit = 10;
    const { calls } = await open({
      extra: (path, init) => {
        if (path === '/v1/profile/rules' && init.method === 'PUT') {
          put = JSON.parse(String(init.body));
          limit = 11;
          return put;
        }
        if (path === '/v1/portfolio/risk')
          return risk({ rules: risk().rules.map(r => (r.key === 'pos' ? { ...r, limit } : r)) });
        return undefined;
      },
    });
    expect(screen.getByTestId('rule-pos-status')).toHaveTextContent('Breached: 12.5%');
    expect(screen.getByTestId('rule-dd-status')).toHaveTextContent('Near limit');
    expect(screen.getByTestId('rule-trades-status')).toHaveTextContent('OK: 1');
    expect(screen.getByTestId('rule-pos-val')).toHaveTextContent('10%');
    await user.click(screen.getByTestId('rule-pos-inc'));
    expect(screen.getByTestId('rule-pos-val')).toHaveTextContent('11%'); // optimistic
    await waitFor(() => expect(calls).toContain('PUT /v1/profile/rules'));
    expect(put).toEqual({ pos: 11, sec: 25, dd: 10, trades: 3, cash: 10 });
    expect(await screen.findByText(/Max position set to 11%\. Logged/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('rule-pos-val')).toHaveTextContent('11%'));
  });

  it('reverts an edit and shows the API message when the rule change is rejected', async () => {
    const user = userEvent.setup();
    await open({
      extra: (path, init) =>
        path === '/v1/profile/rules' && init.method === 'PUT' ? err(422, 'validation_error') : undefined,
    });
    await user.click(screen.getByTestId('rule-sec-dec'));
    expect(await screen.findByText(/Some fields need attention/)).toBeInTheDocument();
    expect(screen.getByTestId('rule-sec-val')).toHaveTextContent('25%');
  });

  it('respects the design min/max for rule steppers', async () => {
    await open({
      risk: risk({ rules: risk().rules.map(r => (r.key === 'trades' ? { ...r, limit: 1 } : r)) }),
    });
    expect(screen.getByTestId('rule-trades-dec')).toBeDisabled();
    expect(screen.getByTestId('rule-trades-inc')).toBeEnabled();
  });

  it('empty portfolio: shows the cash-only card with a link to the order ticket', async () => {
    const user = userEvent.setup();
    const { router } = await open({
      portfolio: { ...base([]), sectors: [], hhi: 0, effective_n: 0, invested: 0, cash: 100000 },
      risk: risk({ violations: [] }),
    });
    expect(screen.getByTestId('pf-empty')).toHaveTextContent('No positions yet');
    expect(screen.getByTestId('kpi-hhi')).toHaveTextContent('No positions');
    expect(screen.queryByTestId('pf-positions')).toBeNull();
    await user.click(
      within(screen.getByTestId('pf-empty')).getByRole('button', { name: 'Open order ticket' }),
    );
    expect(router.state.location.pathname).toBe('/trading');
  });

  it('shows an error panel with retry when the portfolio fails (500)', async () => {
    installFetch(api({ extra: p => (p === '/v1/portfolio' ? err(500, 'internal') : undefined) }));
    renderApp('/portfolio');
    expect(await screen.findByTestId('error-panel', undefined, { timeout: 6000 })).toHaveTextContent(
      'Reference: tr-9',
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  }, 12000);

  it('keeps positions when only the risk call fails and disables rule editing', async () => {
    installFetch(api({ extra: p => (p === '/v1/portfolio/risk' ? err(404, 'not_found') : undefined) }));
    renderApp('/portfolio');
    expect(await screen.findByTestId('pf-positions')).toBeInTheDocument();
    expect(await screen.findByText('Rule status is unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('pf-risk-error')).toBeInTheDocument();
    expect(screen.queryByTestId('pf-rules')).toBeNull();
  });

  it('has no axe violations', async () => {
    await open();
    await screen.findByTestId('pf-curve');
    expect(
      await axe(document.body, { rules: { 'color-contrast': { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
