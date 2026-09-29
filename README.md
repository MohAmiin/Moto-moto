# Jareeye

Quick moto delivery for Hargeisa. *Jareeye* is Somali for a fast horse. Anyone who needs something delivered (a shop owner, a family, a business) opens the app, sees the motorbike riders online nearest to them, and calls one. They meet, hand over the package and the receiver's phone number, and the rider delivers it. Payment goes to the rider directly.

The app speaks English (default), Somali and Arabic (right to left), and is built with Expo (React Native) on top of Supabase. Headquarters and launch city: Hargeisa, Somaliland. Phone numbers use +252; Hargeisa numbers usually start with 3, 4, 6 or 9, but any number that receives the SMS code works. A bare 7-digit number gets Telesom's 63 added (474 0002 becomes +252 63 474 0002); delivery areas (xaafad and their degmo) are listed in `src/lib/format.ts`.

## What's in the app

One app with three roles, chosen at sign-up:

| Role | What they can do |
|---|---|
| **Customer** (anyone sending something) | Sign in with phone + SMS code, see a live map of themselves and the approved riders online nearby (nearest first, with distance), and call a rider's registered number |
| **Rider** | Register with name, ID number, bike plate, area and a photo of their ID, wait for approval, then go online so people nearby can see them on the map and call them. While online the app shares their position every 30 seconds |
| **Admin** | Approve or reject riders (with their ID photo), see every online rider on a live map |

Rules enforced by the database:

- Only approved riders who are online and were seen in the last 10 minutes appear in the list.
- Riders' phone numbers and positions are only returned through `nearby_riders()`, to signed-in users.
- Going offline clears the rider's saved position.
- Riders cannot approve themselves and users cannot make themselves admin.
- ID photos are stored in a private bucket that only the rider and admins can read.

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
2. In **SQL Editor**, run each file in `supabase/migrations/` in order (`20260928…_init.sql`, `20260929…_nearby_riders.sql`, `20260930…_rider_map.sql`, then `20261001…_service_area.sql`).
   (Or with the Supabase CLI: `npx supabase link` then `npx supabase db push`.)
   If only the first migration was applied, `supabase/catch-up-find-a-rider.sql` applies the other three in one go; it is safe to run more than once.
3. In **Authentication → Sign In / Providers → Phone**, enable phone sign-in and connect an SMS provider (Twilio, MessageBird, Vonage or Textlocal). Check that it delivers to Hormuud, Somtel and Golis numbers before launch.
4. While testing, add **test phone numbers** with fixed codes in the same Phone settings so no real SMS is sent, for example `252610000001` with code `123456`.

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

## Checks

```bash
npm run typecheck
npm run lint
```

## Next steps

- Let a rider mark themselves busy while on a delivery.
- Ratings, so people can pick trusted riders.
- A local Somaliland SMS provider for real login codes (Supabase SMS hook), or phone + PIN for a zero-cost pilot.
- Later: shops and menus, in-app ordering and mobile money (EVC Plus / Zaad).
