import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { __resetSession } from '@/auth/session';
import { installFetch, renderApp, type MockRoute } from '@/test/renderApp';
import { waterfall } from './TracesTab';

afterEach(() => {
  __resetSession();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const T1 = {
  id: 'tr-8f3a1c22-0000',
  name: 'Brief: AAPL',
  model: 'muse-spark-1.3',
  mode: 'Standard',
  duration_ms: 4200,
  tokens_in: 3100,
  tokens_out: 900,
  cost_usd: 0.0421,
  outcome: 'ok',
  steps: [
    { name: 'Fetch 10-K', ms: 300, outcome: 'ok', detail: '42 chunks' },
    { name: 'Output guard', ms: 100, outcome: 'blocked', detail: 'guarantee phrase removed' },
  ],
};
const T2 = {
  id: 'tr-b1',
  name: 'Chat: advice refused',
  model: 'n/a',
  mode: 'Guard only',
  duration_ms: 90,
  tokens_in: 0,
  tokens_out: 0,
  cost_usd: 0,
  outcome: 'blocked',
  steps: [],
};
const EVALS = {
  generated_at: '2026-10-31T12:00:00Z',
  thresholds_met: false,
  items: [
    {
      id: 'T-SEC-02',
      description: 'Guarantee phrases blocked',
      target: '100%',
      actual: '100%',
      status: 'pass',
    },
    { id: 'T-NUM-01', description: 'Numeric grounding', target: '>= 99%', actual: '97.1%', status: 'fail' },
  ],
};

type O = { traces?: unknown; evals?: unknown };
const err = (status: number) =>
  new Response(
    JSON.stringify({ code: status === 404 ? 'not_found' : 'internal', message: 'x', trace_id: 't' }),
    { status },
  );
const api =
  (o: O = {}): MockRoute =>
  path => {
    if (path === '/v1/audit/traces') return o.traces ?? { items: [T1, T2], next_cursor: null };
    if (path === '/v1/audit/traces/tr-8f3a1c22-0000') return T1;
    if (path === '/v1/audit/traces/tr-b1') return T2;
    if (path === '/v1/evals/latest') return o.evals ?? EVALS;
    return undefined;
  };
const open = async (path = '/audit', o?: O) => {
  const f = installFetch(api(o));
  renderApp(path);
  await screen.findByTestId('screen-audit');
  return f;
};

describe('audit traces', () => {
  it('lists traces and shows the selected trace detail with a step waterfall', async () => {
    await open();
    const detail = await screen.findByTestId('trace-detail');
    expect(detail).toHaveTextContent('Brief: AAPL');
    expect(within(detail).getByTestId('trace-latency')).toHaveTextContent('4.20 s');
    expect(within(detail).getByTestId('trace-tokens')).toHaveTextContent('3,100 in / 900 out · $0.042');
    const steps = within(detail).getAllByTestId('trace-step');
    expect(steps).toHaveLength(2);
    expect(steps[1]).toHaveTextContent('Blocked: guarantee phrase removed');
    await userEvent.click(screen.getByTestId('trace-tr-b1'));
    await waitFor(() => expect(screen.getByTestId('trace-detail')).toHaveTextContent('Chat: advice refused'));
    expect(screen.getByTestId('trace-tokens')).toHaveTextContent('none · $0.000');
  });

  it('waterfall offsets are cumulative', () => {
    const g = waterfall(T1.steps);
    expect(g[0]).toMatchObject({ left: 0 });
    expect(g[1]!.left).toBeCloseTo(75);
  });

  it('empty, unavailable (404) and error states', async () => {
    await open('/audit', { traces: { items: [], next_cursor: null } });
    expect(await screen.findByTestId('traces-empty')).toBeInTheDocument();
  });

  it('404 means "not available yet"', async () => {
    installFetch(path => (path === '/v1/audit/traces' ? err(404) : undefined));
    renderApp('/audit');
    expect(await screen.findByTestId('traces-unavailable')).toBeInTheDocument();
  });

  it('5xx shows an error panel', async () => {
    installFetch(path => (path === '/v1/audit/traces' ? err(500) : undefined));
    renderApp('/audit');
    expect(await screen.findByText('Could not load traces', {}, { timeout: 6000 })).toBeInTheDocument();
  }, 10000);

  it('has no axe violations', async () => {
    await open();
    await screen.findByTestId('trace-detail');
    expect(await axe(document.body)).toHaveNoViolations();
  });
});

describe('eval scoreboard', () => {
  it('shows real pass and fail rows from the API', async () => {
    await open('/audit?tab=evals');
    const ev = await screen.findByTestId('evals');
    expect(within(screen.getByTestId('eval-T-SEC-02')).getByText('Pass')).toBeInTheDocument();
    expect(within(screen.getByTestId('eval-T-NUM-01')).getByText('Fail')).toBeInTheDocument();
    expect(screen.getByTestId('eval-T-NUM-01')).toHaveTextContent('97.1%');
    expect(screen.getByTestId('evals-summary')).toHaveTextContent('1 of 2 passing · thresholds not met');
    expect(await axe(ev)).toHaveNoViolations();
  });

  it('404 → no run recorded yet', async () => {
    installFetch(path => (path === '/v1/evals/latest' ? err(404) : undefined));
    renderApp('/audit?tab=evals');
    expect(await screen.findByTestId('evals-unavailable')).toBeInTheDocument();
  });

  it('5xx → error panel', async () => {
    installFetch(path => (path === '/v1/evals/latest' ? err(500) : undefined));
    renderApp('/audit?tab=evals');
    expect(
      await screen.findByText('Could not load the eval scoreboard', {}, { timeout: 6000 }),
    ).toBeInTheDocument();
  }, 10000);
});

describe('failure drills (dev only)', () => {
  it('is listed in dev auth mode and triggers/clears the model drill', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'dev');
    await open('/audit?tab=drills');
    const btn = await screen.findByTestId('drill-llm');
    expect(btn).toHaveTextContent('Trigger');
    await userEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('drill-llm')).toHaveTextContent('Clear'));
    await userEvent.click(screen.getByTestId('drills-clear'));
    await waitFor(() => expect(screen.getByTestId('drill-llm')).toHaveTextContent('Trigger'));
  });
});
