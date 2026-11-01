import type { Freshness, Quote, WatchlistItem } from '@/api/types';
import { getLiveQuote, useLiveQuote } from '@/realtime';
import { Pill, type Tone } from '@/ui';

const BADGE: Record<Freshness, { label: string; tone: Tone; hint: string }> = {
  live: { label: 'Live', tone: 'ok', hint: 'Streaming from the market data feed' },
  delayed: { label: 'Delayed', tone: 'warn', hint: 'Prices may be up to 15 minutes old' },
  stale: {
    label: 'Stale',
    tone: 'bad',
    hint: 'Older than 15 minutes. Market orders are blocked until the feed recovers',
  },
  closed: { label: 'Closed', tone: 'n', hint: 'Market closed. Showing the last price' },
};
const SESSION: Record<string, string> = { pre: 'Pre-market', post: 'After hours' };

const fmtTime = (iso: string): string => {
  const t = Date.parse(iso);
  return Number.isNaN(t)
    ? ''
    : new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

/** Freshness badge per quote (SPEC FR-15 / §6.4): Live, Delayed, Stale or Closed, with source and time as a tooltip. */
export function FreshnessBadge({
  quote,
  showSession = false,
}: {
  quote: Quote | null | undefined;
  showSession?: boolean;
}) {
  if (!quote)
    return (
      <Pill tone="n" data-testid="freshness" data-freshness="none" title="No quote received yet">
        No quote
      </Pill>
    );
  const b = BADGE[quote.freshness] ?? BADGE.delayed;
  const session = showSession ? SESSION[quote.session] : undefined;
  return (
    <Pill
      tone={b.tone}
      data-testid="freshness"
      data-freshness={quote.freshness}
      title={`${b.hint}. Source: ${quote.source}${quote.ts ? `, as of ${fmtTime(quote.ts)}` : ''}`}
    >
      {session ? `${b.label} · ${session}` : b.label}
    </Pill>
  );
}

const newer = (a: Quote | null | undefined, b: Quote | null | undefined): Quote | null => {
  if (!a) return b ?? null;
  if (!b) return a;
  return Date.parse(b.ts) >= Date.parse(a.ts) ? b : a;
};

/** The quote for one symbol: the latest of what the REST call returned and what the SSE stream pushed. */
export function useQuoteFor(symbol: string, polled: Quote | null | undefined): Quote | null {
  const live = useLiveQuote(symbol);
  return newer(polled, live);
}

/** Merge polled watchlist quotes with SSE pushes for a whole list (re-renders on any pushed quote). */
export function useMergedQuotes(items: readonly WatchlistItem[] | undefined): Map<string, Quote | null> {
  useLiveQuote(undefined); // subscribes to the live quote store
  const out = new Map<string, Quote | null>();
  for (const it of items ?? []) out.set(it.symbol, newer(it.quote, getLiveQuote(it.symbol)));
  return out;
}

/** `true` when any quote is a US-exchange price delivered by IEX (SPEC §6.4: show the IEX footnote). */
export const hasIexSource = (qs: Iterable<Quote | null>): boolean => {
  for (const q of qs) if (q && /iex/i.test(q.source)) return true;
  return false;
};
