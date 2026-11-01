import type { PortfolioRisk, RulesObject } from '@/api/types';

export type RuleKey = keyof RulesObject;

/** design `defs`: [key, label, unit, step, min, max, note] */
export const RULE_DEFS: ReadonlyArray<{
  key: RuleKey;
  label: string;
  unit: string;
  step: number;
  min: number;
  max: number;
  note: string;
}> = [
  { key: 'pos', label: 'Max position', unit: '%', step: 1, min: 5, max: 40, note: 'Single stock weight' },
  { key: 'sec', label: 'Max sector', unit: '%', step: 5, min: 10, max: 70, note: 'Sum of one sector' },
  { key: 'dd', label: 'Drawdown alert', unit: '%', step: 1, min: 5, max: 40, note: 'From equity peak' },
  { key: 'trades', label: 'Trades per week', unit: '', step: 1, min: 1, max: 20, note: 'Rolling 7 days' },
  {
    key: 'cash',
    label: 'Min cash buffer',
    unit: '%',
    step: 1,
    min: 0,
    max: 30,
    note: 'Cash kept after buys',
  },
];

export const limitFor = (risk: PortfolioRisk | undefined, key: RuleKey): number | undefined =>
  risk?.rules.find(r => r.key === key)?.limit;

/** The full rules object from the risk response, or null when any key is missing (PUT /profile/rules needs all five). */
export function rulesFromRisk(risk: PortfolioRisk | undefined): RulesObject | null {
  if (!risk) return null;
  const out: Partial<RulesObject> = {};
  for (const d of RULE_DEFS) {
    const v = limitFor(risk, d.key);
    if (v == null) return null;
    out[d.key] = v;
  }
  return out as RulesObject;
}
