import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { __resetSession } from '@/auth/session';
import { installFetch, renderApp, type MockRoute } from '@/test/renderApp';

afterEach(() => {
  __resetSession();
  vi.unstubAllGlobals();
});

const alert = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  type: 'filing',
  symbol: 'AAPL',
  critical: false,
  materiality: 0.82,
  title: `Title ${id}`,
  body: `Body ${id}`,
  source_label: 'SEC EDGAR 8-K',
  state: 'new',
  created_at: new Date(Date.now() - 3_600_000).toISOString(),
  ...over,
});

const LIST = [
  alert('a1'),
  alert('a2', { type: 'breach', symbol: null, critical: true, title: 'Position cap exceeded' }),
  alert('a3', { type: 'move', symbol: 'NVDA', state: 'opened' }),
  alert('a4', { type: 'mirror', symbol: null }),
  alert('a5', { state: 'dismissed' }),
  alert('a6', { state: 'snoozed', type: 'earnings' }),
];

const base =
  (items: unknown[] = LIST): MockRoute =>
  (path, init) => {
    if (path === '/v1/alerts') return { items, next_cursor: null };
    const m = /^\/v1\/alerts\/(.+)\/action$/.exec(path);
    if (m && init.method === 'POST') return alert(m[1] ?? '', { state: 'opened' });
    return undefined;
  };

const open = async (h: MockRoute = base()) => {
  const f = installFetch(h);
  renderApp('/alerts');
  await screen.findByTestId('screen-alerts');
  return f;
};
const actionCalls = (f: ReturnType<typeof installFetch>) =>
  f.fn.mock.calls
    .filter(([u, i]) => /\/action$/.test(new URL(String(u)).pathname) && (i as RequestInit).method === 'POST')
    .map(([u, i]) => ({
      path: new URL(String(u)).pathname,
      body: JSON.parse(String((i as RequestInit).body)),
    }));

describe('alerts', () => {
  it('lists live alerts (pinned first) with counts, materiality and sources', async () => {
    await open();
    const list = await screen.findByTestId('alerts-list');
    const cards = within(list).getAllByRole('article');
    expect(cards).toHaveLength(4);
    expect(cards[0]).toHaveTextContent('Position cap exceeded');
    expect(within(cards[0]!).getByTestId('alert-pinned')).toBeInTheDocument();
    expect(within(cards[0]!).getByTestId('alert-materiality')).toHaveTextContent('0.82');
    expect(cards[0]).toHaveTextContent('Source: SEC EDGAR 8-K');
    expect(screen.getByRole('radio', { name: 'All (4)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Archived (2)' })).toBeInTheDocument();
  });

  it('pinned alerts cannot be dismissed or snoozed', async () => {
    await open();
    await screen.findByTestId('alert-a2');
    expect(screen.queryByTestId('alert-dismiss-a2')).toBeNull();
    expect(screen.queryByTestId('alert-snooze-a2')).toBeNull();
    expect(screen.getByTestId('alert-open-a2')).toBeInTheDocument();
  });

  it('filters by type and shows the archived view', async () => {
    await open();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('radio', { name: 'Moves' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    await user.click(screen.getByRole('radio', { name: 'Archived (2)' }));
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByTestId('alert-dismiss-a5')).toBeNull();
    await user.click(screen.getByRole('radio', { name: 'Earnings' }));
    expect(screen.getByTestId('alerts-empty')).toHaveTextContent('No alerts in this view.');
  });

  it('Dismiss and Snooze POST the action and toast', async () => {
    const f = await open();
    const user = userEvent.setup();
    await user.click(await screen.findByTestId('alert-dismiss-a1'));
    await waitFor(() =>
      expect(actionCalls(f)).toContainEqual({ path: '/v1/alerts/a1/action', body: { action: 'dismiss' } }),
    );
    expect(await screen.findByTestId('toast')).toHaveTextContent('Dismissed. 8-K filing alerts rank lower.');
    await user.click(await screen.findByTestId('alert-snooze-a3'));
    await waitFor(() =>
      expect(actionCalls(f)).toContainEqual({ path: '/v1/alerts/a3/action', body: { action: 'snooze' } }),
    );
  });

  it('Open marks it read and goes to the related screen', async () => {
    const f = await open();
    await userEvent.click(await screen.findByTestId('alert-open-a2'));
    await waitFor(() =>
      expect(actionCalls(f)).toContainEqual({ path: '/v1/alerts/a2/action', body: { action: 'open' } }),
    );
    await waitFor(() => expect(screen.queryByTestId('screen-alerts')).toBeNull());
  });

  it('renders alert text as plain text, never HTML', async () => {
    await open(
      base([alert('x', { title: '<img src=x onerror=alert(1)>', body: '<script>boom()</script>' })]),
    );
    const card = await screen.findByTestId('alert-x');
    expect(card).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(card.querySelector('img, script')).toBeNull();
  });

  it('shows the why disclosure when the API provides it', async () => {
    await open(
      base([
        alert('w', {
          why: {
            summary: 'Matches your Technology interest',
            top_features: [],
            rules_checked: [{ rule: 'pos', passed: true }],
            sources: [],
            basis: 'profile',
          },
        }),
      ]),
    );
    expect(await screen.findByText('Why am I seeing this?')).toBeInTheDocument();
    expect(screen.getByText('Matches your Technology interest')).toBeInTheDocument();
  });

  it('shows an error panel with retry on 5xx and an empty state', async () => {
    installFetch(path =>
      path === '/v1/alerts'
        ? new Response(JSON.stringify({ code: 'internal', message: 'x', trace_id: 't' }), { status: 500 })
        : undefined,
    );
    renderApp('/alerts');
    expect(await screen.findByText('Could not load your alerts', {}, { timeout: 6000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again|retry/i })).toBeInTheDocument();
  }, 10000);

  it('empty list', async () => {
    await open(base([]));
    expect(await screen.findByTestId('alerts-empty')).toBeInTheDocument();
  });

  it('a failed action surfaces the error and keeps the card', async () => {
    await open((path, init) =>
      /\/action$/.test(path)
        ? new Response(JSON.stringify({ code: 'internal', message: 'x', trace_id: 't' }), { status: 500 })
        : base()(path, init),
    );
    await userEvent.click(await screen.findByTestId('alert-dismiss-a1'));
    expect(await screen.findByTestId('toast')).toHaveTextContent(/went wrong|try again/i);
    expect(screen.getByTestId('alert-a1')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    await open();
    await screen.findByTestId('alerts-list');
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
