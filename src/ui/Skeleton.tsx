import type { CSSProperties } from 'react';
import './ui.css';

/** Shimmering placeholder bar (design `bSkel`). Decorative: pair with aria-busy on the container. */
export function Skeleton({
  width = '100%',
  height = 12,
  style,
}: {
  width?: number | string;
  height?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      className="sp-skel"
      aria-hidden="true"
      style={{ width: typeof width === 'number' ? `${width}%` : width, height, ...style }}
    />
  );
}

export function SkeletonBlock({
  widths = [60, 100, 80],
  label = 'Loading',
}: {
  widths?: number[];
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="sp-card"
      style={{ display: 'grid', gap: 10, padding: 20 }}
    >
      {widths.map((w, i) => (
        <Skeleton key={i} width={w} />
      ))}
    </div>
  );
}
