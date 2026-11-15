# Backups: jareeye-live

The live project is **jareeye-live** (`zbrfxsropeiacagwpgsc`, Free plan, eu-west-1). The Free plan keeps no backups you can download, so the Mac makes them.

## What runs

- `scripts/backup-live.sh` dumps the database (roles, schema, data) to `~/jareeye-backups/<date-time>-zbrfxsropeiacagwpgsc/` as `roles.sql.gz`, `schema.sql.gz`, `data.sql.gz` and `SHA256SUMS`. It only reads from the project.
- The data dump includes the sign-in accounts (`auth.users`, identities) and every Jareeye table (profiles, rider applications, calls, ratings, PIN records, membership payments).
- The rider photo and ID files in Storage (`rider-photos`, `rider-ids`) are copied into `storage/` in the same folder. If that copy fails, the log shows a warning and the database backup still counts.
- It runs **every day at 21:00** through a macOS launch agent, `~/Library/LaunchAgents/com.jareeye.backup-live.plist`. If the Mac is asleep or off at 21:00, it runs when the Mac wakes. Output goes to `~/jareeye-backups/backup.log`.
- Backups older than 30 days are deleted.
- It needs **Docker Desktop**, which the script starts if needed, and the Supabase CLI signed in to the jareeye organisation (`npx supabase login`).

The folder holds phone numbers and PIN hashes, so only your user can open it. **Copy it somewhere other than this Mac at least weekly**, for example an encrypted USB drive. If the Mac is lost, these are the only copies.

## Commands

```bash
# Back up now
scripts/backup-live.sh

# Back up staging instead
JAREEYE_BACKUP_REF=espnowmofsejtshoqcuo scripts/backup-live.sh

# Check the last scheduled run (last exit code = 0 means it worked)
launchctl print gui/$(id -u)/com.jareeye.backup-live | grep 'last exit code'
tail -20 ~/jareeye-backups/backup.log

# Run the scheduled job right now
launchctl kickstart gui/$(id -u)/com.jareeye.backup-live

# Stop or restart the daily schedule
launchctl bootout gui/$(id -u)/com.jareeye.backup-live
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.jareeye.backup-live.plist

# Check a backup is intact
cd ~/jareeye-backups/<folder> && shasum -a 256 -c SHA256SUMS
```

## Restoring

Restore into a **new, empty** Supabase project, never on top of live. Test the restore on a spare project first. You need that project's database connection string (Dashboard → Connect → Session pooler); type the password yourself and don't paste it into chat.

```bash
cd ~/jareeye-backups/<folder>
gunzip -k *.sql.gz
psql "<connection string>" -v ON_ERROR_STOP=1 \
  -f roles.sql -f schema.sql \
  -c 'SET session_replication_role = replica' -f data.sql
```

Then deploy `pin-auth` to the new project (`npx supabase functions deploy pin-auth --no-verify-jwt --project-ref <new ref>`), point `.env` and `eas.json` at it, and build a new APK, because the address is part of the build.

## Restoring Storage files

The backup's `storage/rider-photos` and `storage/rider-ids` folders go back into the new project's buckets of the same names (the migrations create the buckets):

```bash
npx supabase storage cp -r ~/jareeye-backups/<folder>/storage/rider-photos ss:///rider-photos --experimental --linked --project-ref <new ref>
npx supabase storage cp -r ~/jareeye-backups/<folder>/storage/rider-ids ss:///rider-ids --experimental --linked --project-ref <new ref>
```

Afterwards, check in Dashboard → Storage that files sit at `<user id>/<file>` directly inside each bucket, not inside an extra `rider-photos/` folder. Move them if they do: the app looks for them at the exact path stored in the database.
