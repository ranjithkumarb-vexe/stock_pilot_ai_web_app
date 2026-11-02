# Release status (pointer)

The canonical release report is in the backend repo: `stock_pilot_ai_backend_service/docs/RELEASE.md` (gate table with evidence, owner
action checklist, unverified functionality, known defects). Procedures: `stock_pilot_ai_backend_service/docs/RUNBOOK.md`.

Web-specific facts as of 2026-11-02:
- Verdict (backend `docs/RELEASE.md`, 2026-11-02, BE-22): **NOT READY by the written gate** (gates 1 and 8: backend QA-01 todo / partial tasks / hosted runbook parts), all engineering blockers closed.
- Task board: 13/13 done. Tests: 280 vitest, 38 live Playwright specs (re-run 2026-11-02 after the backend hardening), 6 deploy-smoke specs (`npm run e2e:deploy`).
- Deploy artifacts: `vercel.json`, `.env.production.example`, `scripts/check_bundle_size.mjs`, `scripts/check_deploy.mjs`, `scripts/serve_dist.mjs`, `.github/workflows/ci.yml`, README "Deploy (Vercel)".
- Bundle (gzip): initial JS 125.7 KB (budget 160), largest chunk 75.3 KB (95), total 315.8 KB (400). No source maps are published.
- Owner steps for the web app: create the Vercel project, set `VITE_API_BASE_URL`, `VITE_AUTH_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; make `vercel.json` `connect-src` match the real API origin; add the Vercel URL to the backend `CORS_ORIGINS` and Supabase redirect URLs; raise the PR `develop -> main`.
