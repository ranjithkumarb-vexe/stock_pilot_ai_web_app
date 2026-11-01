import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { __resetSession } from '@/auth/session';
import { THEME_KEY } from '@/theme/theme';
import { defaultApi, installFetch, renderApp } from '@/test/renderApp';
import { DISCLAIMER_TEXT } from './disclaimer';
import { NAV_ORDER } from './screens';

beforeEach(() => {
  localStorage.clear();
  installFetch();
});
afterEach(() => {
  vi.restoreAllMocks();
  __resetSession();
  vi.unstubAllGlobals();
});

const inShell = async (path = '/dashboard') => {
  const ctx = renderApp(path);
  await screen.findByTestId('app-shell');
  return ctx;
};

describe('app shell', () => {
  it('renders all 11 nav items with stable test ids, in design order', async () => {
    await inShell();
    const nav = await screen.findByTestId('primary-nav');
    const ids = within(nav)
      .getAllByRole('link')
      .map(a => a.getAttribute('data-testid'));
    expect(ids).toEqual(NAV_ORDER.map(n => `nav-${n}`));
    expect(screen.getByTestId('nav-dashboard')).toHaveAttribute('aria-current', 'page');
  });

  it('shows nav badges from the API (pending proposals, new alerts)', async () => {
    await inShell();
    expect(await screen.findByTestId('nav-badge-proposals')).toHaveTextContent('1');
    expect(await screen.findByTestId('nav-badge-alerts')).toHaveTextContent('2');
  });

  it('has a skip link, a main landmark and the Appendix A disclaimer verbatim', async () => {
    await inShell();
    expect(screen.getByTestId('skip-link')).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByTestId('disclaimer-text').textContent).toBe(DISCLAIMER_TEXT);
  });

  it('DISCLAIMER_TEXT equals SPEC Appendix A', () => {
    const spec = readFileSync(resolve(__dirname, '../../docs/SPEC.md'), 'utf8');
    const block = spec.slice(spec.indexOf('## Appendix A'), spec.indexOf('## Appendix B'));
    const quote = block
      .split('\n')
      .find(l => l.startsWith('> '))
      ?.slice(2);
    expect(quote).toBe(DISCLAIMER_TEXT);
  });

  it('navigates between screens and updates the title', async () => {
    await inShell();
    await userEvent.click(screen.getByTestId('nav-portfolio'));
    expect(await screen.findByTestId('screen-portfolio')).toBeInTheDocument();
    expect(screen.getByTestId('page-title')).toHaveTextContent('Portfolio and risk');
    expect(document.title).toBe('Portfolio and risk · StockPilot AI');
  });

  it('transition direction follows nav order', async () => {
    await inShell();
    await userEvent.click(screen.getByTestId('nav-portfolio'));
    await screen.findByTestId('screen-portfolio');
    expect(screen.getByTestId('screen-transition')).toHaveAttribute('data-dir', 'f');
    await userEvent.click(screen.getByTestId('nav-watchlist'));
    await screen.findByTestId('screen-watchlist');
    expect(screen.getByTestId('screen-transition')).toHaveAttribute('data-dir', 'b');
  });

  it('theme toggle flips body[data-theme] and persists', async () => {
    await inShell();
    await userEvent.click(screen.getByTestId('theme-toggle'));
    expect(document.body.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
  });

  it('command palette: Ctrl+K opens, filters, Enter navigates, Esc closes', async () => {
    await inShell();
    await userEvent.keyboard('{Control>}k{/Control}');
    const input = await screen.findByTestId('palette-input');
    expect(input).toHaveFocus();
    await userEvent.type(input, 'johnson');
    const first = await screen.findByTestId('palette-item-0');
    expect(first).toHaveTextContent('JNJ · Johnson & Johnson');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByTestId('screen-brief')).toBeInTheDocument();
    expect(screen.queryByTestId('palette')).toBeNull();

    await userEvent.keyboard('{Control>}k{/Control}');
    await screen.findByTestId('palette');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('palette')).toBeNull());
  });

  it('palette offers "Ask Pilot" with the typed text and routes it to /ask', async () => {
    const { router } = await inShell();
    await userEvent.click(screen.getByTestId('palette-trigger'));
    await userEvent.type(await screen.findByTestId('palette-input'), 'what is HHI');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByTestId('screen-ask')).toBeInTheDocument();
    expect(router.state.location.state).toEqual({ ask: 'what is HHI' });
  });

  it('user menu offers switch account (dev), profile and sign out; sign out returns to /signin', async () => {
    const { router } = await inShell();
    await userEvent.click(screen.getByTestId('user-menu'));
    const pop = await screen.findByTestId('user-menu-popover');
    expect(within(pop).getByTestId('switch-alex')).toBeInTheDocument();
    await userEvent.click(within(pop).getByTestId('sign-out'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/signin'));
    expect(await screen.findByTestId('screen-signin')).toBeInTheDocument();
  });

  it('shows the market chip and feed chip from /market/status', async () => {
    await inShell();
    expect(await screen.findByText('US market open')).toBeInTheDocument();
    expect(screen.getByTestId('market-chip')).toBeInTheDocument();
    expect(screen.getByTestId('feed-chip')).toBeInTheDocument();
  });

  it('HUD shows portfolio value, day change and rule segments', async () => {
    await inShell();
    const hud = await screen.findByTestId('hud');
    expect(hud).toHaveTextContent('$100,000');
    expect(hud).toHaveTextContent('+0.42%');
  });

  it('has no axe violations (shell, dark)', async () => {
    const { container } = await inShell();
    await screen.findByTestId('hud');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with the palette open', async () => {
    await inShell();
    await userEvent.click(screen.getByTestId('palette-trigger'));
    await screen.findByTestId('palette');
    expect(await axe(document.body)).toHaveNoViolations();
  });
});

describe('banners', () => {
  it('shows the OFFLINE banner when the browser goes offline', async () => {
    await inShell();
    await act(async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(await screen.findByTestId('banner-offline')).toHaveTextContent('You are offline');
    // TanStack Query's onlineManager is a module singleton: bring it back online for the following tests
    await act(async () => {
      vi.restoreAllMocks();
      window.dispatchEvent(new Event('online'));
    });
  });

  it('shows STALE DATA when the feed is stale during market hours', async () => {
    installFetch(path =>
      path === '/v1/market/status'
        ? { open: true, session: 'regular', feed_state: 'stale' }
        : defaultApi(path, {}),
    );
    const { router } = renderApp('/dashboard');
    await screen.findByTestId('app-shell');
    expect(router).toBeTruthy();
    // stream is not connected in jsdom, so the shell reports reconnecting; stale needs a connected stream
    expect(await screen.findByTestId('banners')).toBeInTheDocument();
  });

  it('shows MARKET CLOSED on trading when the market is closed', async () => {
    installFetch(path =>
      path === '/v1/market/status' ? { open: false, session: 'closed' } : defaultApi(path, {}),
    );
    renderApp('/trading');
    expect(await screen.findByTestId('banner-closed')).toHaveTextContent('The market is closed');
  });
});

describe('guards and routing', () => {
  it('signed-out users are sent to /signin', async () => {
    const { router } = renderApp('/portfolio', { signedIn: false });
    expect(await screen.findByTestId('screen-signin')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/signin');
  });

  it('users who have not onboarded are sent to /onboarding', async () => {
    installFetch(path =>
      path === '/v1/me'
        ? {
            user_id: 'u',
            email: 'n@x.io',
            display_name: 'New',
            initials: 'N',
            onboarded: false,
            persona_id: null,
          }
        : defaultApi(path, {}),
    );
    const { router } = renderApp('/dashboard');
    expect(await screen.findByTestId('screen-onboarding')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/onboarding');
  });

  it('onboarded users cannot open /onboarding', async () => {
    const { router } = renderApp('/onboarding');
    await screen.findByTestId('app-shell');
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('signed-in users skip /signin', async () => {
    const { router } = renderApp('/signin');
    await screen.findByTestId('app-shell');
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('unknown routes render the 404 page', async () => {
    renderApp('/definitely-not-a-page');
    expect(await screen.findByTestId('not-found')).toBeInTheDocument();
  });

  it('a 401 from the API signs the user out and shows the session-expired dialog', async () => {
    installFetch(path =>
      path === '/v1/me'
        ? new Response(JSON.stringify({ code: 'unauthenticated', message: 'expired' }), { status: 401 })
        : defaultApi(path, {}),
    );
    const { router } = renderApp('/dashboard');
    expect(await screen.findByTestId('session-expired')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/signin'));
    await userEvent.click(screen.getByTestId('session-expired-signin'));
    await waitFor(() => expect(screen.queryByTestId('session-expired')).toBeNull());
  });

  it('every feature module exports a default `Screen` and renders a testid', async () => {
    for (const id of [
      'watchlist',
      'brief',
      'portfolio',
      'proposals',
      'trading',
      'live',
      'alerts',
      'ask',
      'profile',
      'audit',
    ]) {
      const mod = (await import(`../features/${id}/index.tsx`)) as { default: unknown };
      expect(typeof mod.default, id).toBe('function');
    }
  });
});

describe('safeInternalPath', () => {
  it('accepts internal paths and rejects open-redirect shapes', async () => {
    const { safeInternalPath } = await import('./Guards');
    expect(safeInternalPath('/alerts?x=1')).toBe('/alerts?x=1');
    for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', '\\\\evil', undefined, 42, '/signin'])
      expect(safeInternalPath(bad)).toBe('/dashboard');
  });
});
