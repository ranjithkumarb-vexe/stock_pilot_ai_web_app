import { useRef, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from 'react';
import type { EnterKind, LoopKind } from './engine';
import { useEnter, useLoop, useStagger } from './hooks';

type EnterOwn<T extends ElementType> = {
  as?: T;
  kind: EnterKind;
  /** ms */
  delay?: number;
  /** seconds */
  duration?: number;
  /** stroke length for kind="draw" */
  len?: number;
  children?: ReactNode;
};

/** `data-m` as a component: `<Enter kind="pop" delay={120}>…</Enter>`; use `as="g"` / `as="path"` inside SVG. */
export function Enter<T extends ElementType = 'div'>({
  as,
  kind,
  delay,
  duration,
  len,
  ...rest
}: EnterOwn<T> & Omit<ComponentPropsWithoutRef<T>, keyof EnterOwn<T>>) {
  const ref = useRef<Element>(null);
  useEnter(ref, kind, { delay, duration, len });
  const Tag = (as ?? 'div') as ElementType;
  return <Tag ref={ref} {...rest} />;
}

type StaggerOwn<T extends ElementType> = { as?: T; children?: ReactNode };

/** `data-stagger` as a component. */
export function Stagger<T extends ElementType = 'div'>({
  as,
  ...rest
}: StaggerOwn<T> & Omit<ComponentPropsWithoutRef<T>, keyof StaggerOwn<T>>) {
  const ref = useRef<Element>(null);
  useStagger(ref);
  const Tag = (as ?? 'div') as ElementType;
  return <Tag ref={ref} {...rest} />;
}

type LoopOwn<T extends ElementType> = {
  as?: T;
  kind: LoopKind | null | '';
  /** seconds per cycle */
  duration?: number;
  /** ms */
  delay?: number;
  children?: ReactNode;
};

/** `data-loop` as a component, e.g. the live-feed status dot. */
export function Loop<T extends ElementType = 'span'>({
  as,
  kind,
  duration,
  delay,
  ...rest
}: LoopOwn<T> & Omit<ComponentPropsWithoutRef<T>, keyof LoopOwn<T>>) {
  const ref = useRef<Element>(null);
  useLoop(ref, kind, { duration, delay });
  const Tag = (as ?? 'span') as ElementType;
  return <Tag ref={ref} {...rest} />;
}
