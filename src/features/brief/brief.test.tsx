import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { __resetSession } from '@/auth/session';
import { installFetch, renderApp, type MockRoute } from '@/test/renderApp';
import { resetSystemStatus } from '@/shell/systemStatus';
import { brief, citation, jnjPosition, portfolio, quote, risk } from './brief.fixtures';

const err = (status: number, code: string, message = 'x') =>
  new Response(JSON.stringify({ code, message, trace_id: 'tr-1' }), { status });

type Opts = { brief?: unknown; citations?: Record<string, unknown>; extra?: MockRoute };
const api =
  (o: Opts = {}): MockRoute =>
  (path, init) => {
    const custom = o.extra?.(path, init);
    if (custom !== undefined) return custom;
    if (path === '/v1/briefs/JNJ') return o.brief ?? brief();
    if (path.startsWith('/v1/citations/')) {
      const id = path.split('/').pop() ?? '';
      return o.citations?.[id] ?? citation({ id });
    }
    if (path === '/v1/watchlist')
      return {
        items: [
          { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', quote: null },
          { symbol: 'KO', name: 'Coca-Cola', sector: 'Consumer', quote: null },
        ],
      };
    if (path === '/v1/quotes') return { items: [quote] };
    if (path === '/v1/portfolio') return portfolio([jnjPosition]);
    if (path === '/v1/portfolio/risk') return risk;
    if (path.startsWith('/v1/why/'))
      return {
        summary: 'Sections follow your income goal.',
        top_features: [{ name: 'goal', weight: 0.6, detail: 'You expand the balance sheet first.' }],
        rules_checked: [],
        sources: [],
        basis: 'profile',
      };
    return undefined;
  };

const open = async (o: Opts = {}, path = '/brief/JNJ') => {
  const f = installFetch(api(o));
  renderApp(path);
  await screen.findByTestId('brief-sections');
  return f;
};

/** events the tracker sent, by forcing the unload flush */
const events = (fn: ReturnType<typeof installFetch>['fn']) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  return fn.mock.calls
    .filter(([u]) => String(u).endsWith('/v1/events'))
    .flatMap(
      ([, init]) =>
        (
          JSON.parse(String((init as RequestInit).body)) as {
            events: Array<{ type: string; entity: Record<string, string>; props: Record<string, unknown> }>;
          }
        ).events,
    );
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetSystemStatus();
});
afterEach(() => {
  vi.restoreAllMocks();
  __resetSession();
  vi.unstubAllGlobals();
  resetSystemStatus();
});

describe('brief viewer (FE-06)', () => {
  it('renders sections in the API section_order, with plain hints, verified badge and quote', async () => {
    await open();
    const titles = within(screen.getByTestId('brief-sections'))
      .getAllByRole('heading', { level: 3 })
      .map(h => h.textContent);
    expect(titles).toEqual(['Balance sheet & dividend', 'Risks', 'Trend & growth', 'Bull / Bear']);
    expect(screen.getAllByTestId('plain-hint')).toHaveLength(2);
    expect(screen.getByTestId('verified-badge')).toHaveTextContent('All numbers verified against XBRL');
    expect(screen.getByTestId('brief-quote')).toHaveTextContent('$152.40');
    expect(screen.getByTestId('brief-meta')).toHaveTextContent('prices delayed');
    expect(screen.getByTestId('bull-text')).toHaveTextContent('Defensive demand');
    expect(screen.getByTestId('bear-text')).toHaveTextContent('Talc litigation');
    expect(screen.getByTestId('brief-disclaimer')).toHaveTextContent('API disclaimer text for the brief.');
  });

  it('numbers footnotes in reading order and pins the style card metric', async () => {
    await open();
    // reading order: bal(c2) -> risk(c3) -> trend(c1) ; so c2=[1], c3=[2], c1=[3]
    expect(within(screen.getByTestId('section-bal')).getByTestId('cite-1')).toBeInTheDocument();
    expect(within(screen.getByTestId('section-risk')).getByTestId('cite-2')).toBeInTheDocument();
    expect(screen.getByTestId('tile-m3')).toHaveTextContent('PINNED');
    expect(screen.getByTestId('tile-m1')).not.toHaveTextContent('PINNED');
  });

  it('opens the citation drawer with document, accession, hash, excerpt and XBRL rows; Esc closes it', async () => {
    const user = userEvent.setup();
    const { calls } = await open();
    await user.click(within(screen.getByTestId('section-bal')).getByTestId('cite-1'));
    const drawer = await screen.findByTestId('citation-drawer');
    expect(await within(drawer).findByTestId('citation-accession')).toHaveTextContent('0000200406-26-000012');
    expect(within(drawer).getByTestId('citation-hash')).toHaveTextContent('sha256:9f2c61ab7740');
    expect(within(drawer).getByTestId('citation-excerpt')).toHaveTextContent(
      'highest level in company history',
    );
    expect(within(drawer).getByTestId('citation-rows')).toHaveTextContent('Revenue, latest fiscal year');
    expect(within(drawer).getByTestId('citation-rows')).toHaveTextContent('$88.8B');
    expect(within(drawer).getByTestId('citation-open')).toHaveAttribute(
      'href',
      expect.stringContaining('sec.gov'),
    );
    expect(within(drawer).getByTestId('citation-open')).toHaveAttribute(
      'rel',
      expect.stringContaining('noopener'),
    );
    expect(calls).toContain('GET /v1/citations/c2');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('citation-drawer')).not.toBeInTheDocument());
  });

  it('opens the drawer from the section source button and from a metric tile', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByTestId('section-cite-trend'));
    expect(await screen.findByTestId('citation-drawer')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close source' }));
    await waitFor(() => expect(screen.queryByTestId('citation-drawer')).not.toBeInTheDocument());
    await user.click(screen.getByTestId('tile-m1')); // revenue -> claim in trend cites c1
    expect(await screen.findByTestId('citation-drawer')).toBeInTheDocument();
    expect(await screen.findByTestId('citation-accession')).toBeInTheDocument();
  });

  it('shows a ledger-only drawer for a tile whose number has no cited claim', async () => {
    const user = userEvent.setup();
    const b = brief();
    b.ledger.m9 = {
      label: 'Free cash flow',
      value: 19,
      display: '$19B',
      unit: 'USD',
      source: 'code: CFO - capex',
    };
    await open({ brief: b });
    await user.click(screen.getByTestId('tile-m9'));
    const drawer = await screen.findByTestId('citation-drawer');
    expect(within(drawer).getByText('Free cash flow', { selector: 'h2' })).toBeInTheDocument();
    expect(within(drawer).getByTestId('citation-rows')).toHaveTextContent('$19B');
  });

  it('shows an error with retry when a citation fails to load', async () => {
    const user = userEvent.setup();
    await open({ citations: { c2: err(500, 'internal') as unknown as object } });
    await user.click(within(screen.getByTestId('section-bal')).getByTestId('cite-1'));
    expect(
      await within(await screen.findByTestId('citation-drawer')).findByTestId('error-panel', undefined, {
        timeout: 6000,
      }),
    ).toBeInTheDocument();
  }, 12000);

  it('never renders an unsafe source URL as a link and never injects claim HTML', async () => {
    const user = userEvent.setup();
    const b = brief();
    b.sections[1]!.claims[0]!.text = '<img src=x onerror="alert(1)"> Revenue grew.';
    await open({
      brief: b,
      citations: { c2: citation({ id: 'c2', url: 'javascript:alert(1)', excerpt: '<b>bold</b>' }) },
    });
    const claim = within(screen.getByTestId('section-bal')).getByTestId('claim');
    expect(claim.querySelector('img')).toBeNull();
    expect(claim).toHaveTextContent('<img src=x onerror="alert(1)"> Revenue grew.');
    await user.click(within(screen.getByTestId('section-bal')).getByTestId('cite-1'));
    const drawer = await screen.findByTestId('citation-drawer');
    await within(drawer).findByTestId('citation-excerpt');
    expect(within(drawer).queryByTestId('citation-open')).toBeNull();
    expect(drawer.querySelector('b')).toBeNull();
  });

  it('shows the unverified badge only when the API reports unverified numbers', async () => {
    await open({ brief: brief({ citations_summary: { coverage_pct: 90, unverified_numbers: 2 } }) });
    expect(screen.queryByTestId('verified-badge')).toBeNull();
    expect(screen.getByTestId('unverified-badge')).toHaveTextContent('2 numbers not verified');
  });

  it('degraded and stale banners; refresh posts generate and swaps in the new brief', async () => {
    const user = userEvent.setup();
    let generated = false;
    const f = await open({
      brief: brief({ status: 'degraded', stale: true, stale_reason: 'A 10-Q was filed after this brief.' }),
      extra: (path, init) => {
        if (path === '/v1/briefs/JNJ/generate' && init.method === 'POST') {
          generated = true;
          return brief({ id: 'b2', name: 'Johnson & Johnson (fresh)' });
        }
        if (path === '/v1/briefs/JNJ' && generated)
          return brief({ id: 'b2', name: 'Johnson & Johnson (fresh)' });
        return undefined;
      },
    });
    expect(screen.getByTestId('brief-degraded')).toBeInTheDocument();
    expect(screen.getByTestId('brief-stale')).toHaveTextContent('A 10-Q was filed after this brief.');
    expect(await screen.findByTestId('banner-llm')).toBeInTheDocument(); // shell flag raised by the screen
    await user.click(screen.getByTestId('brief-refresh'));
    expect(await screen.findByText('Johnson & Johnson (fresh)')).toBeInTheDocument();
    expect(f.calls).toContain('POST /v1/briefs/JNJ/generate');
    expect(screen.queryByTestId('brief-degraded')).toBeNull();
    expect(screen.queryByTestId('brief-stale')).toBeNull();
    await waitFor(() => expect(screen.queryByTestId('banner-llm')).toBeNull());
  });

  it('404 -> offers Generate, shows the reading state while generating, then the brief', async () => {
    const user = userEvent.setup();
    let release: (b: unknown) => void = () => {};
    const pending = new Promise<unknown>(r => (release = r));
    let have = false;
    installFetch((path, init) => {
      if (path === '/v1/briefs/JNJ' && init.method !== 'POST') return have ? brief() : err(404, 'not_found');
      if (path === '/v1/briefs/JNJ/generate') return undefined;
      return api()(path, init);
    });
    // generate: a never-resolving response until released
    const base = globalThis.fetch;
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).endsWith('/v1/briefs/JNJ/generate')
        ? pending.then(b => new Response(JSON.stringify(b), { status: 200, headers: { 'X-Trace-Id': 'tr' } }))
        : base(input, init),
    );
    renderApp('/brief/JNJ');
    expect(await screen.findByTestId('brief-empty')).toHaveTextContent('No brief for JNJ yet');
    await user.click(screen.getByTestId('brief-generate'));
    expect(await screen.findByTestId('brief-generating')).toHaveTextContent('PILOT IS READING JNJ');
    have = true;
    await act(async () => release(brief()));
    expect(await screen.findByTestId('brief-sections')).toBeInTheDocument();
    expect(screen.queryByTestId('brief-generating')).toBeNull();
  });

  it('shows a retryable error when generation fails (503) and keeps the page usable', async () => {
    const user = userEvent.setup();
    installFetch((path, init) => {
      if (path === '/v1/briefs/JNJ' && init.method !== 'POST') return err(404, 'not_found');
      if (path === '/v1/briefs/JNJ/generate') return err(503, 'upstream_unavailable');
      return api()(path, init);
    });
    renderApp('/brief/JNJ');
    await user.click(await screen.findByTestId('brief-generate'));
    expect(await screen.findByText('Could not generate the brief')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows an error panel with retry when the brief request fails (500)', async () => {
    installFetch((path, init) => (path === '/v1/briefs/JNJ' ? err(500, 'internal') : api()(path, init)));
    renderApp('/brief/JNJ');
    expect(await screen.findByTestId('error-panel', undefined, { timeout: 6000 })).toBeInTheDocument();
  }, 12000);

  it('shows the offline state when the network is down', async () => {
    installFetch((path, init) => {
      if (path === '/v1/briefs/JNJ') throw new TypeError('Failed to fetch');
      return api()(path, init);
    });
    renderApp('/brief/JNJ');
    expect(await screen.findByTestId('error-panel', undefined, { timeout: 4000 })).toHaveTextContent(
      /reach StockPilot|Check your connection/,
    );
  });

  it('depth control: TL;DR collapses to the first claim and hides hints, Deep shows the source ledger', async () => {
    const user = userEvent.setup();
    await open();
    const trend = screen.getByTestId('section-trend');
    expect(within(trend).getAllByTestId('claim')).toHaveLength(2);
    expect(screen.queryByTestId('brief-ledger')).toBeNull();
    await user.click(screen.getByRole('radio', { name: 'TL;DR' }));
    expect(within(trend).getAllByTestId('claim')).toHaveLength(1);
    expect(screen.queryAllByTestId('plain-hint')).toHaveLength(0);
    await user.click(within(trend).getByTestId('section-toggle-trend'));
    expect(within(trend).getAllByTestId('claim')).toHaveLength(2);
    await user.click(screen.getByRole('radio', { name: 'Deep' }));
    const ledger = screen.getByTestId('brief-ledger');
    expect(within(ledger).getByText('$88.8B')).toBeInTheDocument();
    expect(screen.getByTestId('section-rows-trend')).toHaveTextContent('+4.3%');
  });

  it('shows the position against the cap and the personalisation reasons', async () => {
    await open();
    expect(await screen.findByTestId('brief-position-status')).toHaveTextContent('Within your cap');
    expect(screen.getByTestId('brief-position')).toHaveTextContent(
      'You hold 62 shares worth $9,449, 9.4% of your portfolio',
    );
    expect(screen.getByTestId('brief-position')).toHaveTextContent('maximum position is 10%');
    expect(await screen.findByText('You expand the balance sheet first.')).toBeInTheDocument();
  });

  it('opens the order ticket for the ticker and toggles the watchlist', async () => {
    const user = userEvent.setup();
    let removed = false;
    const f = await open({
      extra: (path, init) => {
        if (path === '/v1/watchlist/JNJ' && init.method === 'DELETE') {
          removed = true;
          return {};
        }
        if (path === '/v1/watchlist' && removed) return { items: [{ symbol: 'KO', quote: null }] };
        return undefined;
      },
    });
    expect(screen.getByTestId('brief-toggle-watch')).toHaveTextContent('Remove from watchlist');
    await user.click(screen.getByTestId('brief-toggle-watch'));
    await waitFor(() => expect(f.calls).toContain('DELETE /v1/watchlist/JNJ'));
    expect(await screen.findByText('Add to watchlist')).toBeInTheDocument();
    await user.click(screen.getByTestId('brief-open-ticket'));
    expect(await screen.findByTestId('screen-trading')).toBeInTheDocument();
  });

  it('switches ticker from the watchlist chips', async () => {
    const user = userEvent.setup();
    await open({
      extra: path => (path === '/v1/briefs/KO' ? brief({ symbol: 'KO', name: 'Coca-Cola' }) : undefined),
    });
    await user.click(screen.getByTestId('brief-chip-KO'));
    expect(await screen.findByText('Coca-Cola', { selector: 'h2' })).toBeInTheDocument();
  });

  it('/brief with no symbol reopens the last viewed ticker', async () => {
    installFetch(api());
    const first = renderApp('/brief/JNJ');
    await screen.findByTestId('brief-sections');
    first.unmount();
    const { router } = renderApp('/brief');
    await screen.findByTestId('brief-sections');
    expect(router.state.location.pathname).toBe('/brief/JNJ');
  });

  it('records ticker_viewed, brief_opened, section_expanded, thumbs and metric_clicked telemetry', async () => {
    const user = userEvent.setup();
    const f = await open();
    await user.click(screen.getByTestId('thumb-up-bal'));
    await user.click(screen.getByTestId('thumb-down-risk'));
    await user.click(screen.getByTestId('thumb-down-risk')); // same value again: not re-emitted
    expect(screen.getByTestId('thumb-up-bal')).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('radio', { name: 'TL;DR' }));
    await user.click(screen.getByTestId('section-toggle-trend'));
    await user.click(screen.getByTestId('tile-m1'));
    const ev = events(f.fn);
    const types = ev.map(e => e.type);
    expect(types).toContain('ticker_viewed');
    expect(types).toContain('brief_opened');
    expect(ev.find(e => e.type === 'thumbs_up')?.entity).toMatchObject({ ticker: 'JNJ', section: 'bal' });
    expect(types.filter(t => t === 'thumbs_down')).toHaveLength(1);
    expect(ev.find(e => e.type === 'section_expanded')?.entity).toMatchObject({
      ticker: 'JNJ',
      section: 'trend',
    });
    expect(ev.find(e => e.type === 'metric_clicked')?.entity).toMatchObject({
      ticker: 'JNJ',
      metric: 'Revenue',
    });
  });

  it('records section_dwell when a section was read for over a second', async () => {
    const f = await open();
    await new Promise(r => setTimeout(r, 1150));
    // leave the page: the section unmounts and emits dwell
    document.querySelector<HTMLAnchorElement>('[data-testid="nav-portfolio"]')?.click();
    await screen.findByTestId('screen-portfolio');
    const ev = events(f.fn);
    expect(ev.some(e => e.type === 'section_dwell' && e.entity.ticker === 'JNJ')).toBe(true);
  });

  it('has no axe violations (default and with the drawer open)', async () => {
    const user = userEvent.setup();
    await open();
    expect(
      await axe(document.body, { rules: { 'color-contrast': { enabled: false } } }),
    ).toHaveNoViolations();
    await user.click(screen.getByTestId('section-cite-trend'));
    await screen.findByTestId('citation-accession');
    expect(
      await axe(document.body, { rules: { 'color-contrast': { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
