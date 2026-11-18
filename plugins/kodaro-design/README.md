# Kodaro Design Plugin

Anthropic's Design plugin, customised for **Kodaro**, a software company in Hargeisa, Somaliland. Its motto is "code, crafted with care". Every skill reads [BRAND.md](BRAND.md), which holds Kodaro's and Jareeye's tokens, voice, quality bar, audiences and process. Output is on-brand by default.

## What's customised

| Skill | Kodaro additions |
|---|---|
| `design-critique` | A "Kodaro Fit" pass: brand detection (Kodaro / client / AOMS / Jareeye), a one-CTA goal check, honesty and trust, mobile-first and low-bandwidth checks, multilingual and RTL, and operational clarity for AOMS |
| `design-system` | Both real systems mapped (Kodaro `site.css` and Jareeye `theme.ts`), a client starter structure, and a known-debt list (misnamed slots, failing greys, radius sprawl) |
| `design-handoff` | Real token names, Kodaro stacks (HTML/CSS on Vercel; Expo Router + Supabase), mobile-first breakpoints, `--ease`, reduced motion, a Somali/English/Arabic string table, and an "Open questions" handover list |
| `ux-copy` | Kodaro voice cheat sheet (British English, honest, no hype, → / ↗ arrows), WhatsApp-first enquiry flows, and three-language product strings keyed like Jareeye's i18n |
| `accessibility-review` | House bar of 7:1 body text, clay focus ring, 44px targets and Lighthouse 100. Pre-verified contrast pairs for both brands, plus React Native / TalkBack / RTL checks |
| `research-synthesis` | Kodaro inputs (discovery notes, WhatsApp threads, preview feedback, Somali-language testing) and recommendations tagged by process stage |
| `user-research` | A client discovery-call script that feeds the written quote, a local fieldwork playbook (Somali-first, own device, real network) and AOMS safeguards |

## Commands

| Command | Example |
|---|---|
| `/design-critique` | `/design-critique https://kodaro-website.vercel.app/services/` |
| `/design-system` | `/design-system audit Jareeye theme` |
| `/design-handoff` | `/design-handoff Jareeye rider onboarding screen (Expo)` |
| `/ux-copy` | `/ux-copy empty state for "no riders nearby" in Jareeye` |
| `/accessibility-review` | `/accessibility-review client landing page for a Hargeisa clinic` |
| `/research-synthesis` | `/research-synthesis` + paste discovery or usability notes |

## Updating the brand

Edit **BRAND.md** only. All skills reference it. Re-check contrast whenever a colour token changes.

## Connectors

See [CONNECTORS.md](CONNECTORS.md). All skills work standalone; connectors add live data.
