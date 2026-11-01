import type { Brief, BriefSection, Uuid } from '@/api/types';

export type Depth = 'tldr' | 'standard' | 'deep';
export const DEPTHS: ReadonlyArray<{ value: Depth; label: string }> = [
  { value: 'tldr', label: 'TL;DR' },
  { value: 'standard', label: 'Standard' },
  { value: 'deep', label: 'Deep' },
];

/** Initial depth from the style card when the API provides one (shape UNVERIFIED), else Standard. */
export function initialDepth(styleCard: Brief['style_card'] | undefined): Depth {
  const d = styleCard?.depth;
  return d === 'tldr' || d === 'standard' || d === 'deep' ? d : 'standard';
}

/** Design `PLAIN` hints are API-provided now (`plain_hint`); this is only the fallback label for a section without a title. */
export const SECTION_TITLE: Record<string, string> = {
  trend: 'Trend & growth',
  bal: 'Balance sheet & dividend',
  val: 'Valuation context',
  moat: 'Moat',
  risk: 'Risks',
  cat: 'Catalysts',
  bb: 'Bull / Bear',
};

export type OrderedSection = BriefSection & { synthetic?: boolean };

/**
 * Sections in the order the API sent in `section_order` (personalised by the style card). Keys the order does not name keep
 * their original relative order after the named ones. If the API sent bull/bear text but no `bb` section, one is synthesised.
 */
export function orderSections(brief: Brief): OrderedSection[] {
  const list: OrderedSection[] = [...brief.sections];
  const hasBB = list.some(s => s.key === 'bb');
  if (!hasBB && (brief.bull?.text || brief.bear?.text)) {
    list.push({
      key: 'bb',
      title: SECTION_TITLE.bb ?? 'Bull / Bear',
      source_label: 'Item 1A + Item 7',
      claims: [],
      rows: [],
      plain_hint: null,
      synthetic: true,
    });
  }
  const rank = (k: string) => {
    const i = brief.section_order.indexOf(k);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return list
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s.key) - rank(b.s.key) || a.i - b.i)
    .map(x => x.s);
}

/** Footnote numbers: each distinct citation id gets [1], [2]... in reading order (claims, then bull and bear). */
export function citationNumbers(brief: Brief, sections: OrderedSection[]): Map<Uuid, number> {
  const out = new Map<Uuid, number>();
  const add = (ids: readonly Uuid[] | undefined) =>
    ids?.forEach(id => out.has(id) || out.set(id, out.size + 1));
  for (const s of sections) {
    s.claims.forEach(c => add(c.citation_ids));
    if (s.key === 'bb') {
      add(brief.bull?.citation_ids);
      add(brief.bear?.citation_ids);
    }
  }
  return out;
}

/** All citation ids that belong to a section (claims, plus bull/bear for `bb`), in order, de-duplicated. */
export function sectionCitationIds(brief: Brief, s: BriefSection): Uuid[] {
  const ids = s.claims.flatMap(c => c.citation_ids);
  if (s.key === 'bb') ids.push(...(brief.bull?.citation_ids ?? []), ...(brief.bear?.citation_ids ?? []));
  return [...new Set(ids)];
}

/** Ledger entries (`m1`, `m2`... in numeric order) as an ordered list. */
export function ledgerEntries(brief: Brief) {
  return Object.entries(brief.ledger ?? {}).sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

/** First citation (if any) of the first claim that references a ledger key; used to open a source from a metric tile. */
export function citationForLedger(brief: Brief, key: string): Uuid | null {
  for (const s of brief.sections)
    for (const c of s.claims) if (c.ledger_refs?.includes(key) && c.citation_ids[0]) return c.citation_ids[0];
  return null;
}

/** Pinned tile: the ledger entry whose label matches the style card's `metric` (verified live), else the first. */
export function pinnedKey(brief: Brief, entries: ReturnType<typeof ledgerEntries>): string | null {
  const want = brief.style_card?.metric;
  if (typeof want === 'string') {
    const hit = entries.find(([, v]) => v.label.toLowerCase() === want.toLowerCase());
    if (hit) return hit[0];
  }
  return entries[0]?.[0] ?? null;
}

export const SYMBOL_RE = /^[A-Za-z][A-Za-z0-9.-]{0,9}$/;
