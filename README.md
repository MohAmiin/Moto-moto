# Jareeye

Quick moto delivery for Hargeisa. *Jareeye* is Somali for a fast horse. Anyone who needs something delivered (a shop owner, a family, a business) opens the app, sees the motorbike riders online nearest to them, and calls one. They meet, hand over the package and the receiver's phone number, and the rider delivers it. Payment goes to the rider directly.

The app speaks English (default), Somali and Arabic (right to left), and is built with Expo (React Native) on top of Supabase. Headquarters and launch city: Hargeisa, Somaliland. Phone numbers use +252; Hargeisa numbers usually start with 3, 4, 6 or 9, but any number that receives the SMS code works. A bare 7-digit number gets Telesom's 63 added (474 0002 becomes +252 63 474 0002); customers and drivers pick one of Hargeisa's eight districts (Koodbuur, 26 June, Gacan Libaax, Macalin Haaruun, Ahmed Dhagax, Maxamed Mooge, Maxamuud Haybe, 31 May), listed in `src/lib/format.ts`.

## What's in the app

One app with three roles, chosen at sign-up:

| Role | What they can do |
|---|---|
| **Customer** (anyone sending something) | Sign in with phone number + 4-digit PIN, see a live map of themselves and the approved motos online nearby (nearest first, with photo, Jareeye number, rating and distance), call a driver, and rate them 1–5 stars a few minutes later |
| **Moto driver** | Register with name, face photo, bike plate and area (ID number and ID photo optional during the pilot), wait for approval, then go online so people nearby can see them on the map and call them. While online the app shares their position every 30 seconds; "I'm on a delivery" hides them for 45 minutes or until they tap "I'm free again" |
| **Admin** | Approve or reject drivers (with face and ID photos), see each driver's Jareeye number, calls and rating, and every online driver (busy ones included) on a live map |

Rules enforced by the database:

- Only approved riders who are online, not busy, and were seen in the last 10 minutes appear in the list.
- Each driver gets a Jareeye number (JRY-001, JRY-002, …) when first approved; it never changes, so it can be printed on their vest.
- A call can be rated once, only by the person who made it.
- Riders' phone numbers and positions are only returned through `nearby_riders()`, to signed-in users.
- Going offline clears the rider's saved position.
- Riders cannot approve themselves and users cannot make themselves admin.
- Anyone can delete their own account in the app (Account screen, or the driver screen); this removes their login, profile, photos, driver application, calls and PIN reset requests. Admin accounts are removed from the SQL editor instead.
- A profile's phone number always comes from the login itself, so drivers cannot switch it to someone else's number.

## Signing in

People sign in with their **phone number and a 4-digit PIN** they choose, so no SMS provider is needed. Behind the scenes each number becomes a login address `252…@pin.jareeye.app` (unique per number) and the PIN becomes the password; users never see this.

A forgotten PIN is reset by request: the person enters their number and a new PIN, the request appears under **PIN resets** in admin, the admin calls the number to check it's really them, then approves. Approval sets the new PIN and signs the account out on every device. Supabase limits repeated sign-in attempts from the same network.

"Use an SMS code instead" still works for numbers set up as test numbers in Supabase (or for everyone once an SMS provider is connected).
- ID photos are stored in a private bucket that only the rider and admins can read.

## Calling a rider

Tapping **Call** on Android rings the rider straight away: the first time, Android asks once for permission to make phone calls; if that's refused, the phone's dialler opens with the number. iPhones always show their own "Call +252…?" confirmation, which apps can't skip. The call is a normal phone call from the customer's SIM, so it costs the app nothing.

Calls are always free. Every tap is recorded in the `calls` table (who called which rider, and when) through `log_call()`, so the owner can see how much each rider is used.

## Money

Riders are paid directly by the customer (about $1 a delivery, maybe $1.5 once the app has real users). Jareeye is completely free for now, for customers and riders. Later options: a one-time rider registration fee, or a small percentage of each delivery.

The first migration also contains stores, products and orders for a later marketplace version; the current app does not use them.

## Maps

The live map uses Leaflet with OpenStreetMap tiles (free, no API key). It runs in a WebView on phones and an iframe on the web. OpenStreetMap's public tiles are fine for testing and a small pilot; before a large launch switch to a hosted tile provider (for example MapTiler or Stadia Maps) in `src/components/live-map/map-html.ts`.

## Service area

Jareeye runs in Hargeisa only for now. The map is locked to the city, and riders whose position is outside it are not shown to customers. Cities are listed in `src/lib/service-area.ts` and in `in_service_area()` in the database; add Mogadishu to both when it's time to expand.

## Brand

- The logo is a scooter whose front is a running horse (*jareeye*), in royal blue `#0046B5` and orange `#FF6B0A`.
- `assets/brand/jareeye-logo.png` is the full logo with the name, and `jareeye-mark.png` the horse scooter alone, both with transparent backgrounds.
- `assets/images/` holds the PNGs the app uses (icon, Android adaptive icon, splash, in-app logos, favicon), cut from the logo. The map's rider pin is in `src/components/live-map/pin-image.ts`.
- The logo is a raster image. Before printing (stickers, vests, delivery boxes) have it redrawn as a vector file.

## Project layout

```
src/app/                 Screens (Expo Router, one file per screen)
  sign-in.tsx, verify.tsx   Phone and SMS code
  onboarding/               Choose role, customer details, rider registration
  (customer)/               Find a rider nearby, account
  rider/                    Application status, go online and share location
  admin/                    Rider approvals and riders online
src/components/          Shared UI
src/lib/                 Supabase client, auth, location and calling, translations (i18n.tsx), areas and formatting, types
supabase/migrations/     Database schema, security rules and functions
supabase/seed.sql        Sample stores and products
```

## Setup

### 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run each file in `supabase/migrations/` in order (`20260928…_init.sql`, `20260929…_nearby_riders.sql`, `20260930…_rider_map.sql`, `20261001…_service_area.sql`, `20261002…_call_log.sql`, `20261003…_trust.sql`, `20261004…_pin_login.sql`, `20261005…_optional_id.sql`, then `20261006…_delete_account.sql`).
   (Or with the Supabase CLI: `npx supabase link` then `npx supabase db push`.)
   If only the first migration was applied, `supabase/catch-up-find-a-rider.sql` applies the other three in one go; it is safe to run more than once.
3. For PIN login: in **Authentication → Sign In / Providers → Email**, make sure Email is enabled and switch **Confirm email** off.
4. Optional, for SMS codes: in **Authentication → Sign In / Providers → Phone**, enable phone sign-in and connect an SMS provider (Twilio, MessageBird, Vonage or Textlocal). Check that it delivers to Hormuud, Somtel and Golis numbers before launch.
5. While testing SMS codes, add **test phone numbers** with fixed codes in the same Phone settings so no real SMS is sent, for example `252610000001` with code `123456`.

### 2. Make yourself admin

Sign in once in the app and choose any role, then run this in the SQL Editor with your number:

```sql
update public.profiles set role = 'admin'
where phone = '252610000001';
```

Sign out and back in to see the admin screen.

### 3. Run the app

```bash
cp .env.example .env      # paste the two lines from Supabase → Connect → Expo React Native → .env.local
npm install
npx expo start            # scan the QR code with Expo Go, or press w for web
```

### 4. Build an Android app (APK)

`eas.json` holds the build profiles. The Supabase URL and publishable key are in it on purpose: they ship inside the app anyway, and the database rules protect the data. Never put the secret / service_role key there.

```bash
npx eas-cli@latest login                                   # same Expo account as Expo Go
npx eas-cli@latest build --platform android --profile preview
```

The first time, answer **Yes** to creating the EAS project and to generating a new Android keystore. The build runs in Expo's cloud (10–20 minutes) and ends with a link and QR code to download the APK, which you can send to riders directly. The `production` profile builds an app bundle for the Play Store.

### 5. Send fixes without a new build (EAS Update)

Builds made after EAS Update was added download fixes by themselves: when the app opens it fetches the latest update for its channel and uses it from the next launch.

```bash
# fix for the APK testers (preview builds)
npx eas-cli@latest update --channel preview --message "What changed"
# fix for Google Play users (production builds)
npx eas-cli@latest update --channel production --message "What changed"
```

Updates carry JavaScript, text, images and styles. A change to native parts (a new permission or a new native package) changes the app's fingerprint; older installed builds then ignore the update, and a new build is needed. The Supabase settings for an update come from your local `.env`, so keep it the same as the `env` in `eas.json`.

## Checks

```bash
npm run typecheck
npm run lint
```

## Next steps

- Later, once there are real users: a rider registration fee or a small percentage of each delivery (EVC Plus / Zaad).
- A local Somaliland SMS provider for real login codes (Supabase SMS hook), or phone + PIN for a zero-cost pilot.
- Later: shops and menus, in-app ordering and mobile money (EVC Plus / Zaad).
