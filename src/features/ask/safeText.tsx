import { Fragment, type ReactNode } from 'react';

/**
 * Plain-text-first renderer for LLM output. It NEVER produces HTML from the text: every character ends up as a React
 * text node. A tiny markdown subset is recognised and turned into React elements (never `dangerouslySetInnerHTML`):
 *   **bold**, *italic*, `code`, "- " / "* " / "1. " list items, blank-line paragraphs.
 * Links are not rendered as links (a model can be talked into emitting a hostile URL); the raw text stays visible.
 */
type Block = { kind: 'p'; lines: string[] } | { kind: 'ul' | 'ol'; items: string[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  const push = () => {
    if (cur) blocks.push(cur);
    cur = null;
  };
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (raw.trim() === '') {
      push();
      continue;
    }
    const b = BULLET.exec(raw);
    const o = ORDERED.exec(raw);
    if (b || o) {
      const kind = b ? 'ul' : 'ol';
      const item = (b ?? o)![1] ?? '';
      if (cur && (cur as Block).kind === kind) (cur as { items: string[] }).items.push(item);
      else {
        push();
        cur = { kind, items: [item] };
      }
    } else if (cur && (cur as Block).kind === 'p') (cur as { lines: string[] }).lines.push(raw);
    else {
      push();
      cur = { kind: 'p', lines: [raw] };
    }
  }
  push();
  return blocks;
}

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g;

export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  text.split(INLINE).forEach((part, i) => {
    if (!part) return;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      out.push(<strong key={i}>{part.slice(2, -2)}</strong>);
    else if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      out.push(
        <code key={i} style={{ fontFamily: 'var(--mono)', fontSize: '0.92em' }}>
          {part.slice(1, -1)}
        </code>,
      );
    else if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
      out.push(<em key={i}>{part.slice(1, -1)}</em>);
    else out.push(<Fragment key={i}>{part}</Fragment>);
  });
  return out;
}

export function SafeText({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div style={{ display: 'grid', gap: 8 }} data-testid="safe-text">
      {blocks.map((b, i) =>
        b.kind === 'p' ? (
          <p key={i} style={{ margin: 0 }}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(l)}
              </Fragment>
            ))}
          </p>
        ) : b.kind === 'ul' ? (
          <ul key={i} style={{ margin: 0, paddingLeft: 20 }}>
            {b.items.map((it, j) => (
              <li key={j}>{renderInline(it)}</li>
            ))}
          </ul>
        ) : (
          <ol key={i} style={{ margin: 0, paddingLeft: 20 }}>
            {b.items.map((it, j) => (
              <li key={j}>{renderInline(it)}</li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
