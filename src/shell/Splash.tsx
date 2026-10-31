import { Enter } from '@/motion';
import { LogoMark } from '@/ui/Logo';

/** Boot splash from the design (`data-m="splash"`): shown ~1.5 s then fades out. Decorative and never blocks input. */
export function Splash() {
  return (
    <Enter
      kind="splash"
      aria-hidden="true"
      data-testid="splash"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        pointerEvents: 'none',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg)',
      }}
    >
      <Enter kind="pop" style={{ display: 'grid', justifyItems: 'center', gap: 18, color: 'var(--ink)' }}>
        <LogoMark size={84} />
        <div style={{ font: '750 28px var(--serif)', fontStretch: '125%', letterSpacing: '-.01em' }}>
          StockPilot
        </div>
        <div
          style={{ width: 180, height: 2, background: 'var(--line)', overflow: 'hidden', borderRadius: 2 }}
        >
          <Enter
            kind="prog"
            duration={1.2}
            style={{ height: '100%', background: 'var(--accent)', transformOrigin: 'left' }}
          />
        </div>
        <div style={{ font: '500 11px var(--mono)', letterSpacing: '.12em', color: 'var(--ink-3)' }}>
          VERIFYING SOURCES
        </div>
      </Enter>
    </Enter>
  );
}
