import { useState, type ReactNode } from 'react';
import { useAuth } from '@/auth/useAuth';
import { useUpdateRules } from '@/api/hooks/profile';
import { describeError } from '@/api/errors';
import type { ProfileResponse, RulesObject } from '@/api/types';
import { useTrack } from '@/telemetry';
import { Chip, SegmentedControl, useToast } from '@/ui';
import { JARGON, METRICS, readProfile, TONES, useProfileOptions, useSaveProfile } from './api';

const toggle = (arr: string[], x: string) => (arr.includes(x) ? arr.filter(y => y !== x) : [...arr, x]);

function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div>
      {children}
    </div>
  );
}

export function ProfileTab({ data }: { data: ProfileResponse }) {
  const v = readProfile(data);
  const opts = useProfileOptions();
  const { save, pending } = useSaveProfile();
  const [warnings, setWarnings] = useState<string[]>([]);
  const { user } = useAuth();
  return (
    <div className="s3-grid-2">
      <div style={{ display: 'grid', gap: 24 }}>
        <section className="s3-card" style={{ gap: 20 }} aria-labelledby="told-h" data-testid="profile-told">
          <div>
            <h2 id="told-h" className="s3-h2" style={{ marginBottom: 4 }}>
              What you told us
            </h2>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              Stated preferences are never overwritten by behaviour. Conflicts are shown to you.
            </div>
          </div>
          <Field
            title={`Risk tier: ${v.tierLabel || opts.tierLabel(data.stated_tier)} (${data.stated_tier} of 5, stated)`}
          >
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              Set from your onboarding answers. It does not change by itself; edit the rules below to move
              your limits.
            </span>
          </Field>
          <Field title="Horizon">
            <SegmentedControl
              aria-label="Horizon"
              testId="profile-horizon"
              value={v.horizon}
              onChange={h => void save({ horizon: h })}
              options={opts.horizons}
            />
          </Field>
          <Field title="Goals">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Goals">
              {opts.goals.map(g => (
                <Chip
                  key={g}
                  pressed={v.goals.includes(g)}
                  disabled={pending || (v.goals.length === 1 && v.goals.includes(g))}
                  title={v.goals.length === 1 && v.goals.includes(g) ? 'Keep at least one goal' : undefined}
                  onClick={() => void save({ goals: toggle(v.goals, g) })}
                >
                  {g}
                </Chip>
              ))}
            </div>
          </Field>
          <Field title="Exclusions (hard filter)">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Exclusions">
              {opts.exclusions.map(g => (
                <Chip
                  key={g}
                  pressed={v.exclusions.includes(g)}
                  disabled={pending}
                  onClick={() => void save({ esg_exclusions: toggle(v.exclusions, g) })}
                >
                  {g}
                </Chip>
              ))}
            </div>
          </Field>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 20 }}
          >
            <Field title="Experience">
              <SegmentedControl
                aria-label="Experience"
                value={v.experience}
                onChange={x => void save({ experience: x, jargon: JARGON[x] ?? 2 })}
                options={opts.experience}
              />
            </Field>
            <Field title="Tone">
              <SegmentedControl
                aria-label="Tone"
                value={v.tone}
                onChange={x => void save({ tone: x })}
                options={TONES}
              />
            </Field>
          </div>
          <Field title="Pinned metric">
            <SegmentedControl
              aria-label="Pinned metric"
              value={v.metric}
              onChange={x => void save({ metric: x })}
              options={METRICS}
            />
          </Field>
        </section>

        <RulesEditor
          key={JSON.stringify(data.rules)}
          rules={data.rules}
          tier={data.stated_tier}
          warnings={warnings}
          onWarnings={setWarnings}
        />
      </div>

      <section
        className="s3-card"
        style={{ alignContent: 'start' }}
        aria-labelledby="acct-h"
        data-testid="profile-account"
      >
        <h2 id="acct-h" className="s3-h2">
          Account and security
        </h2>
        <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
          <div>
            <b>{user?.display_name ?? 'Your account'}</b>
            <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{user?.email}</div>
          </div>
          <div style={{ color: 'var(--ink-2)' }}>
            Sign-in and two-step verification are managed by your sign-in provider.
          </div>
        </div>
        <div
          style={{
            borderTop: '1px solid var(--line)',
            paddingTop: 12,
            fontSize: 13,
            color: 'var(--ink-2)',
            display: 'grid',
            gap: 4,
          }}
        >
          <div>
            Region and currency:{' '}
            <b style={{ color: 'var(--ink)' }}>
              {[v.region, v.currency].filter(Boolean).join(' · ') || 'Not set'}
            </b>
          </div>
          <div>
            Time zone: <b style={{ color: 'var(--ink)' }}>America/New_York (stored in UTC)</b>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------------- rules editor (PUT /profile/rules) ---------------- */
type RuleKey = keyof RulesObject;
const RULE_FIELDS: Array<{
  key: RuleKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  hint: string;
}> = [
  {
    key: 'pos',
    label: 'Max position size',
    unit: '%',
    min: 0.1,
    max: 100,
    hint: 'Largest share of the portfolio one stock may be',
  },
  {
    key: 'sec',
    label: 'Max sector exposure',
    unit: '%',
    min: 0.1,
    max: 100,
    hint: 'Largest share one sector may be',
  },
  {
    key: 'dd',
    label: 'Drawdown alert',
    unit: '%',
    min: 0.1,
    max: 100,
    hint: 'Alert when the portfolio falls this far from its peak',
  },
  {
    key: 'trades',
    label: 'Trades per 7 days',
    unit: '',
    min: 1,
    max: 100,
    hint: 'Rolling seven-day trade count',
  },
  { key: 'cash', label: 'Minimum cash', unit: '%', min: 0, max: 100, hint: 'Cash kept in reserve' },
];

function RulesEditor({
  rules,
  tier,
  warnings,
  onWarnings,
}: {
  rules: RulesObject;
  tier: number;
  warnings: string[];
  onWarnings: (w: string[]) => void;
}) {
  const update = useUpdateRules();
  const opts = useProfileOptions();
  const defaults = opts.tierRules?.[String(tier)] ?? null;
  const toast = useToast();
  const track = useTrack();
  const [draft, setDraft] = useState<Record<RuleKey, string>>(() => toDraft(rules));
  const [errors, setErrors] = useState<Partial<Record<RuleKey, string>>>({});

  const dirty = RULE_FIELDS.some(f => Number(draft[f.key]) !== rules[f.key]);

  const applyDefaults = () => {
    if (!defaults) return;
    setDraft(toDraft(defaults));
    setErrors({});
  };

  const onSave = async () => {
    const errs: Partial<Record<RuleKey, string>> = {};
    const next = { ...rules };
    for (const f of RULE_FIELDS) {
      const n = Number(draft[f.key]);
      if (draft[f.key].trim() === '' || !Number.isFinite(n) || n < f.min || n > f.max)
        errs[f.key] = `Enter a number from ${f.min} to ${f.max}`;
      else next[f.key] = n;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const res = (await update.mutateAsync(next)) as unknown as { warnings?: string[] } | undefined;
      track({ type: 'rule_edited', props: { action: 'profile_rules' } });
      onWarnings(Array.isArray(res?.warnings) ? res.warnings : []);
      toast.say('Rules saved. Logged.');
    } catch (e) {
      const d = describeError(e);
      const fe: Partial<Record<RuleKey, string>> = {};
      for (const f of RULE_FIELDS) if (d.fieldErrors[f.key]) fe[f.key] = d.fieldErrors[f.key];
      setErrors(fe);
      toast.say(d.message);
    }
  };

  return (
    <section className="s3-card" aria-labelledby="rules-h" data-testid="profile-rules">
      <div>
        <h2 id="rules-h" className="s3-h2" style={{ marginBottom: 4 }}>
          Your rules
        </h2>
        <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
          The risk engine enforces these on every order and proposal. Each change is logged and never loosened
          automatically.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14 }}>
        {RULE_FIELDS.map(f => (
          <label key={f.key} className="s3-field">
            {f.label}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                className="s3-input s3-input--num"
                style={{ width: '100%' }}
                inputMode="decimal"
                data-testid={`rule-${f.key}`}
                aria-invalid={!!errors[f.key]}
                aria-describedby={`rule-${f.key}-hint`}
                value={draft[f.key]}
                onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value.replace(/[^0-9.]/g, '') }))}
              />
              {f.unit && <span style={{ color: 'var(--ink-3)' }}>{f.unit}</span>}
            </span>
            <span
              id={`rule-${f.key}-hint`}
              style={{ fontWeight: 400, fontSize: 11, color: errors[f.key] ? 'var(--loss)' : 'var(--ink-3)' }}
            >
              {errors[f.key] ?? f.hint}
            </span>
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="s3-btn-primary"
          style={{ height: 34, padding: '0 16px' }}
          data-testid="rules-save"
          disabled={!dirty || update.isPending}
          onClick={() => void onSave()}
        >
          {update.isPending ? 'Saving' : 'Save rules'}
        </button>
        <button
          type="button"
          className="s3-btn-sm"
          style={{ height: 34 }}
          disabled={!dirty || update.isPending}
          onClick={() => {
            setDraft(toDraft(rules));
            setErrors({});
          }}
        >
          Reset
        </button>
        {defaults && (
          <button
            type="button"
            className="s3-btn-sm"
            style={{ height: 34 }}
            data-testid="rules-defaults"
            disabled={update.isPending}
            onClick={applyDefaults}
          >
            Use tier {tier} defaults
          </button>
        )}
      </div>
      {warnings.length > 0 && (
        <ul
          role="status"
          data-testid="rules-warnings"
          style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--warn)' }}
        >
          {warnings.map(w => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

const toDraft = (r: RulesObject): Record<RuleKey, string> => ({
  pos: String(r.pos),
  sec: String(r.sec),
  dd: String(r.dd),
  trades: String(r.trades),
  cash: String(r.cash),
});
