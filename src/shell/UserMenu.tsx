import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DEV_PERSONAS } from '@/auth/personas';
import { useAuth } from '@/auth/useAuth';
import { useToast } from '@/ui';
import { describeError } from '@/api/errors';

/** Signed-in user block at the bottom of the sidebar (design "Signed in as"): switch demo account (dev mode), profile, sign out. */
export function UserMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { user, mode, signInDev, signOut } = useAuth();
  const navigate = useNavigate();
  const { say } = useToast();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        wrap.current?.querySelector<HTMLElement>('[data-testid="user-menu"]')?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const switchTo = async (id: (typeof DEV_PERSONAS)[number]['id'], name: string) => {
    setOpen(false);
    try {
      await signInDev(id);
      onNavigate?.();
      navigate('/dashboard');
      say(`Switched to ${name}`);
    } catch (e) {
      say(describeError(e).title);
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'grid', gap: 6 }}>
      <div className="sp-eyebrow" style={{ font: '600 10px var(--mono)', padding: '0 8px' }}>
        Signed in as
      </div>
      <div ref={wrap} style={{ position: 'relative' }}>
        {open && (
          <div className="menu-pop" role="menu" aria-label="Account" data-testid="user-menu-popover">
            {mode === 'dev' && (
              <>
                <div className="sp-eyebrow" style={{ font: '600 10px var(--mono)', padding: '4px 8px 2px' }}>
                  Switch demo account
                </div>
                {DEV_PERSONAS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    role="menuitem"
                    data-testid={`switch-${p.id}`}
                    onClick={() => void switchTo(p.id, p.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        display: 'grid',
                        placeItems: 'center',
                        font: '700 10px Geist',
                        flex: 'none',
                      }}
                    >
                      {p.initials}
                    </span>
                    {p.name}
                  </button>
                ))}
              </>
            )}
            <Link
              to="/profile"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
            >
              Profile and privacy
            </Link>
            <button
              type="button"
              role="menuitem"
              data-testid="sign-out"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
            >
              Sign out
            </button>
          </div>
        )}
        <button
          type="button"
          data-testid="user-menu"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          style={{
            width: '100%',
            minWidth: 0,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 8,
            borderRadius: 10,
            cursor: 'pointer',
            textAlign: 'left',
            background: 'var(--surface-2)',
            border: '1px solid var(--line-strong)',
          }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: 11,
              flex: 'none',
            }}
          >
            {user?.initials ?? '?'}
          </span>
          <span style={{ minWidth: 0 }}>
            <b style={{ display: 'block', fontSize: 13 }}>{user?.display_name ?? 'Account'}</b>
            <span
              style={{
                display: 'block',
                fontSize: 11,
                color: 'var(--ink-3)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.email ?? ''}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
