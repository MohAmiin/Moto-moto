#!/usr/bin/env bash
# Backs up jareeye-live (database roles, schema, data, and the rider photo/ID files in Storage)
# to ~/jareeye-backups/<date-time>-<ref>/.
# Read-only on the project. Needs: Docker Desktop (pg_dump runs in a container) and the Supabase CLI signed in
# to the jareeye organisation (`npx supabase login`). The Free plan keeps no downloadable backups, so this is the
# only copy: copy the folder somewhere other than this Mac too.
#
#   scripts/backup-live.sh                      # back up jareeye-live
#   JAREEYE_BACKUP_REF=espnowmofsejtshoqcuo scripts/backup-live.sh   # back up staging instead
#
# Settings (environment): JAREEYE_BACKUP_DIR (default ~/jareeye-backups), JAREEYE_BACKUP_KEEP_DAYS (default 30).
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.."

ref="${JAREEYE_BACKUP_REF:-zbrfxsropeiacagwpgsc}"   # jareeye-live
root="${JAREEYE_BACKUP_DIR:-$HOME/jareeye-backups}"
keep_days="${JAREEYE_BACKUP_KEEP_DAYS:-30}"

if ! docker info >/dev/null 2>&1; then
  open -a Docker
  for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 5; done
fi
docker info >/dev/null 2>&1 || { echo "Docker Desktop isn't running; start it and try again." >&2; exit 1; }

dir="$root/$(date +%Y%m%d-%H%M)-$ref"
mkdir -p "$dir"
chmod 700 "$root" "$dir"   # the data contains phone numbers and PIN hashes

# --project-ref picks the project even if the CLI is linked to another one.
dump() { npx -y supabase@2 db dump --linked --project-ref "$ref" "$@" 2> >(grep -vE 'new version|recommend' >&2); }
dump --role-only -f "$dir/roles.sql"
dump -f "$dir/schema.sql"
dump --data-only --use-copy -f "$dir/data.sql"

# A dump that is empty or has no tables is a failed backup.
[ -s "$dir/schema.sql" ] && grep -q 'CREATE TABLE' "$dir/schema.sql" || { echo "schema.sql is empty or has no tables: $dir" >&2; exit 1; }
[ -s "$dir/data.sql" ] || { echo "data.sql is empty: $dir" >&2; exit 1; }

gzip -9 "$dir"/*.sql

# Rider photo and ID files (Storage isn't in the database dump).
for bucket in rider-photos rider-ids; do
  mkdir -p "$dir/storage"   # not the bucket folder itself: copying into an existing folder adds another level
  npx -y supabase@2 storage cp -r "ss:///$bucket" "$dir/storage/$bucket" --experimental --linked --project-ref "$ref" >/dev/null 2>&1 \
    || echo "Warning: couldn't copy Storage bucket $bucket (the database backup is fine)." >&2
done

(cd "$dir" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 shasum -a 256 > SHA256SUMS)
echo "Backed up $ref to $dir:"
ls -lh "$dir" | tail -n +2

# Keep the last $keep_days days (only folders this script made).
find "$root" -mindepth 1 -maxdepth 1 -type d -name '20*-*' -mtime +"$keep_days" -print -exec rm -rf {} + || true
