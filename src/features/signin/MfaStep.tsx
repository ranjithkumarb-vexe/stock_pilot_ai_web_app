import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Enter } from '@/motion';
import { Button } from '@/ui';
import { useAttemptLimiter } from './useAttemptLimiter';

const INVALID = /not valid|invalid|incorrect/i;

type Props = {
  /** verify the 6-digit code; reject with an Error carrying a user-safe message */
  onVerify: (code: string) => Promise<void>;
  /** leave the step (signs out of the half-authenticated session) */
  onBack: () => void;
  maxAttempts?: number;
  lockSeconds?: number;
};

/**
 * TOTP step. Six digits, three tries, then a 30 s lock with a live countdown (design copy). Wrong codes shake the
 * message; only "code not valid" answers consume an attempt, so a network failure never locks the user out.
 */
export function MfaStep({ onVerify, onBack, maxAttempts = 3, lockSeconds = 30 }: Props) {
  const limiter = useAttemptLimiter({ max: maxAttempts, lockMs: lockSeconds * 1000 });
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  /** the stored message announces a lock; once the lock ends it must not reappear */
  const [msgIsLock, setMsgIsLock] = useState(false);
  const [shakes, setShakes] = useState(0);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!limiter.locked) input.current?.focus();
  }, [limiter.locked]);

  const text = limiter.locked
    ? `Too many attempts. Try again in ${limiter.secondsLeft} second${limiter.secondsLeft === 1 ? '' : 's'}.`
    : msgIsLock
      ? ''
      : message;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || limiter.locked || busy) return;
    setBusy(true);
    setMessage('');
    setMsgIsLock(false);
    try {
      await onVerify(code);
      limiter.reset();
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : 'Could not verify the code. Try again.';
      setCode('');
      setShakes(n => n + 1);
      if (INVALID.test(msg)) {
        limiter.recordFailure();
        const left = limiter.attemptsLeft - 1;
        setMsgIsLock(left <= 0);
        setMessage(
          left > 0
            ? `That code is not valid. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`
            : `Too many attempts. Try again in ${lockSeconds} seconds.`,
        );
      } else setMessage(msg);
    } finally {
      setBusy(false);
    }
  };

  const disabled = code.length !== 6 || limiter.locked || busy;
  return (
    <form
      onSubmit={e => void submit(e)}
      style={{ display: 'grid', gap: 20 }}
      data-testid="signin-mfa"
      noValidate
    >
      <div>
        <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 32, margin: '0 0 6px' }}>
          Two-step verification
        </h1>
        <p style={{ margin: 0, color: 'var(--ink-2)' }}>
          Enter the 6-digit code from your authenticator app.
        </p>
      </div>
      <input
        ref={input}
        data-testid="mfa-code"
        value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        maxLength={6}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        aria-label="Authenticator code"
        aria-invalid={!!text}
        aria-describedby={text ? 'mfa-msg' : undefined}
        disabled={limiter.locked}
        style={{
          height: 56,
          textAlign: 'center',
          letterSpacing: '.5em',
          fontFamily: 'var(--mono)',
          fontSize: 24,
          borderRadius: 10,
          border: '1px solid var(--line-strong)',
          background: 'var(--surface)',
          opacity: limiter.locked ? 0.6 : 1,
        }}
      />
      <div id="mfa-msg" role="alert" data-testid="mfa-message">
        {text && (
          <Enter
            key={shakes}
            kind={shakes % 2 ? 'shake-a' : 'shake-b'}
            style={{
              background: 'var(--loss-soft)',
              color: 'var(--loss)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {text}
          </Enter>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" onClick={onBack} data-testid="mfa-back">
          Back
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={disabled}
          data-testid="mfa-verify"
          style={{ flex: 1 }}
        >
          {busy ? 'Verifying…' : 'Verify and continue'}
        </Button>
      </div>
    </form>
  );
}
