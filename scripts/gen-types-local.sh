#!/usr/bin/env bash
# Generate types/database.ts from the local validation DB without Docker, using
# the same generator the Supabase CLI runs (postgres-meta + postgrest-typegen).
# With Docker available prefer: pnpm db:types
set -euo pipefail
cd "$(dirname "$0")/.."
DB_URL="${COMMUNE_LOCAL_DB_URL:-postgresql://localhost:5432/${COMMUNE_LOCAL_DB:-commune_dev}}"
PG_META_DB_URL="$DB_URL" \
PG_META_GENERATE_TYPES=typescript \
PG_META_GENERATE_TYPES_INCLUDED_SCHEMAS=public \
PG_META_GENERATE_TYPES_DETECT_ONE_TO_ONE_RELATIONSHIPS=true \
node node_modules/@supabase/postgres-meta/dist/server/server.js > types/database.ts
echo "ok: types/database.ts ($(wc -l < types/database.ts | tr -d ' ') lines)"
