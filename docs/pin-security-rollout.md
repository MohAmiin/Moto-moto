# Rollout: PIN security, rider phone checks and ratings

This covers the three migrations `20261007000000_pin_security.sql`, `20261008000000_rider_phone_verification.sql` and `20261009000000_one_rating_per_customer.sql`, the `pin-auth` Edge Function, and the app update that uses them. Nothing here has been applied to the live project yet.

## What changes for people

| Who | Before | After |
|---|---|---|
| Everyone signing in | PIN checked by Supabase Auth; guessing limited only per internet connection | PIN checked by `pin-auth`. 5 wrong PINs lock the number for 15 minutes, then 30 minutes, doubling up to 24 hours |
| New accounts | 4-digit PIN | 6-digit PIN |
| Existing accounts | 4-digit PIN | Same 4-digit PIN keeps working. It becomes 6 digits only after a PIN reset |
| Forgot PIN | Request; admin calls and approves; a newer request silently replaced an older one | The app shows the requester a 6-digit code, valid 2 hours. The admin calls the account's number and types in the code the owner reads out. 5 wrong codes close the request. Each request stands alone |
| New riders | Admin approves | Admin calls the rider's number and types the code shown in the rider's app. Approval is refused without it. Who confirmed it and when are recorded |
| Ratings | Every rated call counted; riders could rate themselves | One current rating per customer per rider, only after that customer tapped Call (3 minutes to 3 days earlier). Riders and admins can't log taps or rate |

Riders approved before the change stay approved. Existing ratings are carried over as each customer's latest rating of each rider. Self-ratings are dropped.

## Order of steps

Do these in order and check each step before going on. Steps 1–5 can happen on the same day. Step 7 comes later.

### 1. Back up the database
In Supabase: **Database → Backups**. If the plan has no downloadable backups, take one from the Mac:
```
npx supabase login
npx supabase link --project-ref rxeijbsstxflpwnnbaya
npx supabase db dump -f ~/jareeye-backup-$(date +%Y%m%d).sql
npx supabase db dump --data-only -f ~/jareeye-data-$(date +%Y%m%d).sql
```

### 2. Apply the three migrations
In **SQL Editor**, run each file in order: `20261007000000_pin_security.sql`, then `20261008000000_rider_phone_verification.sql`, then `20261009000000_one_rating_per_customer.sql`.

The current app keeps working, except for two things until the app update arrives:
- "Forgot PIN" in the old app shows an error. Old reset requests could not be verified safely, so they are closed.
- Admins need the new app to approve riders, because approval now needs the phone check.

Check with:
```sql
select count(*) from auth.users where email like '%@pin.jareeye.app';   -- A
select count(*) from public.pin_credentials;                               -- should equal A
```

### 3. Deploy the `pin-auth` function
```
cd ~/jareeye
npx supabase functions deploy pin-auth --no-verify-jwt
```
`--no-verify-jwt` is needed because people calling it are signed out. The function does its own checks.

Check it from the Mac with a test number that has no account. The reply should be `{"ok":false,"error":"wrong"}`:
```
curl -s -X POST https://rxeijbsstxflpwnnbaya.supabase.co/functions/v1/pin-auth \
  -H "apikey: sb_publishable_OncHuAtgmjlzBQcP7ZcnPQ_uEykrby1" -H "Content-Type: application/json" \
  -d '{"action":"sign-in","phone":"252610000099","pin":"123456"}'
```
Then, in **Edge Functions → pin-auth → Logs**, confirm there are no errors. Run `select key from auth_rate_limits where bucket = 'signin-fail-ip';` and check the address is your real internet address, not a Supabase-internal one. That confirms the per-address limit sees real callers.

### 4. Publish the app update to the preview channel and test on phones
Check that the update can reach the installed builds. The build's runtime version must match the update's:
```
npx eas-cli@latest fingerprint:compare
npx eas-cli@latest update --channel preview --message "PIN security, rider phone checks, ratings"
```
Then run the phone checklist on a preview build.

### 5. Publish to production
```
npx eas-cli@latest update --channel production --message "PIN security, rider phone checks, ratings"
```

### 6. Wait for people to update
In the Expo dashboard, under **Updates**, watch how many launches use the new update. Old versions can still sign in until step 7. Wait until nearly everyone active has the update (about 1–2 weeks for a small pilot), and tell riders directly.

### 7. Close the old sign-in path (the cut-over)
1. In **SQL Editor**, run `supabase/rollout/lock-legacy-pin-passwords.sql`. It stops and changes nothing if any phone account lacks a PIN credential.
2. In **Authentication → Sign In / Providers**, switch off **Allow new users to sign up**. The `pin-auth` function still creates accounts (it uses the secret key). This only blocks sign-ups that bypass it. It also stops SMS-code sign-up for new numbers, which only works for test numbers anyway.

After this, old app versions can't sign in. PINs can no longer be guessed against Supabase Auth.

### 8. Publish the updated privacy policy
`docs/privacy-policy.html` now describes the new sign-in records, phone checks and ratings. Set its "Effective" date to the day you publish it.

## Undoing

- **Before step 7:** the migrations only add things. Existing data isn't removed, and old sign-in still works. If the app update misbehaves, roll it back with `npx eas-cli@latest update:rollback`.
- **After step 7:** old app versions can't sign in, and rolling the app back would lock people out. Fix forward, or restore the passwords from the step 1 backup.

## Known limits

- **Locking out:** anyone who types 5 wrong PINs for a number locks that number for 15 minutes, and repeated attempts can lock it for up to 24 hours. Someone already signed in stays signed in. An approved PIN reset unlocks the number.
- **Shared internet addresses:** mobile networks share addresses between many people, so the per-address limits are generous (50 wrong PINs an hour, 20 sign-ups, 10 reset requests). The per-number lock is the main protection.
- **Old 4-digit PINs** are still 4 digits until reset. With the locks, guessing one takes months rather than minutes, but 6 digits is much stronger. A later step could ask people to choose a new PIN.
- **Fake customer accounts:** customer phone numbers aren't verified, so someone with many accounts can still leave one rating from each. Sign-ups are limited per address. Verifying customer numbers would need SMS, which costs money.
