#!/usr/bin/env bash
# Deployment validation (FE-12 / INT-03): build with the production env template, check budgets and the CSP/env
# consistency, serve the builds with the vercel.json headers + rewrites, run the Playwright smoke under that CSP.
#   npm run e2e:deploy
# Needs `npx playwright install chromium` once. No backend, no network access to third parties (they are stubbed).
# Ports are freed by number only (never pkill).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"
PROD_PORT="${E2E_DEPLOY_PROD_PORT:-4181}"
DEV_PORT="${E2E_DEPLOY_DEV_PORT:-4182}"
OUT="$HERE/dist-smoke"
LOG="$HERE/.e2e-logs"; mkdir -p "$LOG"

free_port() { local pids; pids="$(lsof -ti "tcp:$1" 2>/dev/null || true)"; [ -n "$pids" ] && kill $pids 2>/dev/null || true; }
cleanup() { free_port "$PROD_PORT"; free_port "$DEV_PORT"; }
trap cleanup EXIT
free_port "$PROD_PORT"; free_port "$DEV_PORT"; sleep 1
rm -rf "$OUT"

set -a; . ./.env.production.example; set +a   # the template IS the production env under test
echo "e2e:deploy: build 1/2 (production template: VITE_AUTH_MODE=$VITE_AUTH_MODE, API=$VITE_API_BASE_URL)"
npx vite build --outDir "$OUT/prod" >"$LOG/deploy-build-prod.log" 2>&1 || { echo "build failed, see $LOG/deploy-build-prod.log"; exit 2; }
node scripts/check_bundle_size.mjs "$OUT/prod" || exit 1
node scripts/check_deploy.mjs "$OUT/prod" || exit 1
echo "e2e:deploy: build 2/2 (same, VITE_AUTH_MODE=dev for the demo sign-in)"
VITE_AUTH_MODE=dev npx vite build --outDir "$OUT/dev" >"$LOG/deploy-build-dev.log" 2>&1 || { echo "build failed, see $LOG/deploy-build-dev.log"; exit 2; }
node scripts/check_deploy.mjs "$OUT/dev" || exit 1

nohup node scripts/serve_dist.mjs "$OUT/prod" "$PROD_PORT" >"$LOG/deploy-serve-prod.log" 2>&1 &
nohup node scripts/serve_dist.mjs "$OUT/dev" "$DEV_PORT" >"$LOG/deploy-serve-dev.log" 2>&1 &
for p in "$PROD_PORT" "$DEV_PORT"; do
  for _ in $(seq 1 20); do curl -fs "http://127.0.0.1:$p/" >/dev/null 2>&1 && break; sleep 0.5; done
  curl -fs "http://127.0.0.1:$p/" >/dev/null 2>&1 || { echo "server on :$p did not start"; exit 2; }
done

E2E_DEPLOY_PROD_URL="http://127.0.0.1:$PROD_PORT" E2E_DEPLOY_DEV_URL="http://127.0.0.1:$DEV_PORT" \
  npx playwright test -c playwright.deploy.config.ts "$@"
STATUS=$?
echo "e2e:deploy: playwright exit code $STATUS"
exit $STATUS
