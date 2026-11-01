import { describeError } from '@/api/errors';
import { useForgetMemory } from '@/api/hooks/profile';
import type { ProfileResponse } from '@/api/types';
import { Pill, useToast, type Tone } from '@/ui';

const KIND: Record<string, Tone> = { semantic: 'info', episodic: 'acc', procedural: 'warn' };

export function MemoryTab({ data }: { data: ProfileResponse }) {
  const forget = useForgetMemory();
  const toast = useToast();
  const items = data.memories ?? [];
  return (
    <section className="s3-card" style={{ gap: 12 }} aria-labelledby="mem-h" data-testid="profile-memories">
      <div>
        <h2 id="mem-h" className="s3-h2" style={{ marginBottom: 4 }}>
          Memories
        </h2>
        <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
          Created only from your own messages and actions, never from documents. Forget any item and it is
          removed with its embedding.
        </div>
      </div>
      {items.map(m => {
        const conf = Math.round(Math.max(0, Math.min(1, m.confidence)) * 100);
        return (
          <div
            key={m.id}
            data-testid={`memory-${m.id}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '90px minmax(0,1fr) 120px 80px',
              gap: 14,
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: '1px solid var(--line)',
            }}
            className="mem-row"
          >
            <Pill tone={KIND[m.kind] ?? 'n'} style={{ textAlign: 'center' }}>
              {m.kind}
            </Pill>
            <div>
              <div style={{ fontSize: 14, overflowWrap: 'anywhere' }}>{m.text}</div>
              <div style={{ font: '400 11px var(--mono)', color: 'var(--ink-3)' }}>Source: {m.source}</div>
            </div>
            <div style={{ display: 'grid', gap: 3 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                Confidence {m.confidence.toFixed(2)}
              </span>
              <span
                role="meter"
                aria-label="Confidence"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={conf}
                style={{ height: 5, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}
              >
                <span
                  style={{ display: 'block', height: '100%', width: `${conf}%`, background: 'var(--accent)' }}
                />
              </span>
            </div>
            <button
              type="button"
              className="s3-btn-sm"
              data-testid={`forget-${m.id}`}
              aria-label={`Forget memory: ${m.text.slice(0, 60)}`}
              disabled={forget.isPending && forget.variables === m.id}
              onClick={() =>
                forget.mutate(m.id, {
                  onSuccess: () => toast.say('Forgotten. Removed with its embedding.'),
                  onError: e => toast.say(describeError(e).message),
                })
              }
            >
              Forget
            </button>
          </div>
        );
      })}
      {items.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-2)' }} data-testid="memories-empty">
          No memories stored.
        </div>
      )}
    </section>
  );
}
