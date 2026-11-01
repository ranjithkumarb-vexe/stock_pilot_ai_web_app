import { forwardRef } from 'react';
import type { OnboardingQuestions } from '@/api/types';
import { DISCLAIMER_TEXT } from '@/shell/disclaimer';
import { Stagger } from '@/motion';
import { Chip, SegmentedControl } from '@/ui';
import { CASH_PRESETS, ESG_EXCLUSIONS, GOALS, toggle, type Draft } from './draft';
import { cardStyle, Field, StepHeading } from './parts';

type Common = { draft: Draft; set: (patch: Partial<Draft>) => void };

/** Step 1: what StockPilot does, the Appendix A disclaimer (verbatim) and the mandatory acknowledgement. */
export const WelcomeStep = forwardRef<HTMLHeadingElement, Common>(function WelcomeStep({ draft, set }, ref) {
  return (
    <Stagger style={{ display: 'grid', gap: 20 }}>
      <StepHeading ref={ref} eyebrow="Step 1 of 5" title="What StockPilot does and does not do">
        It researches companies, checks your portfolio against rules you set, and lets you practice with
        simulated trades.
      </StepHeading>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        {[
          ['Education', 'Briefs explain filings and link every number to its source.'],
          ['Your rules', 'Suggestions follow limits you write, never the other way round.'],
          ['Paper only', 'No broker is connected. No real order can be placed.'],
        ].map(([t, d]) => (
          <div key={t} style={{ ...cardStyle, padding: 16 }}>
            <b style={{ display: 'block', marginBottom: 4 }}>{t}</b>
            <span style={{ color: 'var(--ink-2)', fontSize: 13 }}>{d}</span>
          </div>
        ))}
      </div>
      <div
        data-testid="onboarding-disclaimer"
        style={{
          background: 'var(--warn-soft)',
          borderRadius: 14,
          padding: 20,
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--ink)',
        }}
      >
        <b style={{ display: 'block', marginBottom: 6 }}>Disclaimer</b>
        {DISCLAIMER_TEXT}
      </div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 14 }}>
        <input
          type="checkbox"
          data-testid="onboarding-ack"
          checked={draft.ack}
          onChange={() => set({ ack: !draft.ack })}
          style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--accent)' }}
        />
        I have read and understand this disclaimer.
      </label>
    </Stagger>
  );
});

/** Step 2: the six risk scenarios from GET /onboarding/questions. Scores are sent as-is; the server derives the tier. */
export const RiskStep = forwardRef<
  HTMLHeadingElement,
  Common & { questions: OnboardingQuestions['questions'] }
>(function RiskStep({ draft, set, questions }, ref) {
  const answered = draft.answers.filter(a => a != null).length;
  return (
    <Stagger style={{ display: 'grid', gap: 20 }}>
      <StepHeading ref={ref} eyebrow="Step 2 of 5" title="How do you react to risk?">
        {questions.length} scenarios. They set your starting rules, and you can change them later.
      </StepHeading>
      <div role="status" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
        {answered} of {questions.length} answered
      </div>
      {questions.map((q, qi) => (
        <fieldset
          key={q.id}
          data-testid={`question-${qi + 1}`}
          style={{
            ...cardStyle,
            padding: '16px 20px',
            margin: 0,
            display: 'grid',
            gap: 10,
            minWidth: 0,
          }}
        >
          <legend style={{ font: '600 11px var(--mono)', color: 'var(--ink-3)', padding: '0 6px' }}>
            Question {qi + 1} of {questions.length}
          </legend>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{q.text}</div>
          <div role="radiogroup" aria-label={q.text} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {q.options.map(o => {
              const on = draft.answers[qi] === o.score;
              return (
                <button
                  key={o.label}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set({ answers: draft.answers.map((a, i) => (i === qi ? o.score : a)) })}
                  style={{
                    minHeight: 36,
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: on ? 'var(--grad)' : 'var(--surface)',
                    color: on ? 'var(--accent-ink)' : 'var(--ink)',
                    border: on ? '1px solid var(--accent)' : '1px solid var(--line-strong)',
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </Stagger>
  );
});

/** Step 3: horizon, goals, experience, liked sectors, hard exclusions. */
export const GoalsStep = forwardRef<HTMLHeadingElement, Common & { q: OnboardingQuestions }>(
  function GoalsStep({ draft, set, q }, ref) {
    return (
      <Stagger style={{ display: 'grid', gap: 22 }}>
        <StepHeading ref={ref} eyebrow="Step 3 of 5" title="Your goals and interests">
          These tune what is shown first and how much jargon appears.
        </StepHeading>
        <Field label="Investment horizon">
          <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
            <SegmentedControl
              aria-label="Investment horizon"
              testId="onboarding-horizon"
              options={q.horizons}
              value={draft.horizon ?? ''}
              onChange={v => set({ horizon: v })}
            />
          </div>
        </Field>
        <Field label="Goals" hint="pick at least one">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GOALS.map(g => (
              <Chip
                key={g}
                pressed={draft.goals.includes(g)}
                onClick={() => set({ goals: toggle(draft.goals, g) })}
              >
                {g}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Experience">
          <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
            <SegmentedControl
              aria-label="Experience"
              testId="onboarding-experience"
              options={q.experience_levels}
              value={draft.experience ?? ''}
              onChange={v => set({ experience: v })}
            />
          </div>
        </Field>
        <Field label="Sectors you like" hint="raises ranking">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {q.sectors.map(s => (
              <Chip
                key={s}
                pressed={draft.likes.includes(s)}
                onClick={() =>
                  set({ likes: toggle(draft.likes, s), excludes: draft.excludes.filter(x => x !== s) })
                }
              >
                {s}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Exclude sectors" hint="hard filter, never shown">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {q.sectors.map(s => (
              <Chip
                key={s}
                pressed={draft.excludes.includes(s)}
                onClick={() =>
                  set({ excludes: toggle(draft.excludes, s), likes: draft.likes.filter(x => x !== s) })
                }
              >
                {s}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Values filters" hint="never shown">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ESG_EXCLUSIONS.map(s => (
              <Chip
                key={s}
                pressed={draft.esg.includes(s)}
                onClick={() => set({ esg: toggle(draft.esg, s) })}
              >
                {s}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Paper portfolio starting cash" hint="simulated">
          <SegmentedControl
            aria-label="Starting cash"
            testId="onboarding-cash"
            options={CASH_PRESETS.map(c => ({ value: String(c), label: `$${c.toLocaleString('en-US')}` }))}
            value={String(draft.startingCash)}
            onChange={v => set({ startingCash: Number(v) })}
          />
        </Field>
      </Stagger>
    );
  },
);
