import { useSyncExternalStore } from 'react';
import type { Quote } from '@/api/types';

/** Latest quote per symbol pushed over SSE. Screens prefer this over the polled `useQuotes` data when present. */
const quotes = new Map<string, Quote>();
let version = 0;
const listeners = new Set<() => void>();

export function pushQuote(q: Quote): void {
  quotes.set(q.symbol.toUpperCase(), q);
  version++;
  listeners.forEach(l => l());
}
export const getLiveQuote = (symbol: string): Quote | undefined => quotes.get(symbol.toUpperCase());
export const clearLiveQuotes = (): void => {
  quotes.clear();
  version++;
  listeners.forEach(l => l());
};

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Re-renders when any pushed quote changes; returns the symbol's latest quote (or undefined). */
export function useLiveQuote(symbol: string | undefined): Quote | undefined {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
  return symbol ? getLiveQuote(symbol) : undefined;
}
