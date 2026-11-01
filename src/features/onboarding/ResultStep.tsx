import { forwardRef } from 'react';
import type { OnboardingResult } from '@/api/types';
import { Stagger } from '@/motion';
import { Button } from '@/ui';
import { cardStyle, StepHeading } from './parts';

/** Labels for the five rule keys (design `onbRules` + the dashboard rule rows). `trades` is a count, the rest percent. */
const RULES: Array<{ key: keyof OnboardingResult['rules']; label: string; unit: string }> = [
  { key: 'pos', label: 'Max position', unit: '%' },
  { key: 'sec', label: 'Max sector', unit: '%' },
  { key: 'dd', label: 'Drawdown alert', unit: '%' },
  { key: 'trades', label: 'Trades / week', unit: '' },
  { key: 'cash', label: 'Min cash buffer', unit: '%' },
];

type Props = {
  result: OnboardingResult;
  startingCash: number;
  finishing: boolean;
  onFinish: () => void;
};

/** Step 5, shown after POST /onboarding succeeded: the tier the server derived, why, and the rules it will enforce. */
export const ResultStep = forwardRef<HTMLHeadingElement, Props>(function ResultStep(
  { result, startingCash, finishing, onFinish },
  ref,
) {
  return (
    <Stagger style={{ display: 'grid', gap: 22 }} data-testid="onboarding-result">
      <StepHeading ref={ref} eyebrow="Step 5 of 5" title="Your starting rules">
        Stated risk tier:{' '}
        <b data-testid="onboarding-tier">
          {result.tier_label} (tier {result.risk_tier})
        </b>
        . The risk engine enforces these limits on every suggestion.
      </StepHeading>
      <div
        data-testid="onboarding-explanation"
        style={{ ...cardStyle, padding: 16, fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)' }}
      >
        <b style={{ display: 'block', color: 'var(--ink)', marginBottom: 4 }}>How this was set</b>
        {result.explanation}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        {RULES.map(r => (
          <div key={r.key} style={{ ...cardStyle, padding: 16 }} data-testid={`rule-${r.key}`}>
            <div
              style={{
                font: '600 11px var(--mono)',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
                marginBottom: 6,
              }}
            >
              {r.label}
            </div>
            <div style={{ font: '500 28px var(--mono)' }}>
              {result.rules[r.key]}
              {r.unit}
            </div>
          </div>
        ))}
      </div>
      {result.watchlist.length > 0 && (
        <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
          Starter watchlist:{' '}
          <span style={{ font: '600 12px var(--mono)', color: 'var(--ink)' }}>
            {result.watchlist.join(', ')}
          </span>
        </div>
      )}
      <div
        style={{
          background: 'var(--accent-soft)',
          borderRadius: 14,
          padding: 16,
          fontSize: 13,
          color: 'var(--ink)',
        }}
      >
        Your paper portfolio starts with <b>${startingCash.toLocaleString('en-US')}</b> in simulated cash.
        Rankings begin from a persona prior and adapt as you use the app. You can change every rule later in
        your profile.
      </div>
      <div>
        <Button
          variant="primary"
          size="lg"
          onClick={onFinish}
          disabled={finishing}
          data-testid="onboarding-finish"
        >
          {finishing ? 'Opening…' : 'Open my dashboard'}
        </Button>
      </div>
    </Stagger>
  );
});
