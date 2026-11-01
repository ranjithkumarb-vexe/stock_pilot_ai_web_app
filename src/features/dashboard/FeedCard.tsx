import { useId, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWhy } from '@/api/hooks/feed';
import { useAlertAction } from '@/api/hooks/alerts';
import type { FeedItem, Why } from '@/api/types';
import { useTrack } from '@/telemetry';
import { Pill, useToast } from '@/ui';
import { BASIS_LABEL, ALERT_META, KIND_META } from './labels';
import { timeAgo } from './format';
import { card } from './panels';

type View = {
  edge: string;
  label: string;
  tone: 'ok' | 'warn' | 'bad' | 'info' | 'n' | 'acc';
  symbol: string | null;
  title: string;
  body: string;
  time: string;
  cta: string | null;
  to: string | null;
  critical: boolean;
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Map the three feed kinds onto the card the design draws. Text is rendered as text, never as HTML. */
export function viewOf(f: FeedItem): View {
  if (f.kind === 'alert') {
    const a = f.item;
    const meta = ALERT_META[a.type] ?? { label: a.type, tone: 'n' as const, edge: 'var(--accent)' };
    const to =
      a.type === 'breach' || a.type === 'concentration'
        ? '/portfolio'
        : a.type === 'mirror'
          ? '/profile'
          : a.symbol
            ? `/brief/${a.symbol}`
            : '/alerts';
    const cta =
      a.type === 'breach' || a.type === 'concentration'
        ? 'Open portfolio'
        : a.type === 'mirror'
          ? 'See your pattern'
          : a.symbol
            ? 'Open brief'
            : 'Open alerts';
    return {
      ...meta,
      symbol: a.symbol,
      title: a.title,
      body: a.body,
      time: timeAgo(a.created_at),
      cta,
      to,
      critical: a.critical || f.pinned,
    };
  }
  if (f.kind === 'proposal') {
    const p = f.item;
    return {
      ...KIND_META.proposal,
      symbol: p.symbol,
      title: p.title,
      body: p.body || p.rationale[0] || '',
      time: timeAgo(p.created_at),
      cta: 'Review proposal',
      to: `/proposals/${p.id}`,
      critical: f.pinned,
    };
  }
  const b = f.item;
  const symbol = str(b.symbol) || null;
  return {
    ...KIND_META.briefing,
    symbol,
    title: str(b.title) || 'Your daily briefing',
    body: str(b.body) || str(b.summary),
    time: timeAgo(str(b.generated_at) || str(b.created_at)),
    cta: symbol ? 'Open brief' : null,
    to: symbol ? `/brief/${symbol}` : null,
    critical: f.pinned,
  };
}

function WhyPanel({ f, open, id }: { f: FeedItem; open: boolean; id: string }) {
  // the feed normally embeds `why`; fall back to GET /why/{type}/{id} when it does not
  const fetched = useWhy(f.kind, f.id, open && !f.why);
  const why: Why | undefined = f.why ?? fetched.data;
  return (
    <div id={id} className="dash-why" data-open={open} data-testid={`why-${f.id}`}>
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
        <div
          style={{
            background: 'var(--surface-2)',
            borderRadius: 10,
            padding: '12px 14px',
            display: 'grid',
            gap: 6,
            fontSize: 12,
            color: 'var(--ink-2)',
          }}
        >
          {!why && fetched.isPending && <span>Loading the reasons…</span>}
          {!why && fetched.isError && (
            <span role="alert">The explanation could not be loaded. Try again in a moment.</span>
          )}
          {why && (
            <>
              <span
                style={{
                  font: '600 11px var(--mono)',
                  letterSpacing: '.06em',
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                }}
              >
                {BASIS_LABEL[why.basis] ?? why.basis}
              </span>
              {why.summary && <Row>{why.summary}</Row>}
              {why.top_features.map((t, i) => (
                <Row key={`${t.name}-${i}`}>
                  <b style={{ color: 'var(--ink)' }}>{t.name}</b>
                  {t.detail ? `: ${t.detail}` : ''}{' '}
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>
                    weight {t.weight.toFixed(2)}
                  </span>
                </Row>
              ))}
              {why.rules_checked.map((r, i) => (
                <Row
                  key={`${r.rule}-${i}`}
                  mark={r.passed ? '✓' : '✗'}
                  tone={r.passed ? 'var(--gain)' : 'var(--loss)'}
                >
                  Rule checked: {r.rule} {r.passed ? '(passed)' : '(not passed)'}
                </Row>
              ))}
              {why.sources.length > 0 && <Row>Sources: {why.sources.join(', ')}</Row>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  children,
  mark = '▸',
  tone = 'var(--accent)',
}: {
  children: ReactNode;
  mark?: string;
  tone?: string;
}) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span aria-hidden="true" style={{ color: tone }}>
        {mark}
      </span>
      <span>{children}</span>
    </div>
  );
}

/** One ranked card: edge colour by kind, SIGNAL score, open / useful / not useful, expandable "Why am I seeing this?". */
export function FeedCard({ f }: { f: FeedItem }) {
  const v = viewOf(f);
  const navigate = useNavigate();
  const track = useTrack();
  const { say } = useToast();
  const alertAction = useAlertAction();
  const [open, setOpen] = useState(false);
  const [rated, setRated] = useState<'up' | 'down' | null>(null);
  const whyId = `why-${useId().replace(/:/g, '')}`;

  const entity = {
    ...(f.kind === 'alert' ? { alert_id: f.id } : f.kind === 'proposal' ? { proposal_id: f.id } : {}),
    ...(v.symbol ? { ticker: v.symbol } : {}),
  };

  const onOpen = () => {
    if (f.kind === 'alert') {
      track({ type: 'alert_opened', entity, props: { action: 'dashboard_feed' } });
      alertAction.mutate({ id: f.id, action: 'open' });
    } else if (v.symbol) track({ type: 'ticker_viewed', entity, props: { action: 'dashboard_feed' } });
    if (v.to) navigate(v.to);
  };
  const rate = (up: boolean) => {
    setRated(up ? 'up' : 'down');
    track({ type: up ? 'thumbs_up' : 'thumbs_down', entity, props: { action: `feed_${f.kind}` } });
    say(`Noted. ${v.label} items will rank ${up ? 'higher' : 'lower'}.`);
  };
  const toggleWhy = () => {
    if (!open)
      track({
        type: 'section_expanded',
        entity: { ...entity, section: 'why_am_i_seeing_this' },
        props: { action: f.kind },
      });
    setOpen(o => !o);
  };

  const score = Math.max(0, Math.min(1, f.score));
  return (
    <article
      className="dash-feedcard"
      data-testid={`feed-${f.id}`}
      data-kind={f.kind}
      style={{
        ...card,
        position: 'relative',
        overflow: 'hidden',
        padding: '16px 18px 16px 22px',
        display: 'grid',
        gap: 10,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: v.edge,
          boxShadow: `0 0 18px ${v.edge}`,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pill tone={v.tone}>{v.label}</Pill>
        {f.pinned && <span style={{ font: '600 11px var(--mono)', color: 'var(--ink-3)' }}>PINNED</span>}
        {v.symbol && <span style={{ font: '600 12px var(--mono)', color: 'var(--ink-2)' }}>{v.symbol}</span>}
        <span style={{ flex: 1 }} />
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            font: '500 11px var(--mono)',
            color: 'var(--ink-3)',
          }}
          title="Materiality, learned weight and interest combined"
        >
          SIGNAL {f.score.toFixed(2)}
          <span
            aria-hidden="true"
            style={{
              width: 46,
              height: 4,
              borderRadius: 2,
              background: 'var(--surface-2)',
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                display: 'block',
                height: '100%',
                width: `${Math.round(score * 100)}%`,
                background: 'var(--grad)',
              }}
            />
          </span>
        </span>
        {v.time && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{v.time}</span>}
      </div>
      <div>
        <b style={{ fontSize: 15, display: 'block', marginBottom: 2 }}>{v.title}</b>
        {v.body && <span style={{ color: 'var(--ink-2)', fontSize: 13 }}>{v.body}</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {v.cta && v.to && (
          <button
            type="button"
            onClick={onOpen}
            data-testid={`feed-open-${f.id}`}
            className="sp-btn sp-btn--primary sp-btn--sm"
          >
            {v.cta}
          </button>
        )}
        {!v.critical && (
          <>
            <button
              type="button"
              className="sp-btn sp-btn--secondary sp-btn--sm"
              aria-pressed={rated === 'up'}
              disabled={rated != null}
              onClick={() => rate(true)}
              data-testid={`feed-up-${f.id}`}
            >
              Useful
            </button>
            <button
              type="button"
              className="sp-btn sp-btn--secondary sp-btn--sm"
              aria-pressed={rated === 'down'}
              disabled={rated != null}
              onClick={() => rate(false)}
              data-testid={`feed-down-${f.id}`}
            >
              Not useful
            </button>
          </>
        )}
        <button
          type="button"
          className="dash-link"
          aria-expanded={open}
          aria-controls={whyId}
          onClick={toggleWhy}
          data-testid={`feed-why-btn-${f.id}`}
        >
          Why am I seeing this?
        </button>
      </div>
      <WhyPanel f={f} open={open} id={whyId} />
    </article>
  );
}
