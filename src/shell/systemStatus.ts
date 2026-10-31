import { useSyncExternalStore } from 'react';

/**
 * Global degradation flags that screens (or the API layer) can raise; the shell renders the matching banners.
 *   reportLlmDegraded(true)   when a brief/chat response has status 'degraded' or the model returned 429/upstream_unavailable
 *   reportEdgarDelayed(true)  when filing alerts are delayed by SEC rate limiting
 * Clear them (false) when a later call succeeds normally.
 */
type Flags = { llmDegraded: boolean; edgarDelayed: boolean };
let flags: Flags = { llmDegraded: false, edgarDelayed: false };
const listeners = new Set<() => void>();

const set = (patch: Partial<Flags>) => {
  const next = { ...flags, ...patch };
  if (next.llmDegraded === flags.llmDegraded && next.edgarDelayed === flags.edgarDelayed) return;
  flags = next;
  listeners.forEach(l => l());
};

export const reportLlmDegraded = (on: boolean): void => set({ llmDegraded: on });
export const reportEdgarDelayed = (on: boolean): void => set({ edgarDelayed: on });
export const resetSystemStatus = (): void => set({ llmDegraded: false, edgarDelayed: false });

export function useSystemStatus(): Flags {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => flags,
    () => flags,
  );
}
