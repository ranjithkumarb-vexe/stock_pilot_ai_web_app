import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { describeError, isApiError } from '@/api/errors';
import { usePortfolio } from '@/api/hooks/portfolio';
import { useChatHistory, useSendChat } from '@/api/hooks/chat';
import { useWatchlist } from '@/api/hooks/watchlist';
import { AiGlyph, Loop } from '@/motion';
import { LogoMark, Pill, SkeletonBlock } from '@/ui';
import { reportLlmDegraded } from '@/shell/systemStatus';
import { useTrack } from '@/telemetry';
import '@/features/trading/shared.css';
import { CitationDrawer } from './CitationDrawer';
import {
  fromHistory,
  GREETING,
  hashText,
  humanizeReason,
  normalizeCitations,
  type Cite,
  type Msg,
} from './api';
import { SafeText } from './safeText';
import './ask.css';

const REFUSAL_REDIRECT = {
  lead: 'I cannot give personal buy or sell advice, price targets or return guarantees. Here is what I can do instead:',
  points: [
    'Explain what a company’s filings say about its revenue, margins, debt or risks.',
    'Check your portfolio against the rules you set, and show which ones are close.',
    'Walk through a decision framework: your time horizon, how large the position would be, and what you could lose.',
  ],
};

const HANDLED_KEY = 'sp-ask-handled';
let seq = 0;
const nextId = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`;

/** FE-09 · Ask Pilot: chat thread with citations and guardrail refusals. All model text renders as plain text. */
export default function Screen() {
  const navigate = useNavigate();
  const location = useLocation();
  const track = useTrack();
  const history = useChatHistory();
  const send = useSendChat();
  const portfolio = usePortfolio();
  const watchlist = useWatchlist();

  const [local, setMsgs] = useState<Msg[]>([]);
  const [threadId, setThreadId] = useState<string | undefined>();
  const [input, setInput] = useState('');
  const [cite, setCite] = useState<{ id: string; label: string } | null>(null);
  // history is read ONCE: later refetches (after a send) must not duplicate the messages sent in this session
  const [base, setBase] = useState<Msg[] | null>(null);
  if (base === null && history.data) setBase(fromHistory(history.data));
  const msgs = useMemo(() => [...(base ?? []), ...local], [base, local]);
  const historyThread = history.data?.items[history.data.items.length - 1]?.thread_id;
  const thread = threadId ?? historyThread;
  const inflight = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const lastText = useRef('');

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [msgs, send.isPending]);

  const ask = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || inflight.current) return;
      inflight.current = true;
      lastText.current = text;
      setInput('');
      setMsgs(m => [...m, { id: nextId('u'), role: 'user', text }]);
      track({ type: 'chat_query', props: { query_text_hash: hashText(text) } });
      try {
        const res = await send.mutateAsync({ message: text, thread_id: thread });
        reportLlmDegraded(false);
        setThreadId(res.thread_id);
        setMsgs(m => [
          ...m,
          {
            id: res.id,
            role: 'assistant',
            text: res.answer,
            refused: res.refused,
            refusalReason: res.refusal_reason,
            citations: normalizeCitations(res.citations),
            traceId: res.trace_id,
          },
        ]);
      } catch (e) {
        const d = describeError(e);
        if (isApiError(e) && e.code === 'guardrail_blocked') {
          setMsgs(m => [
            ...m,
            {
              id: nextId('a'),
              role: 'assistant',
              text: d.serverMessage ?? d.message,
              refused: true,
              refusalReason: 'guardrail_blocked',
              traceId: d.traceId ?? undefined,
            },
          ]);
        } else {
          if (d.code === 'upstream_unavailable' || d.code === 'rate_limited') reportLlmDegraded(true);
          setMsgs(m => [
            ...m,
            {
              id: nextId('a'),
              role: 'assistant',
              text: `${d.title}. ${d.message}`,
              failed: true,
              traceId: d.traceId ?? undefined,
            },
          ]);
        }
      } finally {
        inflight.current = false;
      }
    },
    [send, thread, track],
  );

  // hand-off from the command palette: navigate('/ask', { state: { ask } }). Sent once per navigation (location.key),
  // so a reload that restores the same history entry does not ask again.
  const handed = useRef(false);
  useEffect(() => {
    const q = (location.state as { ask?: unknown } | null)?.ask;
    if (handed.current || typeof q !== 'string' || !q.trim()) return;
    handed.current = true;
    try {
      if (sessionStorage.getItem(HANDLED_KEY) === location.key) return;
      sessionStorage.setItem(HANDLED_KEY, location.key);
    } catch {
      /* storage blocked: fall back to once per mount */
    }
    queueMicrotask(() => void ask(q));
  }, [location.state, location.key, ask]);

  const t0 = portfolio.data?.positions[0]?.symbol ?? watchlist.data?.items[0]?.symbol ?? 'AAPL';
  const suggestions = [
    'What is my concentration?',
    `Summarize ${t0} risks`,
    `What is ${t0} revenue growth?`,
    'Am I breaching any rules?',
    'What should I buy now?',
    'Guarantee me 20% returns',
    'Why am I seeing these alerts?',
  ];

  const onCite = (c: Cite) => {
    if (c.citationId) setCite({ id: c.citationId, label: c.label });
    else if (c.route) navigate(c.route);
  };

  const showGreeting = msgs.length === 0 && !history.isLoading;
  const pending = send.isPending;

  return (
    <div className="ask-layout" data-testid="screen-ask">
      <section className="s3-card ask-chat" aria-label="Chat with Pilot">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '16px 22px',
            borderBottom: '1px solid var(--line)',
            background: 'var(--surface-2)',
            borderRadius: '14px 14px 0 0',
          }}
        >
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'var(--surface)',
              border: '1px solid var(--line-strong)',
              display: 'grid',
              placeItems: 'center',
              flex: 'none',
            }}
          >
            <LogoMark size={26} />
          </span>
          <div>
            <b style={{ font: '600 16px var(--serif)' }}>Pilot</b>
            <div style={{ font: '500 11px var(--mono)', color: 'var(--ink-3)' }}>
              Muse Spark 1.3 · reads filings and your portfolio · cannot trade
            </div>
          </div>
        </div>

        <div
          className="ask-thread"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Conversation"
          data-testid="ask-thread"
        >
          {history.isLoading && <SkeletonBlock label="Loading conversation" widths={[60, 90, 40]} />}
          {showGreeting && (
            <MessageView
              m={{ id: 'greeting', role: 'assistant', text: GREETING }}
              onCite={onCite}
              onSuggest={ask}
              greeting
              disabled={pending}
            />
          )}
          {msgs.map(m => (
            <MessageView
              key={m.id}
              m={m}
              onCite={onCite}
              onSuggest={ask}
              disabled={pending}
              onRetry={m.failed ? () => void ask(lastText.current) : undefined}
            />
          ))}
          {pending && (
            <div
              role="status"
              data-testid="ask-typing"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}
            >
              <AiGlyph size={24} label="Pilot is thinking" />
              <Loop kind="shimmer-text" style={{ font: '500 12px var(--mono)', letterSpacing: '.04em' }}>
                Pilot is checking sources
              </Loop>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div style={{ borderTop: '1px solid var(--line)', padding: '14px 18px', display: 'grid', gap: 10 }}>
          <div
            style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
            aria-label="Suggested questions"
            role="group"
          >
            {suggestions.map(s => (
              <button
                key={s}
                type="button"
                className="ask-chip"
                disabled={pending}
                onClick={() => void ask(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <form
            style={{ display: 'flex', gap: 8 }}
            onSubmit={e => {
              e.preventDefault();
              void ask(input);
            }}
          >
            <input
              className="s3-input"
              style={{ flex: 1, height: 42, fontSize: 14, padding: '0 14px' }}
              data-testid="ask-input"
              aria-label="Message"
              placeholder="Ask about a company, your portfolio, or a rule"
              value={input}
              maxLength={2000}
              autoComplete="off"
              onChange={e => setInput(e.target.value)}
            />
            <button
              type="submit"
              className="sp-btn sp-btn--primary"
              style={{ height: 42, padding: '0 20px' }}
              data-testid="ask-send"
              disabled={pending || !input.trim()}
            >
              Send
            </button>
          </form>
        </div>
      </section>

      <aside className="ask-aside" aria-label="How answers are made">
        <section className="s3-card" style={{ padding: 18, gap: 10 }}>
          <h2 className="s3-h2 s3-h2--sm">How answers are made</h2>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', display: 'grid', gap: 8 }}>
            <div>
              Numbers come from XBRL and your portfolio through read-only tools. The model explains them.
            </div>
            <div>
              Chats with portfolio data use Standard mode on the Meta Model API, which is never used for
              training.
            </div>
            <div>Llama Guard 4 checks every question and answer.</div>
            <div>
              The assistant declines buy and sell requests, price targets, return guarantees, options and
              leverage.
            </div>
          </div>
        </section>
      </aside>

      <CitationDrawer id={cite?.id ?? null} label={cite?.label ?? 'Source'} onClose={() => setCite(null)} />
    </div>
  );
}

function MessageView({
  m,
  onCite,
  onSuggest,
  disabled,
  greeting,
  onRetry,
}: {
  m: Msg;
  onCite: (c: Cite) => void;
  onSuggest: (q: string) => void;
  disabled: boolean;
  greeting?: boolean;
  onRetry?: () => void;
}) {
  const user = m.role === 'user';
  const reason = humanizeReason(m.refusalReason);
  return (
    <div
      style={{ display: 'grid', gap: 6, justifyItems: user ? 'end' : 'start' }}
      data-testid={user ? 'msg-user' : m.refused ? 'msg-refused' : 'msg-ai'}
    >
      <div
        className={`ask-bubble ${user ? 'ask-bubble--user' : m.refused ? 'ask-bubble--ai ask-bubble--refused' : 'ask-bubble--ai'}`}
      >
        {user ? <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span> : <SafeText text={m.text} />}
        {m.refused && (
          <div
            style={{ marginTop: 10, display: 'grid', gap: 6, fontSize: 13 }}
            data-testid="refusal-redirect"
          >
            <div>{REFUSAL_REDIRECT.lead}</div>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {REFUSAL_REDIRECT.points.map(p => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="ask-chip"
                disabled={disabled}
                onClick={() => onSuggest('What is my concentration?')}
              >
                What is my concentration?
              </button>
              <button
                type="button"
                className="ask-chip"
                disabled={disabled}
                onClick={() => onSuggest('Am I breaching any rules?')}
              >
                Am I breaching any rules?
              </button>
            </div>
          </div>
        )}
        {m.failed && onRetry && (
          <div style={{ marginTop: 8 }}>
            <button type="button" className="s3-btn-sm" disabled={disabled} onClick={onRetry}>
              Try again
            </button>
          </div>
        )}
      </div>
      {!!m.citations?.length && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} data-testid="msg-cites">
          {m.citations.map(c =>
            c.citationId || c.route ? (
              <button key={c.key} type="button" className="ask-cite" onClick={() => onCite(c)}>
                {c.label}
              </button>
            ) : (
              <span
                key={c.key}
                className="ask-cite ask-cite--static"
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                {c.label}
              </span>
            ),
          )}
        </div>
      )}
      {!user && !m.failed && (
        <span style={{ font: '500 11px var(--mono)', padding: '0 6px', borderRadius: 4, lineHeight: '18px' }}>
          {m.refused ? (
            <Pill tone="warn">Declined{reason ? `: ${reason}` : ''}</Pill>
          ) : (
            <Pill tone="ok">
              {greeting ? 'Llama Guard 4 checks input and output' : 'Checked by Llama Guard 4'}
            </Pill>
          )}
        </span>
      )}
    </div>
  );
}
