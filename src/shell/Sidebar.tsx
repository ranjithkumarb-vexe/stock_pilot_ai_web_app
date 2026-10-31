import { useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAlerts } from '@/api/hooks/alerts';
import { useProposals } from '@/api/hooks/proposals';
import { useWatchlist } from '@/api/hooks/watchlist';
import { useSpringStyle } from '@/motion';
import { Badge, Icon, Wordmark } from '@/ui';
import { PilotCard } from './PilotCard';
import { UserMenu } from './UserMenu';
import { NAV_ORDER, SCREENS, navIndex, screenFromPath, type NavId } from './screens';
import { useLastTicker } from './lastTicker';

/** Primary navigation (design sidebar). `onNavigate` lets the mobile drawer close itself. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const current = screenFromPath(pathname);
  const idx = navIndex(current);
  const proposals = useProposals('pending');
  const alerts = useAlerts({ state: 'new' });
  const [lastTicker] = useLastTicker();
  const watch = useWatchlist();
  const ticker = lastTicker || watch.data?.items[0]?.symbol || '';
  const badges: Partial<Record<NavId, number>> = {
    proposals: proposals.data?.items.length ?? 0,
    alerts: alerts.data?.items.length ?? 0,
  };

  const indicator = useRef<HTMLSpanElement>(null);
  // the soft accent block glides to the active item (design `navSp`: y = index * 42)
  useSpringStyle(indicator, { y: Math.max(0, idx) * 42, opacity: idx >= 0 ? 1 : 0 });

  return (
    <>
      <div style={{ padding: '0 8px 18px' }}>
        <Wordmark />
      </div>
      <PilotCard />
      <nav
        aria-label="Primary"
        style={{ position: 'relative', display: 'grid', gap: 2 }}
        data-testid="primary-nav"
      >
        <span
          ref={indicator}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 40,
            borderRadius: 10,
            background: 'var(--accent-soft)',
            boxShadow: 'inset 3px 0 0 var(--accent)',
          }}
        />
        {NAV_ORDER.map(id => {
          const s = SCREENS[id];
          const to = id === 'brief' && ticker ? `/brief/${ticker}` : s.path;
          const n = badges[id] ?? 0;
          return (
            <NavLink
              key={id}
              to={to}
              data-testid={`nav-${id}`}
              aria-label={n > 0 ? `${s.label}, ${n} new` : s.label}
              aria-current={current === id ? 'page' : undefined}
              className="nav-item"
              data-hs="1"
              data-hx="3"
              onClick={onNavigate}
            >
              <Icon name={s.icon} />
              <span style={{ flex: 1 }}>{s.label}</span>
              <Badge count={n} data-testid={`nav-badge-${id}`} />
            </NavLink>
          );
        })}
      </nav>
      <div style={{ flex: 1 }} />
      <UserMenu onNavigate={onNavigate} />
    </>
  );
}
