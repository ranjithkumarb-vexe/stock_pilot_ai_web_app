import { useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { isApiError } from '@/api/errors';
import { useDevFeed, useMarketStatus } from '@/api/hooks/quotes';
import { reportEdgarDelayed, reportLlmDegraded, useSystemStatus } from '@/shell/systemStatus';
import { feedOf } from '@/features/trading/api';
import { Pill, useToast } from '@/ui';

type Drill = {
  key: string;
  label: string;
  desc: string;
  active: boolean;
  toggle: () => void;
  disabled?: boolean;
};

/**
 * Failure drills (design "Failure drills", maps to T-CHAOS-01, T-DATA-02, T-DATA-05). Dev auth mode only. The model
 * and filings drills raise the same global flags the real error paths raise; the feed drills use the backend's
 * `POST /v1/dev/feed`; the session drill expires the session the way the idle timer does.
 */
export function DrillsTab() {
  const { expireSession } = useAuth();
  const sys = useSystemStatus();
  const market = useMarketStatus();
  const devFeed = useDevFeed();
  const toast = useToast();
  const [offlineHint, setOfflineHint] = useState(false);
  const feed = feedOf(market.data) ?? 'live';
  const feedMissing = isApiError(devFeed.error) && devFeed.error.status === 404;

  const drills: Drill[] = [
    {
      key: 'llm',
      label: 'Model API rate limit (429)',
      desc: 'Brief and Ask fall back to cached content with a stale banner. Numbers stay verified.',
      active: sys.llmDegraded,
      toggle: () => reportLlmDegraded(!sys.llmDegraded),
    },
    {
      key: 'edgar',
      label: 'SEC EDGAR rate limit (429)',
      desc: 'Filing alerts are delayed. Backoff keeps requests under 8 per second.',
      active: sys.edgarDelayed,
      toggle: () => reportEdgarDelayed(!sys.edgarDelayed),
    },
    {
      key: 'stale',
      label: 'Quote feed goes stale (over 15 min)',
      desc: 'Market orders blocked, unusual-move alerts paused, stale banner shown.',
      active: feed === 'stale',
      toggle: () => devFeed.mutate(feed === 'stale' ? 'live' : 'stale'),
      disabled: feedMissing || devFeed.isPending,
    },
    {
      key: 'rec',
      label: 'Live feed disconnects',
      desc: 'Falls back to delayed polling and reconnects with backoff. Badge follows.',
      active: feed === 'reconnecting',
      toggle: () => devFeed.mutate(feed === 'reconnecting' ? 'live' : 'reconnecting'),
      disabled: feedMissing || devFeed.isPending,
    },
    {
      key: 'sess',
      label: 'Session expires',
      desc: 'Signs you out with a clear message. Ledger and drafts are saved.',
      active: false,
      toggle: () => void expireSession(),
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }} data-testid="drills">
      <section className="s3-card" style={{ padding: '8px 18px', gap: 0 }} aria-labelledby="drills-h">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            padding: '10px 0',
            borderBottom: '1px solid var(--line)',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2 id="drills-h" className="s3-h2 s3-h2--sm">
              Failure drills
            </h2>
            <div className="s3-sub">
              Trigger each failure to see how the app degrades. Maps to T-CHAOS-01, T-DATA-02, T-DATA-05.
            </div>
          </div>
          <button
            type="button"
            className="s3-btn-sm"
            data-testid="drills-clear"
            onClick={() => {
              reportLlmDegraded(false);
              reportEdgarDelayed(false);
              if (feed !== 'live' && !feedMissing) devFeed.mutate('live');
              toast.say('All drills cleared');
            }}
          >
            Clear all
          </button>
        </div>
        {drills.map(d => (
          <div
            key={d.key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              padding: '12px 0',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 13 }}>{d.label}</b>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{d.desc}</div>
            </div>
            <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Pill tone={d.active ? 'warn' : 'n'}>{d.active ? 'Active' : 'Normal'}</Pill>
              <button
                type="button"
                className="s3-btn-sm"
                data-testid={`drill-${d.key}`}
                disabled={d.disabled}
                aria-label={`${d.active ? 'Clear' : 'Trigger'}: ${d.label}`}
                onClick={d.toggle}
              >
                {d.active ? 'Clear' : 'Trigger'}
              </button>
            </span>
          </div>
        ))}
        <div style={{ padding: '12px 0', fontSize: 12, color: 'var(--ink-3)' }}>
          {feedMissing
            ? 'The feed drills need the backend dev endpoints, which are not available here. '
            : ''}
          {offlineHint ? (
            'To test offline behaviour, switch the browser to offline in the developer tools.'
          ) : (
            <button
              type="button"
              className="s3-btn-sm"
              style={{
                border: 0,
                background: 'transparent',
                textDecoration: 'underline',
                padding: 0,
                height: 'auto',
              }}
              onClick={() => setOfflineHint(true)}
            >
              How do I test offline?
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
