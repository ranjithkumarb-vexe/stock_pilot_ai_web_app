import { useId, useRef, type KeyboardEvent } from 'react';
import './ui.css';

export type SegOption<V extends string> = { value: V; label: string };

type Props<V extends string> = {
  options: ReadonlyArray<SegOption<V> | V>;
  value: V;
  onChange: (v: V) => void;
  'aria-label': string;
  testId?: string;
};

/** Pill-in-tray switch (design `segs`). Radio-group semantics with arrow-key navigation. */
export function SegmentedControl<V extends string>({ options, value, onChange, testId, ...rest }: Props<V>) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
  // roving tabindex: when the current value is not among the options (e.g. an empty profile field) the first option stays reachable
  const tabbable = opts.some(o => o.value === value) ? value : opts[0]?.value;
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = opts[(i + (e.key === 'ArrowRight' ? 1 : opts.length - 1)) % opts.length];
    if (!next) return;
    onChange(next.value);
    ref.current?.querySelectorAll('button')[opts.indexOf(next)]?.focus();
  };
  return (
    <div ref={ref} className="sp-seg" role="radiogroup" data-testid={testId} {...rest}>
      {opts.map((o, i) => (
        <button
          key={`${id}-${o.value}`}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === tabbable ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={e => onKey(e, i)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
