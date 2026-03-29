# AGENTS.md - DOA Operations Hub

## Product Reality

DOA Operations Hub is an internal DOA-focused application. It is not a full Odoo replacement. The app is intended to complement broader business tooling with a specialized operational layer for:

- quotations
- project execution
- engineering workspace
- internal tools
- AI-assisted support

## Current Runtime Conventions

- Authentication is handled through Supabase SSR auth.
- Protected application routes are enforced in `proxy.ts`.
- The active app surface runs on the `doa_*` domain model.
- The `doa_new_*` model remains legacy/reference debt and is not the canonical runtime source for the current workflows.

## Current Workflow Rules

### Quotations

Commercial workflow only. Do not mix with project execution states.

Allowed states:

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

Operational workflow only. Do not use quotation states here.

Allowed states:

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

The only intended bridge is:

- `quotation won -> create/activate project`

## Current Key Routes

- `/login`
- `/home`
- `/engineering/portfolio`
- `/engineering/projects/[id]`
- `/quotations`
- `/clients`
- `/databases`
- `/tools`
- `/tools/experto`

## Current AI Surface

- Active AI chat route: `app/api/tools/chat/route.ts`
- Active UI: `app/(dashboard)/tools/experto/page.tsx`
- Provider: OpenRouter
- Default model: `anthropic/claude-sonnet-4`

Do not reintroduce the removed legacy chat route under `app/api/experto/chat/route.ts`.

## Where to Query Data

The active codebase currently queries and models `doa_*` tables such as:

- `doa_proyectos_generales`
- `doa_proyectos_documentos`
- `doa_proyectos_tareas`
- `doa_clientes_datos_generales`
- `doa_solicitudes`
- `doa_ofertas`

Do not assume `doa_new_*` is the current runtime source unless you are doing explicit migration work.

## Safe Development Rules

- Do not edit `supabase/migrations/001_initial_schema.sql`.
- Add new schema changes as new migration files only.
- Do not mix quotation semantics into project workflow code.
- Do not mix project semantics into quotation workflow code.
- Do not reintroduce placeholder APIs, routes, or stores that were removed during sanitation.
- If you touch auth, workflow, or database types, validate with `lint` and `build`.

## Useful Runtime Notes

- Standard dev command: `npm run dev`
- Stable fallback used during debugging: `npm run dev -- --webpack --port 3000`
- OpenRouter requires `OPENROUTER_API_KEY`

## Documentation Sources

When in doubt, align work with:

- `README.md`
- `CURRENT_DOMAIN_MODEL.md`
- `SANITATION_REPORT_2026-03-28.txt`
- `PROJECT_HANDOFF_2026-03-28.txt`
