import { useState } from 'react';
import { describeError } from '@/api/errors';
import { useDeleteAccount, useResetProfile } from '@/api/hooks/profile';
import { useAuth } from '@/auth/useAuth';
import { Modal, SkeletonBlock, useToast } from '@/ui';
import { ErrorPanel } from '@/shell/ErrorBoundary';
import { downloadText, useExportJson } from './api';

const PREVIEW_MAX = 20_000;
const row = { display: 'grid', gap: 4 } as const;

export function PrivacyTab() {
  const [modal, setModal] = useState<'' | 'export' | 'reset' | 'delete'>('');
  return (
    <div className="s3-grid-2">
      <section className="s3-card" style={{ gap: 12 }} aria-labelledby="handled-h">
        <h2 id="handled-h" className="s3-h2">
          How your data is handled
        </h2>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', display: 'grid', gap: 10 }}>
          <div>
            <b style={{ color: 'var(--ink)' }}>Minimal data.</b> No brokerage link, no SSN or PAN. Paper
            portfolio only.
          </div>
          <div>
            <b style={{ color: 'var(--ink)' }}>Model routing.</b> Anything with your profile, portfolio or
            chat uses Standard mode, which Meta does not train on. Contributor mode is used only for public
            filings.
          </div>
          <div>
            <b style={{ color: 'var(--ink)' }}>Isolation.</b> Row-level security restricts every table to your
            user ID.
          </div>
          <div>
            <b style={{ color: 'var(--ink)' }}>Encryption.</b> At rest and in transit.
          </div>
          <div>
            <b style={{ color: 'var(--ink)' }}>Audit.</b> Every proposal, approval, profile change and model
            call has a trace ID.
          </div>
        </div>
      </section>
      <section
        className="s3-card"
        style={{ gap: 14 }}
        aria-labelledby="controls-h"
        data-testid="profile-controls"
      >
        <h2 id="controls-h" className="s3-h2">
          Your controls
        </h2>
        <div style={row}>
          <b style={{ fontSize: 13 }}>Export</b>
          <span className="s3-sub">Download everything stored about you as JSON.</span>
          <button
            type="button"
            className="s3-btn-sm"
            style={{ justifySelf: 'start', marginTop: 6, height: 34, fontSize: 13 }}
            data-testid="open-export"
            onClick={() => setModal('export')}
          >
            Export my data
          </button>
        </div>
        <div style={{ ...row, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <b style={{ fontSize: 13 }}>Reset learned data</b>
          <span className="s3-sub">
            Clears behaviour signals and memories learned from actions. Your stated profile and rules stay.
          </span>
          <button
            type="button"
            className="s3-btn-sm"
            style={{ justifySelf: 'start', marginTop: 6, height: 34, fontSize: 13 }}
            data-testid="open-reset"
            onClick={() => setModal('reset')}
          >
            Reset what StockPilot learned
          </button>
        </div>
        <div style={{ ...row, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <b style={{ fontSize: 13 }}>Delete account</b>
          <span className="s3-sub">Removes all rows, memories and embeddings.</span>
          <button
            type="button"
            data-testid="open-delete"
            style={{
              justifySelf: 'start',
              marginTop: 6,
              height: 34,
              padding: '0 14px',
              borderRadius: 8,
              border: '1px solid var(--loss-line)',
              background: 'var(--loss-soft)',
              color: 'var(--loss)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={() => setModal('delete')}
          >
            Delete my account
          </button>
        </div>
      </section>

      <ExportModal open={modal === 'export'} onClose={() => setModal('')} />
      <ResetModal open={modal === 'reset'} onClose={() => setModal('')} />
      <DeleteModal open={modal === 'delete'} onClose={() => setModal('')} />
    </div>
  );
}

function ExportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const q = useExportJson(open);
  const toast = useToast();
  return (
    <Modal open={open} onClose={onClose} title="Export your data" width={640} testId="export-modal">
      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>
        Portable JSON of everything stored about you. Embeddings are excluded from the file and deleted with
        your account.
      </p>
      {q.isLoading ? (
        <SkeletonBlock label="Preparing export" widths={[100, 90, 70, 95]} />
      ) : q.isError ? (
        <ErrorPanel error={q.error} title="Could not prepare your export" onRetry={() => void q.refetch()} />
      ) : (
        <pre
          data-testid="export-json"
          style={{
            margin: 0,
            overflow: 'auto',
            maxHeight: '48vh',
            background: 'var(--surface-2)',
            borderRadius: 8,
            padding: 14,
            font: '400 12px/1.5 var(--mono)',
          }}
        >
          {(q.data ?? '').length > PREVIEW_MAX
            ? (q.data ?? '').slice(0, PREVIEW_MAX) +
              '\n\u2026 preview truncated; the download has everything.'
            : q.data}
        </pre>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          type="button"
          className="s3-btn-sm"
          style={{ height: 36, padding: '0 16px', fontSize: 13 }}
          onClick={onClose}
        >
          Close
        </button>
        <button
          type="button"
          className="sp-btn sp-btn--primary"
          data-testid="download-export"
          disabled={!q.data}
          onClick={() => {
            if (!q.data) return;
            downloadText('stockpilot-export.json', q.data);
            toast.say('Export downloaded');
          }}
        >
          Download JSON
        </button>
      </div>
    </Modal>
  );
}

function ResetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reset = useResetProfile();
  const toast = useToast();
  return (
    <Modal open={open} onClose={onClose} title="Reset learned data?" width={480} testId="reset-modal">
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)' }}>
        This clears behaviour signals and the memories learned from your actions. Rankings return to your
        setup. Your stated profile and rules stay.
      </p>
      {reset.isError && (
        <div role="alert" className="s3-alert">
          {describeError(reset.error).message}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          type="button"
          className="s3-btn-sm"
          style={{ height: 36, padding: '0 16px', fontSize: 13 }}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="sp-btn sp-btn--primary"
          data-testid="confirm-reset"
          disabled={reset.isPending}
          onClick={() =>
            reset.mutate(undefined, {
              onSuccess: () => {
                toast.say('Learned data cleared. Rankings return to your setup.');
                onClose();
              },
            })
          }
        >
          {reset.isPending ? 'Resetting' : 'Reset learned data'}
        </button>
      </div>
    </Modal>
  );
}

function DeleteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const del = useDeleteAccount();
  const { signOut } = useAuth();
  const toast = useToast();
  const [text, setText] = useState('');
  const ok = text === 'DELETE';
  const close = () => {
    setText('');
    del.reset();
    onClose();
  };
  const onDelete = async () => {
    if (!ok || del.isPending) return;
    try {
      await del.mutateAsync();
    } catch {
      return; // the error is shown inside the dialog; the account still exists
    }
    toast.say('Account deleted. 0 rows, memories or embeddings remain.');
    await signOut();
  };
  return (
    <Modal open={open} onClose={close} title="Delete account" width={480} testId="delete-modal">
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)' }}>
        This removes your profile, rules, memories, events, orders and embeddings. It cannot be undone. Type{' '}
        <b style={{ fontFamily: 'var(--mono)' }}>DELETE</b> to confirm.
      </p>
      <input
        className="s3-input"
        style={{ height: 40, font: '500 14px var(--mono)', padding: '0 12px' }}
        aria-label="Type DELETE"
        data-testid="delete-confirm"
        autoComplete="off"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') void onDelete();
        }}
      />
      {del.isError && (
        <div role="alert" className="s3-alert" data-testid="delete-error">
          {describeError(del.error).message} Your account was not deleted.
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          type="button"
          className="s3-btn-sm"
          style={{ height: 36, padding: '0 16px', fontSize: 13 }}
          onClick={close}
        >
          Cancel
        </button>
        <button
          type="button"
          data-testid="confirm-delete"
          disabled={!ok || del.isPending}
          style={{
            height: 36,
            padding: '0 16px',
            borderRadius: 8,
            border: '1px solid var(--loss-line)',
            background: 'var(--loss-soft)',
            color: 'var(--loss)',
            fontWeight: 600,
            fontSize: 13,
            cursor: ok ? 'pointer' : 'not-allowed',
            opacity: ok ? 1 : 0.45,
          }}
          onClick={() => void onDelete()}
        >
          {del.isPending ? 'Deleting' : 'Delete everything'}
        </button>
      </div>
    </Modal>
  );
}
