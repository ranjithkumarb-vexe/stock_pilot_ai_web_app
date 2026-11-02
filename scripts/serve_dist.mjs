#!/usr/bin/env node
/**
 * Tiny static server that behaves like Vercel for this project (FE-12): serves <dist> on <port> applying the `headers` and
 * `rewrites` of vercel.json, so the deploy smoke test runs under the REAL Content-Security-Policy. (`vite preview` ignores
 * vercel.json.)   node scripts/serve_dist.mjs <dist dir> <port>
 * Vercel semantics emulated: a file on disk wins over rewrites; rewrites then map to /index.html; all matching header
 * rules apply, later rules overriding earlier ones for the same key. Source patterns are path-to-regexp style, which for
 * the patterns used here is a plain regular expression over the whole path.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const dist = resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 4180);
const cfg = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const re = source => new RegExp(`^${source}$`);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = normalize(join(dist, path));
  if (!file.startsWith(dist)) {
    res.writeHead(400).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) || !statSync(file).isFile()) {
    const rw = (cfg.rewrites ?? []).find(r => re(r.source).test(path));
    if (!rw) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('404 not found');
      return;
    }
    file = join(dist, rw.destination);
  }
  const headers = { 'content-type': types[extname(file)] ?? 'application/octet-stream' };
  for (const rule of cfg.headers ?? []) {
    if (re(rule.source).test(path)) for (const h of rule.headers) headers[h.key] = h.value;
  }
  res.writeHead(200, headers);
  res.end(readFileSync(file));
}).listen(port, '127.0.0.1', () =>
  console.log(`serve_dist: ${dist} on http://127.0.0.1:${port} (vercel.json headers + rewrites)`),
);
