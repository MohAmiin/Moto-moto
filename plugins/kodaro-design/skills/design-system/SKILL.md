---
name: design-system
description: "Audit, document, or extend Kodaro's design systems: the Kodaro website tokens (Fraunces / Instrument Sans, ink and cream) and the Jareeye app theme (Rubik, royal blue and orange). Use when checking for naming inconsistencies or hardcoded values, documenting a component's variants, states and accessibility, designing a new pattern, or setting up a starter system for a client project."
argument-hint: "[audit | document | extend] <component or system>"
---

# /design-system

> If you see unfamiliar placeholders or need to check which tools are connected, see [CONNECTORS.md](../../CONNECTORS.md).
> **Kodaro house context:** read [BRAND.md](../../BRAND.md) before starting. It holds Kodaro's and Jareeye's tokens, voice, quality bar and audiences.

Manage your design system — audit for consistency, document components, or design new patterns.

## Usage

```
/design-system audit                    # Full system audit
/design-system document [component]     # Document a component
/design-system extend [pattern]         # Design a new component or pattern
```

## Components of a Design System

### Design Tokens
Atomic values that define the visual language:
- Colors (brand, semantic, neutral)
- Typography (scale, weights, line heights)
- Spacing (scale, component padding)
- Borders (radius, width)
- Shadows (elevation levels)
- Motion (durations, easings)

### Components
Reusable UI elements with defined:
- Variants (primary, secondary, ghost)
- States (default, hover, active, disabled, loading, error)
- Sizes (sm, md, lg)
- Behavior (interactions, animations)
- Accessibility (ARIA, keyboard)

### Patterns
Common UI solutions combining components:
- Forms (input groups, validation, submission)
- Navigation (sidebar, tabs, breadcrumbs)
- Data display (tables, cards, lists)
- Feedback (toasts, modals, inline messages)

## Kodaro's Systems

There are **two existing systems** plus a starter for client work. Confirm which one you're in before auditing. Full token tables are in BRAND.md.

| System | Lives in | Format | Key conventions |
|---|---|---|---|
| **Kodaro web** | `assets/site.css` on the Kodaro site | CSS custom properties on `:root` | Two naming layers: raw (`--ink`, `--cream`, `--clay`) and semantic theme slots (`--ground`, `--panel`, `--mist`, `--focus`). Fonts: Fraunces, Instrument Sans, JetBrains Mono. Easing `--ease`. |
| **Jareeye app** | `src/constants/theme.ts` | TS objects: `Colors.light` / `Colors.dark`, `Spacing`, `Radius`, `Fonts` | Semantic names (`text`, `brand`, `gold`, `onGold`). Spacing is named `half…six`. Every colour needs a light **and** dark value. |
| **Client starter** | New per project | CSS variables (web) or a `theme.ts` (Expo) | Copy Kodaro's *structure*, not its colours. The client's brand gets raw tokens plus semantic slots, with contrast checked at creation. |

### Known debt to flag in audits
- **Kodaro web:** legacy slot names don't match their values (`--gold`, `--navy`, `--ivory` and `--brass` hold green, ink and clay). Propose a renaming map (`--gold` → `--accent`, `--brass` → `--clay-text`) with aliases kept for one release.
- **Kodaro web:** `--muted #5B6B63` fails AA on cream-2 (4.45:1) and is superseded by `--mist`. Mark it deprecated.
- **Kodaro web:** the radius sprawl (10, 13, 14, 18, 26, 30px …) should consolidate to 4 / 8 / 12 / 16 / 22 / 28 / pill.
- **Jareeye:** the `gold` / `onGold` slots hold **orange**. Consider renaming to `action` / `onAction`.
- **Jareeye:** `textSecondary` on `backgroundElement` is 4.4:1 in light mode (fails AA). Darken it to about `#5F6779`.
- **Jareeye:** `success #1F8A5B` is 4.33:1 on white (fails for small text). Darken it to about `#1A7A50`.
- **Jareeye:** no motion or typography-scale tokens exist yet. Propose `Type` (size and line height) and `Motion` (durations) objects.

When auditing code, search for hardcoded hex values, raw `px` numbers, `fontWeight` without `fontFor()` (Jareeye, Android) and colours missing a dark variant.

## Principles

1. **Consistency over creativity** — The system exists so teams don't reinvent the wheel
2. **Flexibility within constraints** — Components should be composable, not rigid
3. **Document everything** — If it's not documented, it doesn't exist
4. **Version and migrate** — Breaking changes need migration paths

## Output — Audit

```markdown
## Design System Audit

### Summary
**Components reviewed:** [X] | **Issues found:** [X] | **Score:** [X/100]

### Naming Consistency
| Issue | Components | Recommendation |
|-------|------------|----------------|
| [Inconsistent naming] | [List] | [Standard to adopt] |

### Token Coverage
| Category | Defined | Hardcoded Values Found |
|----------|---------|----------------------|
| Colors | [X] | [X] instances of hardcoded hex |
| Spacing | [X] | [X] instances of arbitrary values |
| Typography | [X] | [X] instances of custom fonts/sizes |

### Component Completeness
| Component | States | Variants | Docs | Score |
|-----------|--------|----------|------|-------|
| Button | ✅ | ✅ | ⚠️ | 8/10 |
| Input | ✅ | ⚠️ | ❌ | 5/10 |

### Priority Actions
1. [Most impactful improvement]
2. [Second priority]
3. [Third priority]
```

## Output — Document

```markdown
## Component: [Name]

### Description
[What this component is and when to use it]

### Variants
| Variant | Use When |
|---------|----------|
| [Primary] | [Main actions] |
| [Secondary] | [Supporting actions] |

### Props / Properties
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| [prop] | [type] | [default] | [description] |

### States
| State | Visual | Behavior |
|-------|--------|----------|
| Default | [description] | — |
| Hover | [description] | [interaction] |
| Active | [description] | [interaction] |
| Disabled | [description] | Non-interactive |
| Loading | [description] | [animation] |

### Accessibility
- **Role**: [ARIA role]
- **Keyboard**: [Tab, Enter, Escape behavior]
- **Screen reader**: [Announced as...]

### Do's and Don'ts
| ✅ Do | ❌ Don't |
|------|---------|
| [Best practice] | [Anti-pattern] |

### Code Example
[Kodaro web: semantic HTML + CSS custom properties. Jareeye: React Native / Expo Router component using `useTheme()`, `Spacing`, `Radius` and `fontFor()`.]
```

## Output — Extend

```markdown
## New Component: [Name]

### Problem
[What user need or gap this component addresses]

### Existing Patterns
| Related Component | Similarity | Why It's Not Enough |
|-------------------|-----------|---------------------|
| [Component] | [What's shared] | [What's missing] |

### Proposed Design

#### API / Props
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| [prop] | [type] | [default] | [description] |

#### Variants
| Variant | Use When | Visual |
|---------|----------|--------|
| [Variant] | [Scenario] | [Description] |

#### States
| State | Behavior | Notes |
|-------|----------|-------|
| Default | [Description] | — |
| Hover | [Description] | [Interaction] |
| Disabled | [Description] | Non-interactive |
| Loading | [Description] | [Animation] |

#### Tokens Used
- Colors: [Which tokens]
- Spacing: [Which tokens]
- Typography: [Which tokens]

### Accessibility
- **Role**: [ARIA role]
- **Keyboard**: [Expected interactions]
- **Screen reader**: [Announced as...]

### Open Questions
- [Decision that needs design review]
- [Edge case to resolve]
```

## If Connectors Available

If **~~design tool** is connected:
- Audit components directly in Figma — check naming, variants, and token usage
- Pull component properties and layer structure for documentation

If **~~knowledge base** is connected:
- Search for existing component documentation and usage guidelines
- Publish updated documentation to your wiki

## Tips

1. **Start with an audit.** Say which system you mean: "audit Jareeye theme" or "audit Kodaro site tokens".
2. **Document as you build** — It's easier to document a component while designing it.
3. **Prioritize coverage over perfection** — 80% of components documented beats 100% of 10 components.
