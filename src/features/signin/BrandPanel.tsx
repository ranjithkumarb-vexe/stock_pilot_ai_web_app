import { Enter } from '@/motion';
import { LogoMark } from '@/ui';

/** Left, always-dark brand panel from the design's sign-in screen (also used by the MFA step). */
export function BrandPanel() {
  return (
    <div className="signin__brand">
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(oklch(1 0 0 / .08) 1px,transparent 1.3px)',
          backgroundSize: '24px 24px',
          WebkitMaskImage: 'linear-gradient(180deg,#000,transparent 85%)',
          maskImage: 'linear-gradient(180deg,#000,transparent 85%)',
        }}
      />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: 'oklch(0.965 0.008 100)',
        }}
      >
        <LogoMark size={32} accent="oklch(0.9 0.19 122)" />
        <span style={{ font: '750 22px var(--serif)', fontStretch: '125%', letterSpacing: '-.01em' }}>
          StockPilot
        </span>
        <span
          style={{
            font: '600 11px var(--mono)',
            letterSpacing: '.1em',
            border: '1px solid oklch(1 0 0 / .3)',
            borderRadius: 5,
            padding: '1px 6px',
          }}
        >
          AI
        </span>
      </div>
      <div className="signin__chart" style={{ position: 'relative' }}>
        <svg
          viewBox="0 0 560 200"
          width="100%"
          style={{ display: 'block', maxWidth: 560, overflow: 'visible' }}
          fill="none"
          aria-hidden="true"
        >
          <Enter
            as="path"
            kind="draw"
            len={1400}
            duration={2}
            delay={500}
            d="M0 170 L60 158 L110 165 L160 120 L210 132 L270 90 L330 104 L390 60 L450 72 L520 28"
            stroke="oklch(0.9 0.19 122)"
            strokeWidth="2.500"
            strokeLinejoin="round"
            style={{ strokeDasharray: 1400 }}
          />
          <Enter
            as="path"
            kind="fade"
            delay={1600}
            d="M0 170 L60 158 L110 165 L160 120 L210 132 L270 90 L330 104 L390 60 L450 72 L520 28 L520 200 L0 200Z"
            fill="oklch(0.9 0.19 122 / .07)"
          />
          {[
            { x: 146, y: 98, tx: 160, ty: 90, t: '10-K', d: 1000 },
            { x: 256, y: 76, tx: 270, ty: 68, t: 'XBRL ✓', d: 1400 },
            { x: 376, y: 46, tx: 390, ty: 38, t: 'RULES ✓', d: 1800 },
          ].map(m => (
            <Enter as="g" kind="svg-pop" delay={m.d} key={m.t}>
              <rect
                x={m.x}
                y={m.y}
                width="28"
                height="28"
                rx="7"
                fill="oklch(0.14 0.012 250)"
                stroke="oklch(0.9 0.19 122)"
                strokeWidth="2"
              />
              <text
                x={m.tx}
                y={m.ty}
                fill="oklch(0.8 0.012 250)"
                fontFamily="Geist Mono"
                fontSize="11"
                textAnchor="middle"
              >
                {m.t}
              </text>
            </Enter>
          ))}
          <Enter as="g" kind="svg-pop" delay={2200}>
            <circle cx="520" cy="28" r="7" fill="oklch(0.9 0.19 122)" />
            <text
              x="520"
              y="12"
              fill="oklch(0.9 0.19 122)"
              fontFamily="Geist Mono"
              fontSize="11"
              textAnchor="middle"
            >
              PAPER FILL
            </text>
          </Enter>
        </svg>
      </div>
      <div style={{ position: 'relative', maxWidth: 560, display: 'grid', gap: 18 }}>
        <p className="signin__hero" data-testid="signin-hero">
          Numbers come from code.
          <br />
          <span style={{ color: 'oklch(0.9 0.19 122)' }}>Words come from the model.</span>
        </p>
        <p style={{ fontSize: 17, lineHeight: 1.55, margin: 0, color: 'oklch(0.82 0.012 250)' }}>
          Source-checked research briefs, a risk engine that enforces the rules you wrote, and a paper-trading
          simulator. Pilot plots every step from filing to fill.
        </p>
      </div>
      <p
        style={{
          position: 'relative',
          fontSize: 12,
          lineHeight: 1.5,
          color: 'oklch(0.7 0.015 250)',
          margin: 0,
          maxWidth: 520,
        }}
      >
        Educational research and decision-support tool. Not investment advice. All trades are simulated.
      </p>
    </div>
  );
}
