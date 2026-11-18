# Connectors

## How tool references work

Plugin files use `~~category` as a placeholder for whatever tool the user connects in that category. For example, `~~design tool` might mean Figma, Sketch, or any other design tool with an MCP server.

Plugins are **tool-agnostic** — they describe workflows in terms of categories (design tool, project tracker, user feedback, etc.) rather than specific products. The `.mcp.json` pre-configures specific MCP servers, but any MCP server in that category works.

## Connectors for this plugin

| Category | Placeholder | Included servers | Other options |
|----------|-------------|-----------------|---------------|
| Chat | `~~chat` | Slack | Microsoft Teams |
| Design tool | `~~design tool` | Figma | Sketch, Adobe XD, Framer |
| Knowledge base | `~~knowledge base` | Notion | Confluence, Guru, Coda |
| Project tracker | `~~project tracker` | Linear, Asana, Atlassian (Jira/Confluence) | Shortcut, ClickUp |
| User feedback | `~~user feedback` | Intercom | Productboard, Canny, UserVoice, Dovetail |
| Product analytics | `~~product analytics` | — | Amplitude, Mixpanel, Heap, FullStory |

## Kodaro's working stack

Kodaro's day-to-day tools aren't all MCP connectors, but the skills assume them:

| Tool | Used for | How the skills treat it |
|---|---|---|
| **GitHub** | Source code (client sites, Jareeye, AOMS) | Design-system audits and handoffs can read `site.css` / `src/constants/theme.ts` straight from the repo |
| **Vercel** | Hosting and preview links (the weekly "progress every week" promise) | Critiques and a11y audits can take a preview URL |
| **Supabase** | App back end (Jareeye) | Handoffs note data and loading/empty/error states |
| **Gmail** | Email enquiries and client threads | Research synthesis can pull enquiry threads (remove personal details first) |
| **WhatsApp** | Primary client and customer channel | No MCP. Paste exported chats into `/research-synthesis` |

The connectors in `.mcp.json` (Figma, Notion, Linear, Asana, Atlassian, Intercom, Slack) are kept from the original plugin. Remove any Kodaro doesn't use.
