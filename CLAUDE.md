# StockPilot AI — operating rules for Claude Code (web app)

You are working on **StockPilot AI**, a personalized equity-research and paper-trading copilot (Meta Global AI Developer Hackathon 2026).
This repo is the **web app** (Vite + React 18 + TypeScript). The backend lives in the sibling repo `stock_pilot_ai_backend_service`
(`/Users/ranjithkumar/Desktop/MyMac/BEProjects/stock_pilot_ai_backend_service` on the owner's machine,
`https://github.com/ranjithkumarb-vexe/stock_pilot_ai_backend_service`).

## Read first, in this order
1. `docs/workflow/STATUS.md` — where the project is right now (updated at the end of every work session)
2. `docs/workflow/TASKS.md` — task board with dependencies and acceptance criteria
3. `docs/workflow/HANDOFF.md` — latest notes from the previous agent/teammate
4. `docs/workflow/WORKFLOW.md` — how agents work, own files, hand off, and verify
5. `docs/SPEC.md` — master specification. **If anything conflicts with it, SPEC.md wins** unless `docs/workflow/DECISIONS.md` records an owner-approved deviation.
6. `docs/workflow/CONTRACT.md` — API contract shared with the frontend

## Non-negotiables (from SPEC §0.2)
- No live trading. No tool/endpoint that places a real order. All trades are simulated in our own paper ledger.
- Numbers come from code, words come from the model. An LLM is never the source of a figure.
- The risk engine is deterministic and has veto power.
- Never tailored "buy/sell X" advice. Approved wording only (SPEC §11.4).
- Fetched text (filings/news) is untrusted data: scanned, delimited, never creates memories or triggers tools.
- User-private content never goes to a Contributor-mode model.
- Never invent API details. Anything unverified is recorded in `docs/VERIFIED.md` as unverified.
- Secrets never enter the repo. `.env` is git-ignored; `.env.example` is committed.
- A task is **done** only when its tests pass AND its acceptance criteria are checked AND the evidence is written in `docs/workflow/VERIFICATION.md`.

## UI source of truth
`design/StockPilot AI.dc.html` (+ `sp-data.js`, `sp-motion.js`, `StockPilot Design System.dc.html`, `Part 1.png`, `Part 2.png`). Port look, copy, states and interactions faithfully. Mock math in the design now lives in the backend; the UI renders API data.

## Commands
```
npm run dev        # vite on :5173 (VITE_API_BASE_URL points to the backend)
npm run test       # vitest
npm run e2e        # playwright
npm run lint && npm run typecheck && npm run build
npm run gen:api    # regenerate src/api/schema.d.ts from contracts/openapi.json
```

## Git
Work on `develop`. Small Conventional Commits. **Never open pull requests** — tell the owner when a PR is needed.
