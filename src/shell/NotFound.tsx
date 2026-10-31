import { Link } from 'react-router-dom';
import { LogoMark } from '@/ui/Logo';

export function NotFound() {
  return (
    <main
      id="main"
      data-testid="not-found"
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}
    >
      <div style={{ display: 'grid', gap: 14, justifyItems: 'start', maxWidth: 460 }}>
        <LogoMark size={40} animate={false} />
        <div className="sp-eyebrow">Error 404</div>
        <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 36, lineHeight: 1.1, margin: 0 }}>
          This page does not exist
        </h1>
        <p style={{ margin: 0, color: 'var(--ink-2)' }}>
          The link may be out of date, or the page was moved. Your portfolio and settings are unaffected.
        </p>
        <Link to="/dashboard" data-testid="not-found-home" style={{ fontWeight: 600 }}>
          Back to the dashboard
        </Link>
      </div>
    </main>
  );
}
