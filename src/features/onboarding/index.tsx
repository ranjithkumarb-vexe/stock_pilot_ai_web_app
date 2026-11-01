import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { describeError, type DescribedError } from '@/api/errors';
import { useUniverse } from '@/api/hooks/watchlist';
import { useOnboardingQuestions } from '@/api/hooks/profile';
import type { OnboardingQuestions } from '@/api/types';
import { useAuth } from '@/auth/useAuth';
import { Enter } from '@/motion';
import { ErrorPanel } from '@/shell/ErrorBoundary';
import { Button, SkeletonBlock, Wordmark } from '@/ui';
import { useCreateWorkspace } from './api';
import {
  emptyDraft,
  RESULT_STEP,
  STARTER_SYMBOLS,
  stepProblem,
  STEPS,
  toBody,
  type Draft,
  type StepIndex,
} from './draft';
import { ResultStep } from './ResultStep';
import { GoalsStep, RiskStep, WelcomeStep } from './Steps';
import { WatchlistStep } from './WatchlistStep';

const CSS = `
.onb-steps{display:flex;gap:6px;align-items:center;margin:0;padding:0;list-style:none}
.onb-steps li{display:flex;align-items:center;gap:8px;margin-right:12px}
@media (max-width: 760px){.onb-steps li{margin-right:2px}.onb-steps li .onb-steps__label{display:none}.onb-steps li[aria-current="step"] .onb-steps__label{display:inline}}
.onb-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 40px;border-bottom:1px solid var(--line);background:var(--surface)}
@media (max-width: 760px){.onb-header{padding:14px 16px;flex-wrap:wrap}.onb-main{padding:24px 16px!important}}
`;

/** Entry: loads the (public) questionnaire, then hands a complete questions object to the flow. */
export default function Screen() {
  const questions = useOnboardingQuestions();
  return (
    <div
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
      data-testid="screen-onboarding"
    >
      <style>{CSS}</style>
      {questions.data ? (
        <Flow questions={questions.data} />
      ) : (
        <main id="main" tabIndex={-1} style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24 }}>
          {questions.isError ? (
            <ErrorPanel
              error={questions.error}
              title="Could not load the questionnaire"
              onRetry={() => void questions.refetch()}
            />
          ) : (
            <div style={{ width: 'min(480px,100%)' }}>
              <SkeletonBlock label="Loading the questionnaire" widths={[40, 100, 80, 60]} />
            </div>
          )}
        </main>
      )}
    </div>
  );
}

function Flow({ questions }: { questions: OnboardingQuestions }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const universe = useUniverse();
  const create = useCreateWorkspace();

  const [step, setStep] = useState<StepIndex>(0);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(questions));
  const [problem, setProblem] = useState<string | null>(null);
  const [shakes, setShakes] = useState(0);
  const [serverError, setServerError] = useState<DescribedError | null>(null);
  const [finishing, setFinishing] = useState(false);

  const set = useCallback((patch: Partial<Draft>) => {
    setDraft(d => ({ ...d, ...patch }));
    setProblem(null);
  }, []);

  // pre-select the design's starter tickers that exist in the supported universe, once, if the user has not chosen
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !universe.data) return;
    seeded.current = true;
    const known = new Set(universe.data.items.map(u => u.symbol));
    const starters = STARTER_SYMBOLS.filter(s => known.has(s));
    setDraft(d => (d.watchlist.length === 0 ? { ...d, watchlist: [...starters] } : d));
  }, [universe.data]);

  // move focus to the step heading when the step changes
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
    heading.current?.focus();
  }, [step]);

  const fail = (msg: string) => {
    setProblem(msg);
    setShakes(n => n + 1);
  };

  const next = async () => {
    const p = stepProblem(step, draft);
    if (p) return fail(p);
    setProblem(null);
    setServerError(null);
    if (step < 3) return setStep((step + 1) as StepIndex);
    try {
      await create.mutateAsync(toBody(draft));
      setStep(RESULT_STEP);
    } catch (e) {
      const d = describeError(e);
      setServerError(d);
      setShakes(n => n + 1);
    }
  };

  const finish = async () => {
    setFinishing(true);
    try {
      await create.finish();
    } finally {
      setFinishing(false);
    }
    navigate('/dashboard', { replace: true });
  };

  const result = create.data;
  const alreadyOnboarded = serverError?.code === 'conflict';
  const submitting = create.isPending;

  return (
    <>
      <header className="onb-header">
        <Wordmark />
        <nav aria-label="Onboarding progress">
          <ol className="onb-steps" data-testid="onboarding-steps">
            {STEPS.map((label, i) => {
              const state = i < step ? 'done' : i === step ? 'current' : 'todo';
              return (
                <li key={label} aria-current={state === 'current' ? 'step' : undefined} data-state={state}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      font: '600 12px var(--mono)',
                      background:
                        state === 'done'
                          ? 'var(--grad)'
                          : state === 'current'
                            ? 'var(--ink)'
                            : 'var(--surface-2)',
                      color:
                        state === 'done'
                          ? 'var(--accent-ink)'
                          : state === 'current'
                            ? 'var(--bg)'
                            : 'var(--ink-3)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="onb-steps__label"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: state === 'current' ? 'var(--ink)' : 'var(--ink-3)',
                    }}
                  >
                    {label}
                  </span>
                  <span className="sr-only">{state === 'done' ? ' (completed)' : ''}</span>
                </li>
              );
            })}
          </ol>
        </nav>
        <button
          type="button"
          onClick={() => void signOut()}
          data-testid="onboarding-exit"
          style={{
            border: 0,
            background: 'transparent',
            color: 'var(--ink-2)',
            fontSize: 13,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Exit
        </button>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="onb-main"
        style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '40px 24px' }}
      >
        <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: 24, alignContent: 'start' }}>
          {step === 0 && <WelcomeStep ref={heading} draft={draft} set={set} />}
          {step === 1 && <RiskStep ref={heading} draft={draft} set={set} questions={questions.questions} />}
          {step === 2 && <GoalsStep ref={heading} draft={draft} set={set} q={questions} />}
          {step === 3 && <WatchlistStep ref={heading} draft={draft} set={set} universe={universe} />}
          {step === RESULT_STEP && result && (
            <ResultStep
              ref={heading}
              result={result}
              startingCash={draft.startingCash}
              finishing={finishing}
              onFinish={() => void finish()}
            />
          )}

          <div role="alert" data-testid="onboarding-error-region">
            {problem && (
              <Enter
                key={shakes}
                kind={shakes % 2 ? 'shake-a' : 'shake-b'}
                data-testid="onboarding-error"
                style={errStyle}
              >
                {problem}
              </Enter>
            )}
            {serverError && (
              <Enter
                key={`s${shakes}`}
                kind={shakes % 2 ? 'shake-a' : 'shake-b'}
                data-testid="onboarding-server-error"
                style={{ ...errStyle, display: 'grid', gap: 4, alignItems: 'start' }}
              >
                <b>{alreadyOnboarded ? 'Your workspace is already set up' : serverError.title}</b>
                <span style={{ color: 'var(--ink)', fontWeight: 400 }}>
                  {alreadyOnboarded
                    ? 'This account finished onboarding earlier. Open the dashboard to continue.'
                    : serverError.message}
                </span>
                {Object.entries(serverError.fieldErrors).map(([f, m]) => (
                  <span key={f} style={{ color: 'var(--ink)', fontWeight: 400 }}>
                    {f}: {m}
                  </span>
                ))}
                {serverError.serverMessage &&
                  (serverError.code !== 'validation_error' ||
                    (Object.keys(serverError.fieldErrors).length === 0 &&
                      serverError.serverMessage !== 'Request validation failed')) &&
                  !alreadyOnboarded && (
                    <span style={{ color: 'var(--ink-2)', fontWeight: 400 }}>
                      {serverError.serverMessage}
                    </span>
                  )}
                {serverError.traceId && (
                  <span style={{ font: '400 11px var(--mono)', color: 'var(--ink-3)' }}>
                    Reference: {serverError.traceId}
                  </span>
                )}
                {alreadyOnboarded && (
                  <div>
                    <Button size="sm" onClick={() => void finish()} data-testid="onboarding-already">
                      Open dashboard
                    </Button>
                  </div>
                )}
              </Enter>
            )}
          </div>

          {step !== RESULT_STEP && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 8,
              }}
            >
              <Button
                onClick={() => {
                  setServerError(null);
                  setProblem(null);
                  setStep((step - 1) as StepIndex);
                }}
                disabled={step === 0 || submitting}
                data-testid="onboarding-back"
              >
                Back
              </Button>
              <Button
                variant="primary"
                onClick={() => void next()}
                disabled={submitting}
                aria-describedby={problem ? 'onboarding-error-region' : undefined}
                data-testid="onboarding-next"
                style={{ opacity: stepProblem(step, draft) && !submitting ? 0.72 : 1 }}
              >
                {submitting ? 'Creating…' : step === 3 ? 'Create my workspace' : 'Continue'}
              </Button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

const errStyle = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  padding: '10px 14px',
  borderRadius: 10,
  background: 'var(--loss-soft)',
  color: 'var(--loss)',
  fontSize: 13,
  fontWeight: 600,
} as const;
