# StockPilot AI web app

Vite + React 18 + TypeScript (strict) frontend for StockPilot AI: source-checked research briefs, a rule-based risk engine and paper trading. UI source of truth is `design/` (see `CLAUDE.md`). Backend: sibling repo `stock_pilot_ai_backend_service`.

## Setup

```bash
npm install
cp .env.example .env        # set VITE_API_BASE_URL (default http://localhost:8000)
npm run dev                 # http://localhost:5173
```

Start the backend (`make run` in the backend repo, `AUTH_MODE=dev`), open the app and pick a demo account (Priya / Alex / New user). Allowed CORS origin on the backend is `http://localhost:5173`.

| Env var                                       | Meaning                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`                           | backend origin, no trailing slash                                                       |
| `VITE_AUTH_MODE`                              | `dev` forces dev-login; otherwise Supabase is used only when both Supabase vars are set |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Google OAuth + TOTP MFA (public anon key only)                                          |

## Commands

| Command                                 | What it does                                                                                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `preview`     | Vite dev server (5173) / production build / serve the build                                                                                                                  |
| `npm run lint` / `typecheck` / `format` | ESLint (typescript-eslint, react-hooks, jsx-a11y; 0 warnings allowed) / `tsc -b` strict / Prettier                                                                           |
| `npm run test`                          | Vitest + Testing Library + jest-axe (jsdom)                                                                                                                                  |
| `npm run e2e`                           | Playwright (`npx playwright install chromium` once). Shell smoke runs against a mocked API                                                                                   |
| `npm run gen:api`                       | copies the backend contract if needed and writes `src/api/schema.d.ts` from `contracts/openapi.json`                                                                         |
| `npm run check:bundle`                  | gzip budget check of `dist/` (initial JS <= 160 KB, largest chunk <= 95 KB, total <= 400 KB; fails if source maps are published)                                             |
| `npm run check:deploy`                  | proves `vercel.json`'s CSP matches the build (inline-script hash, API/Supabase origins in `connect-src`); `--strict` on Vercel also refuses placeholders, http and localhost |
| `npm run e2e:deploy`                    | builds with `.env.production.example`, serves `dist` with the `vercel.json` headers + rewrites and runs `e2e/deploy-smoke.spec.ts` under the real CSP (no backend needed)    |
| `npm run audit:prod`                    | `npm audit --omit=dev --audit-level=high`                                                                                                                                    |
| `npm run check:contract`                | fails if `contracts/openapi.json` differs from the backend's `docs/contracts/openapi.json`                                                                                   |

## Structure

```
src/
  styles/      tokens.css (exact copy of the design tokens, guarded by a test), global.css, utilities.css, shell.css
  theme/       ThemeProvider (localStorage key sp-theme2, default dark, sets body[data-theme])
  motion/      typed port of design/sp-motion.js (engine, hooks, <Enter>/<Stagger>/<Loop>/<AiGlyph>, data-m observer)
  ui/          Button, Pill/Chip/Badge, Card, SegmentedControl, Modal/Drawer (focus trap), Toast/Stamp, Skeleton, Meter, Sparkline, Logo, icons
  api/         client (bearer, X-Trace-Id, ApiError, 401, 429), errors.ts (code -> copy), keys, hooks/<resource>, types.ts, schema.d.ts (generated)
  auth/        AuthProvider + useAuth (dev personas or Supabase Google + TOTP), session store
  realtime/    SSE state machine (StreamClient), StreamProvider, live quote store
  telemetry/   event tracker (batch <=100 / 5 s), useTrack, useDwell
  shell/       AppShell, Sidebar, Topbar, CommandPalette, Banners, Footer, guards, 404, error boundary
  features/    one lazy module per screen: signin onboarding dashboard watchlist brief portfolio proposals trading live alerts ask profile audit
  router.tsx   routes (React Router 6 data router)
e2e/           Playwright specs + mock API support
scripts/       check_contract.sh, gen_api.sh
docs/screens/  1440 / 390 px screenshots of sign-in and the shell
```

No mock data is shipped from `src/`; every number comes from the API.

## Deploy (Vercel)

The web app is a static SPA: `vercel.json` holds the SPA rewrite, the security headers (CSP, HSTS, `X-Content-Type-Options`,
`X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`) and the asset cache rules. Source maps are **not**
published (`BUILD_SOURCEMAP=hidden` opts into hidden maps for an error tracker). The full first-deploy procedure for Supabase +
Render + Vercel is in the backend repo's `docs/RUNBOOK.md`; this is the web part.

1. Import the repo in Vercel (framework Vite; `vercel.json` already sets install/build/output). Production branch: `main`.
2. Project -> Settings -> Environment Variables (Production), values from `.env.production.example`:
   `VITE_API_BASE_URL` (the Render API origin, https, no trailing slash), `VITE_AUTH_MODE=supabase`, `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` (anon/publishable key only, never the service-role key). They are inlined at build time, so
   changing one needs a redeploy.
3. **The API origin must also be in `connect-src` of `vercel.json`** (header values are static and cannot read env vars). The
   committed value is `https://stockpilot-api.onrender.com`. If your Render URL or custom domain differs, edit it there. The build
   command runs `npm run check:deploy`, which on Vercel fails the deployment when `VITE_API_BASE_URL` / `VITE_SUPABASE_URL` are not
   allowed by the CSP, are placeholders/http/localhost, or `VITE_AUTH_MODE=dev`.
4. Add the Vercel production URL (and custom domain) to the backend's `CORS_ORIGINS` and to Supabase Auth -> URL Configuration
   (Site URL + Redirect URLs; the app redirects back to `<origin>/signin`).
5. If you add a third-party origin (analytics, error tracker) or change an inline `<script>`/`<style>`: update the CSP in
   `vercel.json` and run `npm run e2e:deploy` - it fails with the exact blocked directive and hash. `lightweight-charts` injects two
   `<style>` elements (the TradingView attribution link), allowed by hash in `style-src`; a version bump of that library changes
   the hashes (the smoke test prints the new ones).

Validate locally before pushing: `npm run build && npm run check:bundle && npm run check:deploy && npm run e2e:deploy`.
CI (`.github/workflows/ci.yml`): lint, typecheck, prettier (src/e2e/scripts), vitest, generated-types-in-sync, build, bundle budget,
CSP/env consistency, `npm audit --omit=dev --audit-level=high`, the deploy smoke, and (when the `BACKEND_REPO_TOKEN` secret exists)
the contract drift check against the backend repo.

Not verified here: an actual Vercel deployment (rewrite regex and header rules are the documented Vercel syntax; the local
`scripts/serve_dist.mjs` emulates them), real Supabase Google OAuth + MFA, Safari/Firefox rendering under the CSP.
