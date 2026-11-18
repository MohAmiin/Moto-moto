---
name: research-synthesis
description: "Synthesize user and client research into themes, insights and recommendations for Kodaro projects: client discovery calls, WhatsApp enquiry threads, usability tests of Jareeye or AOMS, and website feedback. Use when you have interview notes, transcripts, surveys, usability notes, support messages or reviews to distil into patterns, segments and prioritised next steps."
argument-hint: "<research data, transcripts, or survey results>"
---

# /research-synthesis

> If you see unfamiliar placeholders or need to check which tools are connected, see [CONNECTORS.md](../../CONNECTORS.md).
> **Kodaro house context:** read [BRAND.md](../../BRAND.md) before starting. It holds Kodaro's and Jareeye's tokens, voice, quality bar and audiences.

Synthesize user research data into actionable insights. See the **user-research** skill for research methods, interview guides, and analysis frameworks.

## Usage

```
/research-synthesis $ARGUMENTS
```

## What I Accept

- Interview transcripts or notes
- Survey results (CSV, pasted data)
- Usability test recordings or notes
- Support tickets or feedback
- NPS/CSAT responses
- App store reviews

## Kodaro Sources & Lenses

**Typical inputs at Kodaro**
- **Discovery notes** (process stage *i*): how the client's business runs today, and what v1 must do.
- **WhatsApp / email enquiry threads.** These are often the richest signal of what prospects actually ask for. Remove phone numbers and names before quoting.
- **Weekly preview feedback** from clients reviewing the preview link.
- **Jareeye testing** with customers and riders in Hargeisa. Notes may be in Somali, so translate the quotes and keep the original alongside them.
- **AOMS walkthroughs** with controllers and airport staff. Use **sample data** only and never paste real operational records.

**Lenses to apply**
- **Context:** connectivity, device (Android-heavy, mid-range), language preference (so / en / ar), and WhatsApp-first habits.
- **Trust:** what makes a Somaliland business or user trust a website or app (real photos, local phone number, WhatsApp, clear prices or quotes).
- **Operational load** (AOMS): what slows a handover or causes a mis-read under pressure.
- **Map to Kodaro's process:** tag each recommendation as *Discovery*, *Design*, *Build* or *Care plan*.

## Output

```markdown
## Research Synthesis: [Study Name]
**Method:** [Interviews / Survey / Usability Test] | **Participants:** [X]
**Date:** [Date range] | **Researcher:** [Name]

### Executive Summary
[3-4 sentence overview of key findings]

### Key Themes

#### Theme 1: [Name]
**Prevalence:** [X of Y participants]
**Summary:** [What this theme is about]
**Supporting Evidence:**
- "[Quote]" — P[X]
- "[Quote]" — P[X]
**Implication:** [What this means for the product]

#### Theme 2: [Name]
[Same format]

### Insights → Opportunities

| Insight | Opportunity | Impact | Effort |
|---------|-------------|--------|--------|
| [What we learned] | [What we could do] | High/Med/Low | High/Med/Low |

_Tag each opportunity with a Kodaro stage: Discovery / Design / Build / Care plan._

### User Segments Identified
| Segment | Characteristics | Needs | Size |
|---------|----------------|-------|------|
| [Name] | [Description] | [Key needs] | [Rough %] |

### Recommendations
1. **[High priority]** — [Why, based on which findings]
2. **[Medium priority]** — [Why]
3. **[Lower priority]** — [Why]

### Questions for Further Research
- [What we still don't know]

### Methodology Notes
[How the research was conducted, any limitations or biases to note, languages used, how quotes were translated, and confirmation that personal data was removed]
```

## If Connectors Available

If **~~user feedback** is connected:
- Pull support tickets, feature requests, and NPS responses to supplement research data
- Cross-reference themes with real user complaints and requests

If **~~product analytics** is connected:
- Validate qualitative findings with usage data and behavioral metrics
- Quantify the impact of identified pain points

If **~~knowledge base** is connected:
- Search for prior research studies and findings to compare against
- Publish the synthesis to your research repository

## Tips

1. **Include raw quotes** — Direct participant quotes make insights credible and memorable.
2. **Separate observations from interpretations** — "5 of 8 users clicked the wrong button" is an observation. "The button placement is confusing" is an interpretation.
3. **Quantify where possible** — "Most users" is vague. "7 of 10 users" is specific.
