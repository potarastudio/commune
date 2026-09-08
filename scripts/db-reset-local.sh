#!/usr/bin/env bash
# Rebuild the local validation database (plain Postgres, no Docker) from
# scratch: shim -> migrations -> seed. Use `pnpm supabase db reset` when Docker
# is available; this script exists so the schema can be exercised without it.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${COMMUNE_LOCAL_DB:-commune_dev}"
dropdb --if-exists "$DB"
createdb "$DB"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f scripts/local-pg-shim.sql 2>&1 | grep -v 'wal_level\|HINT' || true
for f in supabase/migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f" 2>&1 | grep -v 'NOTICE' || true
done
if [[ "${1:-}" != "--no-seed" ]]; then
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/seed.sql
fi
echo "ok: $DB rebuilt"
