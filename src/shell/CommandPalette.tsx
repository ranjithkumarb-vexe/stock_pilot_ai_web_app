import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUniverse } from '@/api/hooks/watchlist';
import { useDevMarket } from '@/api/hooks/quotes';
import { useAuth } from '@/auth/useAuth';
import { Enter, Stagger } from '@/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { LogoMark } from '@/ui/Logo';
import { useFocusTrap } from '@/ui/useFocusTrap';
import { useShellUi } from './ShellUi';
import { SCREENS, type NavId } from './screens';
import { useShellStatus } from './useShellStatus';

type Item = { k: string; l: string; sub: string; run: () => void };

/** Router state used to hand a typed question to the Ask screen (`navigate('/ask', { state: { ask: 'text' } })`). */
export type AskState = { ask?: string };

const GO: NavId[] = [
  'dashboard',
  'watchlist',
  'portfolio',
  'proposals',
  'trading',
  'live',
  'alerts',
  'ask',
  'profile',
  'audit',
];
const MAX_ITEMS = 8;

/** Pure matcher so it can be unit tested: keeps items whose kind/label/sub contain the query, capped at 8 (design `palItems`). */
export function filterItems(items: Item[], q: string): Item[] {
  const s = q.trim().toLowerCase();
  return items.filter(x => !s || `${x.l} ${x.sub} ${x.k}`.toLowerCase().includes(s)).slice(0, MAX_ITEMS);
}

/** Command palette: Cmd/Ctrl+K toggles, ↑↓ navigate, Enter selects, Esc closes. */
export function CommandPalette() {
  const { paletteOpen, closePalette, togglePalette } = useShellUi();

  // global shortcut (design: metaKey||ctrlKey + K)
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePalette();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePalette]);

  if (!paletteOpen) return null;
  return createPortal(<PaletteDialog onClose={closePalette} />, document.body);
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const loc = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { mode } = useAuth();
  const universe = useUniverse();
  const st = useShellStatus();
  const devMarket = useDevMarket();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const listId = useId();
  useFocusTrap(panel, true, onClose);

  const items = useMemo(() => {
    const run = (fn: () => void) => () => {
      onClose();
      fn();
    };
    const list: Item[] = [];
    for (const id of GO) {
      const s = SCREENS[id];
      list.push({
        k: 'Go to',
        l: id === 'ask' ? 'Ask Pilot' : s.label,
        sub: s.sub,
        run: run(() => navigate(s.path)),
      });
    }
    for (const u of universe.data?.items ?? []) {
      list.push({
        k: 'Brief',
        l: `${u.symbol} · ${u.name}`,
        sub: u.sector,
        run: run(() => navigate(`/brief/${u.symbol}`)),
      });
    }
    list.push({
      k: 'Action',
      l: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      sub: 'Appearance',
      run: run(toggleTheme),
    });
    if (mode === 'dev' && st.marketKnown) {
      list.push({
        k: 'Action',
        l: st.open ? 'Simulate market closed' : 'Simulate market open',
        sub: 'Paper trading session',
        run: run(() => devMarket.mutate(!st.open)),
      });
    }
    return list;
    // devMarket.mutate is stable; navigate identity changes with location, which is fine to refresh on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universe.data, theme, mode, st.marketKnown, st.open, onClose, navigate, toggleTheme, loc.key]);

  const shown = useMemo(() => {
    const f = filterItems(items, q);
    const text = q.trim();
    if (text) {
      f.push({
        k: 'Ask Pilot',
        l: `Ask: "${text}"`,
        sub: 'Send to the assistant',
        run: () => {
          onClose();
          navigate('/ask', { state: { ask: text } satisfies AskState });
        },
      });
    }
    return f;
  }, [items, q, navigate, onClose]);

  const idx = Math.max(0, Math.min(sel, shown.length - 1));
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel(Math.min(shown.length - 1, idx + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel(Math.max(0, idx - 1));
    } else if (e.key === 'Enter' && shown[idx]) {
      e.preventDefault();
      shown[idx].run();
    }
  };

  return (
    <Enter
      kind="fade"
      className="palette"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
      data-testid="palette-backdrop"
    >
      <Enter kind="pop" className="palette__panel">
        <div ref={panel} role="dialog" aria-modal="true" aria-label="Command bar" data-testid="palette">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '16px 18px',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <LogoMark size={26} />
            <input
              data-autofocus
              data-testid="palette-input"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={shown[idx] ? `${listId}-${idx}` : undefined}
              aria-autocomplete="list"
              aria-label="Command bar"
              value={q}
              onChange={e => {
                setQ(e.target.value);
                setSel(0);
              }}
              onKeyDown={onKey}
              placeholder="Ask Pilot, open a brief, or jump to a screen"
              style={{
                flex: 1,
                minWidth: 0,
                border: 0,
                background: 'transparent',
                fontSize: 17,
                outline: 'none',
              }}
            />
            <kbd
              style={{
                font: '500 11px var(--mono)',
                border: '1px solid var(--line-strong)',
                borderRadius: 6,
                padding: '2px 6px',
                color: 'var(--ink-3)',
              }}
            >
              esc
            </kbd>
          </div>
          <Stagger
            id={listId}
            role="listbox"
            aria-label="Results"
            data-testid="palette-list"
            style={{ maxHeight: '46vh', overflowY: 'auto', padding: 8, display: 'grid', gap: 2 }}
          >
            {shown.map((x, i) => (
              <button
                key={`${x.k}-${x.l}`}
                id={`${listId}-${i}`}
                type="button"
                role="option"
                aria-selected={i === idx}
                tabIndex={-1}
                data-testid={`palette-item-${i}`}
                className="palette__item"
                onClick={x.run}
                onMouseMove={() => i !== idx && setSel(i)}
              >
                <span
                  style={{
                    font: '600 10px var(--mono)',
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    color: 'var(--accent)',
                  }}
                >
                  {x.k}
                </span>
                <span style={{ minWidth: 0 }}>
                  <b
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      display: 'block',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {x.l}
                  </b>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{x.sub}</span>
                </span>
              </button>
            ))}
            {shown.length === 0 && (
              <div style={{ padding: 16, fontSize: 13, color: 'var(--ink-3)' }}>No matches.</div>
            )}
          </Stagger>
          <div
            style={{
              display: 'flex',
              gap: 16,
              padding: '10px 18px',
              borderTop: '1px solid var(--line)',
              font: '500 11px var(--mono)',
              color: 'var(--ink-3)',
              flexWrap: 'wrap',
            }}
          >
            <span>↑↓ navigate</span>
            <span>⏎ select</span>
            <span>Type a question to ask Pilot</span>
          </div>
        </div>
      </Enter>
    </Enter>
  );
}
