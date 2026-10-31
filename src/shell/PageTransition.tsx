import { useState, type ReactNode } from 'react';
import { Enter } from '@/motion';
import { navIndex, type ScreenId } from './screens';

/**
 * Direction-aware screen transition (design `dir`/`scrIn`): moving to a later nav item slides in from the right
 * (`scr-f`), to an earlier one from the left (`scr-b`). Keyed by screen so sub-routes (/brief/JNJ → /brief/MSFT) do not replay.
 */
export function PageTransition({ screen, children }: { screen: ScreenId | null; children: ReactNode }) {
  const idx = navIndex(screen);
  const [prev, setPrev] = useState(idx);
  const [dir, setDir] = useState<'f' | 'b'>('f');
  if (idx !== prev) {
    // derive during render (React pattern) so the first paint of the new screen already has the right direction
    setDir(idx >= prev ? 'f' : 'b');
    setPrev(idx);
  }
  return (
    <Enter
      key={screen ?? 'none'}
      kind={dir === 'b' ? 'scr-b' : 'scr-f'}
      data-testid="screen-transition"
      data-dir={dir}
      style={{ display: 'grid', gap: 24, alignContent: 'start' }}
    >
      {children}
    </Enter>
  );
}
