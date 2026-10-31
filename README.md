# StockPilot AI web app

Vite + React 18 + TypeScript (strict) frontend for StockPilot AI: source-checked research briefs, a rule-based risk engine and paper trading. UI source of truth is `design/` (see `CLAUDE.md`). Backend: sibling repo `stock_pilot_ai_backend_service`.

## Setup
```bash
npm install
cp .env.example .env        # set VITE_API_BASE_URL (default http://localhost:8000)
npm run dev                 # http://localhost:5173
```
Start the backend (`make run` in the backend repo, `AUTH_MODE=dev`), open the app and pick a demo account (Priya / Alex / New user). Allowed CORS origin on the backend is `http://localhost:5173`.

| Env var | Meaning |
|---|---|
| `VITE_API_BASE_URL` | backend origin, no trailing slash |
| `VITE_AUTH_MODE` | `dev` forces dev-login; otherwise Supabase is used only when both Supabase vars are set |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Google OAuth + TOTP MFA (public anon key only) |

## Commands
| Command | What it does |
|---|---|
| `npm run dev` / `build` / `preview` | Vite dev server (5173) / production build / serve the build |
| `npm run lint` / `typecheck` / `format` | ESLint (typescript-eslint, react-hooks, jsx-a11y; 0 warnings allowed) / `tsc -b` strict / Prettier |
| `npm run test` | Vitest + Testing Library + jest-axe (jsdom) |
| `npm run e2e` | Playwright (`npx playwright install chromium` once). Shell smoke runs against a mocked API |
| `npm run gen:api` | copies the backend contract if needed and writes `src/api/schema.d.ts` from `contracts/openapi.json` |
| `npm run check:contract` | fails if `contracts/openapi.json` differs from the backend's `docs/contracts/openapi.json` |

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
