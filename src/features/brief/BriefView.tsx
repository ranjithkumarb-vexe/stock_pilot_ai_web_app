import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  isApiError,
  useAddToWatchlist,
  useBrief,
  useGenerateBrief,
  usePortfolio,
  usePortfolioRisk,
  useQuotes,
  useRemoveFromWatchlist,
  useWatchlist,
  useWhy,
} from '@/api';
import { describeError } from '@/api/errors';
import type { Brief, BriefSection, Uuid } from '@/api/types';
import { money0, money2, dateTime, signedPct } from '@/features/portfolio/format';
import { Stagger } from '@/motion';
import { useLiveQuote } from '@/realtime';
import { DISCLAIMER_TEXT } from '@/shell/disclaimer';
import { ErrorPanel } from '@/shell/ErrorBoundary';
import { reportLlmDegraded } from '@/shell/systemStatus';
import { useLastTicker } from '@/shell/lastTicker';
import { useTrack } from '@/telemetry';
import { Button, Pill, SegmentedControl, SkeletonBlock, useToast } from '@/ui';
import { CitationDrawer, type DrawerSource } from './CitationDrawer';
import { GeneratingPanel } from './LoadingPanel';
import { SectionCard, type Feedback } from './SectionCard';
import {
  DEPTHS,
  citationForLedger,
  citationNumbers,
  initialDepth,
  ledgerEntries,
  orderSections,
  pinnedKey,
  type Depth,
} from './helpers';
import './brief.css';

const card = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 14,
  boxShadow: 'var(--card-shadow)',
} as const;

const FRESHNESS: Record<string, string> = {
  live: 'live prices',
  delayed: 'prices delayed',
  stale: 'prices stale',
  closed: 'market closed',
};

/** Empty state: the API has no brief for this ticker yet (GET 404) -> offer to generate one. */
function NoBrief({ symbol, onGenerate, busy }: { symbol: string; onGenerate: () => void; busy: boolean }) {
  return (
    <div
      className="sp-empty"
      data-testid="brief-empty"
      style={{ padding: 40, justifyItems: 'center', gap: 12 }}
    >
      <div style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>No brief for {symbol} yet</div>
      <div style={{ color: 'var(--ink-2)', maxWidth: 440 }}>
        Pilot reads the latest filing, matches every number to XBRL and cites each claim. This takes a few
        seconds.
      </div>
      <Button variant="primary" onClick={onGenerate} disabled={busy} data-testid="brief-generate">
        Generate brief
      </Button>
    </div>
  );
}

export function BriefView({ symbol }: { symbol: string }) {
  const navigate = useNavigate();
  const track = useTrack();
  const toast = useToast();
  const [, setLastTicker] = useLastTicker();

  const briefQ = useBrief(symbol);
  const gen = useGenerateBrief();
  const watch = useWatchlist();
  const addWatch = useAddToWatchlist();
  const removeWatch = useRemoveFromWatchlist();
  const quotes = useQuotes([symbol]);
  const liveQuote = useLiveQuote(symbol);
  const portfolio = usePortfolio();
  const risk = usePortfolioRisk();

  const brief: Brief | undefined = briefQ.data;
  const why = useWhy('brief', brief?.id ?? '', !!brief?.id);

  const [depthChoice, setDepth] = useState<Depth | null>(null);
  // the user's choice wins; until then the style card's depth (if the API sent one), else Standard
  const depth: Depth = depthChoice ?? initialDepth(brief?.style_card);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [source, setSource] = useState<DrawerSource | null>(null);

  useEffect(() => setLastTicker(symbol), [symbol, setLastTicker]);

  // telemetry: viewing the ticker and opening its brief
  const briefId = brief?.id;
  const briefStatus = brief?.status;
  useEffect(() => {
    if (!briefId) return;
    track({ type: 'ticker_viewed', entity: { ticker: symbol } });
    track({ type: 'brief_opened', entity: { ticker: symbol }, props: { status: briefStatus } });
  }, [briefId, briefStatus, symbol, track]);

  // the shell shows MODEL UNAVAILABLE while a degraded brief is on screen
  const degraded = brief?.status === 'degraded';
  useEffect(() => {
    reportLlmDegraded(degraded);
    return () => reportLlmDegraded(false);
  }, [degraded]);

  const sections = useMemo(() => (brief ? orderSections(brief) : []), [brief]);
  const nums = useMemo(
    () => (brief ? citationNumbers(brief, sections) : new Map<Uuid, number>()),
    [brief, sections],
  );
  const entries = useMemo(() => (brief ? ledgerEntries(brief) : []), [brief]);
  const pinned = useMemo(() => (brief ? pinnedKey(brief, entries) : null), [brief, entries]);

  const quote = liveQuote ?? quotes.data?.items?.[0];
  const watchItem = watch.data?.items.find(w => w.symbol === symbol);
  const inWatch = !!watchItem;
  const position = portfolio.data?.positions.find(p => p.symbol === symbol);
  const posCap = risk.data?.rules.find(r => r.key === 'pos')?.limit;

  const generate = () =>
    gen.mutate(symbol, {
      onSuccess: b => toast.say(b.status === 'degraded' ? 'Brief ready in summary mode' : 'Brief ready'),
    });

  const open = (id: Uuid, sectionRows?: BriefSection['rows']) => {
    setSource({ kind: 'citation', id, sectionRows });
    track({ type: 'metric_clicked', entity: { ticker: symbol }, props: { action: 'citation' } });
  };

  const rate = (key: string, title: string, v: 'up' | 'down') => {
    if (feedback[key] === v) return;
    setFeedback(f => ({ ...f, [key]: v }));
    track({ type: v === 'up' ? 'thumbs_up' : 'thumbs_down', entity: { ticker: symbol, section: key } });
    toast.say(
      v === 'up'
        ? 'Thanks. This section style will rank higher.'
        : `Thanks. ${title} will rank lower for you.`,
    );
  };

  const toggle = (key: string, isExpanded: boolean) => {
    setExpanded(e => ({ ...e, [key]: !isExpanded }));
    if (!isExpanded) track({ type: 'section_expanded', entity: { ticker: symbol, section: key } });
  };

  const watchChips = watch.data?.items ?? [];
  const notBuilt = briefQ.isError && isApiError(briefQ.error) && briefQ.error.status === 404;
  const generating = gen.isPending;

  return (
    <div data-testid="screen-brief" data-symbol={symbol} style={{ display: 'grid', gap: 20 }}>
      <div
        aria-hidden="true"
        data-m="scroll-prog"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          zIndex: 60,
          background: 'var(--accent)',
          transformOrigin: '0 50%',
        }}
      />

      {watchChips.length > 0 && (
        <nav aria-label="Watchlist tickers" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {watchChips.map(w => (
            <Link
              key={w.symbol}
              to={`/brief/${w.symbol}`}
              className="br-chip"
              aria-current={w.symbol === symbol ? 'true' : undefined}
              data-testid={`brief-chip-${w.symbol}`}
              style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
            >
              {w.symbol}
            </Link>
          ))}
        </nav>
      )}

      <section
        aria-label={`${symbol} overview`}
        style={{
          ...card,
          padding: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h2
              data-testid="brief-name"
              style={{
                fontFamily: 'var(--serif)',
                fontWeight: 500,
                fontSize: 34,
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              {brief?.name ?? watchItem?.name ?? symbol}
            </h2>
            <span style={{ font: '600 13px var(--mono)', color: 'var(--ink-3)' }}>{symbol}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {watchItem?.sector && <Pill tone="n">{watchItem.sector}</Pill>}
            {brief &&
              (brief.citations_summary.unverified_numbers === 0 ? (
                <Pill tone="ok" data-testid="verified-badge">
                  &#10003; All numbers verified against XBRL
                </Pill>
              ) : (
                <Pill tone="warn" data-testid="unverified-badge">
                  {brief.citations_summary.unverified_numbers} number
                  {brief.citations_summary.unverified_numbers === 1 ? '' : 's'} not verified
                </Pill>
              ))}
            {brief && (
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }} data-testid="brief-meta">
                Brief generated {dateTime(brief.generated_at)}
                {quote ? ` · ${FRESHNESS[quote.freshness] ?? quote.freshness}` : ''}
                {` · ${Math.round(brief.citations_summary.coverage_pct)}% of statements cited`}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {quote && (
            <div style={{ textAlign: 'right' }} data-testid="brief-quote">
              <div style={{ font: '500 30px/1 var(--mono)' }}>{money2(quote.price)}</div>
              <div
                style={{
                  font: '500 13px var(--mono)',
                  marginTop: 4,
                  color: quote.change_pct >= 0 ? 'var(--gain)' : 'var(--loss)',
                }}
              >
                {signedPct(quote.change_pct, 2)}
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gap: 6 }}>
            <Button
              variant="primary"
              onClick={() => navigate('/trading', { state: { ticket: { symbol, side: 'buy', qty: 1 } } })}
              data-testid="brief-open-ticket"
            >
              Open order ticket
            </Button>
            <Button
              variant="secondary"
              disabled={watch.isLoading || addWatch.isPending || removeWatch.isPending}
              data-testid="brief-toggle-watch"
              onClick={() =>
                (inWatch ? removeWatch : addWatch).mutate(symbol, {
                  onSuccess: () => toast.say(inWatch ? 'Removed from watchlist' : 'Added to watchlist'),
                  onError: e => toast.say(describeError(e).message),
                })
              }
            >
              {inWatch ? 'Remove from watchlist' : 'Add to watchlist'}
            </Button>
          </div>
        </div>
      </section>

      {gen.isError && (
        <ErrorPanel error={gen.error} title="Could not generate the brief" onRetry={generate} />
      )}

      {generating && <GeneratingPanel symbol={symbol} />}

      {!generating && briefQ.isLoading && (
        <div data-testid="brief-loading">
          <SkeletonBlock label={`Loading ${symbol} brief`} widths={[70, 96, 88, 92, 60, 84, 40]} />
        </div>
      )}

      {!generating && briefQ.isError && notBuilt && (
        <NoBrief symbol={symbol} onGenerate={generate} busy={generating} />
      )}
      {!generating && briefQ.isError && !notBuilt && (
        <ErrorPanel error={briefQ.error} onRetry={() => void briefQ.refetch()} />
      )}

      {!generating && brief && (
        <>
          {degraded && (
            <div
              role="status"
              data-testid="brief-degraded"
              style={{
                background: 'var(--warn-soft)',
                color: 'var(--ink)',
                border: '1px solid var(--warn)',
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
                fontSize: 13,
              }}
            >
              <b style={{ color: 'var(--warn)' }}>SUMMARY MODE</b>
              <span style={{ flex: 1, minWidth: 220 }}>
                The AI model was unavailable, so this brief uses safe templates. Every number is still
                produced by code and cited. Try again later for the full write-up.
              </span>
              <Button size="sm" variant="secondary" onClick={generate} disabled={generating}>
                Try again
              </Button>
            </div>
          )}
          {brief.stale && (
            <div
              role="status"
              data-testid="brief-stale"
              style={{
                background: 'var(--info-soft)',
                border: '1px solid var(--info)',
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
                fontSize: 13,
              }}
            >
              <b style={{ color: 'var(--info)' }}>OUT OF DATE</b>
              <span style={{ flex: 1, minWidth: 220 }}>
                {brief.stale_reason ?? 'Newer filings or prices are available than this brief used.'}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={generate}
                disabled={generating}
                data-testid="brief-refresh"
              >
                Refresh brief
              </Button>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Depth</span>
              <SegmentedControl
                aria-label="Brief depth"
                options={DEPTHS}
                value={depth}
                onChange={setDepth}
                testId="brief-depth"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={generate}
                disabled={generating}
                data-testid="brief-regenerate"
              >
                Regenerate
              </Button>
            </div>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              Click any number or citation to see the filing text and XBRL value.
            </span>
          </div>

          {entries.length > 0 && (
            <Stagger
              data-testid="brief-tiles"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}
            >
              {entries.slice(0, 6).map(([key, e]) => (
                <button
                  key={key}
                  type="button"
                  className="br-tile"
                  data-testid={`tile-${key}`}
                  onClick={() => {
                    const cid = citationForLedger(brief, key);
                    setSource(cid ? { kind: 'citation', id: cid } : { kind: 'ledger', key });
                    track({ type: 'metric_clicked', entity: { ticker: symbol, metric: e.label } });
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '2px 6px',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: 'var(--ink-2)',
                    }}
                  >
                    <span>{e.label}</span>
                    {key === pinned && (
                      <span style={{ font: '600 10px var(--mono)', color: 'var(--accent)' }}>PINNED</span>
                    )}
                  </span>
                  <span style={{ font: '500 22px var(--mono)' }}>{e.display}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', overflowWrap: 'anywhere' }}>
                    <span style={{ color: 'var(--gain)' }}>&#10003;</span> {e.source}
                  </span>
                </button>
              ))}
            </Stagger>
          )}

          <div className="br-layout">
            <Stagger className="br-main" data-testid="brief-sections">
              {sections.map(s => (
                <SectionCard
                  key={s.key}
                  brief={brief}
                  section={s}
                  nums={nums}
                  depth={depth}
                  expanded={expanded[s.key] ?? depth !== 'tldr'}
                  onToggle={() => toggle(s.key, expanded[s.key] ?? depth !== 'tldr')}
                  feedback={feedback[s.key]}
                  onRate={v => rate(s.key, s.title, v)}
                  onOpenCitation={open}
                />
              ))}
              {depth === 'deep' && entries.length > 0 && (
                <section
                  style={{ ...card, padding: '20px 22px', display: 'grid', gap: 8 }}
                  data-testid="brief-ledger"
                  aria-labelledby="ledger-h"
                >
                  <h3
                    id="ledger-h"
                    style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 22, margin: 0 }}
                  >
                    Source ledger
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>
                    Every number above is produced by code from XBRL or a price feed. The model only wrote the
                    words around it.
                  </p>
                  <div role="table" aria-label="Source ledger">
                    <div
                      role="row"
                      className="br-ledger-row"
                      style={{
                        font: '600 11px var(--mono)',
                        letterSpacing: '.06em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-3)',
                        padding: '8px 0',
                        borderBottom: '1px solid var(--line)',
                      }}
                    >
                      <span role="columnheader">Metric</span>
                      <span role="columnheader">Value</span>
                      <span role="columnheader">Source</span>
                      <span role="columnheader" className="br-sr">
                        Verified
                      </span>
                    </div>
                    {entries.map(([key, e]) => (
                      <div
                        key={key}
                        role="row"
                        className="br-ledger-row"
                        style={{ fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--line)' }}
                      >
                        <span role="cell">{e.label}</span>
                        <span role="cell" style={{ fontFamily: 'var(--mono)' }}>
                          {e.display}
                        </span>
                        <span
                          role="cell"
                          style={{
                            font: '400 11px var(--mono)',
                            color: 'var(--ink-3)',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {e.source}
                        </span>
                        <span role="cell" style={{ color: 'var(--gain)' }}>
                          &#10003;
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)' }} data-testid="brief-disclaimer">
                {brief.disclaimer || DISCLAIMER_TEXT}
              </p>
            </Stagger>

            <aside className="br-aside" aria-label="About this brief">
              <section
                style={{ ...card, padding: 18, display: 'grid', gap: 10 }}
                data-testid="brief-position"
              >
                <h3 style={{ font: "600 14px 'Geist'", margin: 0 }}>Your position</h3>
                {portfolio.isLoading ? (
                  <SkeletonBlock label="Loading position" widths={[90, 60]} />
                ) : portfolio.isError ? (
                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                    Your position is not available right now.
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                      {position
                        ? `You hold ${position.qty} shares worth ${money0(position.value)}, ${position.weight_pct.toFixed(1)}% of your portfolio.`
                        : 'Not in your paper portfolio.'}
                      {posCap != null && ` Your maximum position is ${posCap}%.`}
                    </div>
                    {position && posCap != null && (
                      <Pill
                        tone={position.weight_pct > posCap ? 'bad' : 'ok'}
                        style={{ justifySelf: 'start' }}
                        data-testid="brief-position-status"
                      >
                        {position.weight_pct > posCap ? 'Above your cap' : 'Within your cap'}
                      </Pill>
                    )}
                  </>
                )}
              </section>
              <section style={{ ...card, padding: 18, display: 'grid', gap: 10 }} data-testid="brief-why">
                <h3 style={{ font: "600 14px 'Geist'", margin: 0 }}>Why this brief looks like this</h3>
                {why.data?.summary && (
                  <div style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--ink-2)' }}>
                    <span style={{ color: 'var(--accent)' }} aria-hidden="true">
                      &#8226;
                    </span>
                    <span>{why.data.summary}</span>
                  </div>
                )}
                {why.data?.top_features?.map(f => (
                  <div key={f.name} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--ink-2)' }}>
                    <span style={{ color: 'var(--accent)' }} aria-hidden="true">
                      &#8226;
                    </span>
                    <span>{f.detail}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--ink-2)' }}>
                  <span style={{ color: 'var(--accent)' }} aria-hidden="true">
                    &#8226;
                  </span>
                  <span>
                    Only the order and wording are personalized. The content and numbers are identical for
                    every user.
                  </span>
                </div>
                <Link
                  to="/profile"
                  style={{ justifySelf: 'start', fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}
                >
                  See what the profile has learned
                </Link>
              </section>
            </aside>
          </div>

          <CitationDrawer source={source} brief={brief} onClose={() => setSource(null)} />
        </>
      )}
    </div>
  );
}
