import { useEffect, type ReactNode } from 'react';
import { installMotionObserver } from './observer';
import { useHoverTap } from './hooks';

/** Mount once near the root: delegated hover/tap springs for buttons + the `data-m`/`data-loop`/… attribute layer. */
export function MotionRoot({ children }: { children: ReactNode }) {
  useHoverTap();
  useEffect(() => installMotionObserver(document.body), []);
  return <>{children}</>;
}
