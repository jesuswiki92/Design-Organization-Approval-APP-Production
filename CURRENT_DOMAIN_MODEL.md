# Current Domain Model

This document describes the current active domain model of the app after the recent workflow and sanitation work.

## Scope

This is not a target-state architecture document. It describes what the app is actually using today so contributors do not keep mixing old and new naming.

## Current Source of Truth

The active app surface currently works on the `doa_*` model, not on `doa_new_*`.

Examples of active tables and concepts used by the current runtime:

- `doa_clientes_datos_generales`
- `doa_clientes_contactos`
- `doa_proyectos_generales`
- `doa_proyectos_documentos`
- `doa_proyectos_tareas`
- `doa_solicitudes`
- `doa_ofertas`
- `doa_aeronaves_modelos`
- `doa_usuarios`

## What `doa_new_*` Means Today

`doa_new_*` still appears in:

- older documentation
- parts of `types/database.ts`
- migration history and earlier project scaffolding assumptions

Today it should be treated as legacy/reference debt, not as the canonical runtime model for the current app behavior.

## Active Workflow Split

### Quotations Domain

Commercial workflow aligned with `SP-07`.

Current states:

- `new`
- `unassigned`
- `ongoing`
- `pending_customer`
- `pending_internal`
- `rfi_sent`
- `quotation_sent`
- `won`
- `cancelled`

Primary surface:

- `/quotations`

Primary implementation files:

- `app/(dashboard)/quotations/page.tsx`
- `app/(dashboard)/quotations/QuotationsClient.tsx`
- `app/api/workflow/transition/route.ts`
- `lib/workflow-states.ts`

### Projects Domain

Operational workflow aligned with `SP-08`.

Current operational states:

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

Primary surfaces:

- `/engineering/portfolio`
- `/engineering/projects/[id]`

Primary implementation files:

- `app/(dashboard)/engineering/portfolio/PortfolioClient.tsx`
- `components/project/ProjectWorkspaceHeader.tsx`
- `components/project/workspace-utils.ts`
- `app/api/workflow/transition/route.ts`
- `lib/workflow-states.ts`

### Relationship Between Both Domains

The intended handoff is:

- `quotation won -> create/activate project`

Outside that handoff, both workflows should remain separate in states, UI language, and automation logic.

## Legacy State Handling

Some old project records may still carry legacy states such as:

- `oferta`
- `activo`
- `en_revision`
- `pendiente_aprobacion_cve`
- `pendiente_aprobacion_easa`
- `en_pausa`
- `cancelado`
- `cerrado`
- `guardado_en_base_de_datos`

These are no longer the canonical project workflow. They remain only as compatibility bridge data until a later cleanup or migration pass.

## Current Technical Debt

1. `types/database.ts` still contains both old `doa_new_*`-style conceptual types and active `doa_*` domain types.
2. Documentation was originally written against a different routing and schema assumption.
3. Workflow persistence depends on the migration:
   - `supabase/migrations/202603281710_project_and_quotation_states.sql`
4. Real write validation still depends on session and RLS checks in the live Supabase environment.

## Rules For New Work

- Build new features against the active `doa_*` runtime unless the task is explicitly a schema migration effort.
- Keep `quotations` and `projects` separate.
- Do not reintroduce old chat APIs, old stores, or schema assumptions already removed during sanitation.
- Update this document whenever the canonical runtime model changes.
