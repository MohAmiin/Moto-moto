#!/usr/bin/env bash
# Applies every migration to a fresh, throwaway local database and runs supabase/tests/*.test.sql.
# Needs a local Postgres 15+ with pgcrypto (Homebrew: `brew install postgresql@16`).
#
#   PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres scripts/test-db.sh
#
# It creates and drops a database named jareeye_test_<random>, and refuses any host but a local one.
set -euo pipefail
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
cd "$(dirname "$0")/.."

# Only ever a local Postgres: it creates and drops databases.
case "${PGHOST:-localhost}" in
  localhost|127.0.0.1|::1|/*) ;;
  *) echo "Refusing to run: PGHOST must be a local Postgres (localhost, 127.0.0.1 or a socket path)." >&2; exit 1 ;;
esac
unset DATABASE_URL PGSERVICE

db="jareeye_test_$RANDOM$RANDOM"
psql_db() { psql -X -q -v ON_ERROR_STOP=1 -d "$db" "$@"; }

createdb "$db"
trap 'dropdb --if-exists "$db" >/dev/null 2>&1 || true' EXIT

# Roles are cluster-wide, so they are created once (if missing) instead of by the shim.
grep -v '^create role ' supabase/tests/shim.sql > "${TMPDIR:-/tmp}/jareeye-shim.sql"
for role in anon authenticated; do
  psql -X -q -d postgres -c "do \$\$ begin create role $role nologin; exception when duplicate_object then null; end \$\$" >/dev/null
done
psql -X -q -d postgres -c "do \$\$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end \$\$" >/dev/null
psql_db -f "${TMPDIR:-/tmp}/jareeye-shim.sql" >/dev/null 2>&1

for f in supabase/migrations/*.sql; do
  psql_db -f "$f" >/dev/null || { echo "Migration failed: $f" >&2; exit 1; }
done
echo "Applied $(ls supabase/migrations/*.sql | wc -l | tr -d ' ') migrations."

# Tests run inside a transaction that is rolled back, so scripts they include must not commit it:
# the cut-over script is passed in without its own begin/commit.
rollout_lock="${TMPDIR:-/tmp}/jareeye-lock-legacy-pin-passwords.sql"
grep -v -E '^(begin|commit);$' supabase/rollout/lock-legacy-pin-passwords.sql > "$rollout_lock"

status=0
for t in supabase/tests/*.test.sql; do
  [ -e "$t" ] || continue
  # Each test file runs in a transaction that is rolled back, so files don't affect each other.
  if out=$( { echo 'begin;'; cat supabase/tests/helpers.sql "$t"; echo 'rollback;'; } | psql_db -v rollout_lock="$rollout_lock" 2>&1 ); then
    echo "ok   $t"
  else
    echo "FAIL $t"; echo "$out" | sed 's/^/     /'; status=1
  fi
done
exit $status
