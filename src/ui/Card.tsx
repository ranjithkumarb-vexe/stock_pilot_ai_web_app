import type { ElementType, HTMLAttributes } from 'react';
import './ui.css';

export function Card({
  as: Tag = 'section',
  accent,
  className,
  style,
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: ElementType; accent?: boolean }) {
  return (
    <Tag
      className={['sp-card', accent && 'sp-card--accent', className].filter(Boolean).join(' ')}
      style={{ display: 'grid', gap: 10, ...style }}
      {...rest}
    />
  );
}
