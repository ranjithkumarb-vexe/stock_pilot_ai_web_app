import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BiasMirror, Interest, ProfileResponse } from '@/api/types';
import { ago } from '@/features/trading/format';
import { Pill, type Tone } from '@/ui';
import { fmtValue, humanizeKey, useProfileOptions } from './api';

const BIAS: Record<BiasMirror['state'], { label: string; tone: Tone }> = {
  ok: { label: 'Normal', tone: 'ok' },
  watch: { label: 'Watch', tone: 'warn' },
  flag: { label: 'Flag', tone: 'bad' },
};

const pos = (tier: number) => `${Math.max(0, Math.min(100, ((tier - 1) / 4) * 100))}%`;
const KEPT_KEY = 'sp-gap-kept';
const readKept = (): string => {
  try {
    return sessionStorage.getItem(KEPT_KEY) ?? '';
  } catch {
    return '';
  }
};

export function LearnedTab({ data }: { data: ProfileResponse }) {
  const navigate = useNavigate();
  const opts = useProfileOptions();
  const sig = `${data.stated_tier}:${Math.round(data.revealed_tier)}`;
  const [kept, setKept] = useState(readKept() === sig);

  const gap = data.revealed_tier - data.stated_tier;
  const flag = Math.abs(gap) >= 1 && data.gap_days >= 14 && !kept;
  const interests = ([...(data.interests ?? [])] as Array<Interest & { label?: string }>).sort(
    (a, b) => b.weight - a.weight,
  );
  const style = Object.entries(data.style_card ?? {});

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section className="s3-card" style={{ gap: 14 }} aria-labelledby="gap-h" data-testid="profile-gap">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h2 id="gap-h" className="s3-h2">
            Stated vs revealed risk
          </h2>
          <span className="s3-sub">
            Revealed = realized volatility and beta of the actual portfolio, mapped to a tier
          </span>
        </div>
        <div
          style={{ position: 'relative', height: 44, margin: '0 6px' }}
          role="img"
          aria-label={`Stated tier ${data.stated_tier}, revealed tier ${data.revealed_tier.toFixed(1)}`}
        >
          <span
            style={{
              position: 'absolute',
              top: 20,
              left: 0,
              right: 0,
              height: 4,
              borderRadius: 2,
              background: 'var(--surface-2)',
            }}
          />
          <span
            style={{
              position: 'absolute',
              top: 0,
              left: pos(data.stated_tier),
              transform: 'translateX(-50%)',
              font: '600 11px var(--mono)',
              color: 'var(--info)',
              whiteSpace: 'nowrap',
            }}
          >
            STATED {data.stated_tier}
          </span>
          <span
            style={{
              position: 'absolute',
              top: 16,
              left: pos(data.stated_tier),
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: 'var(--info)',
              transform: 'translateX(-50%)',
            }}
          />
          <span
            style={{
              position: 'absolute',
              top: 30,
              left: pos(data.revealed_tier),
              transform: 'translateX(-50%)',
              font: '600 11px var(--mono)',
              color: 'var(--warn)',
              whiteSpace: 'nowrap',
            }}
          >
            REVEALED {data.revealed_tier.toFixed(1)}
          </span>
          <span
            style={{
              position: 'absolute',
              top: 16,
              left: pos(data.revealed_tier),
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: 'var(--warn)',
              transform: 'translateX(-50%)',
            }}
          />
        </div>
        {flag ? (
          <div
            style={{
              background: 'var(--warn-soft)',
              borderRadius: 10,
              padding: 14,
              display: 'grid',
              gap: 10,
            }}
            data-testid="gap-prompt"
          >
            <div style={{ fontSize: 14 }}>
              <b>
                Your portfolio behaves like tier {Math.round(data.revealed_tier)}; you chose tier{' '}
                {data.stated_tier}.
              </b>{' '}
              This has held for {data.gap_days} days. Review your rules or your holdings?
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="s3-btn-primary"
                style={{ height: 32, padding: '0 14px' }}
                onClick={() => navigate('/profile')}
              >
                Review my rules
              </button>
              <button
                type="button"
                className="s3-btn-sm"
                style={{ height: 32 }}
                onClick={() => navigate('/portfolio')}
              >
                Review holdings
              </button>
              <button
                type="button"
                className="s3-btn-sm"
                style={{ height: 32 }}
                onClick={() => {
                  try {
                    sessionStorage.setItem(KEPT_KEY, sig);
                  } catch {
                    /* private mode: the choice only lasts for this view */
                  }
                  setKept(true);
                }}
              >
                Keep as is
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--ink-2)' }} data-testid="gap-ok">
            {kept
              ? 'You chose to keep your stated tier. It is never changed automatically.'
              : data.gap_days < 14 && Math.abs(gap) >= 1
                ? 'Not enough trading history yet. The comparison starts after 14 days of activity.'
                : `Your portfolio behaves close to your stated tier (${opts.tierLabel(data.stated_tier)}). No action needed.`}
          </div>
        )}
      </section>

      <div className="s3-grid-2">
        <section
          className="s3-card"
          style={{ gap: 12 }}
          aria-labelledby="int-h"
          data-testid="profile-interests"
        >
          <div>
            <h2 id="int-h" className="s3-h2" style={{ marginBottom: 4 }}>
              Interest vector
            </h2>
            <div className="s3-sub">
              Learned from views, queries, approvals and holdings. Decays with a 14-day half-life.
            </div>
          </div>
          {interests.length === 0 && (
            <div className="s3-muted" style={{ fontSize: 13 }}>
              Nothing learned yet. Interests appear as you use the app.
            </div>
          )}
          {interests.map(i => {
            const w = Math.round(Math.max(0, Math.min(1, i.weight)) * 100);
            return (
              <div
                key={i.dim}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr 40px',
                  gap: 10,
                  alignItems: 'center',
                  fontSize: 13,
                }}
              >
                <span>{i.label ?? i.dim}</span>
                <span
                  role="meter"
                  aria-label={`${i.label ?? i.dim} interest`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={w}
                  style={{
                    position: 'relative',
                    height: 8,
                    borderRadius: 4,
                    background: 'var(--surface-2)',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{ display: 'block', height: '100%', width: `${w}%`, background: 'var(--accent)' }}
                  />
                  <span
                    title="Starting point from your setup"
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${Math.round(Math.max(0, Math.min(1, i.baseline)) * 100)}%`,
                      width: 2,
                      background: 'var(--ink-3)',
                    }}
                  />
                </span>
                <span style={{ font: '500 12px var(--mono)', textAlign: 'right' }}>{w}</span>
              </div>
            );
          })}
        </section>
        <section
          className="s3-card"
          style={{ gap: 10 }}
          aria-labelledby="style-h"
          data-testid="profile-style"
        >
          <h2 id="style-h" className="s3-h2">
            Style card
          </h2>
          <div className="s3-sub">
            Injected into the model prompt as a compact profile (about 400 tokens).
          </div>
          {style.length === 0 && (
            <div className="s3-muted" style={{ fontSize: 13 }}>
              No style card yet.
            </div>
          )}
          {style.map(([k, val]) => (
            <div
              key={k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                fontSize: 13,
                borderBottom: '1px solid var(--line)',
                paddingBottom: 6,
              }}
            >
              <span style={{ color: 'var(--ink-2)' }}>{humanizeKey(k)}</span>
              <b style={{ textAlign: 'right' }}>{fmtValue(val)}</b>
            </div>
          ))}
        </section>
      </div>

      <section className="s3-card" style={{ gap: 12 }} aria-labelledby="bias-h" data-testid="profile-bias">
        <div>
          <h2 id="bias-h" className="s3-h2" style={{ marginBottom: 4 }}>
            Behaviour mirrors
          </h2>
          <div className="s3-sub">
            Based on academic research on retail investors. These describe patterns in your trades, not what
            to do.
          </div>
        </div>
        {(data.bias ?? []).length === 0 && (
          <div className="s3-muted" style={{ fontSize: 13 }}>
            No behaviour data yet.
          </div>
        )}
        {(data.bias ?? []).map(b => {
          const s = BIAS[b.state] ?? { label: 'No data', tone: 'n' as Tone };
          return (
            <div
              key={b.name}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1.4fr) minmax(0,1.4fr) 90px',
                gap: 12,
                alignItems: 'center',
                fontSize: 13,
                padding: '8px 0',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <b>{b.name}</b>
              <span style={{ color: 'var(--ink-2)' }}>{b.metric}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{String(b.value ?? 'No data')}</span>
              <Pill tone={s.tone} style={{ textAlign: 'center' }}>
                {s.label}
              </Pill>
            </div>
          );
        })}
      </section>

      <section className="s3-card" style={{ gap: 8 }} aria-labelledby="sig-h" data-testid="profile-signals">
        <h2 id="sig-h" className="s3-h2">
          Recent signals
        </h2>
        {(data.recent_events ?? []).length === 0 && (
          <div className="s3-muted" style={{ fontSize: 13 }}>
            No signals recorded yet.
          </div>
        )}
        {(data.recent_events ?? []).slice(0, 10).map(e => (
          <div
            key={e.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 160px 1fr',
              gap: 12,
              fontSize: 13,
              padding: '6px 0',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <span style={{ font: '400 12px var(--mono)', color: 'var(--ink-3)' }}>{ago(e.ts)}</span>
            <span style={{ font: '500 12px var(--mono)', color: 'var(--info)' }}>{e.type}</span>
            <span>{e.text}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
