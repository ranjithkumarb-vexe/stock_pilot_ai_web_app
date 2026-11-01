import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { __resetSession } from '@/auth/session';
import { clearLiveQuotes, pushQuote } from '@/realtime';
import { installFetch, renderApp, type MockRoute } from '@/test/renderApp';

const q = (symbol: string, price: number, change_pct: number, freshness: string, extra = {}) => ({
  symbol,
  price,
  prev_close: price,
  change_pct,
  ts: '2026-11-02T14:00:00Z',
  source: 'iex',
  session: 'regular',
  freshness,
  ...extra,
});
const universe = {
  items: [
    ['AAPL', 'Apple Inc.', 'Technology'],
    ['MSFT', 'Microsoft Corp.', 'Technology'],
    ['KO', 'Coca-Cola Co.', 'Consumer Staples'],
    ['JNJ', 'Johnson & Johnson', 'Healthcare'],
    ['XOM', 'Exxon Mobil', 'Energy'],
  ].map(([symbol, name, sector]) => ({ symbol, name, sector, industry: 'x', exchange: 'NYSE' })),
};

function setup(over: Record<string, unknown> = {}) {
  let list: Array<Record<string, unknown>> = [
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', quote: q('AAPL', 190.12, 1.13, 'live') },
    {
      symbol: 'KO',
      name: 'Coca-Cola Co.',
      sector: 'Consumer Staples',
      quote: q('KO', 61.5, -1.6, 'delayed'),
    },
    { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', quote: q('JNJ', 150, 0.2, 'stale') },
    { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', quote: null },
  ];
  const writes: string[] = [];
  const handler: MockRoute = (path, init) => {
    if (path in over) return over[path] as never;
    if (path === '/v1/watchlist' && (init.method ?? 'GET') === 'GET') return { items: list };
    if (path.startsWith('/v1/watchlist/')) {
      const sym = path.split('/').pop()!;
      writes.push(`${init.method} ${sym}`);
      if (init.method === 'DELETE') {
        list = list.filter(i => i.symbol !== sym);
        return new Response(null, { status: 204 });
      }
      const u = universe.items.find(x => x.symbol === sym);
      if (!u)
        return new Response(
          JSON.stringify({ code: 'unsupported_symbol', message: `${sym} is not supported`, trace_id: 't' }),
          { status: 422 },
        );
      const item = { symbol: sym, name: u.name, sector: u.sector, quote: q(sym, 100, 0, 'live') };
      list = [...list, item];
      return item;
    }
    if (path === '/v1/universe') return universe;
    if (path === '/v1/portfolio')
      return {
        portfolio_id: 'p',
        cash: 1,
        invested: 1,
        equity: 1,
        day_change: 0,
        day_change_pct: 0,
        hhi: 0,
        effective_n: 0,
        sectors: [],
        positions: [
          {
            symbol: 'AAPL',
            name: 'Apple',
            sector: 'Technology',
            qty: 1,
            avg_cost: 1,
            price: 1,
            change_pct: 0,
            value: 1,
            weight_pct: 12.5,
            pnl: 0,
            pnl_pct: 0,
          },
        ],
      };
    if (path === '/v1/profile')
      return {
        profile: {},
        style_card: {},
        rules: {},
        interests: [
          { dim: 'Technology', weight: 0.8, baseline: 0.5 },
          { dim: 'Energy', weight: 0.2, baseline: 0.3 },
        ],
        memories: [],
        bias: [],
        stated_tier: 3,
        revealed_tier: 3,
        gap_days: 0,
        recent_events: [],
      };
    if (path === '/v1/quotes/AAPL/bars')
      return {
        symbol: 'AAPL',
        interval: '1d',
        source: 'iex',
        bars: [1, 2, 3, 4].map(n => ({ time: n, open: n, high: n, low: n, close: 100 + n, volume: 1 })),
      };
    if (path.startsWith('/v1/quotes/'))
      return new Response(JSON.stringify({ code: 'not_found', message: 'x', trace_id: 't' }), {
        status: 404,
      });
    if (path === '/v1/market/status') return { open: true, session: 'regular', feed_state: 'delayed' };
    return undefined;
  };
  return { ...installFetch(handler), writes };
}

afterEach(() => {
  __resetSession();
  clearLiveQuotes();
  vi.unstubAllGlobals();
});

describe('watchlist', () => {
  it('lists tickers with price, day change, freshness badges, held weight and learned interest', async () => {
    setup();
    renderApp('/watchlist');
    const row = await screen.findByTestId('wl-row-AAPL');
    expect(row).toHaveTextContent('Apple Inc.');
    expect(within(row).getByTestId('wl-px-AAPL')).toHaveTextContent('$190.12');
    expect(row).toHaveTextContent('+1.13%');
    expect(within(row).getByTestId('freshness')).toHaveTextContent('Live');
    expect(row).toHaveTextContent('12.5%');
    await waitFor(() => expect(row).toHaveTextContent('80%'));
    expect(within(screen.getByTestId('wl-row-KO')).getByTestId('freshness')).toHaveTextContent('Delayed');
    expect(within(screen.getByTestId('wl-row-JNJ')).getByTestId('freshness')).toHaveTextContent('Stale');
    const xom = screen.getByTestId('wl-row-XOM');
    expect(within(xom).getByTestId('freshness')).toHaveTextContent('No quote');
    expect(within(xom).getByTestId('wl-px-XOM')).toHaveTextContent('—');
    expect(screen.getByTestId('wl-count')).toHaveTextContent(
      '4 of 20 tickers. US large caps only for the MVP.',
    );
    expect(screen.getByTestId('wl-iex')).toHaveTextContent('Prices from IEX');
    // sparkline only where the bars endpoint answered
    await waitFor(() =>
      expect(within(row).getByRole('img', { name: 'AAPL 20-day trend' })).toBeInTheDocument(),
    );
    expect(within(screen.getByTestId('wl-row-KO')).queryByRole('img')).not.toBeInTheDocument();
    // feed status pill comes from /market/status
    await waitFor(() => expect(screen.getByTestId('wl-feed')).toHaveTextContent(/Delayed|Reconnecting/));
  });

  it('prefers a newer SSE quote over the polled one', async () => {
    setup();
    renderApp('/watchlist');
    await screen.findByTestId('wl-row-AAPL');
    act(() => pushQuote(q('AAPL', 195.5, 2.4, 'live', { ts: '2026-11-02T14:00:05Z' }) as never));
    await waitFor(() => expect(screen.getByTestId('wl-px-AAPL')).toHaveTextContent('$195.50'));
    // a push older than the polled quote never wins: the freshest timestamp is shown
    act(() => pushQuote(q('AAPL', 100, 0, 'live', { ts: '2026-11-02T13:00:00Z' }) as never));
    expect(screen.getByTestId('wl-px-AAPL')).toHaveTextContent('$190.12');
  });

  it('searches the universe and adds a ticker with the keyboard', async () => {
    const { writes } = setup();
    renderApp('/watchlist');
    await screen.findByTestId('wl-row-AAPL');
    const input = screen.getByTestId('wl-search');
    await userEvent.type(input, 'micro');
    const opts = await screen.findByTestId('wl-options');
    expect(within(opts).getAllByRole('option')).toHaveLength(1);
    expect(screen.queryByTestId('wl-option-AAPL')).not.toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByTestId('wl-row-MSFT')).toBeInTheDocument();
    expect(writes).toContain('PUT MSFT');
    expect(await screen.findByTestId('toast')).toHaveTextContent('Added MSFT to your watchlist');
    expect(screen.getByTestId('wl-count')).toHaveTextContent('5 of 20');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('refuses unsupported or duplicate tickers with a message', async () => {
    const { writes } = setup();
    renderApp('/watchlist');
    await screen.findByTestId('wl-row-AAPL');
    await userEvent.type(screen.getByTestId('wl-search'), 'ZZZZ');
    expect(await screen.findByTestId('wl-no-match')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('wl-add'));
    expect(await screen.findByTestId('wl-add-error')).toHaveTextContent(
      'ZZZZ is not in the supported universe',
    );
    await userEvent.clear(screen.getByTestId('wl-search'));
    await userEvent.type(screen.getByTestId('wl-search'), 'AAPL');
    await userEvent.click(screen.getByTestId('wl-add'));
    expect(screen.getByTestId('wl-add-error')).toHaveTextContent('AAPL is already on your watchlist.');
    expect(writes).toHaveLength(0);
  });

  it('shows the server message when the API rejects the ticker (422 unsupported_symbol)', async () => {
    // universe is stale: it lists XYZ but the backend no longer supports it
    setup({
      '/v1/universe': {
        items: [
          ...universe.items,
          { symbol: 'XYZ', name: 'Stale Corp', sector: 'Technology', industry: 'x', exchange: 'NYSE' },
        ],
      },
    });
    renderApp('/watchlist');
    await screen.findByTestId('wl-row-AAPL');
    await userEvent.type(screen.getByTestId('wl-search'), 'XYZ');
    await userEvent.click(await screen.findByTestId('wl-option-XYZ'));
    const err = await screen.findByTestId('wl-add-error');
    expect(err).toHaveTextContent('Ticker not supported');
    expect(err).toHaveTextContent('XYZ is not supported');
  });

  it('removes a ticker optimistically and rolls back when the server refuses', async () => {
    const { writes } = setup();
    renderApp('/watchlist');
    await userEvent.click(await screen.findByTestId('wl-remove-KO'));
    await waitFor(() => expect(screen.queryByTestId('wl-row-KO')).not.toBeInTheDocument());
    expect(writes).toContain('DELETE KO');
    expect(await screen.findByTestId('toast')).toHaveTextContent('Removed KO from your watchlist');
  });

  it('rolls back the optimistic removal on a server error', async () => {
    let n = 0;
    installFetch((path, init) => {
      if (path === '/v1/watchlist' && (init.method ?? 'GET') === 'GET')
        return { items: [{ symbol: 'KO', name: 'Coca-Cola', sector: 'Consumer Staples', quote: null }] };
      if (path === '/v1/watchlist/KO' && init.method === 'DELETE') {
        n++;
        return new Response(JSON.stringify({ code: 'forbidden', message: 'no', trace_id: 't' }), {
          status: 403,
        });
      }
      if (path === '/v1/universe') return universe;
      return undefined;
    });
    renderApp('/watchlist');
    await userEvent.click(await screen.findByTestId('wl-remove-KO'));
    await waitFor(() => expect(n).toBe(1));
    expect(await screen.findByTestId('wl-row-KO')).toBeInTheDocument();
    expect(await screen.findByTestId('toast')).toHaveTextContent('Could not remove KO');
  });

  it('disables adding at 20 tickers', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      symbol: `T${i}`,
      name: `Co ${i}`,
      sector: 'Technology',
      quote: null,
    }));
    setup({ '/v1/watchlist': { items } });
    renderApp('/watchlist');
    expect(await screen.findByTestId('wl-full')).toHaveTextContent('Your watchlist is full');
    expect(screen.getByTestId('wl-add')).toBeDisabled();
    expect(screen.getByTestId('wl-search')).toBeDisabled();
  });

  it('shows a loading skeleton, then the empty state', async () => {
    const { fn } = setup({ '/v1/watchlist': { items: [] } });
    const real = fn.getMockImplementation()!;
    fn.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (new URL(String(input)).pathname === '/v1/watchlist') await new Promise(r => setTimeout(r, 200));
      return real(input, init);
    });
    renderApp('/watchlist');
    expect(await screen.findByRole('status', { name: 'Loading your watchlist' })).toBeInTheDocument();
    expect(await screen.findByTestId('wl-empty')).toHaveTextContent(
      'Your watchlist is empty. Add a ticker above to generate a brief.',
    );
  });

  it('shows an error panel with retry when the watchlist cannot be loaded', async () => {
    let fail = true;
    installFetch(path => {
      if (path === '/v1/watchlist')
        return fail
          ? new Response(JSON.stringify({ code: 'forbidden', message: 'x', trace_id: 'tr-7' }), {
              status: 403,
            })
          : { items: [] };
      if (path === '/v1/universe') return universe;
      return undefined;
    });
    renderApp('/watchlist');
    const err = await screen.findByTestId('error-panel');
    expect(err).toHaveTextContent('Could not load your watchlist');
    expect(err).toHaveTextContent('Reference: tr-7');
    fail = false;
    await userEvent.click(within(err).getByText('Try again'));
    expect(await screen.findByTestId('wl-empty')).toBeInTheDocument();
  });

  it('Brief and Trade buttons navigate', async () => {
    setup();
    const { router } = renderApp('/watchlist');
    await userEvent.click(await screen.findByTestId('wl-brief-KO'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/brief/KO'));
    await router.navigate('/watchlist');
    await userEvent.click(await screen.findByTestId('wl-trade-JNJ'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/trading'));
    expect(router.state.location.state).toEqual({ symbol: 'JNJ', side: 'buy' });
  });

  it('has no axe violations (table and combobox open)', async () => {
    setup();
    const { container } = renderApp('/watchlist');
    await screen.findByTestId('wl-row-AAPL');
    await userEvent.click(screen.getByTestId('wl-search'));
    await screen.findByTestId('wl-options');
    expect(await axe(container)).toHaveNoViolations();
  });
});
