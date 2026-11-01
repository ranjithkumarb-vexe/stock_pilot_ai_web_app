import { useState } from 'react';
import { useUpdateRules } from '@/api';
import { describeError } from '@/api/errors';
import type { PortfolioRisk, RulesObject } from '@/api/types';
import { useTrack } from '@/telemetry';
import { Pill, useToast, type Tone } from '@/ui';
import { RULE_DEFS, limitFor, rulesFromRisk, type RuleKey } from './rules';

const STATUS: Record<string, { tone: Tone; word: string }> = {
  ok: { tone: 'ok', word: 'OK' },
  warn: { tone: 'warn', word: 'Near limit' },
  breach: { tone: 'bad', word: 'Breached' },
};

/** "Your risk rules": live status from the risk engine plus the +/- steppers (PUT /v1/profile/rules, logged, never automatic). */
export function RulesPanel({ risk }: { risk: PortfolioRisk }) {
  const update = useUpdateRules();
  const toast = useToast();
  const track = useTrack();
  // an edit is shown until the refreshed risk response reflects it (`base` is the limit it was made from)
  const [ov, setOv] = useState<Partial<Record<RuleKey, { value: number; base: number }>>>({});
  const full = rulesFromRisk(risk);

  const shown = (key: RuleKey): number | undefined => {
    const limit = limitFor(risk, key);
    const o = ov[key];
    return o && o.base === limit ? o.value : limit;
  };

  const step = (key: RuleKey, dir: 1 | -1) => {
    const d = RULE_DEFS.find(x => x.key === key);
    const cur = shown(key);
    const base = limitFor(risk, key);
    if (!d || !full || cur == null || base == null) return;
    const nv = Math.max(d.min, Math.min(d.max, cur + dir * d.step));
    if (nv === cur) return;
    const body: RulesObject = { ...full };
    for (const k of Object.keys(body) as RuleKey[]) body[k] = shown(k) ?? body[k];
    body[key] = nv;
    setOv(o => ({ ...o, [key]: { value: nv, base } }));
    update.mutate(body, {
      onSuccess: () => {
        toast.say(`${d.label} set to ${nv}${d.unit}. Logged. Rules never change automatically.`);
        track({ type: 'rule_edited', entity: { metric: key }, props: { delta: nv - cur, action: 'set' } });
      },
      onError: e => {
        setOv(o => {
          const { [key]: _drop, ...rest } = o;
          void _drop;
          return rest;
        });
        toast.say(describeError(e).message);
      },
    });
  };

  return (
    <section
      className="pf-card"
      style={{ padding: 20, display: 'grid', gap: 14 }}
      data-testid="pf-rules"
      aria-labelledby="pf-rules-h"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h2 id="pf-rules-h" style={{ font: "600 14px 'Geist'", margin: 0 }}>
          Your risk rules
        </h2>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          The risk engine vetoes any suggestion that would break these. Changes are logged and never applied
          automatically.
        </span>
      </div>
      <div className="pf-rules">
        {RULE_DEFS.map(d => {
          const rule = risk.rules.find(r => r.key === d.key);
          const val = shown(d.key);
          const st = rule ? STATUS[rule.status] : undefined;
          return (
            <div
              key={d.key}
              data-testid={`rule-${d.key}`}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 10,
                padding: 12,
                display: 'grid',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{d.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  className="pf-step"
                  aria-label={`Decrease ${d.label}`}
                  data-testid={`rule-${d.key}-dec`}
                  disabled={!full || update.isPending || val == null || val <= d.min}
                  onClick={() => step(d.key, -1)}
                >
                  &#8722;
                </button>
                <span
                  style={{ font: '500 22px var(--mono)' }}
                  data-testid={`rule-${d.key}-val`}
                  aria-live="polite"
                >
                  {val == null ? '–' : `${val}${d.unit}`}
                </span>
                <button
                  type="button"
                  className="pf-step"
                  aria-label={`Increase ${d.label}`}
                  data-testid={`rule-${d.key}-inc`}
                  disabled={!full || update.isPending || val == null || val >= d.max}
                  onClick={() => step(d.key, 1)}
                >
                  +
                </button>
              </div>
              <span
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  fontSize: 11,
                  color: 'var(--ink-3)',
                }}
              >
                {d.note}
                {rule && st && (
                  <Pill
                    tone={st.tone}
                    style={{ height: 18, lineHeight: '18px' }}
                    data-testid={`rule-${d.key}-status`}
                  >
                    {st.word}: {rule.current}
                    {d.unit}
                  </Pill>
                )}
              </span>
            </div>
          );
        })}
      </div>
      {!full && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          Rule editing is unavailable until every rule limit is reported by the risk engine.
        </div>
      )}
    </section>
  );
}
