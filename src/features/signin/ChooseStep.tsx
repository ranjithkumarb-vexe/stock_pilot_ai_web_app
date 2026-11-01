import { useState } from 'react';
import { describeError } from '@/api/errors';
import { DEV_PERSONAS } from '@/auth/personas';
import { useAuth } from '@/auth/useAuth';
import { Stagger } from '@/motion';
import { Button, GoogleGlyph } from '@/ui';

/** "Sign in": Google (Supabase mode) or the demo accounts (dev mode). Errors render with the shared copy + trace id. */
export function ChooseStep() {
  const { mode, signInDev, signInWithGoogle } = useAuth();
  const [error, setError] = useState<ReturnType<typeof describeError> | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
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
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: 'var(--ink-3)',
              fontSize: 12,
            }}
          >
            <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            Demo accounts
            <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>
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
                  cursor: busy ? 'progress' : 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  aria-hidden="true"
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
                      p.tone === 'acc' ? 'var(--accent)' : p.tone === 'info' ? 'var(--info)' : 'var(--ink-2)',
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
        </>
      )}
      <div aria-live="polite">
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
              display: 'grid',
              gap: 2,
            }}
          >
            <b>{error.title}</b>
            <span style={{ color: 'var(--ink)' }}>{error.message}</span>
            {error.traceId && (
              <span style={{ font: '400 11px var(--mono)', color: 'var(--ink-3)' }}>
                Reference: {error.traceId}
              </span>
            )}
          </div>
        )}
      </div>
    </Stagger>
  );
}
