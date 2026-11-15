# Rollout: PIN security, phone checks, ratings, one account per number, memberships (off)

This covers five database migrations, the `pin-auth` Edge Function, and the app update that uses them:

| # | Migration | What it does |
|---|---|---|
| 1 | `20261007000000_pin_security.sql` | PINs checked in the database with lockouts; 6-digit PINs for new accounts; code-verified PIN resets |
| 2 | `20261008000000_rider_phone_verification.sql` | Approval needs an admin-confirmed call to the rider's number |
| 3 | `20261009000000_one_rating_per_customer.sql` | One current rating per customer per rider, tied to a logged Call tap |
| 4 | `20261010000000_rider_membership.sql` | Rider memberships and manual payments. **The switch is OFF** (price $1 per 30 days stored, not enforced) |
| 5 | `20261011000000_one_account_per_phone.sql` | One account per phone number in any form; admin phone corrections with an audit. **Stops by itself** if accounts already share a number |

The original live project (`rxeijbsstxflpwnnbaya`) is in an account that can no longer be reached, so on 2026-11-15 it was replaced by a new, empty project **jareeye-live** (`zbrfxsropeiacagwpgsc`, eu-west-1, jareeye org). All 14 migrations and `pin-auth` were applied to it fresh, so steps 2–4 and 8 below (checks, upgrade and cut-over of existing accounts) don't apply to it: it has no old accounts. It was compared with **jareeye-staging** (`espnowmofsejtshoqcuo`) and matches. See `docs/production-release-checklist.md` for the whole release.

## What changes for people

| Who | Before | After |
|---|---|---|
| Everyone signing in | PIN checked by Supabase Auth; guessing limited only per internet connection | PIN checked by `pin-auth`. 5 wrong PINs lock the number for 15 minutes, then 30, doubling up to 24 hours. A wrong PIN and an unknown number get the same answer |
| Phone numbers | Some forms of a number could make a second account | `4421785`, `634421785`, `0634421785` and `+252 63 442 1785` are one number and one account. New accounts need the full 9 digits after +252 |
| New accounts | 4-digit PIN | 6-digit PIN |
| Existing accounts | 4-digit PIN | Same 4-digit PIN keeps working. It becomes 6 digits only after a PIN reset |
| Forgot PIN | Request; admin calls and approves | The app shows the requester a 6-digit code, valid 2 hours. The admin calls the account's number and types in the code the owner reads out. 5 wrong codes close the request |
| New riders | Admin approves | Admin calls the rider's number and types the code shown in the rider's app. Approval is refused without it |
| Wrong number on an account | Fixed by hand in the database | Admin uses "Correct phone number". The PIN, Jareeye number and history stay; a rider confirms the new number and is approved again; every change is logged |
| Ratings | Every rated call counted; riders could rate themselves | One current rating per customer per rider, only after that customer tapped Call (3 minutes to 3 days earlier). Riders and admins can't log taps or rate |
| Memberships | — | Nothing changes for riders: the switch stays OFF. Admins can see the settings and record payments, which are kept as history |

Riders approved before the change stay approved. Existing ratings are carried over as each customer's latest rating of each rider. Self-ratings are dropped.

## Staging first

Everything is tried on **jareeye-staging** (`espnowmofsejtshoqcuo`) before the live one. Check the ref in every command: the live project is `zbrfxsropeiacagwpgsc`.

- Database: `npx supabase link --project-ref espnowmofsejtshoqcuo`, then `npx supabase db push --linked` (dry run first with `--dry-run`).
- Function: `npx supabase functions deploy pin-auth --no-verify-jwt --project-ref espnowmofsejtshoqcuo`.
- App: `npm run start:staging` on the `staging/pin-security` branch (Expo Go), or the `staging` EAS profile. Keep that profile off the branch production updates are published from: `eas.json` is part of the fingerprint.
- Test data: synthetic accounts on made-up `25263449xxxx` numbers; staging has SMS off.
- The SQL tests in `supabase/tests` are for a throwaway local database (`scripts/test-db.sh`). Never run them on a Supabase project.

## Before you start

- **Who can reach live.** jareeye-live and jareeye-staging are both in the jareeye organisation, which the Supabase CLI on the Mac is signed in to. Check with `npx supabase projects list`.
- **Link explicitly** and check the ref before every command: `npx supabase link --project-ref zbrfxsropeiacagwpgsc`, then `cat supabase/.temp/project-ref`.
- **Approval.** Each step below that changes live needs the owner's go-ahead.

## Order of steps

Do these in order and check each step before going on. Steps 1–6 can happen on the same day. Step 8 comes 1–2 weeks later.

### 1. Back up the database
In Supabase: **Database → Backups**, note the latest backup time. Also take one from the Mac and keep it off the laptop too:
```
npx supabase db dump --linked -f ~/jareeye-backup-$(date +%Y%m%d-%H%M).sql
npx supabase db dump --linked --data-only -f ~/jareeye-data-$(date +%Y%m%d-%H%M).sql
```
Check both files are non-empty and contain `CREATE TABLE` / `COPY` lines.

### 2. Read-only checks (change nothing)
In **SQL Editor**, run and save the output of (all three work on a database without the new migrations; tested on a local copy at live's migration level, 2026-11-15):
1. `supabase/rollout/phone-conflicts.sql`: accounts sharing a number. **Must be empty**, otherwise migration 5 stops. Resolve each pair by hand with the owners (correct one number, or delete a test account). Never merge accounts.
2. `supabase/rollout/invalid-phone-numbers.sql`: numbers that aren't 9 digits after +252. These still sign in; after the rollout, an admin corrects them with the owner's confirmation.
3. Counts to compare later:
   ```sql
   select (select count(*) from auth.users) users, (select count(*) from public.profiles) profiles,
          (select count(*) from public.rider_applications where status = 'approved') approved_riders,
          (select count(*) from public.calls) calls;
   ```
4. Which migrations live already has: `npx supabase migration list --linked`.
   - If the remote column lists everything up to `20261006000000`, use **3a**.
   - If the remote column is empty or incomplete (earlier migrations were run by hand in the SQL Editor), use **3b**. Never let `db push` re-run the old migrations.

### 3. Apply the five migrations
**3a. History is complete.** Dry run first; it must list exactly the five files above, in order:
```
npx supabase db push --linked --dry-run
npx supabase db push --linked
```
**3b. History is missing.** In **SQL Editor**, run each file in order (1 → 5), one at a time, waiting for success. Then record them so later pushes skip them (and, separately, the earlier ones once you've confirmed their tables and functions exist):
```
npx supabase migration repair --linked --status applied 20261007000000 20261008000000 20261009000000 20261010000000 20261011000000
```
If migration 5 stops with "These accounts share a phone number", nothing from it was applied: resolve the listed accounts and run it again.

The current app keeps working, except until the app update arrives:
- "Forgot PIN" in the old app shows an error. Old reset requests could not be verified safely, so they are closed.
- Admins need the new app to approve riders, because approval now needs the phone check.

### 4. Check the database
```sql
select count(*) from auth.users where email like '%@pin.jareeye.app';   -- A
select count(*) from public.pin_credentials;                               -- should equal A
select required, price_usd, first_enabled_at from public.membership_settings;  -- false, 1.00, null
```
Run `select * from public.phone_conflicts();` (empty). Don't re-run `supabase/rollout/phone-conflicts.sql` here: it is the pre-migration version and skips PIN credentials. Compare the counts from step 2.3: nothing should have gone down.

### 5. Deploy `pin-auth` (only after step 3 succeeded)
The function needs `pin_phone_available()`, created by migration 5. Deploying it first would break sign-up.
```
npx supabase functions deploy pin-auth --no-verify-jwt --project-ref zbrfxsropeiacagwpgsc
```
`--no-verify-jwt` is needed because people calling it are signed out; the function does its own checks.

Check it with a number that has no account. The reply should be `{"ok":false,"error":"wrong"}`:
```
curl -s -X POST https://zbrfxsropeiacagwpgsc.supabase.co/functions/v1/pin-auth \
  -H "apikey: sb_publishable_GdpZRXnNC8ZcfEwcyv2FCQ_L3c0y0wf" -H "Content-Type: application/json" \
  -d '{"action":"sign-in","phone":"252634999999","pin":"123456"}'
```
Then in **Edge Functions → pin-auth → Logs** confirm there are no errors, and run `select key from auth_rate_limits where bucket = 'signin-fail-ip';` to check the address recorded is your real one.

### 6. Publish the app update (preview channel first)
See `docs/production-release-checklist.md` → "App update". In short: confirm the installed builds' fingerprints match (`eas fingerprint:compare --build-id …`), check the bundle points at the live project, publish to `preview`, test on phones, then `production`.

### 7. Wait for people to update
In the Expo dashboard, under **Updates**, watch how many launches use the new update. Old versions can still sign in until step 8. Wait until nearly everyone active has it (about 1–2 weeks for a small pilot), and tell riders directly.

### 8. Close the old sign-in path (the cut-over)
1. In **SQL Editor**, run `supabase/rollout/lock-legacy-pin-passwords.sql`. It stops and changes nothing if any phone account lacks a PIN credential.
2. In **Authentication → Sign In / Providers**, switch off **Allow new users to sign up**. `pin-auth` still creates accounts (it uses the secret key); this only blocks sign-ups that bypass it.

After this, old app versions can't sign in, and PINs can no longer be guessed against Supabase Auth.

### 9. Publish the updated privacy policy
`docs/privacy-policy.html` describes the new sign-in records, phone checks and ratings. Set its "Effective" date to the day you publish it. Before memberships are ever switched on, it must also cover payment records (amount, method, reference, receiving account) and the phone-change log.

## Memberships stay off

Migration 4 stores the price ($1 per 30 days) but leaves the switch off, so nothing changes for riders. Turning it on is a separate decision, made in the admin app's **Settings**, and needs: the owner's approval, the privacy policy update above, payment instructions entered, and riders told in advance. The first time it is turned on, riders approved by then get 30 free days, once.

## Undoing

Roll back in this order: **app first, then function, then database.** The new app signs in through `pin-auth`, so removing the function while the new app is live would stop sign-in.

- **App update misbehaves (before step 8):** `npx eas-cli@latest update:rollback` (or republish the previous update group with `eas update:republish`) on the channel you published to. Old sign-in still works.
- **`pin-auth` misbehaves:** after rolling the app back, redeploy the previous version from git, or remove it with `npx supabase functions delete pin-auth --project-ref zbrfxsropeiacagwpgsc`. The old app doesn't use it.
- **Migrations (before step 8):** they only add tables, columns, rules and functions. Existing rows aren't removed, except that old, unverifiable PIN reset requests are closed and self-ratings are dropped. To undo data changes, restore from step 1. With the membership switch off (the default), customer discovery behaves as before.
- **After step 8:** old app versions can't sign in, and rolling the app back would lock people out. Fix forward, or restore the passwords from the step 1 backup.

## Known limits

- **Locking out:** anyone who types 5 wrong PINs for a number locks it for 15 minutes, and repeated attempts can lock it for up to 24 hours. Someone already signed in stays signed in. An approved PIN reset unlocks the number.
- **Shared internet addresses:** mobile networks share addresses, so the per-address limits are generous (50 wrong PINs an hour, 20 sign-ups, 10 reset requests). The per-number lock is the main protection.
- **Old 4-digit PINs** stay 4 digits until reset. With the locks, guessing one takes months rather than minutes.
- **Fake customer accounts:** customer numbers aren't verified, so someone with many accounts can still leave one rating from each. Sign-ups are limited per address.
- **Numbers that aren't 9 digits** (from before the rule) still sign in. Correct them only with the owner (see step 2.2).
- **Location** updates only while the rider app is on screen; after 10 minutes in the background or locked, customers stop seeing the rider.
