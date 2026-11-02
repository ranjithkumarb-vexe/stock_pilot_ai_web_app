#!/usr/bin/env node
/**
 * Deploy consistency check (FE-12):  npm run check:deploy [-- --strict] [-- <dist dir>]
 *
 * vercel.json cannot read environment variables, so its Content-Security-Policy is static. This script proves the static
 * policy matches the build that is about to ship:
 *   1. every inline <script> in dist/index.html has its sha256 in script-src (the pre-paint theme script),
 *   2. the origin of VITE_API_BASE_URL (and VITE_SUPABASE_URL when set) is allowed by connect-src,
 *   3. vercel.json has the required security headers and the SPA rewrite.
 * --strict (automatic on Vercel, VERCEL=1) additionally refuses placeholders, http:// and localhost values, and
 * VITE_AUTH_MODE=dev, so a production deploy cannot go out pointing at the wrong backend.
 * Exit 0 = ok, 1 = problems.   `--print-hashes` prints the CSP hash source(s) for the current dist/index.html.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const strict = args.includes('--strict') || process.env.VERCEL === '1';
const dist = resolve(args.find(a => !a.startsWith('--')) ?? 'dist');
const root = resolve(new URL('..', import.meta.url).pathname);
const problems = [];
const fail = m => problems.push(m);

const indexPath = join(dist, 'index.html');
if (!existsSync(indexPath)) {
  console.error(`check_deploy: no build at ${dist} - run "npm run build" first`);
  process.exit(1);
}
const html = readFileSync(indexPath, 'utf8');
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const hashes = inlineScripts.map(s => `'sha256-${createHash('sha256').update(s).digest('base64')}'`);
if (args.includes('--print-hashes')) {
  console.log(hashes.join(' '));
  process.exit(0);
}

const cfg = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
const allHeaders = (cfg.headers ?? []).flatMap(h =>
  h.headers.map(x => [h.source, x.key.toLowerCase(), x.value]),
);
const global = key => allHeaders.find(([src, k]) => src === '/(.*)' && k === key)?.[2];
const csp = global('content-security-policy');
if (!csp) fail('vercel.json: no Content-Security-Policy header on /(.*)');
const directive = name =>
  (csp ?? '')
    .split(';')
    .map(d => d.trim().split(/\s+/))
    .find(d => d[0] === name)
    ?.slice(1) ?? [];

for (const h of hashes)
  if (!directive('script-src').includes(h))
    fail(
      `CSP script-src is missing ${h} (inline script in dist/index.html changed: run "npm run check:deploy -- --print-hashes" and update vercel.json)`,
    );
for (const need of ["'none'"]) {
  if (!directive('frame-ancestors').includes(need)) fail("CSP frame-ancestors must be 'none'");
  if (!directive('object-src').includes(need)) fail("CSP object-src must be 'none'");
}
if (directive('script-src').includes("'unsafe-inline'") || directive('script-src').includes("'unsafe-eval'"))
  fail("CSP script-src must not contain 'unsafe-inline' or 'unsafe-eval'");
for (const k of [
  'strict-transport-security',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'x-frame-options',
])
  if (!global(k)) fail(`vercel.json: missing ${k} header on /(.*)`);
if (!(cfg.rewrites ?? []).some(r => r.destination === '/index.html'))
  fail('vercel.json: no SPA rewrite to /index.html');

const allowed = url => {
  const o = new URL(url).origin;
  const host = new URL(url).hostname;
  return directive('connect-src').some(s => {
    if (s === o) return true;
    const m = s.match(/^https:\/\/\*\.(.+)$/); // https://*.example.com matches any subdomain of example.com
    return m ? host.endsWith(`.${m[1]}`) : false;
  });
};
const env = k => (process.env[k] ?? '').trim();
for (const [name, dflt] of [
  ['VITE_API_BASE_URL', ''],
  ['VITE_SUPABASE_URL', ''],
]) {
  const v = env(name) || dflt;
  if (!v) {
    if (name === 'VITE_API_BASE_URL')
      fail('VITE_API_BASE_URL is not set: the bundle would fall back to http://localhost:8000');
    continue;
  }
  let u;
  try {
    u = new URL(v);
  } catch {
    fail(`${name}="${v}" is not a URL`);
    continue;
  }
  if (!allowed(v))
    fail(`${name} origin ${u.origin} is not allowed by connect-src in vercel.json - add it there`);
  if (strict) {
    if (u.protocol !== 'https:') fail(`${name} must be https:// in production (got ${u.protocol})`);
    if (/localhost|127\.0\.0\.1/.test(u.hostname)) fail(`${name} points at localhost`);
    if (/YOUR-|<|example\.com/i.test(v)) fail(`${name} is still a placeholder`);
  }
}
if (strict) {
  if (env('VITE_AUTH_MODE').toLowerCase() === 'dev')
    fail('VITE_AUTH_MODE=dev must not be used in a production build');
  if (
    !env('VITE_SUPABASE_URL') ||
    !env('VITE_SUPABASE_ANON_KEY') ||
    /YOUR-/.test(env('VITE_SUPABASE_ANON_KEY'))
  )
    fail(
      'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing or placeholder (Google sign-in would be unavailable)',
    );
}

if (problems.length) {
  console.error(`check_deploy: ${problems.length} problem(s)${strict ? ' (strict)' : ''}:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `check_deploy: OK${strict ? ' (strict)' : ''} - ${hashes.length} inline script hash(es) covered, connect-src allows the configured origins`,
);
