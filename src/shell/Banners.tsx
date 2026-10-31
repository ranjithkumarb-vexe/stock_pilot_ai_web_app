import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { Enter } from '@/motion';
import { qk } from '@/api/keys';
import { useDevFeed } from '@/api/hooks/quotes';
import { useAuth } from '@/auth/useAuth';
import { useStream } from '@/realtime';
import { screenFromPath } from './screens';
import { useShellStatus } from './useShellStatus';
import { useSystemStatus } from './systemStatus';

type Banner = {
  key: string;
  kind: string;
  tone: 'bad' | 'warn';
  text: string;
  action?: { label: string; run: () => void };
};

/** Global banners (design `banners`): offline, stale data, feed reconnecting, model unavailable, filings delayed, market closed. */
export function Banners() {
  const { pathname } = useLocation();
  const screen = screenFromPath(pathname);
  const st = useShellStatus();
  const sys = useSystemStatus();
  const qc = useQueryClient();
  const stream = useStream();
  const { mode } = useAuth();
  const devFeed = useDevFeed();

  const refresh = () => {
    stream.reconnect();
    void qc.invalidateQueries({ queryKey: qk.market });
    void qc.invalidateQueries({ queryKey: qk.quotes.all });
  };
  const list: Banner[] = [];
  if (!st.online)
    list.push({
      key: 'offline',
      kind: 'OFFLINE',
      tone: 'bad',
      text: 'You are offline. Showing the last saved data. Orders and rule changes are paused until the connection returns.',
      action: { label: 'Retry', run: refresh },
    });
  else if (st.apiUnreachable)
    list.push({
      key: 'unreachable',
      kind: 'OFFLINE',
      tone: 'bad',
      text: 'Cannot reach the StockPilot service. Showing the last saved data. Orders and rule changes are paused until the connection returns.',
      action: { label: 'Retry', run: refresh },
    });
  if (st.feed.state === 'stale')
    list.push({
      key: 'stale',
      kind: 'STALE DATA',
      tone: 'warn',
      text: 'Prices are more than 15 minutes old. Unusual-move alerts are paused and market orders are blocked until the feed recovers.',
      action: { label: 'Retry feed', run: () => (mode === 'dev' ? devFeed.mutate('live') : refresh()) },
    });
  if (st.feed.state === 'reconnecting' && st.online)
    list.push({
      key: 'feed',
      kind: 'FEED',
      tone: 'warn',
      text: 'The live connection was lost. Using delayed REST polling while reconnecting with backoff. Prices may be up to 15 minutes old.',
      action: { label: 'Reconnect now', run: refresh },
    });
  if (sys.llmDegraded && (screen === 'brief' || screen === 'ask' || screen === 'dashboard'))
    list.push({
      key: 'llm',
      kind: 'MODEL UNAVAILABLE',
      tone: 'warn',
      text: 'The model is unavailable or rate limited. Showing cached content where available and retrying with backoff. Numbers are unchanged because they come from code.',
    });
  if (sys.edgarDelayed && (screen === 'alerts' || screen === 'dashboard'))
    list.push({
      key: 'edgar',
      kind: 'FILINGS DELAYED',
      tone: 'warn',
      text: 'SEC EDGAR asked us to slow down (429). New 8-K alerts may arrive late while we back off to under 8 requests per second.',
    });
  if (st.marketKnown && !st.open && (screen === 'trading' || screen === 'live'))
    list.push({
      key: 'closed',
      kind: 'MARKET CLOSED',
      tone: 'warn',
      text: 'The market is closed. Paper market orders queue and fill at the next open. Day limit orders expire at the close.',
    });

  // the live region stays mounted so announcements are read when a banner appears
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="banners"
      style={{ display: list.length ? 'grid' : 'contents', gap: 8 }}
    >
      {list.map(b => (
        <Enter
          key={b.key}
          kind="rise"
          data-testid={`banner-${b.key}`}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 13,
            background: b.tone === 'bad' ? 'var(--loss-soft)' : 'var(--warn-soft)',
          }}
        >
          <b style={{ flex: 'none', font: '600 11px var(--mono)', letterSpacing: '.06em', paddingTop: 2 }}>
            {b.kind}
          </b>
          <span style={{ flex: '1 1 280px', color: 'var(--ink)' }}>{b.text}</span>
          {b.action && (
            <button
              type="button"
              onClick={b.action.run}
              style={{
                height: 28,
                padding: '0 12px',
                borderRadius: 7,
                border: '1px solid var(--line-strong)',
                background: 'var(--surface)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {b.action.label}
            </button>
          )}
        </Enter>
      ))}
    </div>
  );
}
