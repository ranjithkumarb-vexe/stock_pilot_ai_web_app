import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProposal, useProposals } from '@/api';
import type { Proposal } from '@/api/types';
import { ago } from '@/features/portfolio/format';
import { Stagger } from '@/motion';
import { ErrorPanel } from '@/shell/ErrorBoundary';
import { Pill, SegmentedControl, SkeletonBlock } from '@/ui';
import { ProposalDetail } from './ProposalDetail';
import { expiresLabel, inTab, shortId, statusChip, subline, type Tab } from './helpers';
import './proposals.css';

/** Proposals (FE-07): Pending / History tabs, list, and the selected proposal's detail with approve / modify / reject. */
export default function Screen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const q = useProposals();
  const deep = useProposal(id && !q.data?.items.some(p => p.id === id) ? id : undefined);
  const [tabPick, setTabPick] = useState<Tab | null>(null);

  const items: Proposal[] = useMemo(() => q.data?.items ?? [], [q.data]);
  const selectedAny = items.find(p => p.id === id) ?? deep.data;
  // a deep link to an already-decided proposal opens on History
  const autoTab: Tab = selectedAny && !inTab(selectedAny, 'pending') ? 'history' : 'pending';
  const tab = tabPick ?? autoTab;

  const pending = items.filter(p => inTab(p, 'pending'));
  const history = items.filter(p => inTab(p, 'history'));
  const list = tab === 'pending' ? pending : history;
  // an explicit /proposals/:id always wins over the tab's first item (so a just-decided proposal stays on screen)
  const selected = selectedAny ?? list[0];

  if (q.isLoading)
    return (
      <div data-testid="screen-proposals">
        <SkeletonBlock label="Loading proposals" widths={[40, 100, 80]} />
      </div>
    );
  if (q.isError)
    return (
      <div data-testid="screen-proposals">
        <ErrorPanel error={q.error} onRetry={() => void q.refetch()} />
      </div>
    );

  return (
    <div
      data-testid="screen-proposals"
      style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}
    >
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
          aria-label="Proposal status"
          testId="proposal-tabs"
          value={tab}
          onChange={t => {
            setTabPick(t);
            navigate('/proposals');
          }}
          options={[
            { value: 'pending', label: `Pending (${pending.length})` },
            { value: 'history', label: `History (${history.length})` },
          ]}
        />
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          Each proposal follows from a rule you wrote or a pattern in your own data. Approving only affects
          the paper simulator.
        </span>
      </div>

      <div className="pp-layout">
        <Stagger className="pp-list" data-testid="proposal-list">
          {list.map(p => {
            const chip = statusChip(p);
            const current = selected?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className="pp-item"
                aria-current={current ? 'true' : undefined}
                data-testid={`proposal-item-${p.id}`}
                onClick={() => navigate(`/proposals/${p.id}`)}
              >
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ font: '600 11px var(--mono)', color: 'var(--ink-3)' }}>{shortId(p.id)}</span>
                  <Pill tone={chip.tone} style={{ height: 20, lineHeight: '20px' }}>
                    {chip.word}
                  </Pill>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {ago(p.created_at)}
                    {p.status === 'pending' ? ` · ${expiresLabel(p).toLowerCase()}` : ''}
                  </span>
                </span>
                <b style={{ fontSize: 14, lineHeight: 1.35 }}>{p.title}</b>
                <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{subline(p)}</span>
              </button>
            );
          })}
          {list.length === 0 && (
            <div
              className="sp-empty"
              data-testid="proposal-empty"
              style={{ padding: 28, color: 'var(--ink-2)' }}
            >
              {tab === 'pending'
                ? 'No pending proposals. New ones appear when a rule is breached.'
                : 'No decisions yet.'}
            </div>
          )}
        </Stagger>
        {selected && (
          <ProposalDetail
            key={selected.id}
            proposal={selected}
            onDecided={() => {
              setTabPick('history');
              navigate(`/proposals/${selected.id}`, { replace: true });
            }}
          />
        )}
      </div>
    </div>
  );
}
