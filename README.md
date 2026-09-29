# SABIQ

Quick moto delivery for Hargeisa. Anyone who needs something delivered (a shop owner, a family, a business) opens the app, sees the motorbike riders online nearest to them, and calls one. They meet, hand over the package and the receiver's phone number, and the rider delivers it. Payment goes to the rider directly.

The app speaks English (default), Somali and Arabic (right to left), and is built with Expo (React Native) on top of Supabase. Headquarters and launch city: Hargeisa, Somaliland. Phone numbers use +252; Hargeisa numbers usually start with 3, 4, 6 or 9, but any number that receives the SMS code works. A bare 7-digit number gets Telesom's 63 added (474 0002 becomes +252 63 474 0002); delivery areas (xaafad and their degmo) are listed in `src/lib/format.ts`.

## What's in the app

One app with three roles, chosen at sign-up:

| Role | What they can do |
|---|---|
| **Customer** (anyone sending something) | Sign in with phone + SMS code, see approved riders online nearby (nearest first, with distance), call or WhatsApp them |
| **Rider** | Register with name, ID number, bike plate, area and a photo of their ID, wait for approval, then go online so people nearby can find and call them. While online the app shares their position every minute |
| **Admin** | Approve or reject riders (with their ID photo), see who is online now |

Rules enforced by the database:

- Only approved riders who are online and were seen in the last 10 minutes appear in the list.
- Riders' phone numbers and positions are only returned through `nearby_riders()`, to signed-in users.
- Going offline clears the rider's saved position.
- Riders cannot approve themselves and users cannot make themselves admin.
- ID photos are stored in a private bucket that only the rider and admins can read.

The first migration also contains stores, products and orders for a later marketplace version; the current app does not use them.

## Brand

- Colors: navy `#14213D` and orange `#F26B1D`.
- `assets/brand/` holds the vector files: `sabiq-logo.svg` (full logo), `sabiq-logo-on-dark.svg`, `sabiq-icon.svg` (app icon) and `sabiq-mark.svg` (the S on wheels).
- The logo text uses the Montserrat font; convert the text to outlines before sending files to a printer.
- `assets/images/` holds the PNGs the app uses (icon, Android adaptive icon, splash, favicon), generated from those SVGs.

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
2. In **SQL Editor**, run each file in `supabase/migrations/` in order (`20260928…_init.sql`, then `20260929…_nearby_riders.sql`).
   (Or with the Supabase CLI: `npx supabase link` then `npx supabase db push`.)
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

### 4. Build an Android app

```bash
npx eas-cli@latest build --platform android --profile preview
```

This builds an APK in the cloud that you can install on phones directly, before publishing to the Play Store.

## Checks

```bash
npm run typecheck
npm run lint
```

## Next steps

- Show nearby riders on a map.
- Let a rider mark themselves busy while on a delivery.
- Ratings, so people can pick trusted riders.
- A local Somaliland SMS provider for real login codes (Supabase SMS hook), or phone + PIN for a zero-cost pilot.
- Later: shops and menus, in-app ordering and mobile money (EVC Plus / Zaad).
