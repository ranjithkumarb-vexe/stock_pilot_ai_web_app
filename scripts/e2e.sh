#!/usr/bin/env bash
# Cross-repo E2E: backend on :8010 (AUTH_MODE=dev, dev DB stockpilot_dev, re-seeded) + the PRODUCTION build of the web app
# served by `vite preview` on :5180, then the Playwright specs in e2e/ (mocked shell spec + live journeys).
#
#   npm run e2e                    # everything
#   npm run e2e -- e2e/live/priya.spec.ts   # extra args go to `playwright test`
#
# Needs: the backend repo next to this one (BACKEND_REPO), `uv`, a migrated local Postgres (`make setup` there), and
# `npx playwright install chromium` once. Ports are killed by number only (never pkill).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_REPO="${BACKEND_REPO:-$HERE/../../BEProjects/stock_pilot_ai_backend_service}"
API_PORT="${E2E_API_PORT:-8010}"
WEB_PORT="${E2E_WEB_PORT:-5180}"
API_URL="http://localhost:${API_PORT}"
WEB_URL="http://localhost:${WEB_PORT}"
# NOT test-results: Playwright empties that folder at the start of a run
LOG_DIR="${E2E_LOG_DIR:-$HERE/.e2e-logs}"
mkdir -p "$LOG_DIR"

[ -d "$BACKEND_REPO" ] || { echo "e2e: backend repo not found at $BACKEND_REPO (set BACKEND_REPO)"; exit 2; }

free_port() { local pids; pids="$(lsof -ti "tcp:$1" 2>/dev/null || true)"; [ -n "$pids" ] && kill $pids 2>/dev/null || true; }
cleanup() { free_port "$API_PORT"; free_port "$WEB_PORT"; }
trap cleanup EXIT
free_port "$API_PORT"; free_port "$WEB_PORT"; sleep 1

echo "e2e: migrating + re-seeding the dev database ..."
( cd "$BACKEND_REPO" && uv run python -m app.core.migrate >"$LOG_DIR/e2e-migrate.log" 2>&1 \
  && uv run python -m scripts.seed --reset >"$LOG_DIR/e2e-seed.log" 2>&1 ) || {
  echo "e2e: migrate/seed failed, see $LOG_DIR/e2e-migrate.log and e2e-seed.log"; exit 2; }

echo "e2e: starting backend on :$API_PORT ..."
# The specs reload the app dozens of times from one IP/user (~25 API calls per load), which the production-like default
# limits (user burst 120, 10/s) would throttle; raise them for the run. The "real rate limiter" spec reads the burst.
export E2E_USER_BURST="${E2E_USER_BURST:-300}"
( cd "$BACKEND_REPO" && AUTH_MODE=dev APP_ENV=dev CORS_ORIGINS="$WEB_URL" \
  RATE_LIMIT_USER_BURST="$E2E_USER_BURST" RATE_LIMIT_USER_PER_S=30 RATE_LIMIT_IP_BURST=2000 RATE_LIMIT_IP_PER_S=200 \
  nohup uv run uvicorn app.main:create_app --factory --host 127.0.0.1 --port "$API_PORT" --no-access-log \
  >"$LOG_DIR/e2e-backend.log" 2>&1 & )
for _ in $(seq 1 60); do curl -fs "$API_URL/readyz" >/dev/null 2>&1 && break; sleep 1; done
curl -fs "$API_URL/readyz" >/dev/null 2>&1 || { echo "e2e: backend did not become ready, see $LOG_DIR/e2e-backend.log"; exit 2; }

echo "e2e: building the web app (VITE_API_BASE_URL=$API_URL) and starting vite preview on :$WEB_PORT ..."
( cd "$HERE" && VITE_API_BASE_URL="$API_URL" VITE_AUTH_MODE=dev npm run build >"$LOG_DIR/e2e-build.log" 2>&1 ) \
  || { echo "e2e: build failed, see $LOG_DIR/e2e-build.log"; exit 2; }
( cd "$HERE" && nohup npx vite preview --port "$WEB_PORT" --strictPort >"$LOG_DIR/e2e-web.log" 2>&1 & )
for _ in $(seq 1 30); do curl -fs "$WEB_URL" >/dev/null 2>&1 && break; sleep 1; done
curl -fs "$WEB_URL" >/dev/null 2>&1 || { echo "e2e: web preview did not start, see $LOG_DIR/e2e-web.log"; exit 2; }

echo "e2e: running Playwright ..."
cd "$HERE"
E2E_BASE_URL="$WEB_URL" E2E_API_URL="$API_URL" npx playwright test "$@"
STATUS=$?
echo "e2e: playwright exit code $STATUS (report: npx playwright show-report)"
exit $STATUS
