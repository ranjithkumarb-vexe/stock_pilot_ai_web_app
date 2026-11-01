import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { __resetSession } from '@/auth/session';
import { installFetch, renderApp } from '@/test/renderApp';
import { MfaStep } from './MfaStep';

afterEach(() => {
  vi.useRealTimers();
  __resetSession();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

const login = (persona: string) => ({
  access_token: 'tok-' + persona,
  expires_in: 3600,
  user: { user_id: 'u-' + persona, email: `${persona}@x.io`, display_name: persona, initials: 'PN' },
});

describe('sign-in (dev accounts)', () => {
  it('lists the demo accounts and signs in through dev-login, landing on the dashboard', async () => {
    const { calls } = installFetch((path, init) => {
      if (path === '/v1/auth/dev-login') {
        expect(JSON.parse(String(init.body))).toEqual({ persona: 'alex' });
        return login('alex');
      }
      if (path === '/v1/me')
        return { user_id: 'u-alex', email: 'a@x.io', display_name: 'Alex', initials: 'AR', onboarded: true };
      return undefined;
    });
    renderApp('/signin', { signedIn: false });
    expect(await screen.findByTestId('signin-priya')).toBeInTheDocument();
    expect(screen.getByTestId('signin-new')).toHaveTextContent('Start the onboarding questionnaire');
    await userEvent.click(screen.getByTestId('signin-alex'));
    expect(await screen.findByTestId('app-shell')).toBeInTheDocument();
    expect(calls).toContain('POST /v1/auth/dev-login');
  });

  it('shows the mapped error copy with the trace id when dev-login fails (503) and when the API is unreachable', async () => {
    installFetch(path =>
      path === '/v1/auth/dev-login'
        ? new Response(
            JSON.stringify({ code: 'upstream_unavailable', message: 'db down', trace_id: 'trace-9' }),
            {
              status: 503,
            },
          )
        : undefined,
    );
    renderApp('/signin', { signedIn: false });
    await userEvent.click(await screen.findByTestId('signin-priya'));
    const err = await screen.findByTestId('signin-error');
    expect(err).toHaveTextContent('Service temporarily unavailable');
    expect(err).toHaveTextContent('Reference: trace-9');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await userEvent.click(screen.getByTestId('signin-alex'));
    await waitFor(() =>
      expect(screen.getByTestId('signin-error')).toHaveTextContent('Cannot reach StockPilot'),
    );
  });

  it('has no axe violations', async () => {
    installFetch();
    const { container } = renderApp('/signin', { signedIn: false });
    await screen.findByTestId('signin-priya');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('TOTP step with attempt limiting', () => {
  const setup = (onVerify: (c: string) => Promise<void>) => {
    const onBack = vi.fn();
    render(
      <main>
        <MfaStep onVerify={onVerify} onBack={onBack} />
      </main>,
    );
    return { onBack, input: screen.getByTestId('mfa-code') as HTMLInputElement };
  };

  it('keeps Verify disabled until 6 digits are entered and strips non-digits', async () => {
    const { input } = setup(async () => {});
    expect(screen.getByTestId('mfa-verify')).toBeDisabled();
    await userEvent.type(input, '12a3-45');
    expect(input.value).toBe('12345');
    expect(screen.getByTestId('mfa-verify')).toBeDisabled();
    await userEvent.type(input, '6');
    expect(screen.getByTestId('mfa-verify')).toBeEnabled();
  });

  it('counts attempts down, locks after 3 invalid codes with a countdown, then unlocks', async () => {
    const verify = vi.fn(async () => {
      throw new Error('That code is not valid.');
    });
    const { input } = setup(verify);
    const submit = async (code: string) => {
      await userEvent.type(input, code);
      await userEvent.click(screen.getByTestId('mfa-verify'));
    };
    await submit('111111');
    expect(await screen.findByTestId('mfa-message')).toHaveTextContent(
      'That code is not valid. 2 attempts left.',
    );
    await submit('222222');
    expect(screen.getByTestId('mfa-message')).toHaveTextContent('1 attempt left.');
    await submit('333333');
    expect(verify).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('mfa-message')).toHaveTextContent(
      /Too many attempts. Try again in \d+ seconds?\./,
    );
    expect(input).toBeDisabled();
    expect(screen.getByTestId('mfa-verify')).toBeDisabled();
    // reload does not hand out fresh attempts
    expect(Number(sessionStorage.getItem('sp-mfa-lock'))).toBeGreaterThan(Date.now());

    vi.useFakeTimers({ shouldAdvanceTime: true });
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });
    await waitFor(() => expect(input).toBeEnabled());
    expect(screen.queryByText(/Too many attempts/)).not.toBeInTheDocument();
    expect(sessionStorage.getItem('sp-mfa-lock')).toBeNull();
  });

  it('does not spend an attempt on a non-code failure (e.g. network) and shows its message', async () => {
    const verify = vi.fn(async () => {
      throw new Error('Could not start verification. Try again.');
    });
    const { input } = setup(verify);
    for (const c of ['111111', '222222', '333333', '444444']) {
      await userEvent.type(input, c);
      await userEvent.click(screen.getByTestId('mfa-verify'));
    }
    expect(verify).toHaveBeenCalledTimes(4);
    expect(screen.getByTestId('mfa-message')).toHaveTextContent('Could not start verification. Try again.');
    expect(input).toBeEnabled();
  });

  it('verifies on Enter and Back leaves the step', async () => {
    const verify = vi.fn(async () => {});
    const { input, onBack } = setup(verify);
    await userEvent.type(input, '123456{Enter}');
    expect(verify).toHaveBeenCalledWith('123456');
    await userEvent.click(screen.getByTestId('mfa-back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('has no axe violations', async () => {
    const { input } = setup(async () => {});
    expect(input).toBeInTheDocument();
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
