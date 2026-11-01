import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { __resetSession } from '@/auth/session';
import { installFetch, renderApp, type MockRoute } from '@/test/renderApp';
import { chartPaths } from './Performance';
import { buildBriefing } from './Hero';
import { timeAgo } from './format';

const fail = (status: number, code: string) =>
  new Response(JSON.stringify({ code, message: code, trace_id: 'tr-1' }), { status });

const portfolio = {
  portfolio_id: 'p1',
  cash: 12_000,
  invested: 88_000,
  equity: 100_000,
  day_change: 420,
  day_change_pct: 0.42,
  positions: [
    {
      symbol: 'AAPL',
      name: 'Apple',
      sector: 'Technology',
      qty: 100,
      avg_cost: 150,
      price: 190,
      change_pct: 1,
      value: 19_000,
      weight_pct: 17.2,
      pnl: 4000,
      pnl_pct: 26,
    },
    {
      symbol: 'JNJ',
      name: 'J&J',
      sector: 'Healthcare',
      qty: 50,
      avg_cost: 150,
      price: 160,
      change_pct: -0.5,
      value: 8_000,
      weight_pct: 8,
      pnl: 500,
      pnl_pct: 6,
    },
  ],
  sectors: [],
  hhi: 0.2,
  effective_n: 5,
};
const risk = {
  metrics: {
    hhi: 0.2,
    effective_n: 5,
    vol_60d: 14.2,
    beta: 0.94,
    max_drawdown_pct: 6.1,
    drawdown_pct: 2.2,
    trades_7d: 2,
  },
  rules: [
    { key: 'pos', limit: 15, current: 17.2, status: 'breach' },
    { key: 'sec', limit: 35, current: 20, status: 'ok' },
    { key: 'dd', limit: 15, current: 13, status: 'warn' },
    { key: 'trades', limit: 5, current: 2, status: 'ok' },
  ],
  violations: [{ rule: 'pos', message: 'AAPL is 17.2% of your portfolio (limit 15%)' }],
};
const perf = {
  series: [
    { ts: '2026-10-01T20:00:00Z', equity: 100_000, spy_norm: 100_000 },
    { ts: '2026-10-15T20:00:00Z', equity: 103_000, spy_norm: 101_000 },
    { ts: '2026-10-30T20:00:00Z', equity: 108_000, spy_norm: 104_000 },
  ],
  stats: {
    ytd_pct: 8.4,
    spy_pct: 5.1,
    vol_pct: 12.3,
    beta: 0.94,
    drawdown_pct: 2.2,
    max_drawdown_pct: 6.1,
    turnover_pct: 12,
    win_rate_pct: 61,
    realized_pnl: 900,
  },
};
const why = {
  summary: 'Pinned: rule breaches always show and bypass learned ranking.',
  top_features: [{ name: 'Materiality', weight: 0.9, detail: 'position is over your cap' }],
  rules_checked: [{ rule: 'max position 15%', passed: false }],
  sources: ['risk engine'],
  basis: 'profile' as const,
};
const feed = {
  items: [
    {
      kind: 'alert',
      id: 'al-1',
      pinned: true,
      score: 0.97,
      item: {
        id: 'al-1',
        type: 'breach',
        symbol: 'AAPL',
        critical: true,
        materiality: 1,
        title: 'AAPL breaks your position cap',
        body: 'AAPL is 17.2% of your portfolio.',
        source_label: 'Risk engine',
        state: 'new',
        created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      },
      why,
    },
    {
      kind: 'proposal',
      id: 'pr-1',
      pinned: false,
      score: 0.71,
      item: {
        id: 'pr-1',
        kind: 'trade',
        symbol: 'AAPL',
        side: 'sell',
        rule: 'pos',
        title: 'Reduce AAPL by 12 shares',
        body: 'Brings AAPL back under your 15% cap.',
        rationale: [],
        rules_checked: [],
        suggested_qty: 12,
        current_weight_pct: 17.2,
        after_weight_pct: 14.9,
        cap_pct: 15,
        sources: [],
        status: 'pending',
        expires_at: '2026-11-02T00:00:00Z',
        created_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
        disclaimer: '',
      },
      why: {
        ...why,
        summary: 'Learned weight and interest.',
        top_features: [{ name: 'Interest', weight: 0.4, detail: 'Technology' }],
        rules_checked: [{ rule: 'max sector 35%', passed: true }],
      },
    },
  ],
  next_cursor: null,
};
const watchlist = {
  items: [
    {
      symbol: 'AAPL',
      name: 'Apple',
      sector: 'Technology',
      quote: {
        symbol: 'AAPL',
        price: 190.12,
        prev_close: 188,
        change_pct: 1.13,
        ts: '2026-11-02T14:00:00Z',
        source: 'iex',
        session: 'regular',
        freshness: 'live',
      },
    },
    {
      symbol: 'KO',
      name: 'Coca-Cola',
      sector: 'Consumer Staples',
      quote: {
        symbol: 'KO',
        price: 61.5,
        prev_close: 62.5,
        change_pct: -1.6,
        ts: '2026-11-02T13:00:00Z',
        source: 'iex',
        session: 'regular',
        freshness: 'delayed',
      },
    },
    { symbol: 'MSFT', name: 'Microsoft', sector: 'Technology', quote: null },
  ],
};
const profile = {
  profile: {},
  style_card: {},
  rules: { pos: 15, sec: 35, dd: 15, trades: 5, cash: 5 },
  interests: [],
  memories: [],
  bias: [],
  stated_tier: 3,
  revealed_tier: 3,
  gap_days: 0,
  recent_events: [
    { id: 'e1', ts: '2026-11-02T13:05:00Z', type: 'alert', text: 'Risk engine checked your 4 rules' },
  ],
};

const base: MockRoute = path => {
  switch (path) {
    case '/v1/portfolio':
      return portfolio;
    case '/v1/portfolio/risk':
      return risk;
    case '/v1/portfolio/performance':
      return perf;
    case '/v1/feed':
      return feed;
    case '/v1/watchlist':
      return watchlist;
    case '/v1/profile':
      return profile;
    case '/v1/alerts':
      return {
        items: [
          {
            id: 'e1',
            type: 'earnings',
            symbol: 'NVDA',
            critical: false,
            materiality: 0.5,
            title: 'NVDA earnings Nov 19',
            body: '',
            source_label: 'Calendar',
            state: 'new',
            created_at: '2026-11-01T00:00:00Z',
          },
        ],
        next_cursor: null,
      };
    case '/v1/proposals':
      return { items: [{ id: 'pr-1' }, { id: 'pr-2' }], next_cursor: null };
    default:
      return undefined;
  }
};
const withRoutes = (over: Record<string, unknown>) =>
  installFetch((path, init) => (path in over ? (over[path] as never) : base(path, init)));

afterEach(() => {
  __resetSession();
  vi.unstubAllGlobals();
});

describe('dashboard', () => {
  it('renders the briefing, tiles, radar and rules from API data', async () => {
    withRoutes({});
    renderApp('/dashboard');
    expect(await screen.findByTestId('dash-greeting')).toHaveTextContent(
      /Good (morning|afternoon|evening), Priya\. Your rules need attention\./,
    );
    expect(await screen.findByTestId('dash-headline-text')).toHaveTextContent(
      'Portfolio value is $100,000, +0.42% today and +8.4% year to date against +5.1% for the S&P 500.',
    );
    const bullets = await screen.findByTestId('dash-bullets');
    expect(bullets).toHaveTextContent('1 of your rules is breached: max position (17.2% vs 15%).');
    expect(bullets).toHaveTextContent('2 proposals waiting for your decision.');
    const tiles = screen.getByTestId('dash-tiles');
    expect(tiles).toHaveTextContent('$100,000');
    expect(tiles).toHaveTextContent('+0.42%');
    expect(tiles).toHaveTextContent('S&P 500 +5.1%');
    expect(tiles).toHaveTextContent('$12,000');

    expect(await screen.findByTestId('radar-summary')).toHaveTextContent('2/4 rules within limits');
    expect(screen.getByTestId('radar-AAPL')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('AAPL: 17.2% of portfolio, cap 15%'),
    );
    const posRow = screen.getByTestId('rule-row-pos');
    expect(posRow).toHaveTextContent('17.2% / 15%');
    expect(posRow).toHaveTextContent('Breached');
    expect(screen.getByTestId('rule-row-dd')).toHaveTextContent('Near limit');
    expect(screen.getByTestId('rule-row-trades')).toHaveTextContent('2 / 5');
    expect(screen.getByTestId('rule-row-trades')).toHaveTextContent('Within');
  });

  it('shows the cash-only briefing for a brand-new account and an empty radar', async () => {
    withRoutes({
      '/v1/portfolio': {
        ...portfolio,
        positions: [],
        invested: 0,
        equity: 100_000,
        cash: 100_000,
        day_change_pct: 0,
      },
      '/v1/portfolio/risk': {
        ...risk,
        rules: risk.rules.map(r => ({ ...r, status: 'ok', current: 0 })),
        violations: [],
      },
      '/v1/feed': { items: [], next_cursor: null },
    });
    renderApp('/dashboard');
    await waitFor(() =>
      expect(screen.getByTestId('dash-greeting')).toHaveTextContent(
        'Welcome, Priya. Your workspace is ready.',
      ),
    );
    expect(await screen.findByTestId('dash-headline-text')).toHaveTextContent(
      'Your paper portfolio is $100,000 in cash.',
    );
    await waitFor(() =>
      expect(screen.getByTestId('dash-bullets')).toHaveTextContent(
        'Your rules are active: 15% per position, 35% per sector, 5 trades a week.',
      ),
    );
    expect(screen.getByTestId('radar-empty')).toBeInTheDocument();
    expect(await screen.findByTestId('feed-empty')).toHaveTextContent('Nothing new. You are caught up.');
  });

  it('ranks the feed as served, labels kinds, and expands "Why am I seeing this?" from the embedded explanation', async () => {
    withRoutes({});
    renderApp('/dashboard');
    const first = await screen.findByTestId('feed-al-1');
    const cards = screen.getAllByRole('article');
    expect(cards[0]).toBe(first);
    expect(within(first).getByText('Rule breach')).toBeInTheDocument();
    expect(within(first).getByText('PINNED')).toBeInTheDocument();
    expect(within(first).getByText('SIGNAL 0.97')).toBeInTheDocument();
    expect(within(first).getByText('5m ago')).toBeInTheDocument();
    // pinned items cannot be rated
    expect(within(first).queryByText('Useful')).not.toBeInTheDocument();
    expect(within(cards[1]!).getByText('Proposal')).toBeInTheDocument();
    expect(within(cards[1]!).getByText('Useful')).toBeInTheDocument();

    const btn = screen.getByTestId('feed-why-btn-al-1');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByTestId('why-al-1');
    expect(panel).toHaveTextContent('Based on your profile');
    expect(panel).toHaveTextContent('Pinned: rule breaches always show and bypass learned ranking.');
    expect(panel).toHaveTextContent('Materiality: position is over your cap');
    expect(panel).toHaveTextContent('Rule checked: max position 15% (not passed)');
    expect(panel).toHaveTextContent('Sources: risk engine');
  });

  it('falls back to GET /why/{type}/{id} when the feed item carries no explanation', async () => {
    const noWhy = { ...feed, items: [{ ...feed.items[1]!, why: undefined }] };
    const { calls } = withRoutes({ '/v1/feed': noWhy, '/v1/why/proposal/pr-1': why });
    renderApp('/dashboard');
    await userEvent.click(await screen.findByTestId('feed-why-btn-pr-1'));
    await waitFor(() =>
      expect(screen.getByTestId('why-pr-1')).toHaveTextContent('Materiality: position is over your cap'),
    );
    expect(calls).toContain('GET /v1/why/proposal/pr-1');
  });

  it('opening an alert records the open and navigates; Useful is acknowledged once', async () => {
    const { calls } = withRoutes({ '/v1/alerts/al-1/action': { id: 'al-1' } });
    const { router } = renderApp('/dashboard');
    await userEvent.click(await screen.findByTestId('feed-open-al-1'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/portfolio'));
    expect(calls).toContain('POST /v1/alerts/al-1/action');

    // back on the dashboard, rate the proposal card
    await router.navigate('/dashboard');
    await userEvent.click(await screen.findByTestId('feed-up-pr-1'));
    expect(await screen.findByTestId('toast')).toHaveTextContent('Noted. Proposal items will rank higher.');
    expect(screen.getByTestId('feed-up-pr-1')).toBeDisabled();
    expect(screen.getByTestId('feed-down-pr-1')).toBeDisabled();
  });

  it('proposal cards open the proposal; radar blips and movers open the brief', async () => {
    withRoutes({});
    const { router } = renderApp('/dashboard');
    await userEvent.click(await screen.findByTestId('feed-open-pr-1'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/proposals/pr-1'));
    await router.navigate('/dashboard');
    await userEvent.click(await screen.findByTestId('radar-JNJ'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/brief/JNJ'));
    await router.navigate('/dashboard');
    await userEvent.click(await screen.findByTestId('mover-KO'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/brief/KO'));
  });

  it('lists watchlist movers by absolute move with freshness badges, activity and upcoming', async () => {
    withRoutes({});
    renderApp('/dashboard');
    const movers = await screen.findByTestId('dash-movers');
    await within(movers).findByTestId('mover-KO');
    const order = within(movers)
      .getAllByRole('button')
      .map(b => b.getAttribute('data-testid'));
    expect(order).toEqual(['mover-KO', 'mover-AAPL', 'mover-MSFT']);
    expect(within(screen.getByTestId('mover-KO')).getByTestId('freshness')).toHaveTextContent('Delayed');
    expect(within(screen.getByTestId('mover-AAPL')).getByTestId('freshness')).toHaveTextContent('Live');
    expect(within(screen.getByTestId('mover-MSFT')).getByTestId('freshness')).toHaveTextContent('No quote');
    expect(screen.getByTestId('mover-KO')).toHaveTextContent('-1.60%');
    expect(await screen.findByTestId('dash-activity')).toHaveTextContent('Risk engine checked your 4 rules');
    expect(await screen.findByTestId('dash-upcoming')).toHaveTextContent('NVDA earnings Nov 19');
  });

  it('shows performance vs S&P 500 and the risk summary', async () => {
    withRoutes({});
    renderApp('/dashboard');
    const p = await screen.findByTestId('dash-performance');
    expect(await within(p).findByRole('img')).toHaveAttribute(
      'aria-label',
      'Portfolio +8.0% versus S&P 500 +4.0% since Oct 1',
    );
    expect(within(p).getByTestId('perf-stats')).toHaveTextContent('+8.4%');
    expect(within(p).getByTestId('perf-stats')).toHaveTextContent('Max drawdown6.1%');
    const r = await screen.findByTestId('dash-risk');
    expect(await within(r).findByText('0.200')).toBeInTheDocument();
    expect(within(r).getByTestId('risk-violations')).toHaveTextContent(
      'AAPL is 17.2% of your portfolio (limit 15%)',
    );
  });

  it('degrades per section: one failing endpoint shows its own error with retry, the rest still render', async () => {
    withRoutes({ '/v1/feed': fail(403, 'forbidden'), '/v1/portfolio/performance': fail(403, 'forbidden') });
    renderApp('/dashboard');
    expect(await screen.findByTestId('dash-radar')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId('section-error').length).toBe(2));
    const [feedErr] = within(screen.getByTestId('dash-feed')).getAllByTestId('section-error');
    expect(feedErr).toHaveTextContent('Could not load your feed');
    expect(within(feedErr!).getByText('Try again')).toBeInTheDocument();
    expect(screen.getByTestId('dash-performance')).toHaveTextContent('Could not load performance');
    // the hero still shows figures (YTD unavailable)
    expect(await screen.findByTestId('dash-tiles')).toHaveTextContent('$100,000');
  });

  it('shows an error panel for the portfolio when it cannot be loaded', async () => {
    withRoutes({ '/v1/portfolio': fail(403, 'forbidden') });
    renderApp('/dashboard');
    const hero = await screen.findByTestId('dash-hero');
    expect(await within(hero).findByTestId('section-error')).toHaveTextContent(
      'Could not load your portfolio',
    );
  });

  it('has no axe violations', async () => {
    withRoutes({});
    const { container } = renderApp('/dashboard');
    await screen.findByTestId('feed-al-1');
    await screen.findByTestId('mover-KO');
    await screen.findByTestId('perf-stats');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('dashboard helpers', () => {
  it('chartPaths rebases both series to % since the first point', () => {
    const p = chartPaths(perf.series);
    expect(p.last.equity).toBeCloseTo(8, 5);
    expect(p.last.spy).toBeCloseTo(4, 5);
    expect(p.equity.startsWith('M')).toBe(true);
  });
  it('buildBriefing lists only what the data says', () => {
    const b = buildBriefing({
      pf: portfolio,
      risk: { ...risk, rules: risk.rules.map(r => ({ ...r, status: 'ok' as const })) },
    });
    expect(b[0]?.text).toBe('Portfolio value is $100,000, +0.42% today.');
    expect(b[1]?.text).toBe('All 4 of your rules are within limits.');
  });
  it('timeAgo', () => {
    const now = Date.parse('2026-11-02T12:00:00Z');
    expect(timeAgo('2026-11-02T11:59:50Z', now)).toBe('Just now');
    expect(timeAgo('2026-11-02T11:30:00Z', now)).toBe('30m ago');
    expect(timeAgo('2026-11-02T09:00:00Z', now)).toBe('3h ago');
    expect(timeAgo('2026-10-31T12:00:00Z', now)).toBe('2d ago');
    expect(timeAgo(null)).toBe('');
  });
});
