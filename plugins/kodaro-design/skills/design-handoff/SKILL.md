---
name: design-handoff
description: "Generate developer handoff specs from a design, using Kodaro's or Jareeye's real tokens. Use when a design is ready for build and needs a spec sheet covering layout, tokens, component props, states, responsive and mobile behaviour, RTL and multilingual cases, edge cases and motion. Output matches Kodaro's stacks: static and semantic HTML/CSS for websites, Expo Router and React Native for apps."
argument-hint: "<Figma URL or design description>"
---

# /design-handoff

> If you see unfamiliar placeholders or need to check which tools are connected, see [CONNECTORS.md](../../CONNECTORS.md).
> **Kodaro house context:** read [BRAND.md](../../BRAND.md) before starting. It holds Kodaro's and Jareeye's tokens, voice, quality bar and audiences.

Generate comprehensive developer handoff documentation from a design.

## Usage

```
/design-handoff $ARGUMENTS
```

Generate handoff specs for: @$1

If a Figma URL is provided, pull the design from Figma. Otherwise, work from the provided description or screenshot.

## What to Include

### Visual Specifications
- Exact measurements (padding, margins, widths)
- Design token references (colors, typography, spacing)
- Responsive breakpoints and behavior
- Component variants and states

### Interaction Specifications
- Click/tap behavior
- Hover states
- Transitions and animations (duration, easing)
- Gesture support (swipe, pinch, long-press)

### Content Specifications
- Character limits
- Truncation behavior
- Empty states
- Loading states
- Error states

### Edge Cases
- Minimum/maximum content
- International text (longer strings)
- Slow connections
- Missing data

### Accessibility
- Focus order
- ARIA labels and roles
- Keyboard interactions
- Screen reader announcements

## Kodaro Defaults

- **Know the stack:**
  - *Websites:* semantic HTML + CSS custom properties, self-hosted fonts, WebP images at sized variants, deployed on Vercel.
  - *Apps (Jareeye-style):* Expo + Expo Router (`src/app/`), React Native, Supabase, with `theme.ts` tokens and `useTheme()`. Native config goes in `app.json`, never in hand-edited `ios/` or `android/`.
- **Name real tokens.** Use `--ink`, `--ground`, `--mist`, `--focus` (web) or `Colors.brand`, `Spacing.three`, `Radius.medium` (Jareeye). Never use raw hex unless proposing a new token.
- **Motion:** web uses `--ease: cubic-bezier(.2,.7,.1,1)`. Keep durations at 150–300ms and always specify `prefers-reduced-motion` behaviour.
- **Focus:** a clay (`--focus #C4703F`) visible outline on every interactive element.
- **Mobile-first breakpoints:** spec the phone layout first (360px), then 768px, then 1024px+.
- **Multilingual (products):** specify the Somali, English and Arabic strings, RTL mirroring (icons, chevrons, swipe direction), and LTR-isolated numbers in Arabic.
- **Low bandwidth:** specify skeletons, image sizes, and what still works offline or on slow 3G.
- **Handover discipline:** the founder's ATC background means a handover leaves nothing implicit. Include an **"Open questions / assumptions"** list so nothing goes unsaid.
- **Process alignment:** handoff happens at the end of stage *ii. Design*, after the client has reviewed clickable screens. State the client-approved version or date.

## Principles

1. **Don't assume** — If it's not specified, the developer will guess. Specify everything.
2. **Use tokens, not values** — Reference `spacing-md` not `16px`.
3. **Show all states** — Default, hover, active, disabled, loading, error, empty.
4. **Describe the why** — "This collapses on mobile because users primarily use one-handed" helps developers make good judgment calls.

## Output

```markdown
## Handoff Spec: [Feature/Screen Name]

### Overview
[What this screen/feature does, user context]

### Layout
[Grid system, breakpoints, responsive behavior]

### Design Tokens Used
| Token | Value | Usage |
|-------|-------|-------|
| `--ink` / `Colors.brand` | #[hex] | Primary CTA background |
| `--mist` / `Colors.textSecondary` | #[hex] | Secondary text |
| `Spacing.three` / [web spacing] | 16px | Between sections |
| Fraunces / Rubik 700 | [size/line-height] | Page title |

### Components
| Component | Variant | Props | Notes |
|-----------|---------|-------|-------|
| [Component] | [Variant] | [Props] | [Special behavior] |

### States and Interactions
| Element | State | Behavior |
|---------|-------|----------|
| [CTA Button] | Hover | [Background darken 10%] |
| [CTA Button] | Loading | [Spinner, disabled] |
| [Form] | Error | [Red border, error message below] |

### Responsive Behavior
| Breakpoint | Changes |
|------------|---------|
| Phone (360–767px) **base** | [Default layout] |
| Tablet (768–1023px) | [What changes] |
| Desktop (≥1024px) | [What changes] |

### Edge Cases
- **Empty state**: [What to show when no data]
- **Long text**: [Truncation rules]
- **Loading**: [Skeleton or spinner]
- **Error**: [Error state appearance]

### Animation / Motion
| Element | Trigger | Animation | Duration | Easing |
|---------|---------|-----------|----------|--------|
| [Element] | [Trigger] | [Description] | [ms] | [easing] |

### Accessibility Notes
- [Focus order; clay focus ring]
- [ARIA labels / `accessibilityLabel` + `accessibilityRole` (RN)]
- [Keyboard interactions]
- [Touch targets ≥ 44×44]

### Multilingual & RTL (products)
| String key | Somali (source) | English | Arabic | Max length |
|---|---|---|---|---|
| [`screen.key`] | [so] | [en] | [ar] | [chars] |
- RTL mirroring: [What flips, what doesn't]

### Open Questions / Assumptions
- [Anything not specified in the design]
```

## If Connectors Available

If **~~design tool** is connected:
- Pull exact measurements, tokens, and component specs from Figma
- Export assets and generate a complete spec sheet

If **~~project tracker** is connected:
- Link the handoff to the implementation ticket
- Create sub-tasks for each section of the spec

## Tips

1. **Share the Figma link** — I can pull exact measurements, tokens, and component info.
2. **Mention edge cases** — "What happens with 100 items?" helps me spec boundary conditions.
3. **Say which stack**: "Kodaro website (HTML/CSS)", "Jareeye (Expo)" or "client web app". Otherwise I default to the closest Kodaro stack.
