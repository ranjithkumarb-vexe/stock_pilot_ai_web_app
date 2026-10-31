import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Parse `selector{--a:b;--c:d}` custom properties out of a CSS string. */
const vars = (css: string, selectorStart: string): Record<string, string> => {
  const i = css.indexOf(selectorStart);
  if (i < 0) throw new Error(`selector not found: ${selectorStart}`);
  const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
  const out: Record<string, string> = {};
  for (const d of body.split(';')) {
    const k = d.indexOf(':');
    if (k < 0) continue;
    out[d.slice(0, k).trim()] = d.slice(k + 1).trim();
  }
  return out;
};

const root = resolve(__dirname, '../..');
const design = readFileSync(resolve(root, 'design/StockPilot AI.dc.html'), 'utf8');
const designStyle = design.slice(design.indexOf('<style>'), design.indexOf('</style>'));
const ours = readFileSync(resolve(root, 'src/styles/tokens.css'), 'utf8');

describe('design tokens parity (light + dark)', () => {
  it(':root tokens equal the design', () => {
    const a = vars(designStyle, ':root{');
    const b = vars(ours, ':root {');
    expect(Object.keys(a).length).toBeGreaterThan(30);
    expect(b).toEqual(a);
  });

  it('body[data-theme="dark"] tokens equal the design', () => {
    const a = vars(designStyle, 'body[data-theme="dark"]{color-scheme');
    const b = vars(ours, 'body[data-theme="dark"] {');
    expect(Object.keys(a)).toContain('--bg');
    expect(b).toEqual(a);
  });

  it('snapshot of computed variable names per theme', () => {
    const light = Object.keys(vars(ours, ':root {')).sort();
    const dark = Object.keys(vars(ours, 'body[data-theme="dark"] {')).sort();
    expect({ light, dark }).toMatchSnapshot();
  });
});
