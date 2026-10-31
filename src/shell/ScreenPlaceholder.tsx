import { SCREENS, type NavId } from './screens';

const OWNER: Record<string, string> = {
  signin: 'FE-04',
  onboarding: 'FE-04',
  dashboard: 'FE-05',
  watchlist: 'FE-05',
  brief: 'FE-06',
  portfolio: 'FE-07',
  proposals: 'FE-07',
  trading: 'FE-08',
  live: 'FE-08',
  alerts: 'FE-09',
  ask: 'FE-09',
  profile: 'FE-10',
  audit: 'FE-10',
};

/**
 * Body of every feature module until its owner replaces it. The owning task is shown so nobody mistakes this for the
 * real screen. Replace the whole component body in `src/features/<screen>/index.tsx`; keep the default export `Screen`.
 */
export function ScreenPlaceholder({ id }: { id: string }) {
  const meta = id in SCREENS ? SCREENS[id as NavId] : null;
  return (
    <section
      data-testid={`screen-${id}`}
      aria-labelledby={`ph-${id}`}
      className="sp-card"
      style={{ display: 'grid', gap: 8, maxWidth: 640 }}
    >
      <div className="sp-eyebrow">Placeholder · {OWNER[id] ?? 'TBD'}</div>
      <h2 id={`ph-${id}`} style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 24, margin: 0 }}>
        {meta?.title ?? id}
      </h2>
      <p style={{ margin: 0, color: 'var(--ink-2)' }}>
        {meta?.sub ?? 'This screen'} is built in task {OWNER[id] ?? 'a later task'} and replaces this
        placeholder.
      </p>
    </section>
  );
}
