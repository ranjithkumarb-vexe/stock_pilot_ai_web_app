import { useMemo } from 'react';
import { useMarketStatus } from '@/api/hooks/quotes';
import type { FeedState } from '@/api/types';
import { useStream } from '@/realtime';
import { useOnline } from './hooks';

export type FeedView = {
  /** resolved feed state; 'closed' when outside the regular session */
  state: FeedState | 'closed' | 'unknown';
  label: string;
  tip: string;
  tone: 'ok' | 'warn' | 'bad' | 'n';
  loop: 'pulse' | '';
};

/** Labels and tooltips are the design's `FR` table; "Stale" drops the hard-coded "18 min" because the age is not known here. */
const TABLE: Record<FeedView['state'], Omit<FeedView, 'state'>> = {
  closed: {
    label: 'Closed · last close',
    tip: 'Outside the regular session. Showing the last close.',
    tone: 'n',
    loop: '',
  },
  live: { label: 'Live · IEX', tip: 'Streaming. Under 5 seconds old.', tone: 'ok', loop: '' },
  delayed: {
    label: 'Delayed · 15 min',
    tip: 'REST polling fallback. Prices are 15 minutes old.',
    tone: 'warn',
    loop: '',
  },
  reconnecting: {
    label: 'Reconnecting',
    tip: 'Live connection lost. Retrying with backoff.',
    tone: 'warn',
    loop: 'pulse',
  },
  stale: { label: 'Stale', tip: 'Older than 15 minutes in regular hours.', tone: 'bad', loop: '' },
  unknown: { label: 'Connecting', tip: 'Checking the market and feed status.', tone: 'n', loop: '' },
};

/** Market + feed state used by the top-bar chips, banners and (via context) screens. */
export function useShellStatus() {
  const market = useMarketStatus();
  const stream = useStream();
  const online = useOnline();

  return useMemo(() => {
    const m = market.data;
    const marketKnown = !!m;
    const open = m?.open ?? false;
    let state: FeedView['state'];
    if (!marketKnown) state = 'unknown';
    else if (!open) state = 'closed';
    else if (stream.state !== 'connected') state = 'reconnecting';
    else state = m?.feed ?? 'live';
    const view: FeedView = { state, ...TABLE[state] };
    return {
      marketKnown,
      open,
      marketLabel: !marketKnown ? 'US market status' : open ? 'US market open' : 'US market closed',
      feed: view,
      online,
      streamState: stream.state,
      apiUnreachable:
        market.isError && !!market.error && (market.error as { code?: string }).code === 'network_error',
    };
  }, [market.data, market.isError, market.error, stream.state, online]);
}
