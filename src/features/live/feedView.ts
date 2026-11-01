import type { FeedState } from '@/api/types';
import type { StreamState } from '@/realtime';

export type FeedView = { label: string; tip: string; tone: 'ok' | 'warn' | 'bad' | 'n'; loop: 'pulse' | '' };

/** Same labels as the top-bar chip (design `FR`), resolved from /market/status (feed_state) and the SSE state. */
export function feedView(
  known: boolean,
  open: boolean,
  feed: FeedState | undefined,
  stream: StreamState,
): FeedView {
  if (!known)
    return { label: 'Connecting', tip: 'Checking the market and feed status.', tone: 'n', loop: '' };
  if (!open)
    return {
      label: 'Closed · last close',
      tip: 'Outside the regular session. Showing the last close.',
      tone: 'n',
      loop: '',
    };
  const state: FeedState = stream !== 'connected' ? 'reconnecting' : (feed ?? 'live');
  switch (state) {
    case 'delayed':
      return {
        label: 'Delayed · 15 min',
        tip: 'REST polling fallback. Prices are 15 minutes old.',
        tone: 'warn',
        loop: '',
      };
    case 'stale':
      return { label: 'Stale', tip: 'Older than 15 minutes in regular hours.', tone: 'bad', loop: '' };
    case 'reconnecting':
      return {
        label: 'Reconnecting',
        tip: 'Live connection lost. Retrying with backoff.',
        tone: 'warn',
        loop: 'pulse',
      };
    default:
      return { label: 'Live · IEX', tip: 'Streaming. Under 5 seconds old.', tone: 'ok', loop: '' };
  }
}
