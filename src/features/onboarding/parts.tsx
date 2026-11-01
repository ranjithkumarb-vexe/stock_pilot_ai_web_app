import { forwardRef, type ReactNode } from 'react';

/** Heading block shared by every step. The h1 is focused on step change (screen-reader announcement). */
export const StepHeading = forwardRef<
  HTMLHeadingElement,
  { eyebrow: string; title: string; children?: ReactNode }
>(function StepHeading({ eyebrow, title, children }, ref) {
  return (
    <div>
      <div
        style={{
          font: '600 11px var(--mono)',
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </div>
      <h1
        ref={ref}
        tabIndex={-1}
        style={{
          fontFamily: 'var(--serif)',
          fontWeight: 500,
          fontSize: 'clamp(26px,4vw,36px)',
          lineHeight: 1.1,
          margin: '0 0 8px',
          outline: 'none',
        }}
      >
        {title}
      </h1>
      {children && <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 16 }}>{children}</p>}
    </div>
  );
});

export const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 14,
  boxShadow: 'var(--card-shadow)',
} as const;

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 600 }} aria-hidden="true">
        {label}
        {hint && <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}> ({hint})</span>}
      </div>
      {children}
    </div>
  );
}
