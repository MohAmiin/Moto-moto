# SABIQ

A $1 motorbike delivery app for Somalia. Customers order food, groceries and medicine, or send a package anywhere in the city. Motorbike riders register, get approved, and deliver. Delivery is a flat $1.

The app speaks English (default), Somali and Arabic (right to left), and is built with Expo (React Native) on top of Supabase. It launches in Hargeisa; delivery areas (xaafad and their degmo) are listed in `src/lib/format.ts`.

## What's in the app

One app with three roles, chosen at sign-up:

| Role | What they can do |
|---|---|
| **Macmiil** (customer) | Sign in with phone + SMS code, browse stores, order with EVC Plus, Zaad, Sahal or cash, send a package, track the order live, call the rider |
| **Darawal** (rider) | Register with name, ID number, bike plate, district and a photo of their ID, wait for approval, go online, accept jobs, mark picked up and delivered, see today's trips and earnings |
| **Maamul** (admin) | Approve or reject riders (with their ID photo), watch all orders |

Rules enforced by the database, not just the app:

- Prices are read from the database when an order is placed, so a customer cannot change them.
- Only approved riders see open jobs. The first rider to accept gets the job, and a rider can hold one job at a time.
- Riders cannot approve themselves and users cannot make themselves admin.
- ID photos are stored in a private bucket that only the rider and admins can read.

## Brand

- Colors: navy `#14213D` and orange `#F26B1D`.
- `assets/brand/` holds the vector files: `sabiq-logo.svg` (full logo), `sabiq-logo-on-dark.svg`, `sabiq-icon.svg` (app icon) and `sabiq-mark.svg` (the S road mark).
- The logo text uses the Montserrat font; convert the text to outlines before sending files to a printer.
- `assets/images/` holds the PNGs the app uses (icon, Android adaptive icon, splash, favicon), generated from those SVGs.

## Project layout

```
src/app/                 Screens (Expo Router, one file per screen)
  sign-in.tsx, verify.tsx   Phone and SMS code
  onboarding/               Choose role, customer details, rider registration
  (customer)/               Home, store, cart, send package, order tracking, orders, account
  rider/                    Application status, jobs dashboard, active job
  admin/                    Rider approvals and orders
src/components/          Shared UI
src/lib/                 Supabase client, auth, cart, translations (i18n.tsx), areas and formatting, types
supabase/migrations/     Database schema, security rules and functions
supabase/seed.sql        Sample stores and products
```

## Setup

### 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/migrations/20260928000000_init.sql`, then `supabase/seed.sql` for sample stores.
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

- Store owners: a store screen to accept orders and mark them ready, and to edit menus and prices.
- Push notifications for new jobs (riders) and order updates (customers).
- Rider location on a map while delivering.
- Mobile money integration (EVC Plus / Zaad merchant APIs) instead of pay-on-delivery.
- Admin tools for adding stores and products from the app.
- Real app icon and splash screen (the current ones are Expo placeholders).
