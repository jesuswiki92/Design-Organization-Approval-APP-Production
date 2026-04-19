# AMS bootstrap extraction report

Source: Cloud Supabase project `gterzsoapepzozgqbljk` (Certification_Data_base, eu-west-1).

Output file: `20260418000000_ams_bootstrap.sql`
Helper input files (safe to delete after review): `_ex_columns.json`, `_ex_constraints.json`, `_build_bootstrap.py`.

## Counts
- Tables: **27** (all `doa_*` in public)
- Enums: **6**
- Sequences (explicit CREATE SEQUENCE): **5** — `ams_solicitudes_seq`, `ams_ofertas_seq`, `ams_chunks_id_seq`, `ams_tcds_embeddings_id_seq`, `ams_part21_embeddings_id_seq`
- Functions kept: **14** (all `doa_new_*` intentionally skipped; legacy `drop_legacy_doa_new_tables` migration confirms they're dead)
- Triggers: **12**
- RLS-enabled tables: **13**
- RLS policies: **19**
- Foreign keys: **22**
- Non-constraint indexes: **92**
- Materialized views: **1** (`ams_project_metrics_mv`)
- Storage buckets renamed: **2**

## Rename map (doa_* -> ams_*)

| From | To |
| --- | --- |
| `doa_aeronaves` | `ams_aeronaves` |
| `doa_ai_response_cache` | `ams_ai_response_cache` |
| `doa_app_events` | `ams_app_events` |
| `doa_chunks` | `ams_chunks` |
| `doa_clientes_contactos` | `ams_clientes_contactos` |
| `doa_clientes_datos_generales` | `ams_clientes_datos_generales` |
| `doa_consultas_entrantes` | `ams_consultas_entrantes` |
| `doa_conteo_horas_proyectos` | `ams_conteo_horas_proyectos` |
| `doa_emails` | `ams_emails` |
| `doa_part21_embeddings` | `ams_part21_embeddings` |
| `doa_plantillas_compliance` | `ams_plantillas_compliance` |
| `doa_project_closures` | `ams_project_closures` |
| `doa_project_deliverables` | `ams_project_deliverables` |
| `doa_project_deliveries` | `ams_project_deliveries` |
| `doa_project_lessons` | `ams_project_lessons` |
| `doa_project_signatures` | `ams_project_signatures` |
| `doa_project_validations` | `ams_project_validations` |
| `doa_proyectos` | `ams_proyectos` |
| `doa_proyectos_historico` | `ams_proyectos_historico` |
| `doa_proyectos_historico_archivos` | `ams_proyectos_historico_archivos` |
| `doa_proyectos_historico_documentos` | `ams_proyectos_historico_documentos` |
| `doa_quotation_items` | `ams_quotation_items` |
| `doa_quotations` | `ams_quotations` |
| `doa_respuestas_formularios` | `ams_respuestas_formularios` |
| `doa_tcds_embeddings` | `ams_tcds_embeddings` |
| `doa_usuarios` | `ams_usuarios` |
| `doa_workflow_state_config` | `ams_workflow_state_config` |

## Storage buckets renamed
- `doa-formularios` -> `ams-formularios` (public)
- `doa-tcds-storage` -> `ams-tcds-storage` (public)

## Enums (values unchanged)
- `ams_classification`: ['minor', 'major', 'repair']
- `ams_doc_status`: ['vigente', 'obsoleto', 'pendiente', 'na']
- `ams_project_status`: ['active', 'review', 'approved', 'paused', 'closed']
- `ams_task_priority`: ['low', 'medium', 'high', 'critical']
- `ams_task_status`: ['todo', 'in_progress', 'blocked', 'done']
- `ams_user_role`: ['engineer', 'team_lead', 'head_of_design', 'admin']

## Functions kept (doa_new_* NOT included)
- auto_generate_numero_entrada
- ams_part21_search_vector (was doa_part21_search_vector)
- ams_proyectos_historico_documentos_set_updated_at (was doa_...)
- ams_tcds_search_vector (was doa_tcds_search_vector)
- set_ams_project_deliverables_updated_at (was set_doa_...)
- set_ams_project_deliveries_updated_at
- set_ams_project_lessons_updated_at
- set_updated_at (name unchanged - no doa_ prefix)
- trg_set_updated_at (name unchanged)
- generate_quotation_number (body references ams_quotations)
- trg_set_quotation_number (name unchanged)
- update_ams_chunks_updated_at (was update_doa_...)
- update_ams_part21_embeddings_updated_at_column
- update_ams_tcds_embeddings_updated_at_column

## Top warnings
- **RLS disabled on many tables** in Cloud source (intentional, but worth reviewing for AMS).
  Tables currently without RLS in the bootstrap: `ams_aeronaves`, `ams_clientes_contactos`, `ams_clientes_datos_generales`, `ams_consultas_entrantes`, `ams_emails`, `ams_part21_embeddings`, `ams_plantillas_compliance`, `ams_proyectos_historico`, `ams_proyectos_historico_archivos`, `ams_proyectos_historico_documentos`, `ams_quotation_items`, `ams_quotations`, `ams_usuarios`, `ams_workflow_state_config`
- Policies on `doa_chunks`, `doa_conteo_horas_proyectos`, `doa_respuestas_formularios`, `doa_proyectos`, `doa_tcds_embeddings` use `roles=public` (broad). Consider tightening when moving to AMS (self-hosted tenancy may differ).
- `update_doa_proyectos_updated_at` trigger on `doa_proyectos` executes `update_doa_tcds_embeddings_updated_at_column` (a quirk of the Cloud setup reusing a generic NOW() fn). Preserved as-is using `update_ams_tcds_embeddings_updated_at_column`.
- `vector` dimensions (confirmed via pg_attribute): `ams_chunks.embedding` is `vector(1536)`; `ams_tcds_embeddings.embedding` and `ams_part21_embeddings.embedding` are `vector(3072)`. All three are correctly hardcoded in the bootstrap.
- `supabase_vault` extension is managed by Supabase Cloud; NOT re-created here. Self-hosted AMS only needs it if the app uses Vault secrets.
- `drop_legacy_doa_new_tables` was already present in the old migrations folder and confirms `doa_new_*` functions/tables are dead — they are intentionally excluded from this bootstrap.
- Check constraints of form `numero_precision IS NOT NULL` are emitted as NOT NULL on the column, not as named CHECK.
- Foreign key rename mapping example: `doa_emails_consulta_id_fkey` -> `ams_emails_consulta_id_fkey`.

## Next recommended
Apply Phase B — move old `doa_*.sql` to `_archive/` and run `supabase db push` (or equivalent) against the `ams-supabase-kong` self-hosted instance.
