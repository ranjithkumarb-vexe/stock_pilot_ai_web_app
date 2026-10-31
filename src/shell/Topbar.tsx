import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useDevFeed, useDevMarket } from '@/api/hooks/quotes';
import { usePortfolio, usePortfolioRisk } from '@/api/hooks/portfolio';
import { useAuth } from '@/auth/useAuth';
import { useSpringStyle } from '@/motion';
import { toneStyle } from '@/ui/Pill';
import { Loop } from '@/motion';
import { Icon } from '@/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { useShellUi } from './ShellUi';
import { SCREENS, screenFromPath, type NavId } from './screens';
import { useShellStatus } from './useShellStatus';

const usd0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const pct2 = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
const FEED_CYCLE = ['live', 'delayed', 'reconnecting', 'stale'] as const;

/** Sticky header: title (collapses on scroll), portfolio HUD, command bar, market + feed chips, theme toggle. */
export function Topbar() {
  const { pathname } = useLocation();
  const screen = screenFromPath(pathname);
  const title = screen && screen in SCREENS ? SCREENS[screen as NavId].title : '';
  const { theme, toggleTheme } = useTheme();
  const { openPalette, setNavOpen } = useShellUi();
  const { mode } = useAuth();
  const st = useShellStatus();
  const pf = usePortfolio();
  const risk = usePortfolioRisk();
  const devMarket = useDevMarket();
  const devFeed = useDevFeed();

  // header collapses after 24 px of scroll (design: min-height 66 → 50, title 22 → 16, shadow fades in)
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const header = useRef<HTMLElement>(null);
  const shadow = useRef<HTMLSpanElement>(null);
  const ttl = useRef<HTMLHeadingElement>(null);
  useSpringStyle(header, { minHeight: scrolled ? 50 : 66 });
  useSpringStyle(shadow, { opacity: scrolled ? 1 : 0 });
  useSpringStyle(ttl, { fontSize: scrolled ? 16 : 22 });

  const p = pf.data;
  const segs = risk.data?.rules ?? [];
  const dev = mode === 'dev';
  const feedStyle = st.feed.tone === 'n' ? toneStyle.n : toneStyle[st.feed.tone];
  const mktStyle = !st.marketKnown ? toneStyle.n : st.open ? toneStyle.ok : toneStyle.warn;

  const cycleFeed = () => {
    const cur = FEED_CYCLE.indexOf(st.feed.state as (typeof FEED_CYCLE)[number]);
    devFeed.mutate(FEED_CYCLE[(cur + 1) % FEED_CYCLE.length] as (typeof FEED_CYCLE)[number]);
  };

  return (
    <header ref={header} className="topbar" data-testid="topbar">
      <span ref={shadow} aria-hidden="true" className="topbar__shadow" />
      <button
        type="button"
        className="topbar__menu"
        aria-label="Open navigation"
        data-testid="nav-toggle"
        onClick={() => setNavOpen(true)}
      >
        <Icon name="menu" />
      </button>
      <h1 ref={ttl} className="topbar__title" data-testid="page-title">
        {title}
      </h1>
      {p && (
        <div className="topbar__hud" title="Portfolio value, today, rule health" data-testid="hud">
          <span style={{ color: 'var(--ink-2)' }}>{usd0(p.equity)}</span>
          <span style={{ color: p.day_change_pct >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
            {pct2(p.day_change_pct)}
          </span>
          {segs.length > 0 && (
            <span
              style={{ display: 'flex', gap: 3 }}
              aria-label={`${segs.filter(r => r.status === 'ok').length} of ${segs.length} rules within limits`}
              role="img"
            >
              {segs.map(r => (
                <span
                  key={r.key}
                  style={{
                    width: 12,
                    height: 6,
                    borderRadius: 2,
                    background:
                      r.status === 'breach'
                        ? 'var(--loss)'
                        : r.status === 'warn'
                          ? 'var(--warn)'
                          : 'var(--accent)',
                  }}
                />
              ))}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        className="topbar__palette hv-cmd"
        aria-label="Open command bar"
        data-testid="palette-trigger"
        onClick={openPalette}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.6"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10 2l1.8 5.2L17 9l-5.200 1.800L10 16l-1.800-5.200L3 9l5.200-1.800z" />
        </svg>
        <span
          style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          Ask Pilot or jump to anything
        </span>
        <kbd>⌘K</kbd>
      </button>
      {dev ? (
        <button
          type="button"
          className="topbar__chip"
          data-testid="market-chip"
          title="Click to simulate market open or closed"
          style={mktStyle}
          disabled={!st.marketKnown || devMarket.isPending}
          onClick={() => devMarket.mutate(!st.open)}
        >
          <i />
          {st.marketLabel}
        </button>
      ) : (
        <span className="topbar__chip" data-testid="market-chip" style={mktStyle}>
          <i />
          {st.marketLabel}
        </span>
      )}
      {dev ? (
        <button
          type="button"
          className="topbar__chip"
          data-testid="feed-chip"
          title={`${st.feed.tip} Click to simulate another state.`}
          style={feedStyle}
          onClick={cycleFeed}
          disabled={!st.marketKnown || !st.open || devFeed.isPending}
        >
          <Loop as="i" kind={st.feed.loop} duration={1.2} />
          {st.feed.label}
        </button>
      ) : (
        <span className="topbar__chip" data-testid="feed-chip" title={st.feed.tip} style={feedStyle}>
          <Loop as="i" kind={st.feed.loop} duration={1.2} />
          {st.feed.label}
        </span>
      )}
      <button
        type="button"
        data-testid="theme-toggle"
        className="sp-iconbtn hv-surface-2"
        aria-label="Toggle theme"
        aria-pressed={theme === 'dark'}
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={toggleTheme}
      >
        <Icon name="moon" size={16} />
      </button>
    </header>
  );
}
