import { useEffect, useRef, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const subscribe = (cb: () => void) => {
    const m = window.matchMedia(query);
    m.addEventListener('change', cb);
    return () => m.removeEventListener('change', cb);
  };
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** < 900px: sidebar becomes a drawer. Keep in sync with shell.css. */
export const MOBILE_QUERY = '(max-width: 899px)';

export function useOnline(): boolean {
  return useSyncExternalStore(
    cb => {
      window.addEventListener('online', cb);
      window.addEventListener('offline', cb);
      return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
      };
    },
    () => navigator.onLine !== false,
    () => true,
  );
}

/** Calls `onIdle` after `ms` without pointer/keyboard/scroll activity (design: signed out after 30 minutes). */
export function useIdleTimeout(ms: number, onIdle: () => void, enabled = true): void {
  const cb = useRef(onIdle);
  useEffect(() => {
    cb.current = onIdle;
  });
  useEffect(() => {
    if (!enabled) return;
    let t: ReturnType<typeof setTimeout>;
    let last = 0;
    const arm = () => {
      clearTimeout(t);
      t = setTimeout(() => cb.current(), ms);
    };
    const bump = () => {
      const now = Date.now();
      if (now - last < 1000) return; // throttle
      last = now;
      arm();
    };
    const evs = ['pointerdown', 'keydown', 'scroll', 'visibilitychange'] as const;
    evs.forEach(e => window.addEventListener(e, bump, { passive: true }));
    arm();
    return () => {
      clearTimeout(t);
      evs.forEach(e => window.removeEventListener(e, bump));
    };
  }, [ms, enabled]);
}
