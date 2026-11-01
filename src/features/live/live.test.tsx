import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { __resetSession } from '@/auth/session';
import { installFetch, renderApp, type MockRoute } from '@/test/renderApp';

const chartApi = vi.hoisted(() => {
  const candles = { setData: vi.fn(), update: vi.fn(), applyOptions: vi.fn() };
  const volume = { setData: vi.fn(), update: vi.fn() };
  const chart = {
    addCandlestickSeries: vi.fn(() => candles),
    addHistogramSeries: vi.fn(() => volume),
    priceScale: vi.fn(() => ({ applyOptions: vi.fn() })),
    timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
    applyOptions: vi.fn(),
    remove: vi.fn(),
  };
  return { candles, volume, chart, createChart: vi.fn(() => chart), fail: { on: false } };
});
vi.mock('lightweight-charts', () => ({
  ColorType: { Solid: 'solid' },
  createChart: (...a: unknown[]) => {
    if (chartApi.fail.on) throw new Error('no canvas');
    return (chartApi.createChart as (...x: unknown[]) => unknown)(...a);
  },
}));

class FakeES {
  static all: FakeES[] = [];
  readyState = 1;
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  private l = new Map<string, Array<(e: MessageEvent) => void>>();
  constructor(public url: string) {
    FakeES.all.push(this);
    setTimeout(() => this.onopen?.(new Event('open')), 0);
  }
  addEventListener(t: string, fn: (e: MessageEvent) => void) {
    this.l.set(t, [...(this.l.get(t) ?? []), fn]);
  }
  close() {
    this.readyState = 2;
  }
  emit(type: string, data: unknown) {
    this.l.get(type)?.forEach(fn => fn({ data: JSON.stringify(data), lastEventId: '' } as MessageEvent));
  }
}

const now = Math.floor(Date.now() / 1000 / 300) * 300;
const bars = Array.from({ length: 5 }, (_, i) => ({
  time: now - (4 - i) * 300,
  open: 100 + i,
  high: 102 + i,
  low: 99 + i,
  close: 101 + i,
  volume: 1000 + i,
}));
const quote = (over: Record<string, unknown> = {}) => ({
  symbol: 'AAPL',
  price: 105,
  prev_close: 100,
  change_pct: 5,
  bid: 104.98,
  ask: 105.02,
  ts: new Date().toISOString(),
  source: 'iex',
  session: 'regular',
  freshness: 'live',
  ...over,
});

type O = { open?: boolean; feed?: string; barsStatus?: number; devMissing?: boolean };
const api =
  (o: O = {}): MockRoute =>
  (path, init) => {
    if (path === '/v1/market/status')
      return { open: o.open ?? true, session: 'regular', feed_state: o.feed ?? 'live' };
    if (path === '/v1/quotes/AAPL/bars')
      return o.barsStatus
        ? new Response(JSON.stringify({ code: 'internal', message: 'x', trace_id: 't' }), {
            status: o.barsStatus,
          })
        : { symbol: 'AAPL', interval: '5m', bars, source: 'iex' };
    if (path === '/v1/quotes') return { items: [quote()] };
    if (path === '/v1/orders' && init.method === 'POST')
      return {
        order: {
          id: 'o1',
          symbol: 'AAPL',
          side: 'buy',
          type: 'market',
          qty: 10,
          status: 'filled',
          created_at: new Date().toISOString(),
        },
        fill: { price: 105.02 },
        checks: [],
        blocked: false,
      };
    if (path === '/v1/orders/preview')
      return {
        order: null,
        fill: { value: 1050 },
        checks: [{ key: 'cash', ok: true, severity: 'pass', label: 'Cash', detail: 'ok' }],
        blocked: false,
      };
    if (path.startsWith('/v1/dev/'))
      return o.devMissing
        ? new Response(JSON.stringify({ code: 'not_found', message: 'nope', trace_id: 't' }), { status: 404 })
        : { ok: true };
    if (path === '/v1/portfolio')
      return {
        portfolio_id: 'p',
        cash: 50000,
        invested: 1,
        equity: 1,
        day_change: 0,
        day_change_pct: 0,
        positions: [
          {
            symbol: 'AAPL',
            name: 'Apple',
            sector: 'Tech',
            qty: 12,
            avg_cost: 90,
            price: 105,
            change_pct: 1,
            value: 1260,
            weight_pct: 2,
            pnl: 180,
            pnl_pct: 16,
          },
        ],
        sectors: [],
        hhi: 0,
        effective_n: 0,
      };
    return undefined;
  };

beforeEach(() => {
  for (const f of [
    chartApi.candles.setData,
    chartApi.candles.update,
    chartApi.candles.applyOptions,
    chartApi.volume.setData,
    chartApi.volume.update,
    chartApi.createChart,
  ])
    f.mockClear();
  FakeES.all = [];
  chartApi.fail.on = false;
  vi.stubGlobal('EventSource', FakeES);
  vi.stubEnv('VITE_AUTH_MODE', 'dev');
});
afterEach(() => {
  __resetSession();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const open = async (o?: O) => {
  const f = installFetch(api(o));
  renderApp('/live?symbol=AAPL');
  await screen.findByTestId('screen-live');
  return f;
};
const stream = async () => {
  await waitFor(() => expect(FakeES.all.length).toBeGreaterThan(0));
  await act(async () => {
    await new Promise(r => setTimeout(r, 5));
  });
  return FakeES.all[FakeES.all.length - 1] as FakeES;
};

describe('live market', () => {
  it('loads /bars into lightweight-charts (candles + volume) and shows the price header', async () => {
    await open();
    await waitFor(() => expect(chartApi.candles.setData).toHaveBeenCalled());
    await waitFor(() =>
      expect((chartApi.candles.setData.mock.calls.at(-1)?.[0] as unknown[]).length).toBe(5),
    );
    const data = chartApi.candles.setData.mock.calls.at(-1)?.[0] as Array<{ time: number }>;
    expect(data).toHaveLength(5);
    expect(chartApi.volume.setData).toHaveBeenCalled();
    expect(await screen.findByTestId('live-price')).toHaveTextContent('$105.00');
    expect(screen.getByTestId('live-change')).toHaveTextContent('(+5.00%)');
    expect(screen.getByTestId('live-quote')).toHaveTextContent('0.04');
  });

  it('updates the last candle and the tape from an SSE quote tick', async () => {
    await open();
    await waitFor(() => expect(chartApi.candles.setData).toHaveBeenCalled());
    const es = await stream();
    chartApi.candles.update.mockClear();
    await act(async () => es.emit('quote', quote({ price: 130, ts: new Date().toISOString() })));
    await waitFor(() => expect(chartApi.candles.update).toHaveBeenCalled());
    const last = chartApi.candles.update.mock.calls.at(-1)?.[0] as { close: number; high: number };
    expect(last.close).toBe(130);
    expect(last.high).toBeGreaterThanOrEqual(130);
    expect(screen.getAllByTestId('tape-row')[0]).toHaveTextContent('130.00');
    expect(screen.getByTestId('live-price')).toHaveTextContent('$130.00');
  });

  it('freezes the chart with a message when the market is closed or the feed is stale', async () => {
    await open({ open: false });
    expect(await screen.findByTestId('live-frozen')).toHaveTextContent('Closed · last close');
  });

  it('does not apply ticks while the feed is stale', async () => {
    await open({ feed: 'stale' });
    expect(await screen.findByTestId('live-frozen')).toHaveTextContent('Stale · updates paused');
    await waitFor(() => expect(chartApi.candles.setData).toHaveBeenCalled());
    const es = await stream();
    chartApi.candles.update.mockClear();
    await act(async () => es.emit('quote', quote({ price: 140 })));
    expect(chartApi.candles.update).not.toHaveBeenCalled();
    expect(screen.queryAllByTestId('tape-row')).toHaveLength(0);
  });

  it('falls back to the data table when the chart library cannot start', async () => {
    chartApi.fail.on = true;
    await open();
    expect(await screen.findByTestId('live-chart-fail')).toHaveTextContent('Chart could not load');
    const table = await screen.findByTestId('live-table');
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(1);
  });

  it('shows a retryable error when /bars fails', async () => {
    await open({ barsStatus: 500 });
    expect(await screen.findByText('Chart data could not load', {}, { timeout: 6000 })).toBeInTheDocument();
  }, 10000);

  it('shows the position and simulate controls (dev) that call the dev endpoints', async () => {
    const { fn } = await open();
    expect(await screen.findByTestId('live-position')).toHaveTextContent('12');
    const sim = await screen.findByTestId('simulate-panel');
    await userEvent.click(within(sim).getByTestId('sim-market'));
    await waitFor(() =>
      expect(fn.mock.calls.some(([u]) => new URL(String(u)).pathname === '/v1/dev/market')).toBe(true),
    );
    await userEvent.click(within(sim).getByRole('radio', { name: 'Stale' }));
    await waitFor(() =>
      expect(fn.mock.calls.some(([u]) => new URL(String(u)).pathname === '/v1/dev/feed')).toBe(true),
    );
  });

  it('hides the simulate panel when the dev endpoints do not exist (404)', async () => {
    await open({ devMissing: true });
    const sim = await screen.findByTestId('simulate-panel');
    await userEvent.click(within(sim).getByTestId('sim-market'));
    await waitFor(() => expect(screen.queryByTestId('simulate-panel')).toBeNull());
  });

  it('quick ticket: one POST per double click', async () => {
    const f = await open();
    const buy = await screen.findByTestId('live-buy');
    await waitFor(() => expect(buy).toBeEnabled());
    f.fn.mockClear();
    await userEvent.dblClick(buy);
    await waitFor(() =>
      expect(
        f.fn.mock.calls.some(
          ([u, i]) => new URL(String(u)).pathname === '/v1/orders' && (i as RequestInit)?.method === 'POST',
        ),
      ).toBe(true),
    );
    const posts = f.fn.mock.calls.filter(
      ([u, i]) => new URL(String(u)).pathname === '/v1/orders' && (i as RequestInit)?.method === 'POST',
    );
    expect(posts).toHaveLength(1);
  });

  it('has no axe violations', async () => {
    await open();
    await screen.findByTestId('live-position');
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
