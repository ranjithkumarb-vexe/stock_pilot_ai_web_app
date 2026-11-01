import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { getToken, __resetSession } from '@/auth/session';
import { installFetch, renderApp, type MockRoute } from '@/test/renderApp';

afterEach(() => {
  sessionStorage.clear();
  __resetSession();
  vi.unstubAllGlobals();
});

const PROFILE = {
  profile: {
    horizon: '3-10 years',
    goals: ['Growth'],
    esg_exclusions: ['Tobacco'],
    experience: 'Intermediate',
    region: 'US',
    currency: 'USD',
  },
  style_card: {
    depth: 'standard',
    tone: 'Direct',
    pinned_metric: 'P/E',
    section_order: ['bal', 'risk', 'val'],
  },
  rules: { pos: 15, sec: 40, dd: 20, trades: 10, cash: 5 },
  interests: [
    { dim: 'sector:Technology', label: 'Technology', weight: 0.8, baseline: 0.5 },
    { dim: 'sector:Healthcare', label: 'Healthcare', weight: 0.3, baseline: 0.3 },
  ],
  memories: [
    { id: 'm1', kind: 'semantic', text: 'Prefers dividend growers', confidence: 0.82, source: 'Chat' },
    { id: 'm2', kind: 'episodic', text: '<b>Dismissed</b> NVDA alerts', confidence: 0.5, source: 'Alerts' },
  ],
  bias: [
    { name: 'Disposition effect', metric: 'Winners sold vs losers held', value: '1.4x', state: 'watch' },
    { name: 'Concentration', metric: 'HHI', value: 0.31, state: 'flag' },
  ],
  stated_tier: 2,
  revealed_tier: 3.6,
  gap_days: 21,
  recent_events: [
    { id: 'e1', ts: new Date().toISOString(), type: 'alert_dismissed', text: 'Dismissed: NVDA move' },
  ],
};

const QUESTIONS = {
  questions: [],
  tiers: [1, 2, 3, 4, 5].map(t => ({
    tier: t,
    label: ['Very conservative', 'Conservative', 'Balanced', 'Growth', 'Aggressive'][t - 1],
  })),
  horizons: ['Under 1 year', '1-3 years', '3-10 years', '10+ years'],
  experience_levels: ['Beginner', 'Intermediate', 'Advanced'],
  sectors: [],
  goals: ['Growth', 'Income', 'Preservation'],
  esg_exclusions: ['Tobacco', 'Weapons', 'Fossil fuels', 'Gambling'],
  tier_rules: { '2': { pos: 10, sec: 25, dd: 10, trades: 3, cash: 10 } },
};

type O = { profile?: unknown; fail?: boolean; deleteStatus?: number; warn?: boolean };
const api =
  (o: O = {}): MockRoute =>
  (path, init) => {
    const m = init.method ?? 'GET';
    if (path === '/v1/onboarding/questions') return QUESTIONS;
    if (path === '/v1/profile' && m === 'GET')
      return o.fail
        ? new Response(JSON.stringify({ code: 'internal', message: 'x', trace_id: 't' }), { status: 500 })
        : (o.profile ?? PROFILE);
    if (path === '/v1/profile' && m === 'PATCH') return PROFILE;
    if (path === '/v1/profile/rules' && m === 'PUT')
      return {
        rules: JSON.parse(String(init.body)),
        changed: [],
        warnings: o.warn ? ["You loosened 'pos' from 15 to 30. Consider noting why."] : [],
      };
    if (path === '/v1/profile/reset' && m === 'POST') return new Response(null, { status: 204 });
    if (path.startsWith('/v1/profile/memories/') && m === 'DELETE')
      return new Response(null, { status: 204 });
    if (path === '/v1/profile/export')
      return { user: 'priya', rules: PROFILE.rules, memories: PROFILE.memories };
    if (path === '/v1/account' && m === 'DELETE')
      return o.deleteStatus
        ? new Response(JSON.stringify({ code: 'internal', message: 'db down', trace_id: 'td' }), {
            status: o.deleteStatus,
          })
        : new Response(null, { status: 204 });
    return undefined;
  };
const call = (f: ReturnType<typeof installFetch>, method: string, path: string) =>
  f.fn.mock.calls.filter(
    ([u, i]) => new URL(String(u)).pathname === path && ((i as RequestInit)?.method ?? 'GET') === method,
  );
const body = (c: unknown[][] | undefined) => JSON.parse(String((c?.[0]?.[1] as RequestInit).body));

const open = async (path = '/profile', o?: O) => {
  const f = installFetch(api(o));
  const ctx = renderApp(path);
  await screen.findByTestId('screen-profile');
  return { f, ...ctx };
};

describe('profile tab', () => {
  it('shows what you told us, with tier labels from the API', async () => {
    await open();
    expect(await screen.findByText('Risk tier: Conservative (2 of 5, stated)')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3-10 years' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Growth' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Tobacco' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('saves a changed preference with PATCH /profile, using the API field names', async () => {
    const { f } = await open();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Income' }));
    await waitFor(() => expect(call(f, 'PATCH', '/v1/profile')).toHaveLength(1));
    expect(body(call(f, 'PATCH', '/v1/profile'))).toEqual({ goals: ['Growth', 'Income'] });
    await user.click(screen.getByRole('radio', { name: 'Advanced' }));
    await waitFor(() => expect(call(f, 'PATCH', '/v1/profile')).toHaveLength(2));
    expect(body([call(f, 'PATCH', '/v1/profile')[1] as unknown[]])).toEqual({
      experience: 'Advanced',
      jargon: 3,
    });
    await user.click(screen.getByRole('radio', { name: 'Dividend yield' }));
    await waitFor(() => expect(call(f, 'PATCH', '/v1/profile')).toHaveLength(3));
    expect(body([call(f, 'PATCH', '/v1/profile')[2] as unknown[]])).toEqual({ metric: 'Dividend yield' });
  });

  it('keeps at least one goal (the API requires it)', async () => {
    await open();
    expect(await screen.findByRole('button', { name: 'Growth' })).toBeDisabled();
  });

  it('edits rules, validates them in the UI and PUTs /profile/rules', async () => {
    const { f } = await open();
    const pos = await screen.findByTestId('rule-pos');
    const save = screen.getByTestId('rules-save');
    expect(save).toBeDisabled();
    await userEvent.clear(pos);
    await userEvent.type(pos, '500');
    await userEvent.click(save);
    expect(screen.getByText('Enter a number from 0.1 to 100')).toBeInTheDocument();
    expect(call(f, 'PUT', '/v1/profile/rules')).toHaveLength(0);
    await userEvent.clear(pos);
    await userEvent.type(pos, '12');
    await userEvent.click(save);
    await waitFor(() => expect(call(f, 'PUT', '/v1/profile/rules')).toHaveLength(1));
    expect(body(call(f, 'PUT', '/v1/profile/rules'))).toEqual({
      pos: 12,
      sec: 40,
      dd: 20,
      trades: 10,
      cash: 5,
    });
  });

  it('fills the tier defaults from the API and shows the loosening warning after saving', async () => {
    const { f } = await open('/profile', { warn: true });
    await userEvent.click(await screen.findByTestId('rules-defaults'));
    expect(screen.getByTestId('rule-pos')).toHaveValue('10');
    await userEvent.click(screen.getByTestId('rules-save'));
    await waitFor(() => expect(call(f, 'PUT', '/v1/profile/rules')).toHaveLength(1));
    expect(body(call(f, 'PUT', '/v1/profile/rules'))).toEqual({
      pos: 10,
      sec: 25,
      dd: 10,
      trades: 3,
      cash: 10,
    });
    expect(await screen.findByTestId('rules-warnings')).toHaveTextContent('You loosened');
  });

  it('shows an error panel with retry when /profile fails', async () => {
    await open('/profile', { fail: true });
    expect(await screen.findByText('Could not load your profile', {}, { timeout: 6000 })).toBeInTheDocument();
  }, 10000);

  it('has no axe violations', async () => {
    await open();
    await screen.findByTestId('profile-rules');
    expect(await axe(document.body)).toHaveNoViolations();
  });
});

describe('what it learned', () => {
  it('shows stated vs revealed, the gap prompt and lets the user keep the stated tier', async () => {
    await open('/profile?tab=learned');
    const gap = await screen.findByTestId('profile-gap');
    expect(gap).toHaveTextContent('STATED 2');
    expect(gap).toHaveTextContent('REVEALED 3.6');
    expect(await screen.findByTestId('gap-prompt')).toHaveTextContent(
      'behaves like tier 4; you chose tier 2',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Keep as is' }));
    expect(await screen.findByTestId('gap-ok')).toHaveTextContent('You chose to keep your stated tier');
  });

  it('Review my rules goes to the Profile tab', async () => {
    const { router } = await open('/profile?tab=learned');
    await userEvent.click(await screen.findByRole('button', { name: 'Review my rules' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await screen.findByTestId('profile-rules')).toBeInTheDocument();
  });

  it('renders interests, style card, behaviour mirrors and recent signals from the API', async () => {
    await open('/profile?tab=learned');
    expect(await screen.findByRole('meter', { name: 'Technology interest' })).toHaveAttribute(
      'aria-valuenow',
      '80',
    );
    expect(screen.getByTestId('profile-style')).toHaveTextContent('Pinned metric');
    expect(screen.getByTestId('profile-style')).toHaveTextContent('bal > risk > val');
    const bias = screen.getByTestId('profile-bias');
    expect(within(bias).getByText('Watch')).toBeInTheDocument();
    expect(within(bias).getByText('Flag')).toBeInTheDocument();
    expect(screen.getByTestId('profile-signals')).toHaveTextContent('Dismissed: NVDA move');
  });

  it('no gap message when the portfolio matches the stated tier', async () => {
    await open('/profile?tab=learned', { profile: { ...PROFILE, revealed_tier: 2.2 } });
    expect(await screen.findByTestId('gap-ok')).toHaveTextContent('close to your stated tier');
  });
});

describe('memories', () => {
  it('lists memories as text and forgets one', async () => {
    const { f } = await open('/profile?tab=memory');
    const row = await screen.findByTestId('memory-m2');
    expect(row).toHaveTextContent('<b>Dismissed</b> NVDA alerts');
    expect(row.querySelector('b')).toBeNull();
    await userEvent.click(screen.getByTestId('forget-m1'));
    await waitFor(() => expect(call(f, 'DELETE', '/v1/profile/memories/m1')).toHaveLength(1));
    expect(await screen.findByTestId('toast')).toHaveTextContent('Forgotten. Removed with its embedding.');
  });

  it('empty state', async () => {
    await open('/profile?tab=memory', { profile: { ...PROFILE, memories: [] } });
    expect(await screen.findByTestId('memories-empty')).toHaveTextContent('No memories stored.');
  });
});

describe('data and privacy', () => {
  it('export previews the JSON and downloads a valid .json file', async () => {
    const created: Blob[] = [];
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: (b: Blob) => (created.push(b), 'blob:x'),
        revokeObjectURL: vi.fn(),
      }),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await open('/profile?tab=privacy');
    await userEvent.click(await screen.findByTestId('open-export'));
    const pre = await screen.findByTestId('export-json');
    expect(JSON.parse(pre.textContent ?? '')).toMatchObject({ user: 'priya' });
    await userEvent.click(screen.getByTestId('download-export'));
    expect(click).toHaveBeenCalled();
    expect(created).toHaveLength(1);
    expect(JSON.parse(await created[0]!.text())).toMatchObject({ rules: { pos: 15 } });
    expect(created[0]!.type).toBe('application/json');
  });

  it('reset needs a confirmation, then POSTs /profile/reset', async () => {
    const { f } = await open('/profile?tab=privacy');
    await userEvent.click(await screen.findByTestId('open-reset'));
    expect(call(f, 'POST', '/v1/profile/reset')).toHaveLength(0);
    await userEvent.click(screen.getByTestId('confirm-reset'));
    await waitFor(() => expect(call(f, 'POST', '/v1/profile/reset')).toHaveLength(1));
  });

  it('delete requires typing DELETE, calls DELETE /account with the confirmation and signs out', async () => {
    const { f, router } = await open('/profile?tab=privacy');
    await userEvent.click(await screen.findByTestId('open-delete'));
    const confirm = screen.getByTestId('confirm-delete');
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByTestId('delete-confirm'), 'delete');
    expect(confirm).toBeDisabled();
    await userEvent.clear(screen.getByTestId('delete-confirm'));
    await userEvent.type(screen.getByTestId('delete-confirm'), 'DELETE');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await waitFor(() => expect(call(f, 'DELETE', '/v1/account')).toHaveLength(1));
    expect(body(call(f, 'DELETE', '/v1/account'))).toEqual({ confirm: 'DELETE' });
    await waitFor(() => expect(getToken()).toBeNull());
    await waitFor(() => expect(router.state.location.pathname).toBe('/signin'));
  });

  it('a failed delete keeps the account and the session', async () => {
    await open('/profile?tab=privacy', { deleteStatus: 500 });
    await userEvent.click(await screen.findByTestId('open-delete'));
    await userEvent.type(screen.getByTestId('delete-confirm'), 'DELETE');
    await userEvent.click(screen.getByTestId('confirm-delete'));
    expect(await screen.findByTestId('delete-error')).toHaveTextContent('Your account was not deleted');
    expect(getToken()).not.toBeNull();
  });

  it('privacy controls stay reachable when /profile is down', async () => {
    await open('/profile?tab=privacy', { fail: true });
    expect(await screen.findByTestId('profile-controls')).toBeInTheDocument();
  });
});
