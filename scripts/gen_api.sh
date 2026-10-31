#!/usr/bin/env bash
# Regenerates src/api/schema.d.ts from contracts/openapi.json (copying the backend's file first when it is newer/absent).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"
BACKEND_DIR="${BACKEND_REPO:-$HERE/../../BEProjects/stock_pilot_ai_backend_service}"
REMOTE="$BACKEND_DIR/docs/contracts/openapi.json"
if [ ! -f contracts/openapi.json ] && [ -f "$REMOTE" ]; then
  mkdir -p contracts && cp "$REMOTE" contracts/openapi.json && echo "gen:api: copied backend contract"
fi
if [ ! -f contracts/openapi.json ]; then
  echo "gen:api: contracts/openapi.json not found. The backend has not published docs/contracts/openapi.json yet;"
  echo "         src/api/types.ts (hand-written from docs/workflow/CONTRACT.md) stays in use until then."
  exit 1
fi
npx openapi-typescript contracts/openapi.json -o src/api/schema.d.ts
echo "gen:api: wrote src/api/schema.d.ts"
