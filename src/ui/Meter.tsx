/**
 * Rule meter: weight against cap. Bar scale is 1.6 x cap so the ink tick always sits at 62.5%.
 * Accent under 85% of the cap, warning to 100%, loss above (Design System: "Rule meter").
 */
export function meterTone(value: number, cap: number): 'accent' | 'warn' | 'loss' {
  const r = cap > 0 ? value / cap : 0;
  return r > 1 ? 'loss' : r >= 0.85 ? 'warn' : 'accent';
}

export function Meter({
  label,
  value,
  cap,
  display,
  labelWidth = 90,
}: {
  label: string;
  value: number;
  cap: number;
  display?: string;
  labelWidth?: number;
}) {
  const width = Math.max(0, Math.min(100, cap > 0 ? (value / (cap * 1.6)) * 100 : 0));
  const tone = meterTone(value, cap);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={cap}
      aria-valuenow={value}
      style={{
        display: 'grid',
        gridTemplateColumns: `${labelWidth}px 1fr 80px`,
        gap: 10,
        alignItems: 'center',
        fontSize: 12,
      }}
    >
      <span style={{ color: 'var(--ink-2)' }}>{label}</span>
      <span style={{ position: 'relative', height: 8, borderRadius: 4, background: 'var(--surface-2)' }}>
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            borderRadius: 4,
            width: `${width}%`,
            background: tone === 'loss' ? 'var(--loss)' : tone === 'warn' ? 'var(--warn)' : 'var(--accent)',
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: -3,
            bottom: -3,
            width: 2,
            left: '62.5%',
            background: 'var(--ink)',
          }}
        />
      </span>
      <span style={{ fontFamily: 'var(--mono)', textAlign: 'right' }}>{display ?? value.toFixed(1)}</span>
    </div>
  );
}
