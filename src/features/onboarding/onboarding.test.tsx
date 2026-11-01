import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { OnboardingQuestions } from '@/api/types';
import { __resetSession } from '@/auth/session';
import { DISCLAIMER_TEXT } from '@/shell/disclaimer';
import { installFetch, renderApp, type MockRoute } from '@/test/renderApp';
import { stepProblem, toBody, emptyDraft } from './draft';

const rawQuestions: Array<[string, Array<[string, number]>]> = [
  [
    'Your portfolio falls 20% in one month. What do you do?',
    [
      ['Sell everything', 1],
      ['Hold and wait', 4],
    ],
  ],
  [
    'Which one-year outcome range would you accept?',
    [
      ['+8% / -8%', 2],
      ['+25% / -30%', 5],
    ],
  ],
  [
    'How stable is your income?',
    [
      ['Variable', 1],
      ['Stable', 3],
    ],
  ],
  [
    'A stock you own rises 30% in two weeks.',
    [
      ['Sell all', 1],
      ['Hold', 3],
    ],
  ],
  [
    'One stock being 20% of your portfolio?',
    [
      ['Uncomfortable', 1],
      ['Comfortable', 5],
    ],
  ],
  [
    'Invested through a decline?',
    [
      ['No', 2],
      ['Yes, and I held', 3],
    ],
  ],
];
const questions: OnboardingQuestions = {
  questions: rawQuestions.map(([text, opts], i) => ({
    id: `q${i + 1}`,
    text,
    options: opts.map(([label, score]) => ({ label, score })),
  })),
  tiers: [1, 2, 3, 4, 5].map(t => ({ tier: t, label: `Tier ${t}` })),
  horizons: ['Under 1 year', '1-3 years', '3-10 years', '10+ years'],
  experience_levels: ['Beginner', 'Intermediate', 'Advanced'],
  sectors: ['Technology', 'Healthcare', 'Financials'],
};
const universe = {
  items: ['AAPL', 'MSFT', 'JNJ', 'KO', 'NVDA', 'XOM'].map(symbol => ({
    symbol,
    name: `${symbol} Inc.`,
    sector: symbol === 'XOM' ? 'Energy' : 'Technology',
    industry: 'x',
    exchange: 'NYSE',
  })),
};
const result = {
  profile: {},
  risk_tier: 3,
  tier_label: 'Balanced',
  explanation: 'Your answers average a balanced reaction to losses, so position limits sit at 15%.',
  rules: { pos: 15, sec: 35, dd: 15, trades: 5, cash: 5 },
  watchlist: ['AAPL', 'MSFT', 'JNJ', 'KO', 'NVDA'],
};

type Opts = { onboard?: MockRoute };
function setup(opts: Opts = {}) {
  let onboarded = false;
  const bodies: unknown[] = [];
  const api = installFetch((path, init) => {
    if (path === '/v1/me')
      return {
        user_id: 'u1',
        email: 'n@x.io',
        display_name: 'New User',
        initials: 'NU',
        persona_id: null,
        onboarded,
      };
    if (path === '/v1/onboarding/questions') return questions;
    if (path === '/v1/universe') return universe;
    if (path === '/v1/onboarding' && init.method === 'POST') {
      bodies.push(JSON.parse(String(init.body)));
      const r = opts.onboard?.(path, init);
      if (r) return r;
      onboarded = true;
      return result;
    }
    return undefined;
  });
  return { ...api, bodies };
}

afterEach(() => {
  __resetSession();
  vi.unstubAllGlobals();
});

const next = () => userEvent.click(screen.getByTestId('onboarding-next'));
async function answerAll() {
  for (let i = 1; i <= 6; i++) {
    const q = screen.getByTestId(`question-${i}`);
    await userEvent.click(within(q).getAllByRole('radio')[1]!);
  }
}
async function toWatchlist() {
  await userEvent.click(await screen.findByTestId('onboarding-ack'));
  await next();
  await screen.findByTestId('question-1');
  await answerAll();
  await next();
  await screen.findByTestId('onboarding-horizon');
  await next();
  await screen.findByTestId('onboarding-wl-chips');
}

describe('onboarding flow', () => {
  it('shows the Appendix A disclaimer verbatim and requires the acknowledgement to continue', async () => {
    setup();
    renderApp('/onboarding');
    expect(await screen.findByTestId('onboarding-disclaimer')).toHaveTextContent(DISCLAIMER_TEXT);
    await next();
    expect(screen.getByTestId('onboarding-error')).toHaveTextContent(
      'Acknowledge the disclaimer to continue.',
    );
    expect(screen.queryByTestId('question-1')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('onboarding-ack'));
    await next();
    expect(await screen.findByTestId('question-1')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-steps').querySelector('[aria-current="step"]')).toHaveTextContent(
      'Risk',
    );
  });

  it('requires all six answers, at least one goal and 3 tickers', async () => {
    setup();
    renderApp('/onboarding');
    await userEvent.click(await screen.findByTestId('onboarding-ack'));
    await next();
    await screen.findByTestId('question-1');
    await userEvent.click(within(screen.getByTestId('question-1')).getAllByRole('radio')[0]!);
    await next();
    expect(screen.getByTestId('onboarding-error')).toHaveTextContent('Answer all 6 questions to continue.');
    await answerAll();
    await next();
    await screen.findByTestId('onboarding-horizon');
    await userEvent.click(screen.getByRole('button', { name: 'Growth' })); // untoggle the default goal
    await next();
    expect(screen.getByTestId('onboarding-error')).toHaveTextContent('Pick at least one goal to continue.');
    await userEvent.click(screen.getByRole('button', { name: 'Income' }));
    await next();
    await screen.findByTestId('onboarding-wl-chips');
    // starter tickers are pre-selected from the supported universe; clear them to hit the minimum
    for (const s of ['AAPL', 'MSFT', 'JNJ', 'KO', 'NVDA'])
      await userEvent.click(screen.getByTestId(`wl-${s}`));
    await next();
    expect(screen.getByTestId('onboarding-error')).toHaveTextContent(
      'Choose at least 3 tickers for your watchlist.',
    );
  });

  it('completes against the API, sends the contract body and shows the tier result with rules and explanation', async () => {
    const { bodies, calls } = setup();
    renderApp('/onboarding');
    await toWatchlist();
    expect(screen.getByTestId('wl-AAPL')).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByTestId('wl-XOM'));
    await userEvent.click(screen.getByTestId('onboarding-next'));
    expect(await screen.findByTestId('onboarding-result')).toBeInTheDocument();
    expect(bodies[0]).toEqual({
      answers: [4, 5, 3, 3, 5, 3],
      horizon: '3-10 years',
      goals: ['Growth'],
      experience: 'Intermediate',
      likes: [],
      excludes: [],
      esg_exclusions: [],
      watchlist: ['AAPL', 'MSFT', 'JNJ', 'KO', 'NVDA', 'XOM'],
      region: 'US',
      currency: 'USD',
      starting_cash: 100000,
      disclaimer_ack: true,
    });
    expect(screen.getByTestId('onboarding-tier')).toHaveTextContent('Balanced (tier 3)');
    expect(screen.getByTestId('onboarding-explanation')).toHaveTextContent('position limits sit at 15%');
    expect(screen.getByTestId('rule-pos')).toHaveTextContent('15%');
    expect(screen.getByTestId('rule-trades')).toHaveTextContent('5');
    expect(screen.getByTestId('rule-cash')).toHaveTextContent('5%');
    // the result stays on screen: /me is not refetched until the user leaves the step
    expect(calls.filter(c => c === 'GET /v1/me').length).toBe(1);
    await userEvent.click(screen.getByTestId('onboarding-finish'));
    expect(await screen.findByTestId('app-shell')).toBeInTheDocument();
  });

  it('renders 422 field errors and lets the user retry', async () => {
    let n = 0;
    setup({
      onboard: () =>
        n++ === 0
          ? new Response(
              JSON.stringify({
                code: 'validation_error',
                message: 'invalid',
                trace_id: 't-42',
                details: { fields: { watchlist: 'ticker ZZZZ is not supported' } },
              }),
              { status: 422 },
            )
          : undefined,
    });
    renderApp('/onboarding');
    await toWatchlist();
    await next();
    const err = await screen.findByTestId('onboarding-server-error');
    expect(err).toHaveTextContent('Check your input');
    expect(err).toHaveTextContent('watchlist: ticker ZZZZ is not supported');
    expect(err).toHaveTextContent('Reference: t-42');
    expect(screen.queryByTestId('onboarding-result')).not.toBeInTheDocument();
    await next();
    expect(await screen.findByTestId('onboarding-result')).toBeInTheDocument();
  });

  it('409 means the workspace already exists: explains and offers the dashboard', async () => {
    setup({
      onboard: () =>
        new Response(JSON.stringify({ code: 'conflict', message: 'already onboarded', trace_id: 't' }), {
          status: 409,
        }),
    });
    renderApp('/onboarding');
    await toWatchlist();
    await next();
    expect(await screen.findByTestId('onboarding-server-error')).toHaveTextContent(
      'Your workspace is already set up',
    );
    expect(screen.getByTestId('onboarding-already')).toBeInTheDocument();
  });

  it('shows an error panel with retry when the questionnaire cannot be loaded', async () => {
    let fail = true;
    installFetch(path => {
      if (path === '/v1/me')
        return {
          user_id: 'u1',
          email: 'n@x.io',
          display_name: 'New',
          initials: 'N',
          persona_id: null,
          onboarded: false,
        };
      if (path === '/v1/onboarding/questions')
        return fail
          ? new Response(JSON.stringify({ code: 'internal', message: 'boom', trace_id: 'x' }), {
              status: 500,
            })
          : questions;
      if (path === '/v1/universe') return universe;
      return undefined;
    });
    renderApp('/onboarding');
    // 5xx is retried twice (1 s + 2 s backoff) before the error panel appears
    expect(
      await screen.findByText('Could not load the questionnaire', {}, { timeout: 6000 }),
    ).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('onboarding-ack')).toBeInTheDocument();
  });

  it('has no axe violations on the welcome, risk and result steps', async () => {
    setup();
    const { container } = renderApp('/onboarding');
    await screen.findByTestId('onboarding-ack');
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByTestId('onboarding-ack'));
    await next();
    await screen.findByTestId('question-1');
    expect(await axe(container)).toHaveNoViolations();
    await answerAll();
    await next();
    await next();
    await screen.findByTestId('onboarding-wl-chips');
    await next();
    await screen.findByTestId('onboarding-result');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Exit signs the user out', async () => {
    setup();
    renderApp('/onboarding');
    await userEvent.click(await screen.findByTestId('onboarding-exit'));
    await waitFor(() => expect(screen.getByTestId('screen-signin')).toBeInTheDocument());
  });
});

describe('draft helpers', () => {
  it('toBody refuses an incomplete draft and stepProblem gates each step', () => {
    const d = emptyDraft(questions);
    expect(() => toBody(d)).toThrow();
    expect(stepProblem(0, d)).toMatch(/Acknowledge/);
    expect(stepProblem(1, d)).toMatch(/6 questions/);
    expect(stepProblem(2, d)).toBeNull();
    expect(stepProblem(3, d)).toMatch(/at least 3/);
    expect(d.horizon).toBe('3-10 years');
    expect(d.experience).toBe('Intermediate');
  });
});
