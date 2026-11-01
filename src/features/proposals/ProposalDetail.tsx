import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDecideProposal, usePortfolio, usePreviewOrder } from '@/api';
import { describeError } from '@/api/errors';
import type { Order, OrderPreview, Proposal, RejectReason } from '@/api/types';
import { money0, money2 } from '@/features/portfolio/format';
import { DISCLAIMER_TEXT } from '@/shell/disclaimer';
import { useTrack } from '@/telemetry';
import { Button, Chip, Meter, Pill, Skeleton, useToast } from '@/ui';
import { HoldButton } from './HoldButton';
import {
  MARK_TONE,
  REJECT_REASONS,
  decidedText,
  expiresLabel,
  fillNotional,
  fillPrice,
  fromOrderChecks,
  fromRulesChecked,
  isExpired,
  isOpen,
  isResolved,
  shortId,
  sideWord,
  type CheckRow,
} from './helpers';

type Mode = 'idle' | 'reject' | 'modify';

const eyebrow = { font: '600 11px var(--mono)', letterSpacing: '.06em', color: 'var(--ink-3)' } as const;

function resultLine(
  o: Order | null,
  decision: 'approve' | 'reject' | 'modify',
  reason?: RejectReason,
): string {
  const modified = decision === 'modify';
  if (decision === 'reject') {
    const why = REJECT_REASONS.find(r => r.value === reason)?.label;
    return `Rejected${why ? `. Reason: ${why}` : ''}. Proposal-type items now rank lower for you.`;
  }
  if (!o) return 'Marked as reviewed.';
  const verb = o.side === 'buy' ? 'Bought' : 'Sold';
  const tail =
    o.status === 'queued'
      ? 'Queued for the next market open in the paper simulator.'
      : 'Executed in the paper simulator.';
  return `${modified ? 'Modified and approved. ' : 'Approved. '}${verb} ${o.qty} ${o.symbol}. ${tail}`;
}

/** Selected proposal: rationale, rules checked, weight before/after, hold-to-approve, modify size, reject with reason. */
export function ProposalDetail({ proposal: p, onDecided }: { proposal: Proposal; onDecided?: () => void }) {
  const track = useTrack();
  const toast = useToast();
  const decide = useDecideProposal();
  const preview = usePreviewOrder();
  const portfolio = usePortfolio();

  const [mode, setMode] = useState<Mode>('idle');
  const [reason, setReason] = useState<RejectReason | null>(null);
  const [qty, setQty] = useState<number | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const isTrade = p.kind === 'trade';
  const expired = isExpired(p);
  const open = isOpen(p) && !done;
  const resolved = isResolved(p);
  const actionable = isTrade && open && p.suggested_qty > 0;
  const held = portfolio.data?.positions.find(x => x.symbol === p.symbol)?.qty;
  const maxQty = Math.max(1, held ?? p.suggested_qty);
  const modQty = Math.max(1, Math.min(maxQty, qty ?? Math.min(p.suggested_qty, maxQty)));

  // pre-trade risk-engine checks (identical to the order ticket's Pass / Note / Blocked list)
  const previewMutate = preview.mutate;
  const symbol = p.symbol;
  const side = p.side;
  const suggested = p.suggested_qty;
  const pid = p.id;
  useEffect(() => {
    if (!actionable || !symbol || !side) return;
    previewMutate({ symbol, side, type: 'market', qty: suggested, proposal_id: pid });
  }, [actionable, symbol, side, suggested, pid, previewMutate]);

  const pv: OrderPreview | undefined = preview.data;
  const checks: CheckRow[] = pv ? fromOrderChecks(pv.checks) : fromRulesChecked(p.rules_checked);
  const blocked = !!pv?.blocked || checks.some(c => c.mark === 'Blocked');
  const px = fillPrice(pv);
  const proceeds = fillNotional(pv);

  const submit = (body: {
    decision: 'approve' | 'reject' | 'modify';
    reason?: RejectReason;
    qty?: number;
  }) => {
    decide.mutate(
      { id: p.id, ...body },
      {
        onSuccess: ({ order }) => {
          setDone(resultLine(order, body.decision, body.reason));
          setMode('idle');
          onDecided?.();
          const type =
            body.decision === 'approve'
              ? 'proposal_approved'
              : body.decision === 'reject'
                ? 'proposal_rejected'
                : 'proposal_modified';
          track({
            type,
            entity: { proposal_id: p.id, ...(p.symbol ? { ticker: p.symbol } : {}) },
            props: {
              ...(body.reason ? { reason: body.reason } : {}),
              ...(body.qty != null ? { delta: body.qty - p.suggested_qty } : {}),
            },
          });
          if (order) {
            toast.stamp({
              word: order.status === 'queued' ? 'QUEUED' : 'FILLED',
              line: `${order.side === 'buy' ? 'BUY' : 'SELL'} ${order.qty} ${order.symbol}`,
              tone: order.status === 'queued' ? 'warn' : 'gain',
            });
          } else
            toast.say(
              body.decision === 'reject'
                ? 'Rejected. Proposal-type items now rank lower for you.'
                : 'Marked as reviewed',
            );
        },
      },
    );
  };

  const err = decide.error ? describeError(decide.error) : null;

  return (
    <section
      className="pp-detail"
      data-testid="proposal-detail"
      data-proposal-id={p.id}
      aria-labelledby="pp-title"
    >
      <div>
        <div style={{ ...eyebrow, marginBottom: 6 }}>
          <span data-testid="proposal-id">{shortId(p.id)}</span> ·{' '}
          {isTrade ? 'Rule-based proposal' : 'Educational prompt'}
        </div>
        <h2
          id="pp-title"
          style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 26, lineHeight: 1.2, margin: 0 }}
        >
          {p.title}
        </h2>
        {open && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }} data-testid="proposal-expiry">
            {expiresLabel(p)}
          </div>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }} data-testid="proposal-body">
        {p.body}
      </p>

      {p.rationale?.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Why this proposal</div>
          <ul
            data-testid="proposal-rationale"
            style={{
              margin: 0,
              paddingLeft: 18,
              display: 'grid',
              gap: 4,
              fontSize: 13,
              color: 'var(--ink-2)',
            }}
          >
            {p.rationale.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {isTrade && !resolved && open && p.suggested_qty > 0 && (
        <>
          <div className="pp-tiles">
            <div className="pp-tile">
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>Order</div>
              <div style={{ font: '500 18px var(--mono)' }} data-testid="proposal-order">
                {sideWord(p)} {p.suggested_qty} {p.symbol}
              </div>
            </div>
            <div className="pp-tile">
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>Est. fill</div>
              <div style={{ font: '500 18px var(--mono)' }}>{px != null ? money2(px) : '–'}</div>
            </div>
            <div className="pp-tile">
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>Est. proceeds</div>
              <div style={{ font: '500 18px var(--mono)' }}>{proceeds != null ? money0(proceeds) : '–'}</div>
            </div>
            <div className="pp-tile">
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>Type</div>
              <div style={{ font: '500 18px var(--mono)' }}>Market, paper</div>
            </div>
          </div>

          {p.cap_pct != null && p.current_weight_pct != null && p.after_weight_pct != null && (
            <div style={{ display: 'grid', gap: 8 }} data-testid="proposal-weights">
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {p.rule === 'sec' ? 'Sector' : (p.symbol ?? 'Position')} weight against your {p.cap_pct}% rule
              </div>
              <Meter
                label="Now"
                value={p.current_weight_pct}
                cap={p.cap_pct}
                display={`${p.current_weight_pct.toFixed(1)}%`}
                labelWidth={70}
              />
              <Meter
                label="After"
                value={p.after_weight_pct}
                cap={p.cap_pct}
                display={`${p.after_weight_pct.toFixed(1)}%`}
                labelWidth={70}
              />
            </div>
          )}
        </>
      )}

      {isTrade && open && checks.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }} data-testid="proposal-checks">
          <div style={{ fontSize: 13, fontWeight: 600 }}>Risk engine checks</div>
          {preview.isPending && !pv ? (
            <div
              role="status"
              aria-busy="true"
              aria-label="Running risk checks"
              style={{ display: 'grid', gap: 8 }}
            >
              <Skeleton width={70} />
              <Skeleton width={90} />
            </div>
          ) : (
            checks.map(c => (
              <div key={c.key} className="pp-check" data-testid={`check-${c.key}`}>
                <Pill
                  tone={MARK_TONE[c.mark]}
                  style={{ width: 58, textAlign: 'center', height: 20, lineHeight: '20px' }}
                >
                  {c.mark}
                </Pill>
                <span style={{ fontWeight: 600 }}>{c.label}</span>
                {c.detail && <span style={{ color: 'var(--ink-2)' }}>{c.detail}</span>}
              </div>
            ))
          )}
          {preview.isError && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }} data-testid="proposal-preview-error">
              Live pre-trade checks are unavailable ({describeError(preview.error).title}). The risk engine
              re-checks the order when you approve.
            </div>
          )}
        </div>
      )}

      {resolved && open && (
        <div
          data-testid="proposal-resolved"
          style={{
            background: 'var(--gain-soft)',
            color: 'var(--gain)',
            borderRadius: 10,
            padding: '12px 14px',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          This is resolved. Your portfolio now satisfies the rule, so no trade is needed.
        </div>
      )}

      {expired && (
        <div
          data-testid="proposal-expired"
          style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', fontSize: 13 }}
        >
          This proposal expired. A new one appears if the rule is still breached.
        </div>
      )}

      {err && (
        <div role="alert" data-testid="proposal-error" className="sp-error-card">
          <b style={{ color: 'var(--loss)' }}>{err.title}</b>
          <span style={{ fontSize: 13 }}>{err.serverMessage ?? err.message}</span>
          {err.violations.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {err.violations.map((v, i) => (
                <li key={i}>{v.message ?? v.rule ?? v.key ?? 'Rule violated'}</li>
              ))}
            </ul>
          )}
          {err.traceId && (
            <span style={{ font: '400 11px var(--mono)', color: 'var(--ink-3)' }}>
              Reference: {err.traceId}
            </span>
          )}
        </div>
      )}

      {open && !resolved && mode === 'idle' && (
        <div
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
          data-testid="proposal-actions"
        >
          <HoldButton
            testId="proposal-approve"
            label={isTrade ? 'Hold to approve paper trade' : 'Hold to mark reviewed'}
            ariaLabel={isTrade ? 'Approve (paper trade)' : 'Mark as reviewed'}
            disabled={blocked || decide.isPending}
            onConfirm={() => submit({ decision: 'approve' })}
          />
          {actionable && (
            <Button
              variant="secondary"
              data-testid="proposal-modify"
              disabled={decide.isPending}
              onClick={() => {
                setQty(Math.min(p.suggested_qty, maxQty));
                setMode('modify');
              }}
            >
              Modify size
            </Button>
          )}
          <Button
            variant="destructive"
            data-testid="proposal-reject"
            disabled={decide.isPending}
            onClick={() => {
              setReason(null);
              setMode('reject');
            }}
          >
            Reject
          </Button>
          {blocked && (
            <span style={{ fontSize: 12, color: 'var(--loss)' }} data-testid="proposal-blocked">
              Blocked by your rules. Modify the size or reject.
            </span>
          )}
        </div>
      )}

      {open && mode === 'modify' && (
        <div
          data-testid="proposal-modify-panel"
          style={{
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>Shares to {p.side === 'buy' ? 'buy' : 'sell'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="pp-step"
              aria-label="Fewer"
              data-testid="modify-dec"
              disabled={modQty <= 1}
              onClick={() => setQty(modQty - 1)}
            >
              &#8722;
            </button>
            <span
              style={{ font: '500 20px var(--mono)', minWidth: 40, textAlign: 'center' }}
              data-testid="modify-qty"
              aria-live="polite"
            >
              {modQty}
            </span>
            <button
              type="button"
              className="pp-step"
              aria-label="More"
              data-testid="modify-inc"
              disabled={modQty >= maxQty}
              onClick={() => setQty(modQty + 1)}
            >
              +
            </button>
          </div>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            Suggested {p.suggested_qty}.{held != null ? ` Held ${held}.` : ''}
          </span>
          <span style={{ flex: 1 }} />
          <Button variant="secondary" size="sm" onClick={() => setMode('idle')}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            data-testid="modify-confirm"
            disabled={decide.isPending}
            onClick={() => submit({ decision: 'modify', qty: modQty })}
          >
            Approve modified order
          </Button>
        </div>
      )}

      {open && mode === 'reject' && (
        <div
          data-testid="proposal-reject-panel"
          style={{
            border: '1px solid var(--loss-line)',
            borderRadius: 10,
            padding: 14,
            display: 'grid',
            gap: 10,
          }}
        >
          <span id="pp-rej-h" style={{ fontSize: 13, fontWeight: 600 }}>
            Why are you rejecting this?{' '}
            <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>
              (required, used to learn your preferences)
            </span>
          </span>
          <div role="group" aria-labelledby="pp-rej-h" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {REJECT_REASONS.map(r => (
              <Chip
                key={r.value}
                pressed={reason === r.value}
                data-testid={`reason-${r.value}`}
                onClick={() => setReason(r.value)}
              >
                {r.label}
              </Chip>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="sm" onClick={() => setMode('idle')}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              data-testid="reject-confirm"
              disabled={!reason || decide.isPending}
              onClick={() => reason && submit({ decision: 'reject', reason })}
            >
              Confirm rejection
            </Button>
          </div>
        </div>
      )}

      {(done || (!open && !resolved && !expired && decidedText(p))) && (
        <div
          data-testid="proposal-result"
          role="status"
          style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', fontSize: 13 }}
        >
          {done ?? decidedText(p)}{' '}
          {isTrade && (done || p.status === 'approved' || p.status === 'modified') && (
            <Link to="/trading" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              See the order
            </Link>
          )}
        </div>
      )}

      {p.sources?.length > 0 && (
        <div
          style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}
          data-testid="proposal-sources"
        >
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Sources</span>
          {p.sources.map(s => (
            <Pill key={s} tone="info">
              {s}
            </Pill>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--ink-3)', display: 'grid', gap: 4 }}>
        <span>
          Simulated trade. No real order is placed. This is an educational prompt based on your own rules, not
          a recommendation to buy or sell.
        </span>
        <span data-testid="proposal-disclaimer">{p.disclaimer || DISCLAIMER_TEXT}</span>
      </div>
    </section>
  );
}
