#!/usr/bin/env bash
# Compares this repo's contracts/openapi.json with the backend's docs/contracts/openapi.json.
# Exit 0 = in sync (or backend sibling not present: skipped with a message), 1 = drift / missing local copy.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL="$HERE/contracts/openapi.json"
BACKEND_DIR="${BACKEND_REPO:-$HERE/../../BEProjects/stock_pilot_ai_backend_service}"
REMOTE="$BACKEND_DIR/docs/contracts/openapi.json"

if [ ! -d "$BACKEND_DIR" ]; then
  echo "check_contract: SKIPPED - backend repo not found at $BACKEND_DIR (set BACKEND_REPO=/path/to/stock_pilot_ai_backend_service)."
  exit 0
fi
if [ ! -f "$REMOTE" ]; then
  echo "check_contract: SKIPPED - backend has not published $REMOTE yet (run 'make openapi' there)."
  exit 0
fi
if [ ! -f "$LOCAL" ]; then
  echo "check_contract: FAIL - $LOCAL is missing. Run: cp \"$REMOTE\" contracts/openapi.json && npm run gen:api"
  exit 1
fi

# Compare canonical JSON (sorted keys, stable formatting) so whitespace/key order never causes false drift.
canon() { python3 -c 'import json,sys; print(json.dumps(json.load(open(sys.argv[1])), sort_keys=True, indent=1))' "$1"; }
if diff -u <(canon "$LOCAL") <(canon "$REMOTE") > /tmp/check_contract.diff; then
  echo "check_contract: OK - contracts/openapi.json matches the backend copy."
else
  echo "check_contract: FAIL - contract drift between contracts/openapi.json and the backend copy:"
  head -60 /tmp/check_contract.diff
  echo "Fix: cp \"$REMOTE\" contracts/openapi.json && npm run gen:api && npm run typecheck"
  exit 1
fi
