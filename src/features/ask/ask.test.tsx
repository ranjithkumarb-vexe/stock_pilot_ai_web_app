import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { __resetSession } from '@/auth/session';
import { installFetch, renderApp, type MockRoute } from '@/test/renderApp';
import { parseBlocks } from './safeText';

afterEach(() => {
  __resetSession();
  vi.unstubAllGlobals();
});

const THREAD = '11111111-1111-4111-8111-111111111111';
const CITE = '22222222-2222-4222-8222-222222222222';

type O = {
  history?: unknown[];
  chat?: (body: Record<string, unknown>) => Response | unknown;
  historyStatus?: number;
};
const api =
  (o: O = {}): MockRoute =>
  (path, init) => {
    if (path === '/v1/chat/history')
      return o.historyStatus
        ? new Response(JSON.stringify({ code: 'internal', message: 'x', trace_id: 't' }), {
            status: o.historyStatus,
          })
        : { items: o.history ?? [] };
    if (path === '/v1/chat' && init.method === 'POST') {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      return (
        o.chat?.(body) ?? {
          id: 'm-ai',
          thread_id: THREAD,
          answer: 'Your HHI is **0.12**.',
          citations: [{ id: CITE, label: 'Risk engine' }],
          refused: false,
          refusal_reason: null,
          trace_id: 'tr1',
        }
      );
    }
    if (path === `/v1/citations/${CITE}`)
      return {
        id: CITE,
        kind: 'xbrl',
        title: 'XBRL companyfacts',
        company: 'Apple Inc.',
        doc_label: '10-K FY2025',
        accession_no: '0000320193-25-000079',
        filed_at: null,
        fetched_at: '2026-10-30T10:00:00Z',
        sha256: 'abc123',
        url: 'https://www.sec.gov/x',
        excerpt: 'Net sales',
        rows: [{ label: 'Revenue', value: '$391B', source: 'XBRL' }],
      };
    return undefined;
  };
const calls = (f: ReturnType<typeof installFetch>, p: string) =>
  f.fn.mock.calls
    .filter(([u, i]) => new URL(String(u)).pathname === p && (i as RequestInit)?.method === 'POST')
    .map(([, i]) => JSON.parse(String((i as RequestInit).body)) as Record<string, unknown>);

const open = async (o?: O, path = '/ask') => {
  const f = installFetch(api(o));
  const ctx = renderApp(path);
  await screen.findByTestId('screen-ask');
  return { f, ...ctx };
};
const send = async (text: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByTestId('ask-input'), text);
  await user.click(screen.getByTestId('ask-send'));
};

describe('ask pilot', () => {
  it('shows the greeting and suggested questions', async () => {
    await open();
    expect(await screen.findByText(/Ask about a company on your watchlist/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'What is my concentration?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'What should I buy now?' })).toBeInTheDocument();
  });

  it('typing indicator is visible while the answer is pending', async () => {
    let resolve!: (r: Response) => void;
    const pending = new Promise<Response>(r => (resolve = r));
    const { fn: orig } = installFetch(api());
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) =>
        new URL(String(input)).pathname === '/v1/chat' && init.method === 'POST'
          ? pending
          : orig(input, init),
      ),
    );
    renderApp('/ask');
    await screen.findByTestId('screen-ask');
    await send('What is my concentration?');
    expect(await screen.findByTestId('ask-typing')).toHaveTextContent('Pilot is checking sources');
    expect(screen.getByTestId('ask-send')).toBeDisabled();
    await act(async () =>
      resolve(
        new Response(
          JSON.stringify({
            id: 'm1',
            thread_id: THREAD,
            answer: 'Done.',
            citations: [],
            refused: false,
            refusal_reason: null,
            trace_id: 't',
          }),
          { status: 200 },
        ),
      ),
    );
    await waitFor(() => expect(screen.queryByTestId('ask-typing')).toBeNull());
    expect(screen.getByText('Done.')).toBeInTheDocument();
  });

  it('POSTs the message, renders markdown-lite answers and opens a citation drawer', async () => {
    const { f } = await open();
    await send('What is my concentration?');
    expect(await screen.findByText('0.12')).toBeInTheDocument();
    expect(screen.getByText('0.12').tagName).toBe('STRONG');
    expect(calls(f, '/v1/chat')[0]).toMatchObject({ message: 'What is my concentration?' });
    await userEvent.click(screen.getByRole('button', { name: 'Risk engine' }));
    const drawer = await screen.findByTestId('ask-citation');
    expect(await within(drawer).findByText('10-K FY2025')).toBeInTheDocument();
    expect(within(drawer).getByText('0000320193-25-000079')).toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: 'Open source document' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('keeps the thread id for the next message', async () => {
    const { f } = await open();
    await send('one');
    await screen.findByText('0.12');
    await send('two');
    await waitFor(() => expect(calls(f, '/v1/chat')).toHaveLength(2));
    expect(calls(f, '/v1/chat')[1]).toMatchObject({ message: 'two', thread_id: THREAD });
  });

  it('renders a refusal with the educational redirect', async () => {
    await open({
      chat: () => ({
        id: 'r1',
        thread_id: THREAD,
        answer: 'I cannot tell you what to buy.',
        citations: [],
        refused: true,
        refusal_reason: 'advice_request',
        trace_id: 't',
      }),
    });
    await send('What should I buy now?');
    const refused = await screen.findByTestId('msg-refused');
    expect(refused).toHaveTextContent('I cannot tell you what to buy.');
    expect(within(refused).getByTestId('refusal-redirect')).toHaveTextContent('decision framework');
    expect(refused).toHaveTextContent('Declined: Advice request');
  });

  it('treats a guardrail_blocked error like a refusal', async () => {
    await open({
      chat: () =>
        new Response(
          JSON.stringify({ code: 'guardrail_blocked', message: 'Blocked: return guarantee', trace_id: 'tg' }),
          { status: 422 },
        ),
    });
    await send('Guarantee me 20% returns');
    const refused = await screen.findByTestId('msg-refused');
    expect(refused).toHaveTextContent('Blocked: return guarantee');
    expect(within(refused).getByTestId('refusal-redirect')).toBeInTheDocument();
  });

  it('never renders model text as HTML', async () => {
    await open({
      chat: () => ({
        id: 'x',
        thread_id: THREAD,
        answer: '<img src=x onerror=alert(1)> and <b>bold</b>\n\n- one\n- <script>x()</script>',
        citations: [],
        refused: false,
        refusal_reason: null,
        trace_id: 't',
      }),
    });
    await send('hi');
    const t = await screen.findByTestId('safe-text', {}, { timeout: 3000 });
    await waitFor(() => expect(screen.getByText(/onerror=alert/)).toBeInTheDocument());
    const log = screen.getByTestId('ask-thread');
    expect(log.querySelector('img, script, b')).toBeNull();
    expect(t).toBeDefined();
    expect(within(log).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows a retryable error message when the model is unavailable', async () => {
    let n = 0;
    await open({
      chat: () =>
        ++n === 1
          ? new Response(JSON.stringify({ code: 'upstream_unavailable', message: 'down', trace_id: 'tu' }), {
              status: 503,
            })
          : undefined,
    });
    await send('hello');
    expect(await screen.findByText(/Service temporarily unavailable/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('0.12')).toBeInTheDocument();
  });

  it('loads earlier messages from history, once', async () => {
    const { f } = await open({
      history: [
        {
          id: 'h2',
          thread_id: THREAD,
          role: 'assistant',
          text: 'Earlier answer',
          created_at: '2026-10-30T10:00:02Z',
        },
        {
          id: 'h1',
          thread_id: THREAD,
          role: 'user',
          text: 'Earlier question',
          created_at: '2026-10-30T10:00:01Z',
        },
      ],
    });
    const log = await screen.findByTestId('ask-thread');
    await within(log).findByText('Earlier question');
    const order = within(log)
      .getAllByText(/Earlier/)
      .map(e => e.textContent);
    expect(order).toEqual(['Earlier question', 'Earlier answer']);
    await send('new');
    await screen.findByText('0.12');
    expect(calls(f, '/v1/chat')[0]).toMatchObject({ thread_id: THREAD });
    expect(within(log).getAllByText('Earlier question')).toHaveLength(1);
  });

  it('still works when history fails', async () => {
    await open({ historyStatus: 500 });
    await send('hello');
    expect(await screen.findByText('0.12', {}, { timeout: 6000 })).toBeInTheDocument();
  }, 10000);

  it('sends a question handed over from the command palette once', async () => {
    const f = installFetch(api());
    const { router } = renderApp('/dashboard');
    await screen.findByTestId('app-shell');
    await act(async () => router.navigate('/ask', { state: { ask: 'Am I breaching any rules?' } }));
    await waitFor(() => expect(calls(f, '/v1/chat')).toHaveLength(1));
    expect(calls(f, '/v1/chat')[0]).toMatchObject({ message: 'Am I breaching any rules?' });
  });

  it('has no axe violations', async () => {
    await open();
    await screen.findByText(/Ask about a company/);
    expect(await axe(document.body)).toHaveNoViolations();
  });
});

describe('safeText.parseBlocks', () => {
  it('groups paragraphs and lists', () => {
    expect(parseBlocks('a\nb\n\n- x\n- y\n\n1. one\n2. two')).toEqual([
      { kind: 'p', lines: ['a', 'b'] },
      { kind: 'ul', items: ['x', 'y'] },
      { kind: 'ol', items: ['one', 'two'] },
    ]);
  });
});
