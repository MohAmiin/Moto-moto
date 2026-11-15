# Production release checklist: Jareeye public pilot

For the release that brings the PIN, phone-check, rating, one-account-per-number and (switched-off) membership changes to the live project `zbrfxsropeiacagwpgsc`. Database steps are in `docs/pin-security-rollout.md`; this list covers the whole release around them.

Every step that changes live needs the owner's explicit go-ahead. Membership enforcement stays **OFF**.

## 1. Go / no-go

All must be true before starting:

- [ ] Staging (`espnowmofsejtshoqcuo`) runs the same migrations and `pin-auth` as will go live, and the staging review passed.
- [ ] `scripts/test.sh` and `scripts/test-db.sh` (local throwaway database) pass on the commit being released.
- [ ] **Real phones checked** on staging: one iPhone and one Android phone, through sign-in, customer find-and-call, rider online/busy/offline, admin approval (section 6 below). Code review alone is not enough.
- [ ] **Translations**: Somali and Arabic wording confirmed by native speakers (`docs/translation-review.md`).
- [ ] **Installed builds known**: which builds pilot users have (Android preview APK on channel `preview`, or a store build on `production`), and that the latest one matches the release's fingerprint (section 4).
- [ ] Privacy policy updated (effective date), published at the URL in the store listing.
- [ ] `supabase/rollout/phone-conflicts.sql` on live returns no rows (or the listed accounts were resolved with their owners).
- [ ] A person is available for 48 hours after release to answer riders and approve PIN resets.

## 2. Access and safety

- [ ] Supabase CLI signed in with the account that owns the live project (`npx supabase projects list` shows `zbrfxsropeiacagwpgsc`).
- [ ] Before every remote command: `cat supabase/.temp/project-ref` shows the intended project.
- [ ] Expo account `mo-jay` signed in (`npx eas-cli@latest whoami`). Check the plan's build quota before any build.
- [ ] Publish updates only from `pilot/rider-availability` (or `main` once merged), never from `staging/pin-security`: that branch carries the staging profile and staging start script.

## 3. Backup

- [ ] **Dashboard**: Database → Backups. Note the newest backup time (on the Free plan there may be none).
- [ ] **Own copy**: `supabase db dump` runs `pg_dump` in Docker. Start **Docker Desktop** first (or `brew install postgresql@17` and use its `pg_dump`; version 16 can't dump Postgres 17). Then:
  ```
  npx supabase db dump --linked -f ~/jareeye-backup-$(date +%Y%m%d-%H%M).sql
  npx supabase db dump --linked --data-only -f ~/jareeye-data-$(date +%Y%m%d-%H%M).sql
  ```
- [ ] Both files open, are non-empty, and are copied somewhere other than the laptop.
- [ ] Save the read-only counts and reports from `docs/pin-security-rollout.md` step 2.

## 4. App update (OTA)

The app uses `runtimeVersion: { policy: "fingerprint" }`: an update reaches only builds whose fingerprint matches. The fingerprint changes when native configuration changes (`app.json`, `eas.json`, native packages, `package.json` scripts), so this release must contain JavaScript changes only.

1. **Find the installed builds.** `npx eas-cli@latest build:list --limit 10`. As of 2026-10-10 the only builds are Android **preview** APKs; the newest is fingerprint `492de1e6…` (commit `9652e4c`). There is no `production` build, so publishing to `production` would reach nobody until one exists.
2. **Compare with the build, not just a local hash.** On the release commit:
   ```
   npx eas-cli@latest fingerprint:compare --build-id <newest installed build id>
   ```
   It must say the fingerprints match. Older preview builds (`6af6e5e…`, `a98ed9e…`) won't receive the update; reinstall those phones from the newest APK.
3. **Check the bundle points at live.** `eas update` uses the local `.env` (live URL and key). Before publishing, confirm with `cat .env` that it holds `zbrfxsropeiacagwpgsc`, and that you are not on the staging branch.
4. **Publish to preview first**, after the database steps and `pin-auth` are live (rollout steps 1–5):
   ```
   npx eas-cli@latest update --channel preview --message "PIN security, phone checks, ratings, admin redesign"
   ```
5. **Test on a phone with the installed preview build**: close and reopen the app twice (updates apply on the next launch). Check Settings → About shows the live server in the admin app, then run section 6 against live with a real test account.
6. Only then, if a production build exists: the same `update` command with `--channel production`.

## 5. Order on the day

1. Backup (section 3).
2. Read-only checks, migrations, database check (`pin-security-rollout.md` steps 2–4).
3. Deploy `pin-auth` (step 5). **Never before the migrations**: sign-up needs `pin_phone_available()`.
4. App update to `preview` (section 4), phone checks (section 6), then `production` if applicable.
5. Watch (section 7).
6. 1–2 weeks later: the cut-over (`pin-security-rollout.md` step 8).

## 6. Phone checks after release

On live, with one real customer and one real rider who agreed to help:

- [ ] Sign in with an existing 4-digit PIN; create a new account (9-digit number, 6-digit PIN).
- [ ] Forgot PIN: the code appears; an admin confirms it on a call; the new PIN works.
- [ ] New rider: application, phone check (admin calls the number), approval.
- [ ] Rider online → visible to the customer → busy → hidden → free → visible → offline.
- [ ] Customer taps Call (Android rings straight away after the permission prompt; iPhone shows its confirmation), then rates after 3 minutes.
- [ ] Admin: Overview figures, Needs attention, map with "Available to customers", Settings → Membership shows **Off**.
- [ ] Arabic layout, dark mode and large text on at least one screen of each app.

## 7. Watch for 48 hours

- Edge Functions → `pin-auth` → Logs: errors or many `server` replies.
- `select bucket, count(*) from auth_rate_limits group by bucket;`: unexpected lockouts.
- Admin app: PIN reset requests and pending riders handled promptly.
- Expo dashboard → Updates: launches on the new update.

## 8. Rollback

Order: **app, then function, then database** (the new app signs in through `pin-auth`).

| Problem | Action |
|---|---|
| App update misbehaves | `npx eas-cli@latest update:rollback` on the channel, or `eas update:republish` the previous group. Old sign-in still works until the cut-over |
| `pin-auth` misbehaves | After rolling the app back: redeploy the previous version from git, or `npx supabase functions delete pin-auth --project-ref zbrfxsropeiacagwpgsc` |
| Database problem | The migrations only add things (old reset requests closed, self-ratings dropped). Restore data from the section 3 backup if needed; keep membership OFF |
| After the cut-over | Don't roll the app back (old versions can't sign in). Fix forward, or restore passwords from the backup |

## 9. Not in this release (needs a new native build)

These change the fingerprint, so they need a new build and can't go out as an update:

- **Remove unused Android permissions.** The current build requests `RECORD_AUDIO` (image picker's video microphone), `READ/WRITE_EXTERNAL_STORAGE` and `SYSTEM_ALERT_WINDOW`, which the app doesn't use. Before a Play Store build: `["expo-image-picker", { "microphonePermission": false, … }]` and `android.blockedPermissions` for the rest.
- Dependency patch updates suggested by `npx expo-doctor`.
- Self-hosted map assets/tiles instead of unpkg and `tile.openstreetmap.org` (whose usage policy limits heavy use).
