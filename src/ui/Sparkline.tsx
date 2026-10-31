/** Maps a numeric series onto the design's 72x22 sparkline polyline (x step 4.6, y from 20 down to 2). */
export function sparkPoints(values: number[]): string {
  if (values.length === 0) return '';
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const span = mx - mn || 1;
  const step = values.length > 1 ? (15 * 4.6) / (values.length - 1) : 0;
  return values
    .map((y, i) => `${(i * step).toFixed(1)},${(20 - ((y - mn) / span) * 18).toFixed(1)}`)
    .join(' ');
}

export function Sparkline({
  values,
  positive,
  width = 72,
  height = 22,
  label,
}: {
  values: number[];
  /** colours the line with --gain / --loss */
  positive: boolean;
  width?: number;
  height?: number;
  label?: string;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 72 22"
      fill="none"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <polyline
        points={sparkPoints(values)}
        stroke={positive ? 'var(--gain)' : 'var(--loss)'}
        strokeWidth="1.5"
      />
    </svg>
  );
}
