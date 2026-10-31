import { Component, type ErrorInfo, type ReactNode } from 'react';
import { describeError } from '@/api/errors';
import { Button } from '@/ui/Button';

type Props = {
  children: ReactNode;
  /** when this value changes the boundary resets (e.g. the pathname) */ resetKey?: unknown;
  fallbackTitle?: string;
};
type State = { error: unknown | null };

/** Catches render errors in a subtree so the shell (nav, banners) stays usable. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('UI error boundary caught', error, info.componentStack);
  }

  override componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  override render(): ReactNode {
    if (this.state.error == null) return this.props.children;
    return (
      <ErrorPanel
        error={this.state.error}
        title={this.props.fallbackTitle}
        onRetry={() => this.setState({ error: null })}
      />
    );
  }
}

/** Friendly error card with a retry and the support reference (trace id). Also used for failed guards. */
export function ErrorPanel({
  error,
  title,
  onRetry,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}) {
  const d = describeError(error);
  return (
    <div role="alert" className="sp-error-card" data-testid="error-panel" style={{ maxWidth: 560 }}>
      <b style={{ color: 'var(--loss)' }}>{title ?? d.title}</b>
      <span style={{ fontSize: 13, color: 'var(--ink)' }}>{d.message}</span>
      {d.traceId && (
        <span style={{ font: '400 11px var(--mono)', color: 'var(--ink-3)' }}>Reference: {d.traceId}</span>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => window.location.assign('/dashboard')}>
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
