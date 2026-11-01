import { AiGlyph, Enter, Loop } from '@/motion';
import { Skeleton } from '@/ui';

const STEPS = [
  'Fetching the latest filing',
  'Scanning fetched text for hidden instructions',
  'Matching every number to XBRL',
  'Ordering sections for you',
];
const SKEL = [70, 96, 88, 92, 60, 84, 40];

const card = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 14,
  boxShadow: 'var(--card-shadow)',
  padding: 24,
  display: 'grid',
  gap: 14,
  alignContent: 'start',
} as const;

/** Design `bLoading`: "PILOT IS READING {T}" with progress steps and a skeleton column. Shown while a brief is generated. */
export function GeneratingPanel({ symbol }: { symbol: string }) {
  return (
    <Enter
      kind="fade"
      data-testid="brief-generating"
      role="status"
      aria-busy="true"
      aria-label={`Pilot is reading ${symbol}`}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))',
        gap: 20,
      }}
    >
      <section style={card}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            font: '600 11px var(--mono)',
            letterSpacing: '.1em',
            color: 'var(--accent)',
          }}
        >
          <AiGlyph size={20} />
          <Loop kind="shimmer-text">PILOT IS READING {symbol}</Loop>
        </div>
        {STEPS.map((l, i) => (
          <Enter
            key={l}
            kind="tick"
            delay={80 + i * 190}
            style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              &#10003;
            </span>
            <span>{l}</span>
          </Enter>
        ))}
        <div style={{ height: 3, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' }}>
          <Enter
            kind="prog"
            duration={0.85}
            style={{ height: '100%', background: 'var(--accent)', transformOrigin: 'left' }}
          />
        </div>
      </section>
      <section style={{ ...card, gap: 12 }} aria-hidden="true">
        {SKEL.map((w, i) => (
          <Skeleton key={i} width={w} />
        ))}
      </section>
    </Enter>
  );
}
