import { useMemo } from 'react';
import type { FeedItem, Portfolio, PortfolioPerformance, PortfolioRisk } from '@/api/types';
import { useFeed } from '@/api/hooks/feed';
import { usePortfolio, usePortfolioPerformance, usePortfolioRisk } from '@/api/hooks/portfolio';
import { useProposals } from '@/api/hooks/proposals';
import { useAuth } from '@/auth/useAuth';
import { Enter, Loop } from '@/motion';
import { AiGlyph } from '@/motion/AiGlyph';
import { LogoMark } from '@/ui';
import { dayPart, firstName, pct, signColor, usd0 } from './format';
import { ruleMeta } from './labels';
import { card, SectionError, SkeletonLines } from './panels';

export type Bullet = { text: string; dot: string };

const num = (v: number, unit: string) => `${Number.isInteger(v) ? v : v.toFixed(1)}${unit}`;

/** Sentences for the briefing. Every number is read from the API responses; nothing is calculated here. */
export function buildBriefing(args: {
  pf: Portfolio;
  risk?: PortfolioRisk;
  perf?: PortfolioPerformance;
  pending?: number;
  topItem?: FeedItem;
  briefing?: FeedItem;
}): Bullet[] {
  const { pf, risk, perf, pending, topItem, briefing } = args;
  const out: Bullet[] = [];
  const breached = (risk?.rules ?? []).filter(r => r.status === 'breach');

  if (pf.positions.length === 0) {
    out.push({
      text: `Your paper portfolio is ${usd0(pf.cash)} in cash. Open a brief from your watchlist or place a first simulated trade.`,
      dot: 'var(--accent)',
    });
    if (risk && risk.rules.length) {
      const get = (k: string) => risk.rules.find(r => r.key === k)?.limit;
      const parts = [
        get('pos') != null && `${num(get('pos')!, '%')} per position`,
        get('sec') != null && `${num(get('sec')!, '%')} per sector`,
        get('trades') != null && `${get('trades')} trades a week`,
      ].filter(Boolean);
      if (parts.length)
        out.push({ text: `Your rules are active: ${parts.join(', ')}.`, dot: 'var(--ink-3)' });
    }
  } else {
    const ytd = perf?.stats
      ? ` and ${pct(perf.stats.ytd_pct)} year to date against ${pct(perf.stats.spy_pct)} for the S&P 500`
      : '';
    out.push({
      text: `Portfolio value is ${usd0(pf.equity)}, ${pct(pf.day_change_pct, 2)} today${ytd}.`,
      dot: 'var(--ink-3)',
    });
    if (risk) {
      out.push(
        breached.length
          ? {
              text: `${breached.length} of your rules ${breached.length > 1 ? 'are' : 'is'} breached: ${breached
                .map(r => {
                  const m = ruleMeta(r.key);
                  return `${m.label.toLowerCase()} (${num(r.current, m.unit)} vs ${num(r.limit, m.unit)})`;
                })
                .join(' and ')}.`,
              dot: 'var(--loss)',
            }
          : { text: `All ${risk.rules.length} of your rules are within limits.`, dot: 'var(--gain)' },
      );
    }
  }
  if (briefing) {
    const b = briefing.item as Record<string, unknown>;
    const text = typeof b.body === 'string' ? b.body : typeof b.summary === 'string' ? b.summary : '';
    if (text) out.push({ text, dot: 'var(--accent)' });
  }
  if (topItem && 'title' in topItem.item && topItem.item.title)
    out.push({ text: `${String(topItem.item.title).replace(/\.$/, '')}.`, dot: 'var(--info)' });
  if (pending != null && pending >= 0)
    out.push({
      text: `${pending} proposal${pending === 1 ? '' : 's'} waiting for your decision. Approving only affects the paper simulator.`,
      dot: 'var(--accent)',
    });
  return out;
}

function Tile({
  label,
  value,
  color = 'var(--ink)',
  sub,
}: {
  label: string;
  value: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div style={{ borderTop: '1px solid var(--line-strong)', paddingTop: 10 }}>
      <div style={{ font: '600 10px var(--mono)', letterSpacing: '.1em', color: 'var(--ink-3)' }}>
        {label}
      </div>
      <div style={{ font: '500 22px var(--mono)', color, whiteSpace: 'nowrap' }}>{value}</div>
      {sub && <div style={{ font: '500 11px var(--mono)', color: 'var(--ink-3)' }}>{sub}</div>}
    </div>
  );
}

/** Daily briefing hero: greeting, word-by-word first line, supporting bullets, four figures. */
export function Hero() {
  const { user } = useAuth();
  const pfQ = usePortfolio();
  const riskQ = usePortfolioRisk();
  const perfQ = usePortfolioPerformance();
  const feedQ = useFeed();
  const pendingQ = useProposals('pending');

  const pf = pfQ.data;
  const name = firstName(user?.display_name);
  const feedItems = feedQ.data?.items;
  const bullets = useMemo(
    () =>
      pf
        ? buildBriefing({
            pf,
            risk: riskQ.data,
            perf: perfQ.data,
            pending: pendingQ.data?.items.length,
            topItem: feedItems?.find(f => !f.pinned && f.kind !== 'briefing'),
            briefing: feedItems?.find(f => f.kind === 'briefing'),
          })
        : [],
    [pf, riskQ.data, perfQ.data, pendingQ.data, feedItems],
  );
  const breached = (riskQ.data?.rules ?? []).some(r => r.status === 'breach');
  const greet = !pf
    ? `Good ${dayPart()}${name ? `, ${name}` : ''}.`
    : pf.positions.length === 0
      ? `Welcome${name ? `, ${name}` : ''}. Your workspace is ready.`
      : `Good ${dayPart()}${name ? `, ${name}` : ''}. ${
          riskQ.data ? (breached ? 'Your rules need attention.' : 'Your portfolio is within your rules.') : ''
        }`.trim();

  const head = bullets[0]?.text ?? '';
  const words = head.split(' ');
  const now = new Date();
  const stamp = `${now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  const stats = perfQ.data?.stats;

  return (
    <section
      aria-label="Pilot briefing"
      data-testid="dash-hero"
      style={{
        ...card,
        flex: '2 1 520px',
        minWidth: 0,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 18,
        padding: 'clamp(20px,3vw,30px) clamp(18px,3vw,32px)',
        display: 'grid',
        gap: 18,
        alignContent: 'start',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: -50,
          top: -50,
          opacity: 0.07,
          color: 'var(--ink)',
          pointerEvents: 'none',
        }}
      >
        <LogoMark size={280} animate={false} />
      </span>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          font: '600 11px var(--mono)',
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
        }}
      >
        <AiGlyph size={16} label="Pilot" />
        Pilot briefing · {stamp}
      </div>
      <h2
        data-testid="dash-greeting"
        style={{
          position: 'relative',
          font: '750 clamp(26px,4vw,36px)/1.06 var(--serif)',
          fontStretch: '118%',
          letterSpacing: '-.025em',
          margin: 0,
          maxWidth: 660,
        }}
      >
        {greet}
      </h2>

      {pfQ.isPending && <SkeletonLines rows={4} label="Loading your briefing" />}
      {pfQ.isError && (
        <SectionError error={pfQ.error} what="your portfolio" onRetry={() => void pfQ.refetch()} />
      )}
      {pf && (
        <>
          <p
            data-testid="dash-headline"
            style={{
              position: 'relative',
              margin: 0,
              fontSize: 16,
              lineHeight: 1.6,
              minHeight: 52,
              maxWidth: 680,
            }}
          >
            <span className="sr-only" data-testid="dash-headline-text">
              {head}
            </span>
            <span aria-hidden="true">
              {words.map((w, i) => (
                <Enter
                  key={`${head}-${i}`}
                  as="span"
                  kind="word-a"
                  delay={120 + i * 50}
                  style={{ display: 'inline-block', whiteSpace: 'pre' }}
                >
                  {w + (i < words.length - 1 ? ' ' : '')}
                </Enter>
              ))}
              <Loop
                as="span"
                kind="blink"
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: '1.1em',
                  background: 'var(--accent)',
                  verticalAlign: 'text-bottom',
                  marginLeft: 2,
                }}
              />
            </span>
          </p>
          <Enter
            as="ul"
            kind="fade"
            delay={300 + words.length * 50}
            data-testid="dash-bullets"
            style={{
              position: 'relative',
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'grid',
              gap: 10,
            }}
          >
            {bullets.slice(1).map(b => (
              <li
                key={b.text}
                style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.5, color: 'var(--ink-2)' }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flex: 'none',
                    width: 6,
                    height: 6,
                    borderRadius: 2,
                    marginTop: 8,
                    background: b.dot,
                  }}
                />
                <span>{b.text}</span>
              </li>
            ))}
          </Enter>
          <div
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
              gap: 12,
            }}
            data-testid="dash-tiles"
          >
            <Tile label="VALUE" value={usd0(pf.equity)} />
            <Tile label="TODAY" value={pct(pf.day_change_pct, 2)} color={signColor(pf.day_change_pct)} />
            <Tile
              label="YTD"
              value={stats ? pct(stats.ytd_pct) : '—'}
              color={stats ? signColor(stats.ytd_pct) : 'var(--ink-3)'}
              sub={stats ? `S&P 500 ${pct(stats.spy_pct)}` : perfQ.isError ? 'Unavailable' : undefined}
            />
            <Tile label="CASH" value={usd0(pf.cash)} />
          </div>
        </>
      )}
      <div style={{ position: 'relative', font: '400 12px var(--sans, Geist)', color: 'var(--ink-3)' }}>
        Every figure is computed in code from your rules and public filings. Educational summary, not
        investment advice.
      </div>
    </section>
  );
}
