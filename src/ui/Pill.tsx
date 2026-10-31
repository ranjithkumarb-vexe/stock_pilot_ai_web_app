import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import './ui.css';

/** The design's `CS` colour styles: ok(gain) warn bad(loss) info n(neutral) acc(accent). */
export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'n' | 'acc';

/** Same as `CS` in the design script, for places that need a style object (e.g. status buttons). */
export const toneStyle: Record<Tone, { background: string; color: string }> = {
  ok: { background: 'var(--gain-soft)', color: 'var(--gain)' },
  warn: { background: 'var(--warn-soft)', color: 'var(--warn)' },
  bad: { background: 'var(--loss-soft)', color: 'var(--loss)' },
  info: { background: 'var(--info-soft)', color: 'var(--info)' },
  n: { background: 'var(--surface-2)', color: 'var(--ink-2)' },
  acc: { background: 'var(--accent-soft)', color: 'var(--accent)' },
};

/** Status badge: always paired with a word, soft ground + strong text. */
export function Pill({
  tone = 'n',
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span className={['sp-pill', `sp-tone-${tone}`, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </span>
  );
}

/** Selectable filter chip (design `chipsOn`): accent gradient when pressed. */
export function Chip({
  pressed,
  className,
  children,
  type = 'button',
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & {
  pressed: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      className={['sp-chip', className].filter(Boolean).join(' ')}
      aria-pressed={pressed}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Round count badge used on nav items (alerts, proposals). */
export function Badge({ count, ...rest }: { count: number } & HTMLAttributes<HTMLSpanElement>) {
  if (count <= 0) return null;
  return (
    <span className="sp-badge" {...rest}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
