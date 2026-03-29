# CLAUDE.md - DOA Operations Hub

## Project Overview

DOA Operations Hub is a Next.js / Supabase internal app for DOA operations. It is being shaped as a specialized DOA layer rather than a replacement for Odoo.

The current app already contains:

- quotations workflow
- engineering portfolio
- project workspace
- client management
- internal data tools
- OpenRouter chat in `tools/experto`

## Current Architecture Reality

- Framework: Next.js 16 App Router
- UI: React 19 + Tailwind v4 + shadcn/ui
- Backend/Auth: Supabase
- AI chat: OpenRouter
- State: minimal Zustand usage

## Current Canonical Runtime Domain

The current runtime code works primarily on the `doa_*` domain model.

The `doa_new_*` model still appears in older docs and in parts of `types/database.ts`, but it is not the canonical source for the current active workflows. Treat that as migration/documentation debt unless a task explicitly targets schema consolidation.

## Workflow Separation

Keep these domains separate.

### Quotations

Commercial pipeline:

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

Operational pipeline:

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

Only connect both domains at:

- `quotation won -> create/activate project`

## Important Paths

| Path | Purpose |
| --- | --- |
| `app/(dashboard)/quotations/` | Quotations UI |
| `app/(dashboard)/engineering/portfolio/` | Project operational portfolio |
| `app/(dashboard)/engineering/projects/[id]/` | Project workspace |
| `app/(dashboard)/tools/experto/` | Current OpenRouter chat UI |
| `app/api/workflow/transition/route.ts` | Workflow transition API |
| `app/api/tools/chat/route.ts` | OpenRouter chat route |
| `lib/workflow-states.ts` | Workflow definitions and transitions |
| `types/database.ts` | Shared domain types, including transitional debt |

## Auth and Route Protection

- Login route: `/login`
- Protected areas are enforced through `proxy.ts`
- Current protected route families include `/home`, `/engineering`, `/quotations`, `/clients`, `/databases`, and `/tools`

## Development Rules

- Do not reintroduce removed legacy files such as `app/api/experto/chat/route.ts` or `store/authStore.ts`.
- Do not mix quotation states into project workflow logic.
- Do not mix project states into quotation workflow logic.
- Do not edit the original base migration file. Add new migrations only.
- If you touch workflow, auth, or types, validate with `npm run lint` and `npm run build`.
- Prefer small, conservative refactors over broad rewrites while the app is still stabilizing.

## Current Operational Notes

- `tools/experto` uses OpenRouter
- Default model is `anthropic/claude-sonnet-4`
- Requires `OPENROUTER_API_KEY`
- Dev fallback that has been useful in this environment:

```bash
npm run dev -- --webpack --port 3000
```

## Current Documentation Set

- `README.md`
- `CURRENT_DOMAIN_MODEL.md`
- `SANITATION_REPORT_2026-03-28.txt`
- `PROJECT_HANDOFF_2026-03-28.txt`
- `problemas-soluciones.txt`
