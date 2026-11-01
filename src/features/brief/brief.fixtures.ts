/** Test-only fixtures for the brief screen (never imported by shipped code). */
import type { Brief, Citation } from '@/api/types';

export const citation = (over: Partial<Citation> = {}): Citation => ({
  id: 'c1',
  kind: 'chunk',
  title: 'Item 7 · MD&A',
  company: 'Johnson & Johnson (CIK 200406)',
  doc_label: '10-K FY2025 · p.37',
  accession_no: '0000200406-26-000012',
  filed_at: '2026-02-17T00:00:00Z',
  fetched_at: '2026-10-29T06:41:00Z',
  sha256: 'sha256:9f2c61ab7740d0c1e55b0a2c5d8a4f3e3b1d0c9a8e7f6d5c4b3a291807f6e5d4',
  url: 'https://www.sec.gov/Archives/edgar/data/200406/000020040626000012/jnj-10k.htm',
  excerpt: 'Worldwide sales to customers increased 4.3% to the highest level in company history.',
  rows: [
    { label: 'Revenue, latest fiscal year', value: '$88.8B', source: 'us-gaap:Revenues' },
    { label: 'Operating margin', value: '26.9%', source: 'code: OperatingIncomeLoss / Revenues' },
  ],
  ...over,
});

export const brief = (over: Partial<Brief> = {}): Brief => ({
  id: 'b1',
  symbol: 'JNJ',
  name: 'Johnson & Johnson',
  as_of: '2026-10-29T00:00:00Z',
  generated_at: '2026-10-29T06:41:00Z',
  status: 'ok',
  stale: false,
  stale_reason: null,
  style_card: { depth: 'standard', pinned_metric: 'Dividend yield' },
  section_order: ['bal', 'risk', 'trend', 'bb'],
  sections: [
    {
      key: 'trend',
      title: 'Trend & growth',
      source_label: 'Item 7 · MD&A',
      claims: [
        { text: 'Revenue grew 4.3% year over year.', citation_ids: ['c1'], ledger_refs: ['m1'] },
        { text: 'Operating margin held near 26.9%.', citation_ids: ['c2'], ledger_refs: ['m2'] },
      ],
      rows: [{ label: 'Revenue growth', value: '+4.3%', source: 'code' }],
      plain_hint: 'In plain terms: this shows whether the company is selling more each year.',
    },
    {
      key: 'bal',
      title: 'Balance sheet & dividend',
      source_label: 'XBRL + Item 7',
      claims: [
        { text: 'Debt to equity is 0.45x with a 3.1% yield.', citation_ids: ['c2'], ledger_refs: ['m3'] },
      ],
      rows: [],
      plain_hint: 'In plain terms: debt is money owed.',
    },
    {
      key: 'risk',
      title: 'Risks',
      source_label: 'Item 1A · Risk Factors',
      claims: [
        {
          text: 'Litigation and patent expiries are listed as key risks.',
          citation_ids: ['c3'],
          ledger_refs: [],
        },
      ],
      rows: [],
      plain_hint: null,
    },
    {
      key: 'bb',
      title: 'Bull / Bear',
      source_label: 'Item 1A + Item 7',
      claims: [],
      rows: [],
      plain_hint: null,
    },
  ],
  bull: { text: 'Defensive demand and a long dividend record.', citation_ids: ['c1'] },
  bear: { text: 'Talc litigation could cost more than reserved.', citation_ids: ['c3'] },
  ledger: {
    m1: { label: 'Revenue', value: 88.8, display: '$88.8B', unit: 'USD', source: 'us-gaap:Revenues' },
    m2: {
      label: 'Operating margin',
      value: 26.9,
      display: '26.9%',
      unit: '%',
      source: 'code: OperatingIncomeLoss / Revenues',
    },
    m3: {
      label: 'Dividend yield',
      value: 3.1,
      display: '3.1%',
      unit: '%',
      source: 'code: DividendsDeclaredPerShare / price',
    },
  },
  citations_summary: { coverage_pct: 100, unverified_numbers: 0 },
  disclaimer: 'API disclaimer text for the brief.',
  trace_id: 'tr-brief',
  ...over,
});

export const quote = {
  symbol: 'JNJ',
  price: 152.4,
  prev_close: 151.1,
  change_pct: 0.86,
  ts: '2026-10-30T15:00:00Z',
  source: 'iex',
  session: 'regular',
  freshness: 'delayed',
};

export const portfolio = (positions: unknown[] = []) => ({
  portfolio_id: 'pf1',
  cash: 22014,
  invested: 78000,
  equity: 100014,
  day_change: 420,
  day_change_pct: 0.42,
  positions,
  sectors: [],
  hhi: 0.12,
  effective_n: 8.1,
});

export const jnjPosition = {
  symbol: 'JNJ',
  name: 'Johnson & Johnson',
  sector: 'Healthcare',
  qty: 62,
  avg_cost: 150,
  price: 152.4,
  change_pct: 0.86,
  value: 9449,
  weight_pct: 9.4,
  pnl: 149,
  pnl_pct: 1.6,
};

export const risk = {
  metrics: {
    hhi: 0.12,
    effective_n: 8.1,
    vol_60d: 11.2,
    beta: 0.62,
    max_drawdown_pct: 5.1,
    drawdown_pct: 2.4,
    trades_7d: 1,
  },
  rules: [
    { key: 'pos', limit: 10, current: 9.4, status: 'warn' },
    { key: 'sec', limit: 25, current: 18, status: 'ok' },
    { key: 'dd', limit: 10, current: 2.4, status: 'ok' },
    { key: 'trades', limit: 3, current: 1, status: 'ok' },
    { key: 'cash', limit: 10, current: 22, status: 'ok' },
  ],
  violations: [],
};
