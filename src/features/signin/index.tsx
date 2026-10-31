import { useState } from 'react';
import { describeError } from '@/api/errors';
import { DEV_PERSONAS } from '@/auth/personas';
import { useAuth } from '@/auth/useAuth';
import { Enter, Stagger } from '@/motion';
import { Button, GoogleGlyph, LogoMark } from '@/ui';

/**
 * Sign-in. FE-03 ships the design's brand panel + the working "choose" step (dev demo accounts, Google in Supabase mode)
 * so the shell is reachable. FE-04 owns the rest: magic link, TOTP step with attempt limiting UI, error states.
 * Replace the body freely; keep the default export `Screen`.
 */
export default function Screen() {
  const { mode, status, signInDev, signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(describeError(e).serverMessage ?? describeError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin" data-testid="screen-signin">
      <style>{`
        .signin{min-height:100vh;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)}
        .signin__brand{position:relative;overflow:hidden;padding:48px 56px;display:flex;flex-direction:column;justify-content:space-between;gap:28px;color:oklch(0.965 0.008 100);background:radial-gradient(800px 500px at 80% 0%,oklch(0.9 0.19 122 / .1),transparent 60%),oklch(0.14 0.012 250)}
        .signin__hero{font:750 52px/1 var(--serif);font-stretch:118%;letter-spacing:-.03em;margin:0}
        .signin__form{display:flex;align-items:center;justify-content:center;padding:48px}
        @media (max-width: 899px){.signin{grid-template-columns:1fr}.signin__brand{padding:28px 20px;gap:20px}.signin__hero{font-size:34px}.signin__chart{display:none}.signin__form{padding:28px 20px}}
      `}</style>
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
            Source-checked research briefs, a risk engine that enforces the rules you wrote, and a
            paper-trading simulator. Pilot plots every step from filing to fill.
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
      <main id="main" tabIndex={-1} className="signin__form">
        <div style={{ width: '100%', maxWidth: 380, display: 'grid', gap: 20 }}>
          {status === 'mfa_required' ? (
            <div style={{ display: 'grid', gap: 8 }} data-testid="signin-mfa-pending">
              <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 32, margin: 0 }}>
                Two-step verification
              </h1>
              <p style={{ margin: 0, color: 'var(--ink-2)' }}>The authenticator step is built in FE-04.</p>
            </div>
          ) : (
            <Stagger style={{ display: 'grid', gap: 20 }}>
              <div>
                <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 32, margin: '0 0 6px' }}>
                  Sign in
                </h1>
                <p style={{ margin: 0, color: 'var(--ink-2)' }}>
                  {mode === 'dev' ? 'Pick a demo account.' : 'Use Google to continue.'}
                </p>
              </div>
              {mode === 'supabase' && (
                <Button
                  variant="secondary"
                  size="lg"
                  block
                  data-testid="signin-google"
                  disabled={busy}
                  onClick={() => void run(signInWithGoogle)}
                  style={{ borderRadius: 10, height: 44, fontSize: 14 }}
                >
                  <GoogleGlyph />
                  Continue with Google
                </Button>
              )}
              {mode === 'dev' && (
                <div style={{ display: 'grid', gap: 8 }} role="group" aria-label="Demo accounts">
                  {DEV_PERSONAS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      data-testid={`signin-${p.id}`}
                      disabled={busy}
                      onClick={() => void run(() => signInDev(p.id))}
                      className="hv-accent-border"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: 12,
                        borderRadius: 10,
                        border: p.id === 'new' ? '1px dashed var(--line-strong)' : '1px solid var(--line)',
                        background: p.id === 'new' ? 'transparent' : 'var(--surface)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background:
                            p.tone === 'acc'
                              ? 'var(--accent-soft)'
                              : p.tone === 'info'
                                ? 'var(--info-soft)'
                                : 'var(--surface-2)',
                          color:
                            p.tone === 'acc'
                              ? 'var(--accent)'
                              : p.tone === 'info'
                                ? 'var(--info)'
                                : 'var(--ink-2)',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 700,
                          fontSize: p.id === 'new' ? 18 : 13,
                          flex: 'none',
                        }}
                      >
                        {p.initials}
                      </span>
                      <span>
                        <b style={{ display: 'block', fontSize: 14 }}>{p.name}</b>
                        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{p.tag}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {error && (
                <div
                  role="alert"
                  data-testid="signin-error"
                  style={{
                    background: 'var(--loss-soft)',
                    color: 'var(--loss)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {error}
                </div>
              )}
            </Stagger>
          )}
        </div>
      </main>
    </div>
  );
}
