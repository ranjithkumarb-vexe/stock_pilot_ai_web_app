import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { describeError } from '@/api/errors';
import type { UniverseItem } from '@/api/types';
import { Button } from '@/ui';
import { useAddTicker } from './api';

const MAX_OPTIONS = 8;

type Props = {
  universe: UniverseItem[] | undefined;
  universeLoading: boolean;
  /** symbols already on the watchlist */
  taken: ReadonlySet<string>;
  full: boolean;
  onAdded: (symbol: string) => void;
};

/**
 * Universe search + add. An ARIA combobox: type a ticker, company or sector, pick with the arrow keys or the mouse.
 * Unsupported tickers are refused here and again by the server (422 unsupported_symbol).
 */
export function AddTicker({ universe, universeLoading, taken, full, onAdded }: Props) {
  const add = useAddTicker();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const listId = useId();
  const optId = (i: number) => `${listId}-o${i}`;

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pool = (universe ?? []).filter(u => !taken.has(u.symbol));
    if (!needle) return pool.slice(0, MAX_OPTIONS);
    return pool
      .filter(u => `${u.symbol} ${u.name} ${u.sector}`.toLowerCase().includes(needle))
      .sort(
        (a, b) =>
          Number(b.symbol.toLowerCase() === needle) - Number(a.symbol.toLowerCase() === needle) ||
          Number(b.symbol.toLowerCase().startsWith(needle)) -
            Number(a.symbol.toLowerCase().startsWith(needle)),
      )
      .slice(0, MAX_OPTIONS);
  }, [universe, taken, q]);

  const submit = async (symbol: string | undefined) => {
    setProblem(null);
    const sym = (symbol ?? '').trim().toUpperCase();
    if (!sym) return setProblem('Type a ticker or company name, then choose one from the list.');
    if (taken.has(sym)) return setProblem(`${sym} is already on your watchlist.`);
    if (universe && !universe.some(u => u.symbol === sym))
      return setProblem(`${sym} is not in the supported universe (US large caps). Pick one from the list.`);
    try {
      await add.mutateAsync(sym);
      setQ('');
      setOpen(false);
      onAdded(sym);
    } catch (e) {
      const d = describeError(e);
      setProblem(
        d.serverMessage && d.code !== 'internal'
          ? `${d.title}. ${d.serverMessage}`
          : `${d.title}. ${d.message}`,
      );
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive(i => Math.min(matches.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(0, i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      void submit(open && matches[active] ? matches[active].symbol : q);
    }
  };

  const busy = add.isPending;
  return (
    <div style={{ display: 'grid', gap: 6, minWidth: 0, flex: '1 1 320px', maxWidth: 460 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <label htmlFor={`${listId}-in`} className="sr-only">
            Add a ticker from the supported universe
          </label>
          <input
            id={`${listId}-in`}
            data-testid="wl-search"
            role="combobox"
            aria-expanded={open && matches.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && matches[active] ? optId(active) : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder={universeLoading ? 'Loading tickers…' : 'Search ticker, company or sector'}
            value={q}
            disabled={full}
            onChange={e => {
              setQ(e.target.value);
              setOpen(true);
              setActive(0);
              setProblem(null);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onKeyDown={onKey}
            style={{
              width: '100%',
              height: 36,
              borderRadius: 8,
              border: '1px solid var(--line-strong)',
              background: 'var(--surface)',
              padding: '0 10px',
              fontSize: 13,
            }}
          />
          {open && matches.length > 0 && !full && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Matching tickers"
              data-testid="wl-options"
              style={{
                position: 'absolute',
                zIndex: 30,
                left: 0,
                right: 0,
                top: 40,
                margin: 0,
                padding: 4,
                listStyle: 'none',
                background: 'var(--surface)',
                border: '1px solid var(--line-strong)',
                borderRadius: 10,
                boxShadow: 'var(--shadow)',
                maxHeight: 320,
                overflowY: 'auto',
              }}
            >
              {matches.map((u, i) => (
                // keyboard users operate the options through the combobox input (aria-activedescendant)
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                <li
                  key={u.symbol}
                  id={optId(i)}
                  role="option"
                  aria-selected={i === active}
                  data-testid={`wl-option-${u.symbol}`}
                  onMouseDown={e => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => void submit(u.symbol)}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'baseline',
                    padding: '8px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: i === active ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  <b style={{ font: '600 13px var(--mono)', minWidth: 52 }}>{u.symbol}</b>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {u.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                    {u.sector}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {open && q.trim() && matches.length === 0 && !full && (
            <div
              role="status"
              data-testid="wl-no-match"
              style={{
                position: 'absolute',
                zIndex: 30,
                left: 0,
                right: 0,
                top: 40,
                padding: '10px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--line-strong)',
                borderRadius: 10,
                fontSize: 13,
                color: 'var(--ink-2)',
              }}
            >
              No supported ticker matches “{q.trim()}”.
            </div>
          )}
        </div>
        <Button
          variant="primary"
          disabled={full || busy}
          onClick={() => void submit(open && matches[active] ? matches[active].symbol : q)}
          data-testid="wl-add"
        >
          {busy ? 'Adding…' : 'Add to watchlist'}
        </Button>
      </div>
      <div aria-live="polite">
        {full && (
          <span data-testid="wl-full" style={{ fontSize: 12, color: 'var(--warn)' }}>
            Your watchlist is full. Remove a ticker to add another.
          </span>
        )}
        {problem && (
          <span
            role="alert"
            data-testid="wl-add-error"
            style={{ fontSize: 12, color: 'var(--loss)', fontWeight: 600 }}
          >
            {problem}
          </span>
        )}
      </div>
    </div>
  );
}
