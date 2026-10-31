import { useCallback, useSyncExternalStore } from 'react';

const KEY = 'sp-last-ticker';
const DEFAULT = '';
const listeners = new Set<() => void>();
let mem = '';

const read = (): string => {
  if (mem) return mem;
  try {
    return sessionStorage.getItem(KEY) || DEFAULT;
  } catch {
    return DEFAULT;
  }
};

/** The ticker the "Research brief" nav item opens (design `s.ticker`); '' until a brief was viewed this session. Brief screens call setTicker when a symbol is viewed. */
export function useLastTicker(): [string, (t: string) => void] {
  const ticker = useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => DEFAULT,
  );
  const set = useCallback((t: string) => {
    mem = t.toUpperCase();
    try {
      sessionStorage.setItem(KEY, mem);
    } catch {
      /* in-memory only */
    }
    listeners.forEach(l => l());
  }, []);
  return [ticker, set];
}
