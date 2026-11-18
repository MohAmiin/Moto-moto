---
name: ux-copy
description: "Write or review UX copy in Kodaro's voice: plain, precise, honest, warm, in British English. Covers microcopy, CTAs, error messages, empty states, enquiry and WhatsApp flows, and Somali / English / Arabic strings for products like Jareeye. Trigger with \"write copy for\", \"what should this button say?\", \"review this error message\", or when naming a CTA, wording a confirmation, filling an empty state, or writing website headlines."
argument-hint: "<context or copy to review>"
---

# /ux-copy

> If you see unfamiliar placeholders or need to check which tools are connected, see [CONNECTORS.md](../../CONNECTORS.md).
> **Kodaro house context:** read [BRAND.md](../../BRAND.md) before starting. It holds Kodaro's and Jareeye's tokens, voice, quality bar and audiences.

Write or review UX copy for any interface context.

## Usage

```
/ux-copy $ARGUMENTS
```

## What I Need From You

- **Context**: What screen, flow, or feature?
- **User state**: What is the user trying to do? How are they feeling?
- **Brand**: Kodaro (default voice), a client (share their voice), or Jareeye (friendly, everyday, Somali-first)?
- **Constraints**: Character limits, platform guidelines?

## Principles

1. **Clear**: Say exactly what you mean. No jargon, no ambiguity.
2. **Concise**: Use the fewest words that convey the full meaning.
3. **Consistent**: Same terms for the same things everywhere.
4. **Useful**: Every word should help the user accomplish their goal.
5. **Human**: Write like a helpful person, not a robot.
6. **Honest** (Kodaro): never overstate. Use "Not yet launched" and "Shown with sample data". Use proof, not adjectives.
7. **British English** (Kodaro): colour, organisation, enquiry, licence.

## Kodaro Voice Cheat Sheet
| Do | Don't |
|---|---|
| "Start your project →" | "Get Started Now!" |
| "Request a quote →" | "Contact Sales" |
| "Chat on WhatsApp ↗" | "Reach out" |
| "The first conversation is free, with no obligation." | "100% FREE consultation!!!" |
| "No technical brief needed." | "Leverage our seamless solutions" |
| "Yours to keep. No lock-in." | "Industry-leading flexibility" |
| "Lighthouse mobile 99 / 100 / 100 / 100" | "Blazing-fast performance" |

- **Arrows:** → for internal navigation, ↗ for leaving the site (WhatsApp, email, external).
- **Headlines:** a short claim over two lines, with the second line as the payoff ("From idea to / launch.").
- **Section eyebrows:** "01 — What we build".
- **No** exclamation marks, emoji or hype words in UI copy.

## Copy Patterns

### CTAs
- Start with a verb: "Start free trial", "Save changes", "Download report"
- Be specific: "Create account" not "Submit"
- Match the outcome to the label

### Error Messages
Structure: What happened + Why + How to fix
- "Payment declined. Your card was declined by your bank. Try a different card or contact your bank."

### Empty States
Structure: What this is + Why it's empty + How to start
- "No projects yet. Create your first project to start collaborating with your team."

### Confirmation Dialogs
- Make the action clear: "Delete 3 files?" not "Are you sure?"
- Describe consequences: "This can't be undone"
- Label buttons with the action: "Delete files" / "Keep files" not "OK" / "Cancel"

### Tooltips
- Concise, helpful, never obvious

### Loading States
- Set expectations, reduce anxiety

### Onboarding
- Progressive disclosure, one concept at a time

### Enquiry & Contact Flows (Kodaro sites)
- Offer **WhatsApp first**, email second. Many users in the region message businesses on WhatsApp before anything else.
- State what happens to their data: "Both options open a draft; nothing is sent automatically."
- Lower the barrier: "A few words about it" beats "Project requirements".

### Product Strings (Jareeye and other multilingual apps)
- **Somali is the source language.** Every key exists in Somali first, then English (default) and Arabic.
- Return **all three** strings, keyed like `screen.element` (e.g. `signin.headline`, `err.smsFailed`).
- Somali often runs **20–40% longer** than English, so check layout limits.
- In Arabic, wrap Latin numbers in LTR isolates (`\u2066…\u2069`) and mind RTL punctuation.
- Errors follow the house pattern: what happened + what to do ("The SMS couldn't be sent. Check the number and try again.")

## Voice and Tone

Adapt tone to context:
- **Success**: Celebratory but not over the top
- **Error**: Empathetic and helpful
- **Warning**: Clear and actionable
- **Neutral**: Informative and concise

## Output

```markdown
## UX Copy: [Context]

### Recommended Copy
**[Element]**: [Copy]

### Alternatives
| Option | Copy | Tone | Best For |
|--------|------|------|----------|
| A | [Copy] | [Tone] | [When to use] |
| B | [Copy] | [Tone] | [When to use] |
| C | [Copy] | [Tone] | [When to use] |

### Rationale
[Why this copy works — user context, clarity, action-orientation]

### Localisation
| Key | Somali | English | Arabic |
|---|---|---|---|
| [`screen.key`] | [so] | [en] | [ar] |

[Notes: idioms to avoid, length expansion, RTL, cultural context for Somaliland]
```

## If Connectors Available

If **~~knowledge base** is connected:
- Pull your brand voice guidelines and content style guide
- Check for existing copy patterns and terminology standards

If **~~design tool** is connected:
- View the screen context in Figma to understand the full user flow
- Check character limits and layout constraints from the design

## Tips

1. **Be specific about context** — "Error message when payment fails" is better than "error message."
2. **Kodaro voice is the default.** For a client project, paste their voice notes or website and I'll match them instead.
3. **Consider the user's emotional state** — Error messages need empathy. Success messages can celebrate.
