# Kodaro — Brand & Studio Reference

Every skill in this plugin reads this file first. It is the source of truth for who Kodaro is, how it looks, how it writes, and the quality bar it holds. When a user's request conflicts with this file, follow the user and point out the difference.

Source: kodaro-website.vercel.app (home, About, Services, Contact) and the Jareeye app codebase, read November 2026.

---

## 1. Who we are

**Kodaro** is a software company in **Hargeisa, Somaliland**, working with clients anywhere, remotely. It was founded in 2026 by **Mohamed A. A. Hassan**, Founder & Lead Engineer, who is also an air traffic controller.

- **Name:** *kod* ("code" in many languages) + *-aro* = **"code, crafted with care."**
- **Tagline:** *Software · Design · Digital Products*
- **Headline promise:** "We design websites that win clients."
- **Mission:** give growing organisations the kind of software that large companies take for granted, and build Kodaro's own products.
- **Operational DNA:** the founder's air-traffic background shapes the work: attention to everyday tasks, clear records and careful handovers. Use that lens in critiques and handoffs, and ask: "Would this survive a busy shift?"

### What we build (client work)
| Service | Notes |
|---|---|
| Portfolio websites | Professionals, freelancers, job seekers, developers, designers, students, graduates. Custom design, CV download, project showcases. |
| Business & company websites | Builds trust and turns visitors into **enquiries**. Design & copy, search visibility, hosting & domain. |
| Personal branding | One identity across site, profiles and pitch. |
| Landing pages | One page built around a single call to action. |
| Custom web applications | Portals, dashboards and operations systems. Staff logins & roles, reports & exports, data migration. |
| Design & branding | Logos & visual identity, social media graphics, print & marketing design. Available on its own. |
| Care plans | Monthly maintenance: monitoring & backups, security updates, small improvements. |

### Our own products
| Product | What it is | Status (say it honestly) |
|---|---|---|
| **AOMS** | Airport Operations Management System. A control-tower platform that replaces paper logs and spreadsheets. | Development complete, not yet in operational use. Demos use **sample data** only. |
| **Jareeye** | Motorbike delivery in Hargeisa. Connects people with nearby approved riders. Expo / React Native app with Supabase. Somali, English and Arabic (right to left). | Prototype, in development. Not yet launched. |
| **Finance tools** | Business and personal finance templates. | In preparation. |

### Three promises (use them as review criteria)
1. **You own everything.** The code, the domain and the data are the client's. No lock-in, no hidden licences.
2. **Progress every week.** A preview link from week one.
3. **Built to last.** Tested, typed code with backups and monitoring, made to run for years.

### Process (align handoffs and plans to these stages)
| Stage | What happens | Typical time |
|---|---|---|
| i. Discovery | Learn how the business runs today. Agree on what v1 must do. | ~1 week |
| ii. Design | **Clickable screens reviewed with the client before any code is written.** | 1–2 weeks |
| iii. Build | Short cycles with progress the client can see and test every week. | 3–10 weeks |
| iv. Launch & care | Deployment, staff training, optional monthly care plan. | Ongoing |

A business website usually takes 2–3 weeks. A custom application takes 5–13 weeks before launch. There are no fixed packages: every project gets a **written quote** after a free first conversation.

---

## 2. Visual identity: Kodaro (company brand)

The look is editorial and warm: deep forest-green ink on cream paper, a clay accent, a serif display face with a clean sans. Layouts are confident and generous, with numbered sections ("01 — What we build").

### Colour tokens (from site.css)
| Token | Hex | Role |
|---|---|---|
| `--ink` | `#0F2E25` | Primary text, dark fills, primary button background |
| `--ink-2` | `#163D31` | Dark surface variant |
| `--ink-3` / `--accent` | `#1F4D3F` | Accent green, links, emphasis |
| `--cream` / `--ground` | `#F4F0E8` | Page background |
| `--paper` | `#FBF9F4` | Raised surface / cards |
| `--cream-2` / `--panel` | `#EAE4D7` | Panels, bands |
| `--sage` | `#8FA897` | Decorative only (2.25:1 on cream, **never for text**) |
| `--clay` / `--focus` | `#C4703F` | Accent and **focus ring**. 3.2:1 on cream: large text, icons and outlines only. |
| `--clay-deep` / `--brass` | `#9A5229` | Clay for small text (5.1:1 on cream) |
| `--mist` | `#56665E` | Secondary text (5.3:1 on cream, 4.8:1 on cream-2) |
| `--muted` | `#5B6B63` | ⚠️ Legacy. 4.45:1 on cream-2 fails AA. Use `--mist`. |
| `--ok` | `#2E8A5F` | Success |
| `--line` / `--hair` | `rgba(15,46,37,.14)` | Hairlines and borders |
| `--field-border` | `#6F807A` | Form field borders (meets 3:1 non-text contrast) |

**Verified contrast:** ink on cream 12.85:1 · ink on paper 13.88:1 · ink on cream-2 11.53:1 · accent green on cream 8.43:1 · cream on ink 12.85:1.

### Typography
| Role | Family | Fallback |
|---|---|---|
| Display / headings | **Fraunces** (variable serif) | Georgia, "Times New Roman", serif |
| Body / UI | **Instrument Sans** (variable) | system-ui, "Segoe UI", sans-serif |
| Code, metrics, labels | **JetBrains Mono** | ui-monospace, Menlo, monospace |

Fonts are self-hosted. There are no third-party font or tracker requests.

### Shape, motion, texture
- **Radius scale in use:** 4, 6, 8, 10, 12, 14, 16, 18, 22, 28px, plus 999px for pills. When proposing tokens, consolidate to **4 / 8 / 12 / 16 / 22 / 28 / pill**.
- **Easing:** `--ease: cubic-bezier(.2, .7, .1, 1)`, a quick start with a soft landing.
- **Shadows:** green-tinted, never grey: `rgba(15,46,37,.12)` soft, `.30` standard, `.42` cast.
- **Grain:** a subtle paper grain overlay (opacity .05).
- **Signature details:** numbered section eyebrows ("01 —"), arrows on CTAs (→ internal, ↗ external), device mock-ups of real screens, honest status pills ("Live", "Web app", "Prototype · in development").

---

## 3. Visual identity: Jareeye (product brand)

Jareeye has its **own** brand, taken from its logo. Never mix it with Kodaro's palette. Source: `src/constants/theme.ts`.

| Token | Light | Dark | Notes |
|---|---|---|---|
| `text` | `#0D1220` | `#EEF1F7` | |
| `textSecondary` | `#6B7385` | `#9CA3B4` | ⚠️ Light: 4.76:1 on white but **4.4:1 on `backgroundElement` (fails AA)** |
| `background` | `#FFFFFF` | `#0D1220` | |
| `backgroundElement` | `#F4F6FA` | `#1A2236` | |
| `brand` (royal blue) | `#0046B5` | `#FF8A3D` | White on blue 8.26:1 |
| `gold` (orange action) | `#FF6B0A` | `#FF6B0A` | Pair with `onGold #14213D` (5.6:1). **White on orange is 2.85:1 and fails.** Never use orange for text on white. |
| `success` | `#1F8A5B` | `#4CC38A` | ⚠️ 4.33:1 on white: large or bold text only, or darken |
| `warning` | `#A95A12` | `#E3A84A` | 5.05:1 on white |
| `danger` | `#C23B2A` | `#EE7A68` | 5.31:1 on white |

- **Font:** Rubik (400 / 500 / 700 / 800). On Android, each weight is its own file, so use `fontFor(weight)` and not `fontWeight` alone.
- **Spacing:** 2, 4, 8, 16, 24, 32, 64 (`half` … `six`).
- **Radius:** 12 / 16 / 24 / pill.
- **Max content width:** 560.
- **Languages:** Somali is the source of truth (every key), then English (default) and Arabic (RTL). Wrap Latin-script numbers in LTR isolates (`⁦…⁩`) inside Arabic.
- **Platform:** Expo Router, iOS + Android + web. Supports light and dark mode.

---

## 4. Voice & writing

Kodaro writes like a calm, competent professional: **plain, precise, honest and warm.** It never uses hype.

**Rules**
1. **British English.** colour, organisation, enquiry, licence (noun), programme, favourite.
2. **Honest about status.** "Not yet launched." "Shown with sample data." "The founder's own portfolio, not a client project." Never inflate claims or invent clients, metrics or testimonials.
3. **Proof over adjectives.** Prefer "Lighthouse mobile 99 / 100 / 100 / 100, median of 9 runs" over "blazing fast".
4. **Short, confident sentences.** Fragments are fine in headlines: "Real work, real screens." "More than a template."
5. **Reassure, then remove friction.** "The first conversation is free, with no obligation." "No technical brief needed."
6. **Ownership language.** "Yours to keep." "No lock-in."
7. **Second person to the client, "we" for Kodaro.**
8. **Privacy plainly stated.** Say what is and isn't stored ("This website does not save your project brief to a database").

**CTA patterns:** verb first, then an arrow. → means an internal link; ↗ means it opens elsewhere (WhatsApp, email).
- "Start your project →" · "Request a quote →" · "Explore our work" · "Chat on WhatsApp ↗" · "Send by email instead ↗"

**Headline pattern:** a short claim, often split over two lines, with the second line carrying the payoff:
- "Websites, built around / your goals." · "From idea to / launch." · "Quality you can / rely on."

**Avoid:** "cutting-edge", "world-class", "revolutionary", "seamless", "leverage", "solutions" used as filler, exclamation marks, emoji in UI copy, and US spellings.

**Primary contact channel:** WhatsApp (+252 65 974 0002), then email. Many Somaliland users reach businesses on WhatsApp first, so flows should offer it.

---

## 5. Quality bar (non-negotiable)

| Area | Kodaro standard |
|---|---|
| Accessibility | WCAG 2.1 AA minimum. **Aim for 7:1 or better on body text** (the site ships 11.5:1 and 12.9:1). Full keyboard navigation and a visible clay focus ring. |
| Performance | Lighthouse mobile ≥ 95 on every category. Self-hosted fonts, WebP images at sized variants (e.g. `-380`, `-800`, `-1000`). |
| Responsive | Test on phones, tablets and large screens. Design **mobile-first**: most visitors in the region use phones, often on slower connections. |
| SEO & sharing | Title, description, sitemap and OG image (1200×630) on every page. |
| Ownership | Client owns the code, domain and content. No proprietary page builders. |
| Privacy | No third-party trackers by default. |
| Honesty | Real screens, real status labels, sample data labelled as sample data. |

---

## 6. Audiences to design for

- **Small and growing businesses in Somaliland and the diaspora.** Often mobile-only, WhatsApp-first, possibly on intermittent connectivity. Trust signals matter.
- **Individuals building a professional presence:** students, graduates, job seekers, freelancers.
- **Operational teams** (AOMS): air traffic controllers and airport staff. High stakes, shift handovers, glanceable status, zero ambiguity.
- **Everyday customers and riders** (Jareeye): Somali-speaking, Android-heavy, low-to-mid-range devices. Calling a rider is a primary action.

Multilingual by default for products: **Somali, English, Arabic (RTL)**.
