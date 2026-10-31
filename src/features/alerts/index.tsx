import { ScreenPlaceholder } from '@/shell/ScreenPlaceholder';

/** Placeholder until FE-09 lands. Replace the body only; keep the default export `Screen` (lazy-loaded by src/router.tsx). */
export default function Screen() {
  return <ScreenPlaceholder id="alerts" />;
}
