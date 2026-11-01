import type { ReactNode } from 'react';
import { describeError } from '@/api/errors';
import { Button, Skeleton } from '@/ui';

/** Dashboard card chrome (design: surface, 1px line, 14px radius, card shadow). */
export const card = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 14,
  boxShadow: 'var(--card-shadow)',
} as const;

export function Panel({
  title,
  aside,
  children,
  testId,
  padding = 18,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  testId?: string;
  padding?: number;
}) {
  return (
    <section
      style={{ ...card, padding, display: 'grid', gap: 10, alignContent: 'start', minWidth: 0 }}
      data-testid={testId}
      aria-label={title}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ font: "600 14px 'Geist'", margin: 0 }}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Inline, per-section error with retry: a failing endpoint never takes the whole dashboard down. */
export function SectionError({
  error,
  onRetry,
  what,
}: {
  error: unknown;
  onRetry?: () => void;
  what: string;
}) {
  const d = describeError(error);
  return (
    <div
      role="alert"
      data-testid="section-error"
      style={{
        background: 'var(--loss-soft)',
        borderRadius: 10,
        padding: '10px 12px',
        display: 'grid',
        gap: 4,
        fontSize: 13,
      }}
    >
      <b style={{ color: 'var(--loss)' }}>Could not load {what}</b>
      <span style={{ color: 'var(--ink)' }}>{d.message}</span>
      {d.traceId && (
        <span style={{ font: '400 11px var(--mono)', color: 'var(--ink-3)' }}>Reference: {d.traceId}</span>
      )}
      {onRetry && (
        <div>
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

export function SkeletonLines({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} style={{ display: 'grid', gap: 10 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} width={i === 0 ? 45 : i % 2 ? 100 : 75} height={12} />
      ))}
    </div>
  );
}

export const Eyebrow = ({ children }: { children: ReactNode }) => (
  <span
    style={{
      font: '600 11px var(--mono)',
      letterSpacing: '.1em',
      color: 'var(--ink-3)',
      textTransform: 'uppercase',
    }}
  >
    {children}
  </span>
);
