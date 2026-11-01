import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { SegmentedControl } from '@/ui';
import '@/features/trading/shared.css';
import { DrillsTab } from './DrillsTab';
import { EvalsTab } from './EvalsTab';
import { TracesTab } from './TracesTab';

type Tab = 'traces' | 'evals' | 'drills';

/** FE-10 · Audit: LLM traces (list + detail waterfall), eval scoreboard, dev-only failure drills. */
export default function Screen() {
  const { mode } = useAuth();
  const [params, setParams] = useSearchParams();
  const tabs: Array<{ value: Tab; label: string }> = [
    { value: 'traces', label: 'LLM traces' },
    { value: 'evals', label: 'Evals' },
    ...(mode === 'dev' ? [{ value: 'drills' as const, label: 'Failure drills' }] : []),
  ];
  const raw = params.get('tab');
  const tab: Tab = tabs.some(t => t.value === raw) ? (raw as Tab) : 'traces';

  return (
    <div className="s3-screen" style={{ gap: 20 }} data-testid="screen-audit">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <SegmentedControl
          aria-label="Audit sections"
          testId="audit-tabs"
          value={tab}
          onChange={t =>
            setParams(
              p => {
                const n = new URLSearchParams(p);
                if (t === 'traces') n.delete('tab');
                else n.set('tab', t);
                return n;
              },
              { replace: true },
            )
          }
          options={tabs}
        />
        <span className="s3-sub">Every output is traceable: trace ID to sources to features used.</span>
      </div>
      {tab === 'traces' ? <TracesTab /> : tab === 'evals' ? <EvalsTab /> : <DrillsTab />}
    </div>
  );
}
