#!/usr/bin/env node
/**
 * Bundle-size budget check (FE-12). Run after `npm run build`:  npm run check:bundle  [-- <dist dir>]
 *
 * Measures GZIP sizes of what the browser really downloads:
 *   initial JS/CSS  = the files index.html loads on first paint (entry script, modulepreload, stylesheets)
 *   largest chunk   = the biggest single JS file (lazy route chunks + vendor chunks)
 *   total           = every JS + CSS file in dist/assets (what a user who visits every screen downloads)
 * Budgets are set ~25 % above the 2026-11-02 baseline (initial JS 126 KB, initial CSS 5 KB, largest chunk 75 KB, total 316 KB gzip), so normal
 * work passes and an accidental heavy dependency (or a charting library pulled into the entry chunk) fails CI.
 * Override with BUDGET_INITIAL_JS_KB / BUDGET_INITIAL_CSS_KB / BUDGET_CHUNK_KB / BUDGET_TOTAL_KB.
 * Exit 0 = within budget, 1 = over budget, 2 = no build found.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = resolve(process.argv[2] ?? 'dist');
const kb = n => n / 1024;
const budget = (name, dflt) => Number(process.env[name] ?? dflt);
const B = {
  initialJs: budget('BUDGET_INITIAL_JS_KB', 160),
  initialCss: budget('BUDGET_INITIAL_CSS_KB', 15),
  chunk: budget('BUDGET_CHUNK_KB', 95),
  total: budget('BUDGET_TOTAL_KB', 400),
};

if (!existsSync(join(dist, 'index.html'))) {
  console.error(`check_bundle_size: no build at ${dist} - run "npm run build" first`);
  process.exit(2);
}
const gz = file => gzipSync(readFileSync(file)).length;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1]);
const initial = refs.map(r => ({ file: r, bytes: gz(join(dist, r)) }));
const initialJs = initial.filter(f => f.file.endsWith('.js')).reduce((a, f) => a + f.bytes, 0);
const initialCss = initial.filter(f => f.file.endsWith('.css')).reduce((a, f) => a + f.bytes, 0);

const assets = readdirSync(join(dist, 'assets'))
  .filter(f => /\.(js|css)$/.test(f))
  .map(f => ({ file: f, bytes: gz(join(dist, 'assets', f)), js: f.endsWith('.js') }));
const total = assets.reduce((a, f) => a + f.bytes, 0);
const largest = assets.filter(f => f.js).sort((a, b) => b.bytes - a.bytes)[0];
const maps = readdirSync(join(dist, 'assets')).filter(f => f.endsWith('.map'));

const rows = [
  ['initial JS (gzip)', kb(initialJs), B.initialJs],
  ['initial CSS (gzip)', kb(initialCss), B.initialCss],
  [`largest chunk (gzip) ${largest.file}`, kb(largest.bytes), B.chunk],
  ['all JS+CSS (gzip)', kb(total), B.total],
];
let failed = false;
for (const [name, value, limit] of rows) {
  const ok = value <= limit;
  failed ||= !ok;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(52)} ${value.toFixed(1).padStart(7)} KB  (budget ${limit} KB)`,
  );
}
if (maps.length > 0 && process.env.BUILD_SOURCEMAP !== 'hidden') {
  console.log(
    `FAIL ${maps.length} source map file(s) in ${dist}/assets: production builds must not publish them`,
  );
  failed = true;
}
console.log(failed ? 'check_bundle_size: OVER BUDGET' : 'check_bundle_size: OK');
process.exit(failed ? 1 : 0);
