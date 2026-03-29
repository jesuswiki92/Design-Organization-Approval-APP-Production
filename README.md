# DOA Operations Hub

Internal web app for DOA operations work. The product is not intended to replace Odoo; it is evolving into a specialized DOA layer for quotations, project execution, tooling, and operational support around EASA Part 21J workflows.

## Current Product Direction

- Keep Odoo as the wider business system.
- Use this app as a focused DOA operations surface.
- Keep `quotations` and `projects` as separate workflows.
- Add AI-assisted tooling on top of the operational workflows.

## Current Runtime State

- Authentication is active through Supabase.
- The dashboard shell is active and protected by `proxy.ts`.
- `quotations` has its own route, list UI, state badges, and transition flow.
- `projects` has an operational workflow visible in engineering portfolio and project workspace.
- `tools/experto` is a live OpenRouter chat surface.
- `home` and parts of `tools` still contain product placeholders and are not yet fully production-grade.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16, App Router, TypeScript |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| State | Zustand |
| Backend / Auth | Supabase |
| AI chat | OpenRouter |
| Deployment | Docker / VPS |

## Local Development

### Prerequisites

- Node.js 20+
- npm
- Supabase project credentials
- OpenRouter API key if you want the AI chat to answer

### Environment

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
OPENROUTER_API_KEY=<openrouter-key>
OPENROUTER_MODEL=anthropic/claude-sonnet-4
```

### Install

```bash
npm install
```

### Run

Default script:

```bash
npm run dev
```

Stable fallback used during recent sanitation/debugging:

```bash
npm run dev -- --webpack --port 3000
```

If `localhost:3000` gives connection refused, first confirm the dev server is actually running.

## Current Route Surface

| Route | Purpose |
| --- | --- |
| `/login` | Auth entry |
| `/home` | Dashboard home |
| `/engineering/portfolio` | Project portfolio / operational view |
| `/engineering/projects/[id]` | Project workspace |
| `/quotations` | Commercial quotations workflow |
| `/clients` | Client records |
| `/databases` | Internal data browsing tools |
| `/tools` | Tool index |
| `/tools/experto` | OpenRouter-backed DOA assistant |

## Current Domain Model

The current runtime source of truth is the `doa_*` family of tables and types used by the active app surface.

The `doa_new_*` model still exists in docs, migration history, and some legacy type sections, but it is not the active runtime source for the current workflows. That mismatch is known technical debt and is being normalized conservatively.

See [CURRENT_DOMAIN_MODEL.md](./CURRENT_DOMAIN_MODEL.md) for the current domain and naming rules.

## Workflow Split

### Quotations

Commercial pipeline aligned with `SP-07`:

- `new`
- `unassigned`
- `ongoing`
- `pending_customer`
- `pending_internal`
- `rfi_sent`
- `quotation_sent`
- `won`
- `cancelled`

### Projects

Operational workflow aligned with `SP-08`:

- `op_00_prepay`
- `op_01_data_collection`
- `op_02_pending_info`
- `op_03_pending_tests`
- `op_04_under_evaluation`
- `op_05_in_work`
- `op_06_customer_review`
- `op_07_internal_review`
- `op_08_pending_signature`
- `op_09_pending_authority`
- `op_10_ready_for_delivery`
- `op_11_delivered`
- `op_12_closed`
- `op_13_invoiced`

The handoff between both domains should remain explicit: `quotation won -> create/activate project`.

## Important Files

- `lib/workflow-states.ts`: shared workflow logic
- `app/api/workflow/transition/route.ts`: transition API
- `app/(dashboard)/quotations/`: quotations UI
- `app/(dashboard)/engineering/portfolio/`: operational project view
- `app/(dashboard)/tools/experto/page.tsx`: current AI chat UI
- `app/api/tools/chat/route.ts`: OpenRouter chat backend
- `supabase/migrations/202603281710_project_and_quotation_states.sql`: workflow state migration

## Known Gaps

- Workflow persistence still depends on applying the migration above and validating RLS with a real session.
- `home` and parts of `tools` still need product cleanup.
- Documentation has recently been realigned, but the broader `doa_*` vs `doa_new_*` debt still exists in code/type history.
- There is not yet a smoke-test baseline.

## Project Docs

- [CURRENT_DOMAIN_MODEL.md](./CURRENT_DOMAIN_MODEL.md)
- [SANITATION_REPORT_2026-03-28.txt](./SANITATION_REPORT_2026-03-28.txt)
- [PROJECT_HANDOFF_2026-03-28.txt](./PROJECT_HANDOFF_2026-03-28.txt)
- [problemas-soluciones.txt](./problemas-soluciones.txt)

## Next Recommended Work

1. Validate workflow persistence with real session and RLS.
2. Keep sanitizing placeholders and product polish.
3. Add the clean handoff `quotation won -> create/activate project`.
4. Continue with AI-specific features after the workflow baseline is stable.
