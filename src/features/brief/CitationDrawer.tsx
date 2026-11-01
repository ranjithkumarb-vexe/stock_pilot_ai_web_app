import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { describeError } from '@/api/errors';
import { useCitation } from '@/api';
import { Enter } from '@/motion';
import type { Brief, Citation } from '@/api/types';
import { dateTime, safeHttpUrl } from '@/features/portfolio/format';
import { ErrorPanel } from '@/shell/ErrorBoundary';
import { IconButton, Pill, Skeleton, useFocusTrap } from '@/ui';

export type DrawerSource =
  | { kind: 'citation'; id: string; sectionRows?: Array<{ label: string; value: string; source: string }> }
  | { kind: 'ledger'; key: string };

type Row = { label: string; value: string; source: string };

const eyebrow = {
  font: '600 11px var(--mono)',
  letterSpacing: '.06em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
};

const KIND_LABEL: Record<Citation['kind'], string> = {
  chunk: 'Filing text',
  xbrl: 'XBRL + code',
  price: 'Price feed',
};

function Rows({ rows, empty }: { rows: Row[]; empty: string }) {
  if (rows.length === 0) return <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{empty}</span>;
  return (
    <div data-testid="citation-rows">
      {rows.map((r, i) => (
        <div
          key={`${r.label}-${i}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '2px 12px',
            padding: '8px 0',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <span style={{ fontSize: 13 }}>{r.label}</span>
          <span style={{ font: '500 13px var(--mono)', textAlign: 'right' }}>
            {r.value}{' '}
            <span style={{ color: 'var(--gain)' }} role="img" aria-label="verified by code">
              &#10003;
            </span>
          </span>
          <span style={{ font: '400 11px var(--mono)', color: 'var(--ink-3)', gridColumn: '1/-1' }}>
            {r.source}
          </span>
        </div>
      ))}
    </div>
  );
}

function Header({ title, titleId, onClose }: { title: string; titleId: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
      <div>
        <div style={eyebrow}>Source</div>
        <h2
          id={titleId}
          data-testid="citation-title"
          style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 24, margin: '4px 0 0' }}
        >
          {title}
        </h2>
      </div>
      <IconButton aria-label="Close source" onClick={onClose} data-autofocus>
        &#215;
      </IconButton>
    </div>
  );
}

function CitationBody({
  id,
  sectionRows,
  titleId,
  onClose,
}: {
  id: string;
  sectionRows?: Row[];
  titleId: string;
  onClose: () => void;
}) {
  const q = useCitation(id);
  const cit = q.data;
  if (q.isLoading)
    return (
      <>
        <Header title="Source" titleId={titleId} onClose={onClose} />
        <div role="status" aria-busy="true" aria-label="Loading source" style={{ display: 'grid', gap: 12 }}>
          <Skeleton width={70} height={22} />
          <Skeleton width={100} height={14} />
          <Skeleton width={90} height={14} />
          <Skeleton width={100} height={60} />
        </div>
      </>
    );
  if (q.isError || !cit)
    return (
      <>
        <Header title="Source" titleId={titleId} onClose={onClose} />
        <ErrorPanel error={q.error} title={describeError(q.error).title} onRetry={() => void q.refetch()} />
      </>
    );
  const rows = cit.rows?.length ? cit.rows : (sectionRows ?? []);
  const href = safeHttpUrl(cit.url);
  return (
    <>
      <Header title={cit.title} titleId={titleId} onClose={onClose} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Pill tone="info" data-testid="citation-kind">
          {KIND_LABEL[cit.kind] ?? cit.kind}
        </Pill>
      </div>
      <dl
        style={{
          margin: 0,
          display: 'grid',
          gridTemplateColumns: '110px 1fr',
          gap: '8px 12px',
          fontSize: 13,
        }}
      >
        <dt style={{ color: 'var(--ink-3)' }}>Company</dt>
        <dd style={{ margin: 0 }}>{cit.company}</dd>
        <dt style={{ color: 'var(--ink-3)' }}>Document</dt>
        <dd style={{ margin: 0 }}>{cit.doc_label}</dd>
        <dt style={{ color: 'var(--ink-3)' }}>Accession no.</dt>
        <dd style={{ margin: 0, font: '400 12px var(--mono)' }} data-testid="citation-accession">
          {cit.accession_no || '–'}
        </dd>
        <dt style={{ color: 'var(--ink-3)' }}>Filed</dt>
        <dd style={{ margin: 0, font: '400 12px var(--mono)' }}>{dateTime(cit.filed_at)}</dd>
        <dt style={{ color: 'var(--ink-3)' }}>Fetched</dt>
        <dd style={{ margin: 0, font: '400 12px var(--mono)' }}>{dateTime(cit.fetched_at)}</dd>
        <dt style={{ color: 'var(--ink-3)' }}>SHA-256</dt>
        <dd
          style={{ margin: 0, font: '400 12px var(--mono)', overflowWrap: 'anywhere' }}
          data-testid="citation-hash"
        >
          {cit.sha256 || '–'}
        </dd>
      </dl>
      {cit.excerpt && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={eyebrow}>Excerpt</div>
          {/* untrusted filing text: always rendered as text, never as HTML */}
          <blockquote
            data-testid="citation-excerpt"
            style={{
              margin: 0,
              padding: '12px 14px',
              background: 'var(--surface-2)',
              borderRadius: 8,
              fontFamily: 'var(--serif)',
              fontSize: 16,
              lineHeight: 1.5,
              overflowWrap: 'anywhere',
            }}
          >
            &#8230;{cit.excerpt}&#8230;
          </blockquote>
        </div>
      )}
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={eyebrow}>Numbers in this section</div>
        <Rows rows={rows} empty="This section makes no numeric claims." />
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="sp-btn sp-btn--secondary"
          data-testid="citation-open"
        >
          Open source document
        </a>
      )}
    </>
  );
}

function LedgerBody({
  brief,
  ledgerKey,
  titleId,
  onClose,
}: {
  brief: Brief;
  ledgerKey: string;
  titleId: string;
  onClose: () => void;
}) {
  const e = brief.ledger?.[ledgerKey];
  return (
    <>
      <Header title={e?.label ?? 'Verified metric'} titleId={titleId} onClose={onClose} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Pill tone="info">XBRL + code</Pill>
      </div>
      {e && <Rows rows={[{ label: e.label, value: e.display, source: e.source }]} empty="" />}
      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>
        This number is produced by code from the source above. The model only wrote the words around it.
      </p>
    </>
  );
}

function Panel({
  titleId,
  onClose,
  children,
}: {
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true, onClose);
  return createPortal(
    <Enter
      kind="fade"
      className="sp-overlay sp-overlay--drawer"
      style={{ zIndex: 60 }}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Enter kind="slide" as="aside" className="sp-drawer" data-testid="citation-drawer">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          style={{ display: 'grid', gap: 16, outline: 'none' }}
        >
          {children}
        </div>
      </Enter>
    </Enter>,
    document.body,
  );
}

/** Right-hand source drawer (design cite drawer): document, accession, hash, excerpt and the XBRL rows behind a citation. */
export function CitationDrawer({
  source,
  brief,
  onClose,
}: {
  source: DrawerSource | null;
  brief: Brief;
  onClose: () => void;
}) {
  const titleId = useId();
  if (!source) return null;
  return (
    <Panel titleId={titleId} onClose={onClose}>
      {source.kind === 'citation' ? (
        <CitationBody id={source.id} sectionRows={source.sectionRows} titleId={titleId} onClose={onClose} />
      ) : (
        <LedgerBody brief={brief} ledgerKey={source.key} titleId={titleId} onClose={onClose} />
      )}
    </Panel>
  );
}
