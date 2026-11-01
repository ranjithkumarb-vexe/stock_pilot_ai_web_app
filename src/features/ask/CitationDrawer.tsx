import { useCitation } from '@/api/hooks/briefs';
import { ErrorPanel } from '@/shell/ErrorBoundary';
import { Drawer, Pill, SkeletonBlock } from '@/ui';

/** Source drawer for a chat citation. All fields render as text; the external link only opens https URLs. */
export function CitationDrawer({
  id,
  label,
  onClose,
}: {
  id: string | null;
  label: string;
  onClose: () => void;
}) {
  const q = useCitation(id);
  const c = q.data;
  const safeUrl = c?.url && /^https:\/\//i.test(c.url) ? c.url : null;
  return (
    <Drawer open={!!id} onClose={onClose} title={c?.title ?? label} testId="ask-citation">
      {q.isLoading ? (
        <SkeletonBlock label="Loading source" />
      ) : q.isError ? (
        <ErrorPanel error={q.error} title="Could not load this source" onRetry={() => void q.refetch()} />
      ) : c ? (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Pill tone="info">{c.kind}</Pill>
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
            <dd style={{ margin: 0 }}>{c.company}</dd>
            <dt style={{ color: 'var(--ink-3)' }}>Document</dt>
            <dd style={{ margin: 0 }}>{c.doc_label}</dd>
            <dt style={{ color: 'var(--ink-3)' }}>Accession no.</dt>
            <dd style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: 12 }}>{c.accession_no}</dd>
            <dt style={{ color: 'var(--ink-3)' }}>Fetched</dt>
            <dd style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: 12 }}>{c.fetched_at}</dd>
            <dt style={{ color: 'var(--ink-3)' }}>SHA-256</dt>
            <dd style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: 12, overflowWrap: 'anywhere' }}>
              {c.sha256}
            </dd>
          </dl>
          {c.excerpt && (
            <blockquote
              style={{
                margin: 0,
                padding: '12px 14px',
                background: 'var(--surface-2)',
                borderRadius: 8,
                fontFamily: 'var(--serif)',
                fontSize: 16,
                lineHeight: 1.5,
              }}
            >
              &#8230;{c.excerpt}&#8230;
            </blockquote>
          )}
          {c.rows.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              <div className="s3-eyebrow">Numbers in this source</div>
              {c.rows.map(r => (
                <div
                  key={r.label}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '2px 12px',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <span style={{ fontSize: 13 }}>{r.label}</span>
                  <span style={{ font: '500 13px var(--mono)', textAlign: 'right' }}>{r.value}</span>
                  <span style={{ font: '400 11px var(--mono)', color: 'var(--ink-3)', gridColumn: '1 / -1' }}>
                    {r.source}
                  </span>
                </div>
              ))}
            </div>
          )}
          {safeUrl && (
            <a
              className="s3-btn-sm"
              style={{ textAlign: 'center', lineHeight: '28px', textDecoration: 'none' }}
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open source document
            </a>
          )}
        </>
      ) : null}
      <button type="button" className="s3-btn-sm" onClick={onClose}>
        Close
      </button>
    </Drawer>
  );
}
