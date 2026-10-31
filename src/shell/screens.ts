import type { IconName } from '@/ui/icons';

/** Nav order exactly as in the design (also drives the direction of page transitions). */
export const NAV_ORDER = [
  'dashboard',
  'watchlist',
  'brief',
  'portfolio',
  'proposals',
  'trading',
  'live',
  'alerts',
  'ask',
  'profile',
  'audit',
] as const;
export type NavId = (typeof NAV_ORDER)[number];
export type ScreenId = NavId | 'signin' | 'onboarding';

/** Page titles and nav labels from the design (`titles` / `nav` in renderVals). */
export const SCREENS: Record<
  NavId,
  { path: string; label: string; title: string; icon: IconName; sub: string }
> = {
  dashboard: {
    path: '/dashboard',
    label: 'Dashboard',
    title: 'Dashboard',
    icon: 'dashboard',
    sub: 'Mission control',
  },
  watchlist: {
    path: '/watchlist',
    label: 'Watchlist',
    title: 'Watchlist',
    icon: 'watchlist',
    sub: 'Tracked tickers',
  },
  brief: {
    path: '/brief',
    label: 'Research brief',
    title: 'Research brief',
    icon: 'brief',
    sub: 'Source-checked company brief',
  },
  portfolio: {
    path: '/portfolio',
    label: 'Portfolio and risk',
    title: 'Portfolio and risk',
    icon: 'portfolio',
    sub: 'Weights, rules, equity curve',
  },
  proposals: {
    path: '/proposals',
    label: 'Proposals',
    title: 'Proposals',
    icon: 'proposals',
    sub: 'Pending decisions',
  },
  trading: {
    path: '/trading',
    label: 'Paper trading',
    title: 'Paper trading',
    icon: 'trading',
    sub: 'Order ticket and ledger',
  },
  live: {
    path: '/live',
    label: 'Live market',
    title: 'Live market',
    icon: 'live',
    sub: 'Chart, order book and tape',
  },
  alerts: {
    path: '/alerts',
    label: 'Alerts',
    title: 'Alerts',
    icon: 'alerts',
    sub: 'Filings, moves, breaches',
  },
  ask: {
    path: '/ask',
    label: 'Ask',
    title: 'Ask StockPilot',
    icon: 'ask',
    sub: 'Chat over filings and portfolio',
  },
  profile: {
    path: '/profile',
    label: 'Profile and privacy',
    title: 'Profile and privacy',
    icon: 'profile',
    sub: 'What Pilot learned',
  },
  audit: {
    path: '/audit',
    label: 'Audit and evals',
    title: 'Audit and evals',
    icon: 'audit',
    sub: 'Traces and tests',
  },
};

/** Resolve the screen id from a pathname (`/brief/JNJ` → `brief`). */
export function screenFromPath(pathname: string): ScreenId | null {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (!seg) return null;
  if (seg === 'signin' || seg === 'onboarding') return seg;
  return (NAV_ORDER as readonly string[]).includes(seg) ? (seg as NavId) : null;
}

export const navIndex = (id: ScreenId | null): number =>
  id ? (NAV_ORDER as readonly string[]).indexOf(id) : -1;
