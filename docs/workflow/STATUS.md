# Project status — web app

_Last updated: 2026-11-02 by the QA engineer (QA-01), on top of the BE-22 hardening agent's update (after REL-01)._

## Summary
All 13 web tasks are `done` (FE-01..FE-12, INT-01..INT-03; 0 partial, 0 todo). Verified here: `npm run lint`, `typecheck`, `test` (280 vitest), `build`, `check:bundle`, `check:deploy`, `audit:prod` (no high), live cross-repo `npm run e2e` (**38 specs green against the real backend, re-run 2026-11-02 after the backend hardening**) and `npm run e2e:deploy` (6/6 under the real `vercel.json` CSP, INT-03). Release verdict is in the backend repo's `docs/RELEASE.md` (pointer: `docs/RELEASE.md` here): **NOT READY by the written gate** (six backend tasks partial pending live services, RUNBOOK hosted parts unexecuted; backend QA-01 is now done, see its `docs/qa/SCENARIO_MATRIX.md`: T-A11Y-01 is covered by this repo's axe specs, `npx vitest run` re-run 2026-11-02 = 280 passed; open web-side items from it: no test for T-DATA-04 'displayed in user TZ', no UI for the interest-drift prompt QA-D1); the web side has no open blockers. This pass changed three e2e specs that encoded old behaviour (`account`, `streams`, `priya`) and `scripts/e2e.sh` (`AUTH_MODE=dev` for the migrate/seed steps; the backend no longer defaults it). The backend now requires `aal2` (TOTP) tokens in production: the SPA already gates on AAL2.

## Gate table (details: backend `docs/RELEASE.md`)
| Gate | State |
|---|---|
| Foundation (scaffold, API layer, shell) | done |
| Screens (13) wired to the real API | done (live-verified against the backend, INT-02) |
| Cross-repo E2E | 38 passed (INT-02; re-run 2026-11-02 after BE-22) |
| Responsive + a11y | done on 360/768/1440, axe both themes (INT-03) |
| Deploy config (Vercel, CSP, budgets, CI) | written + smoke-tested locally; **not deployed**, GitHub Actions never run |
| Real Supabase auth (Google + TOTP) | **not exercised** (no project) |

## Unverified / needs owner
- Supabase Google OAuth + TOTP MFA flow (code paths unit-tested and the redirect target is allowed by the CSP, nothing more).
- A real Vercel deployment (rewrite/header syntax per Vercel docs, emulated by `scripts/serve_dist.mjs`); GitHub Actions run of `.github/workflows/ci.yml`.
- Firefox/Safari, real devices.
- `react-router-dom` 6.x has 2 moderate advisories (fix is the v7 major): owner decision.
- Set the real API origin in `vercel.json` `connect-src` and Vercel env vars (`npm run check:deploy` enforces).

## Sibling repo
Backend: https://github.com/ranjithkumarb-vexe/stock_pilot_ai_backend_service (local: /Users/ranjithkumar/Desktop/MyMac/BEProjects/stock_pilot_ai_backend_service)
