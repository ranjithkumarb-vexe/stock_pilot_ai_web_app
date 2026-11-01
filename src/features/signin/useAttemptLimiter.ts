import { useCallback, useEffect, useState } from 'react';

const KEY = 'sp-mfa-lock';

const readLock = (): number | null => {
  try {
    const v = Number(sessionStorage.getItem(KEY));
    return v > Date.now() ? v : null;
  } catch {
    return null;
  }
};
const writeLock = (until: number | null) => {
  try {
    if (until == null) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, String(until));
  } catch {
    /* storage blocked: the lock then only lasts for this page view */
  }
};

export type AttemptLimiter = {
  /** failed attempts since the last reset */
  failed: number;
  attemptsLeft: number;
  locked: boolean;
  /** whole seconds until the lock ends (0 when not locked) */
  secondsLeft: number;
  /** call after a rejected code; locks once `max` failures are reached */
  recordFailure: () => void;
  /** call after success */
  reset: () => void;
};

/**
 * UX-level attempt limiting for the TOTP step (design: 3 tries, then "Try again in 30 seconds").
 * The authoritative limit is the identity provider's; this only stops the user hammering the form. The lock end is
 * kept in sessionStorage so a reload does not hand out fresh attempts.
 */
export function useAttemptLimiter({
  max = 3,
  lockMs = 30_000,
}: { max?: number; lockMs?: number } = {}): AttemptLimiter {
  const [failed, setFailed] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(readLock);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (lockedUntil == null) return;
    const id = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockedUntil) {
        setLockedUntil(null);
        setFailed(0);
        writeLock(null);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  const recordFailure = useCallback(() => {
    setFailed(f => {
      const next = f + 1;
      if (next >= max) {
        const until = Date.now() + lockMs;
        writeLock(until);
        setNow(Date.now());
        setLockedUntil(until);
      }
      return next;
    });
  }, [max, lockMs]);

  const reset = useCallback(() => {
    setFailed(0);
    setLockedUntil(null);
    writeLock(null);
  }, []);

  const locked = lockedUntil != null && now < lockedUntil;
  return {
    failed,
    attemptsLeft: Math.max(0, max - failed),
    locked,
    secondsLeft: locked && lockedUntil != null ? Math.ceil((lockedUntil - now) / 1000) : 0,
    recordFailure,
    reset,
  };
}
