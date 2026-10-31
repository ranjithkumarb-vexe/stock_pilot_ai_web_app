import { useEffect, useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { Loop } from '@/motion';
import { useProposals } from '@/api/hooks/proposals';
import { usePortfolio } from '@/api/hooks/portfolio';
import { useWatchlist } from '@/api/hooks/watchlist';

type Agent = {
  col: string;
  ring: 'orbit' | '';
  ringLd: number;
  ping: 'ping' | '';
  core: 'breathe' | 'pulse';
  coreLd: number;
  label: string;
  status: string;
};

/** The "Pilot" status card (design `agLabel` / `pilotStatus`). Only states we can truthfully derive: reading, needs you, standing by. */
export function PilotCard() {
  const proposals = useProposals('pending');
  const watch = useWatchlist();
  const pf = usePortfolio();
  const busy = useIsMutating({
    predicate: m => ['briefs', 'chat'].includes(String(m.options.mutationKey?.[0])),
  });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 3200);
    return () => clearInterval(id);
  }, []);

  const pend = proposals.data?.items.length ?? 0;
  const A: Agent =
    busy > 0
      ? {
          col: 'var(--accent)',
          ring: 'orbit',
          ringLd: 2.4,
          ping: '',
          core: 'breathe',
          coreLd: 1,
          label: 'Pilot is reading',
          status: 'Reading filings and your rules',
        }
      : pend > 0
        ? {
            col: 'var(--warn)',
            ring: '',
            ringLd: 3,
            ping: 'ping',
            core: 'pulse',
            coreLd: 1.3,
            label: 'Pilot needs you',
            status: `${pend} proposal${pend === 1 ? '' : 's'} waiting for your decision`,
          }
        : {
            col: 'var(--ink-3)',
            ring: '',
            ringLd: 3,
            ping: '',
            core: 'breathe',
            coreLd: 4.5,
            label: 'Pilot standing by',
            status: 'Watching your portfolio and 8-K filings',
          };

  const nWatch = watch.data?.items.length;
  const nPos = pf.data?.positions.length;
  const lines = [
    nWatch != null
      ? `Monitoring the SEC 8-K feed for ${nWatch} ticker${nWatch === 1 ? '' : 's'}`
      : 'Monitoring the SEC 8-K feed',
    'Every number in a brief is computed in code and checked against filing data',
    nPos != null
      ? `Risk engine checks your rules against ${nPos} position${nPos === 1 ? '' : 's'}`
      : 'Risk engine checks your rules on every order',
    'Fetched filing text is scanned before it is used',
    'Your feed ranking adapts to how you use the app',
  ];
  const text = busy > 0 || pend > 0 ? A.status : (lines[tick % lines.length] as string);

  return (
    <div
      data-testid="pilot-card"
      style={{
        margin: '0 4px 14px',
        padding: 12,
        borderRadius: 14,
        border: '1px solid var(--line-strong)',
        background: 'var(--surface-2)',
        display: 'grid',
        gap: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          font: '600 11px var(--mono)',
          letterSpacing: '.06em',
          textTransform: 'uppercase',
        }}
      >
        <span
          style={{
            position: 'relative',
            display: 'inline-block',
            width: 30,
            height: 30,
            flex: 'none',
            lineHeight: 0,
            color: 'var(--ink)',
          }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 64 64"
            fill="none"
            style={{ overflow: 'visible' }}
            aria-hidden="true"
          >
            <Loop
              as="g"
              kind={A.ring}
              duration={A.ringLd}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            >
              <circle
                cx="32"
                cy="32"
                r="30"
                stroke={A.col}
                strokeWidth="2"
                strokeDasharray="3 9"
                strokeLinecap="round"
              />
            </Loop>
            <path d="M10 22V10h12M54 42v12H42" stroke="currentColor" strokeWidth="4" strokeLinecap="square" />
            <path
              d="M18 35l9 9 19-21"
              stroke={A.col}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Loop
              as="circle"
              kind={A.ping}
              duration={1.3}
              cx="46"
              cy="23"
              r="5"
              fill={A.col}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            />
            <Loop
              as="circle"
              kind={A.core}
              duration={A.coreLd}
              cx="46"
              cy="23"
              r="4.5"
              fill={A.col}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            />
          </svg>
        </span>
        <span style={{ color: A.col }}>{A.label}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-2)', minHeight: 36, lineHeight: 1.4 }}>{text}</div>
    </div>
  );
}
