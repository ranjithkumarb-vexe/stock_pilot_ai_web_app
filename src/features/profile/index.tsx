import { useSearchParams } from 'react-router-dom';
import { useProfile } from '@/api/hooks/profile';
import { ErrorPanel } from '@/shell/ErrorBoundary';
import { SegmentedControl, SkeletonBlock } from '@/ui';
import '@/features/trading/shared.css';
import { LearnedTab } from './LearnedTab';
import { MemoryTab } from './MemoryTab';
import { PrivacyTab } from './PrivacyTab';
import { ProfileTab } from './ProfileTab';
import './profile.css';

const TABS = [
  { value: 'profile', label: 'Profile' },
  { value: 'learned', label: 'What it learned' },
  { value: 'memory', label: 'Memories' },
  { value: 'privacy', label: 'Data and privacy' },
] as const;
type Tab = (typeof TABS)[number]['value'];
const isTab = (v: string | null): v is Tab => TABS.some(t => t.value === v);

/** FE-10 · Profile: stated profile + rules, what it learned, memories (forget), export / reset / delete account. */
export default function Screen() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = isTab(raw) ? raw : 'profile';
  const q = useProfile();
  // the privacy tab does not need the profile payload: controls must stay reachable if /profile is down
  const needsData = tab !== 'privacy';

  return (
    <div className="s3-screen" style={{ gap: 20 }} data-testid="screen-profile">
      <SegmentedControl
        aria-label="Profile sections"
        testId="profile-tabs"
        value={tab}
        onChange={t =>
          setParams(
            p => {
              const n = new URLSearchParams(p);
              if (t === 'profile') n.delete('tab');
              else n.set('tab', t);
              return n;
            },
            { replace: true },
          )
        }
        options={TABS.map(t => ({ value: t.value, label: t.label }))}
      />
      {needsData && q.isLoading ? (
        <SkeletonBlock label="Loading your profile" widths={[40, 100, 90, 60]} />
      ) : needsData && q.isError ? (
        <ErrorPanel error={q.error} title="Could not load your profile" onRetry={() => void q.refetch()} />
      ) : tab === 'privacy' ? (
        <PrivacyTab />
      ) : q.data ? (
        tab === 'profile' ? (
          <ProfileTab data={q.data} />
        ) : tab === 'learned' ? (
          <LearnedTab data={q.data} />
        ) : (
          <MemoryTab data={q.data} />
        )
      ) : null}
    </div>
  );
}
