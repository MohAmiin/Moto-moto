---
name: design-critique
description: Get structured design feedback on usability, hierarchy, consistency and fit with the Kodaro or Jareeye brand. Trigger with "review this design", "critique this mockup", "what do you think of this screen?", or when sharing a Figma link, screenshot or live URL for a Kodaro website, client project, AOMS or Jareeye at any stage from exploration to final polish.
argument-hint: "<Figma URL, screenshot, or description>"
---

# /design-critique

> If you see unfamiliar placeholders or need to check which tools are connected, see [CONNECTORS.md](../../CONNECTORS.md).
> **Kodaro house context:** read [BRAND.md](../../BRAND.md) before starting. It holds Kodaro's and Jareeye's tokens, voice, quality bar and audiences.

Get structured design feedback across multiple dimensions.

## Usage

```
/design-critique $ARGUMENTS
```

Review the design: @$1

If a Figma URL is provided, pull the design from Figma. If a file is referenced, read it. Otherwise, ask the user to describe or share their design.

## What I Need From You

- **The design**: Figma URL, screenshot, or detailed description
- **Context**: What is this? Who is it for? What stage (exploration, refinement, final)?
- **Focus** (optional): "Focus on mobile" or "Focus on the onboarding flow"

## Critique Framework

### 1. First Impression (2 seconds)
- What draws the eye first? Is that correct?
- What's the emotional reaction?
- Is the purpose immediately clear?

### 2. Usability
- Can the user accomplish their goal?
- Is the navigation intuitive?
- Are interactive elements obvious?
- Are there unnecessary steps?

### 3. Visual Hierarchy
- Is there a clear reading order?
- Are the right elements emphasized?
- Is whitespace used effectively?
- Is typography creating the right hierarchy?

### 4. Consistency
- Does it follow the design system?
- Are spacing, colors, and typography consistent?
- Do similar elements behave similarly?

### 5. Accessibility
- Color contrast ratios
- Touch target sizes
- Text readability
- Alternative text for images

### 6. Kodaro Fit
First identify **which brand** the design belongs to: Kodaro (company site), a **client** brand, AOMS, or Jareeye. Judge it against that brand's tokens in BRAND.md, and never push Kodaro's cream and green onto a client or onto Jareeye.
- **Goal clarity:** does the page drive one obvious next step (an enquiry, "Start your project →", a WhatsApp chat or a booking)?
- **Trust & honesty:** are there real screens, honest status labels and sample data marked as sample data? Flag any invented testimonials or metrics.
- **Mobile-first reality:** does it work on a mid-range Android phone with one hand on a slow connection? Are images sized and WebP?
- **Three promises:** does anything create lock-in (a proprietary builder, or a third-party widget the client can't own)?
- **Multilingual (products):** will it hold up in Somali (often longer strings) and mirrored for Arabic RTL?
- **Operational clarity (AOMS):** can the information be read at a glance during a busy shift, and does it support a clean handover?

## How to Give Feedback

- **Be specific**: "The CTA competes with the navigation" not "the layout is confusing"
- **Explain why**: Connect feedback to design principles or user needs
- **Suggest alternatives**: Don't just identify problems, propose solutions
- **Acknowledge what works**: Good feedback includes positive observations
- **Match the stage**: Early exploration gets different feedback than final polish

## Output

```markdown
## Design Critique: [Design Name]

### Overall Impression
[1-2 sentence first reaction — what works, what's the biggest opportunity]

### Usability
| Finding | Severity | Recommendation |
|---------|----------|----------------|
| [Issue] | 🔴 Critical / 🟡 Moderate / 🟢 Minor | [Fix] |

### Visual Hierarchy
- **What draws the eye first**: [Element] — [Is this correct?]
- **Reading flow**: [How does the eye move through the layout?]
- **Emphasis**: [Are the right things emphasized?]

### Consistency
| Element | Issue | Recommendation |
|---------|-------|----------------|
| [Typography/spacing/color] | [Inconsistency] | [Fix] |

### Accessibility
- **Color contrast**: [Pass/fail for key text]
- **Touch targets**: [Adequate size?]
- **Text readability**: [Font size, line height]

### Kodaro Fit
- **Brand:** [Kodaro / Client: name / AOMS / Jareeye], and whether it is on-token
- **Primary goal & CTA:** [What it is, and whether it is obvious]
- **Trust & honesty:** [Real screens? Honest labels?]
- **Mobile-first / low bandwidth:** [Assessment]
- **Multilingual / RTL:** [If a product]

### What Works Well
- [Positive observation 1]
- [Positive observation 2]

### Priority Recommendations
1. **[Most impactful change]** — [Why and how]
2. **[Second priority]** — [Why and how]
3. **[Third priority]** — [Why and how]
```

## If Connectors Available

If **~~design tool** is connected:
- Pull the design directly from Figma and inspect components, tokens, and layers
- Compare against the existing design system for consistency

If **~~user feedback** is connected:
- Cross-reference design decisions with recent user feedback and support tickets

## Tips

1. **Share the context**, e.g. "Business site for a Hargeisa logistics firm, goal is WhatsApp enquiries" or "Jareeye rider onboarding".
2. **Specify your stage** — Early exploration gets different feedback than final polish.
3. **Ask me to focus** — "Just look at the navigation" gives you more depth on one area.
