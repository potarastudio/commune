#!/usr/bin/env bash
# Run supabase/tests/*.sql against the local validation DB without Docker.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${COMMUNE_LOCAL_DB:-commune_dev}"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f scripts/local-pgtap-shim.sql 2>&1 | grep -v NOTICE || true
for f in supabase/tests/*.sql; do
  echo ">> $f"
  out="$(psql -v ON_ERROR_STOP=1 -At -d "$DB" -f "$f" 2>&1)" || { echo "$out" | grep -E '^(ok|not ok|psql:|ERROR|DETAIL)'; echo "FAILED: $f"; exit 1; }
  echo "$out" | grep -E '^(ok|not ok|1\.\.)'
done
echo "RLS tests passed"
