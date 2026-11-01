import { safeInternalPath } from '@/shell/Guards';
import type { ChatHistory } from '@/api/types';

/** A citation chip. Shapes are UNVERIFIED (`citations: unknown[]` in CONTRACT.md) so everything is read defensively. */
export type Cite = { key: string; label: string; citationId?: string; route?: string };

export type Msg = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  refused?: boolean;
  refusalReason?: string | null;
  citations?: Cite[];
  /** assistant message that failed to arrive (kept so the user can see what happened) */
  failed?: boolean;
  traceId?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

export function normalizeCitations(raw: unknown): Cite[] {
  if (!Array.isArray(raw)) return [];
  const out: Cite[] = [];
  raw.forEach((c, i) => {
    if (typeof c === 'string') {
      if (c.trim()) out.push({ key: `${i}-${c}`, label: c.trim() });
      return;
    }
    if (!c || typeof c !== 'object') return;
    const o = c as Record<string, unknown>;
    const id = str(o.citation_id) ?? str(o.id);
    const label =
      str(o.label) ??
      str(o.title) ??
      str(o.doc_label) ??
      (id ? `Source ${id.slice(0, 8)}` : `Source ${i + 1}`);
    const routeRaw = str(o.route) ?? str(o.path);
    const route = routeRaw && safeInternalPath(routeRaw, '') ? safeInternalPath(routeRaw, '') : undefined;
    out.push({ key: `${i}-${id ?? label}`, label, citationId: id && UUID.test(id) ? id : undefined, route });
  });
  return out;
}

export function fromHistory(h: ChatHistory | undefined): Msg[] {
  return (h?.items ?? [])
    .slice()
    .sort((a, b) => (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0))
    .map(m => {
      const raw = m as typeof m & { citations?: unknown; content?: string; refusal_reason?: string | null };
      return {
        id: m.id,
        role: m.role,
        text: m.text ?? raw.content ?? '',
        refused: !!m.refused,
        refusalReason: raw.refusal_reason ?? null,
        citations: normalizeCitations(raw.citations),
      };
    });
}

export function humanizeReason(r: string | null | undefined): string | null {
  if (!r) return null;
  const s = r.replace(/[_-]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : null;
}

/** Non-cryptographic fingerprint so telemetry never carries the question text (SPEC §10.2 `query_text_hash`). */
export function hashText(t: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export const GREETING =
  'Ask about a company on your watchlist, your portfolio risk, or how a suggestion was made. I only explain numbers that come from filings and your own data.';
