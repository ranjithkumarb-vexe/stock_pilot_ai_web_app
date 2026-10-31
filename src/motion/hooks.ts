import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import {
  enter,
  installHoverTap,
  loop,
  springTo,
  staggerChild,
  type EnterKind,
  type EnterOptions,
  type LoopKind,
  type LoopOptions,
  type Stop,
} from './engine';

/** data-m: run an enter animation on mount (and whenever `kind` changes). Layout effect avoids a flash of the final state. */
export function useEnter<T extends Element>(
  ref: RefObject<T | null>,
  kind: EnterKind | null | undefined,
  opts: EnterOptions = {},
): void {
  const { delay, duration, len } = opts;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !kind) return;
    return enter(el, kind, { delay, duration, len });
  }, [ref, kind, delay, duration, len]);
}

/** data-stagger: children of the referenced element rise in 0.05 s steps; children added later animate too. */
export function useStagger<T extends Element>(ref: RefObject<T | null>, enabled = true): void {
  useLayoutEffect(() => {
    const parent = ref.current;
    if (!parent || !enabled) return;
    const seen = new WeakSet<Element>();
    const stops: Stop[] = [];
    const pass = () => {
      Array.from(parent.children).forEach((c, i) => {
        if (seen.has(c)) return;
        seen.add(c);
        stops.push(staggerChild(c, i));
      });
    };
    pass();
    const mo = new MutationObserver(pass);
    mo.observe(parent, { childList: true });
    return () => {
      mo.disconnect();
      stops.forEach(s => s());
    };
  }, [ref, enabled]);
}

/** data-loop: continuous status loop (pulse | blink | shimmer | ...). Set `kind` to null/'' to stop. */
export function useLoop<T extends Element>(
  ref: RefObject<T | null>,
  kind: LoopKind | null | undefined | '',
  opts: LoopOptions = {},
): void {
  const { duration, delay } = opts;
  useEffect(() => {
    const el = ref.current;
    if (!el || !kind) return;
    return loop(el, kind, { duration, delay });
  }, [ref, kind, duration, delay]);
}

/** data-sp: spring style props to new values whenever `props` changes (first run is instant). */
export function useSpringStyle<T extends Element>(
  ref: RefObject<T | null>,
  props: Record<string, unknown>,
  transition?: Record<string, unknown>,
): void {
  const first = useRef(true);
  const key = JSON.stringify(props);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = springTo(el, JSON.parse(key) as Record<string, unknown>, transition, first.current);
    first.current = false;
    return stop;
    // transition is a static design constant at call sites; keyed on the props JSON on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, key]);
}

/** Installs the delegated hover/tap spring for every <button>, [data-hover] and [data-tap]. Mount once at the app root. */
export function useHoverTap(): void {
  useEffect(() => installHoverTap(document), []);
}
