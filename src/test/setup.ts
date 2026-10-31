import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

afterEach(() => {
  cleanup();
});

// Node 25 ships an experimental global `localStorage` that shadows jsdom's and lacks clear()/removeItem on some setups.
class MemoryStorage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  key(i: number) {
    return Array.from(this.m.keys())[i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}
for (const name of ['localStorage', 'sessionStorage'] as const) {
  const cur = (globalThis as unknown as Record<string, Storage | undefined>)[name];
  if (!cur || typeof cur.clear !== 'function') {
    const store = new MemoryStorage();
    Object.defineProperty(globalThis, name, { value: store, configurable: true });
    Object.defineProperty(window, name, { value: store, configurable: true });
  }
}

// jsdom lacks these; the motion layer and shell rely on them.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
window.scrollTo = (() => {}) as typeof window.scrollTo;
if (!('ResizeObserver' in window)) {
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom has no EventSource; the stream client treats a missing/failed EventSource as a failed attempt, tests stub it where needed.
