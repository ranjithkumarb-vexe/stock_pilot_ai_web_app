import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './AuthProvider';
import { __resetSession, getSession, getToken, restoreSession, setSession } from './session';
import { useAuth } from './useAuth';
import { getAuthMode } from '@/lib/env';

function Probe() {
  const a = useAuth();
  return (
    <div>
      <span data-testid="status">{a.status}</span>
      <span data-testid="mode">{a.mode}</span>
      <span data-testid="user">{a.user?.display_name ?? '-'}</span>
      <button onClick={() => void a.signInDev('priya')}>login</button>
      <button onClick={() => void a.signOut()}>logout</button>
    </div>
  );
}
const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  __resetSession();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_u: string, init: RequestInit) => {
      expect(JSON.parse(init.body as string)).toEqual({ persona: 'priya' });
      return new Response(
        JSON.stringify({
          access_token: 'tok',
          expires_in: 60,
          user: { user_id: 'u', email: 'p@x.io', display_name: 'Priya Nair', initials: 'PN' },
        }),
        { status: 200 },
      );
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('auth (dev mode)', () => {
  it('defaults to dev mode when Supabase env is absent, and signs in via dev-login', async () => {
    wrap();
    expect(await screen.findByText('signed_out')).toBeInTheDocument();
    expect(screen.getByTestId('mode')).toHaveTextContent('dev');
    await userEvent.click(screen.getByText('login'));
    expect(await screen.findByText('signed_in')).toBeInTheDocument();
    expect(screen.getByTestId('user')).toHaveTextContent('Priya Nair');
    expect(getToken()).toBe('tok');
    expect(sessionStorage.getItem('sp-session')).toContain('tok'); // sessionStorage, never localStorage
    expect(localStorage.getItem('sp-session')).toBeNull();
  });

  it('switching to a different user resets cached queries (no previous-user data served from cache)', async () => {
    const qc = new QueryClient();
    setSession('t1', { user_id: 'u1', email: 'a@x.io', display_name: 'A', initials: 'A' }, 60);
    render(
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await screen.findByText('signed_in');
    qc.setQueryData(['me'], { onboarded: true });
    await act(async () => {
      setSession('t2', { user_id: 'u2', email: 'b@x.io', display_name: 'B', initials: 'B' }, 60);
    });
    expect(qc.getQueryData(['me'])).toBeUndefined();
  });

  it('sign out clears memory and sessionStorage', async () => {
    setSession('abc', null, 60);
    wrap();
    await userEvent.click(await screen.findByText('logout'));
    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem('sp-session')).toBeNull();
    expect(getSession().endedBy).toBe('signed_out');
  });

  it('restores a non-expired session after a reload and ignores an expired one', () => {
    setSession('keep', null, 60);
    const raw = sessionStorage.getItem('sp-session');
    __resetSession();
    sessionStorage.setItem('sp-session', raw as string);
    expect(restoreSession().token).toBe('keep');
    __resetSession();
    sessionStorage.setItem(
      'sp-session',
      JSON.stringify({ token: 'old', user: null, expiresAt: Date.now() - 1000 }),
    );
    expect(restoreSession().token).toBeNull();
  });

  it('survives sessionStorage throwing', () => {
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => setSession('t', null, 10)).not.toThrow();
    expect(getToken()).toBe('t');
  });

  it('switches to supabase mode only when both env vars are set (and not forced to dev)', () => {
    expect(getAuthMode()).toBe('dev');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    expect(getAuthMode()).toBe('dev');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    expect(getAuthMode()).toBe('supabase');
    vi.stubEnv('VITE_AUTH_MODE', 'dev');
    expect(getAuthMode()).toBe('dev');
  });

  it('useAuth outside a provider throws a helpful error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => act(() => void render(<Probe />))).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});
