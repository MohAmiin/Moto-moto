---
name: accessibility-review
description: Run a WCAG 2.1 AA accessibility audit against Kodaro's higher house bar (7:1 or better body text, clay focus ring, full keyboard support, RTL and multilingual checks). Trigger with "audit accessibility", "check a11y", "is this accessible?", or when reviewing a Kodaro website, client project, AOMS or Jareeye design or page for contrast, keyboard navigation, touch targets or screen reader behaviour before handoff or launch.
argument-hint: "<Figma URL, URL, or description>"
---

# /accessibility-review

> If you see unfamiliar placeholders or need to check which tools are connected, see [CONNECTORS.md](../../CONNECTORS.md).
> **Kodaro house context:** read [BRAND.md](../../BRAND.md) before starting. It holds Kodaro's and Jareeye's tokens, voice, quality bar and audiences.

Audit a design or page for WCAG 2.1 AA accessibility compliance.

## Usage

```
/accessibility-review $ARGUMENTS
```

Audit for accessibility: @$1

## WCAG 2.1 AA Quick Reference

### Perceivable
- **1.1.1** Non-text content has alt text
- **1.3.1** Info and structure conveyed semantically
- **1.4.3** Contrast ratio >= 4.5:1 (normal text), >= 3:1 (large text)
- **1.4.11** Non-text contrast >= 3:1 (UI components, graphics)

### Operable
- **2.1.1** All functionality available via keyboard
- **2.4.3** Logical focus order
- **2.4.7** Visible focus indicator
- **2.5.5** Touch target >= 44x44 CSS pixels

### Understandable
- **3.2.1** Predictable on focus (no unexpected changes)
- **3.3.1** Error identification (describe the error)
- **3.3.2** Labels or instructions for inputs

### Robust
- **4.1.2** Name, role, value for all UI components

## Kodaro House Bar (beyond AA)

| Check | AA requirement | Kodaro target |
|---|---|---|
| Body text contrast | 4.5:1 | **≥ 7:1** (site ships 11.5–12.9:1) |
| Secondary text | 4.5:1 | ≥ 4.5:1 on *every* surface it sits on, including panels |
| Focus indicator | Visible | Clay `#C4703F` outline, ≥ 2px, offset; 3.99:1 on ink, 3.22:1 on cream |
| Touch targets | 24×24 (2.2) / 44×44 (AAA) | **44×44 minimum**, 48×48 for primary mobile actions |
| Lighthouse Accessibility | — | **100** |
| Reduced motion | — | Honour `prefers-reduced-motion` / RN `AccessibilityInfo.isReduceMotionEnabled` |
| Languages | 3.1.1 / 3.1.2 | `lang` set per page and per passage. Arabic gets `dir="rtl"` and mirrored layout. |

### Pre-verified pairs (no need to recompute)
**Kodaro:** ink/cream 12.85 ✅ · ink/paper 13.88 ✅ · accent `#1F4D3F`/cream 8.43 ✅ · mist/cream 5.34 ✅ · mist/cream-2 4.79 ✅ · clay-deep/cream 5.11 ✅ · ⚠️ muted `#5B6B63`/cream-2 4.45 ❌ · ⚠️ clay `#C4703F`/cream 3.22 (large text and UI only) · ⚠️ sage/cream 2.25 (decorative only)

**Jareeye (light):** text/white 18.68 ✅ · white/brand 8.26 ✅ · onGold/orange 5.6 ✅ · danger/white 5.31 ✅ · warning/white 5.05 ✅ · textSecondary/white 4.76 ✅ · ⚠️ textSecondary/backgroundElement 4.40 ❌ · ⚠️ success/white 4.33 ❌ small text · ❌ white/orange 2.85, never use
**Jareeye (dark):** text/bg 16.51 ✅ · textSecondary/bg 7.39 ✅ · textSecondary/element 6.27 ✅ · onBrand/brand `#FF8A3D` 6.81 ✅

### React Native / Expo checks (Jareeye and other apps)
- `accessibilityLabel`, `accessibilityRole` and `accessibilityState` on every Pressable.
- Font scaling: test at the largest system text size. Avoid `allowFontScaling={false}`.
- TalkBack (Android, the primary platform locally) **and** VoiceOver.
- Phone numbers and "Call rider" actions must be reachable and announced clearly.
- Maps (live map) need a non-visual alternative: a list of nearby riders with distances.

## Common Issues

1. Insufficient color contrast
2. Missing form labels
3. No keyboard access to interactive elements
4. Missing alt text on meaningful images
5. Focus traps in modals
6. Missing ARIA landmarks
7. Auto-playing media without controls
8. Time limits without extension options

## Testing Approach

1. Automated scan (catches ~30% of issues)
2. Keyboard-only navigation
3. Screen reader testing (VoiceOver, NVDA, **TalkBack** for Android apps)
4. Color contrast verification
5. Zoom to 200%: does the layout break?
6. Switch to Arabic (RTL) and Somali: does anything clip, overlap or read in the wrong order?
7. Run Lighthouse mobile (target Accessibility 100).

## Output

```markdown
## Accessibility Audit: [Design/Page Name]
**Standard:** WCAG 2.1 AA | **Date:** [Date]

### Summary
**Issues found:** [X] | **Critical:** [X] | **Major:** [X] | **Minor:** [X]

### Findings

#### Perceivable
| # | Issue | WCAG Criterion | Severity | Recommendation |
|---|-------|---------------|----------|----------------|
| 1 | [Issue] | [1.4.3 Contrast] | 🔴 Critical | [Fix] |

#### Operable
| # | Issue | WCAG Criterion | Severity | Recommendation |
|---|-------|---------------|----------|----------------|
| 1 | [Issue] | [2.1.1 Keyboard] | 🟡 Major | [Fix] |

#### Understandable
| # | Issue | WCAG Criterion | Severity | Recommendation |
|---|-------|---------------|----------|----------------|
| 1 | [Issue] | [3.3.2 Labels] | 🟢 Minor | [Fix] |

#### Robust
| # | Issue | WCAG Criterion | Severity | Recommendation |
|---|-------|---------------|----------|----------------|
| 1 | [Issue] | [4.1.2 Name, Role, Value] | 🟡 Major | [Fix] |

### Color Contrast Check
| Element | Foreground | Background | Ratio | Required | Pass? |
|---------|-----------|------------|-------|----------|-------|
| [Body text] | [color] | [color] | [X]:1 | 4.5:1 (Kodaro: 7:1) | ✅/❌ |

### Keyboard Navigation
| Element | Tab Order | Enter/Space | Escape | Arrow Keys |
|---------|-----------|-------------|--------|------------|
| [Element] | [Order] | [Behavior] | [Behavior] | [Behavior] |

### Screen Reader
| Element | Announced As | Issue |
|---------|-------------|-------|
| [Element] | [What SR says] | [Problem if any] |

### Priority Fixes
1. **[Critical fix]** — Affects [who] and blocks [what]
2. **[Major fix]** — Improves [what] for [who]
3. **[Minor fix]** — Nice to have
```

## If Connectors Available

If **~~design tool** is connected:
- Inspect color values, font sizes, and touch targets directly from Figma
- Check component ARIA roles and keyboard behavior in the design spec

If **~~project tracker** is connected:
- Create tickets for each accessibility finding with severity and WCAG criterion
- Link findings to existing accessibility remediation epics

## Tips

1. **Start with contrast and keyboard** — These catch the most common and impactful issues.
2. **Test with real assistive technology** — My audit is a great start, but manual testing with VoiceOver/NVDA catches things I can't.
3. **Prioritize by impact** — Fix issues that block users first, polish later.
