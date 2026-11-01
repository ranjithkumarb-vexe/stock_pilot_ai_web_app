import type { RefObject } from 'react';
import type { Brief, Uuid } from '@/api/types';
import { useDwell } from '@/telemetry';
import { Button } from '@/ui';
import type { Depth, OrderedSection } from './helpers';
import { sectionCitationIds } from './helpers';

export type Feedback = 'up' | 'down' | undefined;

type Props = {
  brief: Brief;
  section: OrderedSection;
  nums: Map<Uuid, number>;
  depth: Depth;
  expanded: boolean;
  onToggle: () => void;
  feedback: Feedback;
  onRate: (v: 'up' | 'down') => void;
  onOpenCitation: (id: Uuid, rows?: OrderedSection['rows']) => void;
};

function Markers({
  ids,
  nums,
  onOpen,
}: {
  ids: readonly Uuid[];
  nums: Map<Uuid, number>;
  onOpen: (id: Uuid) => void;
}) {
  return (
    <>
      {ids.map(id => {
        const n = nums.get(id);
        return (
          <button
            key={id}
            type="button"
            className="br-marker"
            data-testid={`cite-${n}`}
            aria-label={`Open source ${n}`}
            onClick={() => onOpen(id)}
          >
            [{n}]
          </button>
        );
      })}
    </>
  );
}

const card = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 14,
  boxShadow: 'var(--card-shadow)',
  padding: '20px 22px',
  display: 'grid',
  gap: 12,
} as const;

/** One brief section: title, source button, cited claims (or bull/bear), plain-language hint, thumbs. */
export function SectionCard({
  brief,
  section,
  nums,
  depth,
  expanded,
  onToggle,
  feedback,
  onRate,
  onOpenCitation,
}: Props) {
  const ref = useDwell<HTMLElement>(section.key, {
    entity: { ticker: brief.symbol },
  }) as RefObject<HTMLElement>;
  const isBB = section.key === 'bb';
  const ids = sectionCitationIds(brief, section);
  const first = ids[0];
  const firstN = first ? nums.get(first) : undefined;
  const claims = expanded || isBB ? section.claims : section.claims.slice(0, 1);
  const canToggle = !isBB && section.claims.length > 1;
  const open = (id: Uuid) => onOpenCitation(id, section.rows);

  return (
    <section
      ref={ref}
      style={card}
      data-testid={`section-${section.key}`}
      aria-labelledby={`sec-${section.key}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h3
          id={`sec-${section.key}`}
          style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 22, margin: 0 }}
        >
          {section.title}
        </h3>
        {first ? (
          <button
            type="button"
            className="br-cite"
            data-testid={`section-cite-${section.key}`}
            onClick={() => open(first)}
          >
            [{firstN}] {section.source_label}
          </button>
        ) : (
          <span style={{ font: '500 11px var(--mono)', color: 'var(--ink-3)' }}>{section.source_label}</span>
        )}
      </div>

      {isBB && (brief.bull?.text || brief.bear?.text) && (
        <div className="br-bb">
          <div style={{ background: 'var(--gain-soft)', borderRadius: 8, padding: '12px 14px' }}>
            <b style={{ font: '600 11px var(--mono)', letterSpacing: '.06em', color: 'var(--gain)' }}>
              BULL CASE
            </b>
            <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.55 }} data-testid="bull-text">
              {brief.bull.text}
              <Markers ids={brief.bull.citation_ids ?? []} nums={nums} onOpen={open} />
            </p>
          </div>
          <div style={{ background: 'var(--loss-soft)', borderRadius: 8, padding: '12px 14px' }}>
            <b style={{ font: '600 11px var(--mono)', letterSpacing: '.06em', color: 'var(--loss)' }}>
              BEAR CASE
            </b>
            <p style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.55 }} data-testid="bear-text">
              {brief.bear.text}
              <Markers ids={brief.bear.citation_ids ?? []} nums={nums} onOpen={open} />
            </p>
          </div>
        </div>
      )}

      {claims.map((c, i) => (
        <p key={i} style={{ margin: 0, fontSize: 15, lineHeight: 1.65 }} data-testid="claim">
          {c.text}
          <Markers ids={c.citation_ids} nums={nums} onOpen={open} />
        </p>
      ))}

      {depth === 'deep' && section.rows.length > 0 && (
        <div data-testid={`section-rows-${section.key}`} style={{ display: 'grid', gap: 0 }}>
          {section.rows.map((r, i) => (
            <div
              key={`${r.label}-${i}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '6px 0',
                borderBottom: '1px solid var(--line)',
                fontSize: 13,
              }}
            >
              <span>{r.label}</span>
              <span style={{ font: '500 13px var(--mono)' }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}

      {depth !== 'tldr' && section.plain_hint && (
        <div
          data-testid="plain-hint"
          style={{ background: 'var(--accent-soft)', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}
        >
          {section.plain_hint}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        {canToggle && (
          <Button
            variant="link"
            size="sm"
            aria-expanded={expanded}
            data-testid={`section-toggle-${section.key}`}
            onClick={onToggle}
            style={{ marginRight: 'auto' }}
          >
            {expanded ? 'Show less' : 'Read full section'}
          </Button>
        )}
        <span style={{ fontSize: 12, color: 'var(--ink-3)', marginRight: 4 }} id={`fb-${section.key}`}>
          Helpful?
        </span>
        <button
          type="button"
          className="br-fb"
          aria-pressed={feedback === 'up'}
          aria-label={`Helpful: ${section.title}`}
          data-testid={`thumb-up-${section.key}`}
          onClick={() => onRate('up')}
        >
          Yes
        </button>
        <button
          type="button"
          className="br-fb"
          aria-pressed={feedback === 'down'}
          aria-label={`Not helpful: ${section.title}`}
          data-testid={`thumb-down-${section.key}`}
          onClick={() => onRate('down')}
        >
          No
        </button>
      </div>
    </section>
  );
}
