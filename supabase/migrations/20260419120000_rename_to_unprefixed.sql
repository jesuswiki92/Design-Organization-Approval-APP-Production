-- APLICADO 2026-04-19 (rename ejecutado en BD; workflows n8n y código TS actualizados la misma fecha, retomada ~10:20 CEST)
-- =============================================================================
-- Migración: rename_to_unprefixed
-- Fecha plan: 2026-04-19
-- Objetivo: eliminar el prefijo `ams_` de todas las tablas, vistas materializadas,
--           policies RLS y (opcionalmente) constraints/índices/triggers para
--           alinear el esquema con la arquitectura white-label (cada cliente
--           tiene ya su propia instancia Supabase aislada; el prefijo es
--           redundante).
--
-- Contexto runtime:
--   - Stack self-hosted (docker compose): ams-postgres-app + supabase-rest +
--     kong + realtime + meta. NO aplica Supabase Cloud.
--   - Publicación `supabase_realtime` está VACÍA → no hay que re-agregar tablas.
--   - Row counts en el momento del plan: prácticamente todas las tablas a 0
--     salvo `ams_app_events` (28) y `ams_usuarios` (1). Ventana ideal.
--   - 28 tablas + 1 matview afectadas. Cero colisiones (no existe tabla
--     sin prefijo con el mismo nombre destino).
--
-- Alcance del script:
--   [1] RENAME de 28 tablas → nombres sin prefijo.
--   [2] RENAME de la materialized view `ams_project_metrics_mv`.
--   [3] RENAME de policies RLS cuyo `policyname` contiene `ams_`.
--   [4] RENAME opcional cosmético de PK/UNIQUE constraints con `ams_` en su
--       identificador (bloque marcado opcional; Postgres no lo requiere).
--   [5] RENAME opcional cosmético de índices nombrados con `ams_` / `idx_ams_`.
--   [6] RENAME opcional cosmético de triggers `trg_ams_*`.
--
-- NO se hace en este script (se gestiona aparte):
--   - Refactor de tipos TypeScript (`types/database.ts`) y 88 archivos .ts/.tsx
--     con referencias literales a `ams_*` (390 ocurrencias).
--   - Actualización de `tableId` en nodos Supabase de los 10 workflows n8n
--     activos en ssn8n.testn8n.com.
--   - Actualización de URLs hardcodeadas `/rest/v1/ams_conteo_horas_proyectos`
--     en HTTP Request nodes del workflow `AMS - Conteo Horas Proyectos`.
--   - Reescritura del cuerpo de las 9 funciones que mencionan tablas `ams_*`
--     por nombre (usar `pg_get_functiondef` para volcar, editar y re-crear).
--   - Actualización de docs `.md` (seguirá apareciendo "prefijo doa_" / "ams_"
--     en documentación histórica — decidir si se purga o se marca deprecated).
--
-- Orden recomendado de ejecución real (cuando se apruebe):
--   0. Snapshot de `ams-postgres-app` (`pg_dump` + volumen backup).
--   1. Pausar workflows n8n activos que escriben en estas tablas.
--   2. Ejecutar ESTE script completo dentro de una única transacción.
--   3. Volcar + reescribir cuerpos de funciones afectadas.
--   4. Desplegar build Next.js con `types/database.ts` regenerado y
--      literales `ams_*` reemplazados.
--   5. Actualizar `tableId` / URLs en workflows n8n (vía MCP n8n).
--   6. Reanudar workflows.
--   7. Smoke test: insert consulta entrante, abrir proyecto, cerrar proyecto.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- [1] Rename de tablas (28)
-- -----------------------------------------------------------------------------
ALTER TABLE public.ams_aeronaves                        RENAME TO aeronaves;
ALTER TABLE public.ams_ai_response_cache                RENAME TO ai_response_cache;
ALTER TABLE public.ams_app_events                       RENAME TO app_events;
ALTER TABLE public.ams_chunks                           RENAME TO chunks;
ALTER TABLE public.ams_clientes_contactos               RENAME TO clientes_contactos;
ALTER TABLE public.ams_clientes_datos_generales         RENAME TO clientes_datos_generales;
ALTER TABLE public.ams_consultas_entrantes              RENAME TO consultas_entrantes;
ALTER TABLE public.ams_conteo_horas_proyectos           RENAME TO conteo_horas_proyectos;
ALTER TABLE public.ams_emails                           RENAME TO emails;
ALTER TABLE public.ams_part21_embeddings                RENAME TO part21_embeddings;
ALTER TABLE public.ams_plantillas_compliance            RENAME TO plantillas_compliance;
ALTER TABLE public.ams_project_closures                 RENAME TO project_closures;
ALTER TABLE public.ams_project_deliverables             RENAME TO project_deliverables;
ALTER TABLE public.ams_project_deliveries               RENAME TO project_deliveries;
ALTER TABLE public.ams_project_lessons                  RENAME TO project_lessons;
ALTER TABLE public.ams_project_signatures               RENAME TO project_signatures;
ALTER TABLE public.ams_project_validations              RENAME TO project_validations;
ALTER TABLE public.ams_proyectos                        RENAME TO proyectos;
ALTER TABLE public.ams_proyectos_embeddings             RENAME TO proyectos_embeddings;
ALTER TABLE public.ams_proyectos_historico              RENAME TO proyectos_historico;
ALTER TABLE public.ams_proyectos_historico_archivos     RENAME TO proyectos_historico_archivos;
ALTER TABLE public.ams_proyectos_historico_documentos   RENAME TO proyectos_historico_documentos;
ALTER TABLE public.ams_quotation_items                  RENAME TO quotation_items;
ALTER TABLE public.ams_quotations                       RENAME TO quotations;
ALTER TABLE public.ams_respuestas_formularios           RENAME TO respuestas_formularios;
ALTER TABLE public.ams_tcds_embeddings                  RENAME TO tcds_embeddings;
ALTER TABLE public.ams_usuarios                         RENAME TO usuarios;
ALTER TABLE public.ams_workflow_state_config            RENAME TO workflow_state_config;

-- -----------------------------------------------------------------------------
-- [2] Rename de materialized views (1)
-- -----------------------------------------------------------------------------
ALTER MATERIALIZED VIEW public.ams_project_metrics_mv   RENAME TO project_metrics_mv;

-- -----------------------------------------------------------------------------
-- [3] Rename de policies RLS cuyo nombre incluye `ams_`
--     (PostgreSQL no renombra automáticamente los policynames al renombrar la
--      tabla subyacente; hay que hacerlo explícitamente.)
-- -----------------------------------------------------------------------------
ALTER POLICY "allow_all_ams_chunks"                       ON public.chunks              RENAME TO "allow_all_chunks";
ALTER POLICY "ams_project_closures_select"                ON public.project_closures    RENAME TO "project_closures_select";
ALTER POLICY "ams_project_closures_service_all"           ON public.project_closures    RENAME TO "project_closures_service_all";
ALTER POLICY "ams_project_deliverables_select"            ON public.project_deliverables RENAME TO "project_deliverables_select";
ALTER POLICY "ams_project_deliverables_service_all"       ON public.project_deliverables RENAME TO "project_deliverables_service_all";
ALTER POLICY "ams_project_deliveries_select"              ON public.project_deliveries   RENAME TO "project_deliveries_select";
ALTER POLICY "ams_project_deliveries_service_all"         ON public.project_deliveries   RENAME TO "project_deliveries_service_all";
ALTER POLICY "ams_project_lessons_select"                 ON public.project_lessons      RENAME TO "project_lessons_select";
ALTER POLICY "ams_project_lessons_service_all"            ON public.project_lessons      RENAME TO "project_lessons_service_all";
ALTER POLICY "ams_project_signatures_select"              ON public.project_signatures   RENAME TO "project_signatures_select";
ALTER POLICY "ams_project_signatures_service_all"         ON public.project_signatures   RENAME TO "project_signatures_service_all";
ALTER POLICY "ams_project_validations_select"             ON public.project_validations  RENAME TO "project_validations_select";
ALTER POLICY "ams_project_validations_service_all"        ON public.project_validations  RENAME TO "project_validations_service_all";
ALTER POLICY "Allow public read access on ams_tcds_embeddings"  ON public.tcds_embeddings RENAME TO "tcds_embeddings_public_read";
ALTER POLICY "Allow service role full access on ams_tcds_embeddings" ON public.tcds_embeddings RENAME TO "tcds_embeddings_service_all";

-- -----------------------------------------------------------------------------
-- [4] OPCIONAL — Rename cosmético de PK / UNIQUE / FK constraints
--     Postgres actualiza automáticamente las REFERENCIAS; solo los NOMBRES
--     siguen con `ams_`. No afecta al runtime pero conviene para consistencia.
--     Descomentar cuando se haya revisado que ningún script SQL externo
--     referencia estos identificadores por nombre.
-- -----------------------------------------------------------------------------
-- ALTER TABLE public.aeronaves                      RENAME CONSTRAINT ams_aeronaves_pkey                  TO aeronaves_pkey;
-- ALTER TABLE public.ai_response_cache              RENAME CONSTRAINT ams_ai_response_cache_pkey          TO ai_response_cache_pkey;
-- ALTER TABLE public.app_events                     RENAME CONSTRAINT ams_app_events_pkey                 TO app_events_pkey;
-- ALTER TABLE public.chunks                         RENAME CONSTRAINT ams_chunks_pkey                     TO chunks_pkey;
-- ALTER TABLE public.clientes_contactos             RENAME CONSTRAINT ams_clientes_contactos_pkey         TO clientes_contactos_pkey;
-- ALTER TABLE public.clientes_datos_generales       RENAME CONSTRAINT ams_clientes_datos_generales_pkey   TO clientes_datos_generales_pkey;
-- ALTER TABLE public.consultas_entrantes            RENAME CONSTRAINT ams_consultas_entrantes_pkey        TO consultas_entrantes_pkey;
-- ALTER TABLE public.conteo_horas_proyectos         RENAME CONSTRAINT ams_conteo_horas_proyectos_pkey     TO conteo_horas_proyectos_pkey;
-- ALTER TABLE public.emails                         RENAME CONSTRAINT ams_emails_pkey                     TO emails_pkey;
-- ALTER TABLE public.emails                         RENAME CONSTRAINT ams_emails_consulta_id_fkey         TO emails_consulta_id_fkey;
-- ALTER TABLE public.part21_embeddings              RENAME CONSTRAINT ams_part21_embeddings_pkey          TO part21_embeddings_pkey;
-- ALTER TABLE public.plantillas_compliance          RENAME CONSTRAINT ams_plantillas_compliance_pkey      TO plantillas_compliance_pkey;
-- ALTER TABLE public.project_closures               RENAME CONSTRAINT ams_project_closures_pkey           TO project_closures_pkey;
-- ALTER TABLE public.project_deliverables           RENAME CONSTRAINT ams_project_deliverables_pkey       TO project_deliverables_pkey;
-- ALTER TABLE public.project_deliveries             RENAME CONSTRAINT ams_project_deliveries_pkey         TO project_deliveries_pkey;
-- ALTER TABLE public.project_lessons                RENAME CONSTRAINT ams_project_lessons_pkey            TO project_lessons_pkey;
-- ALTER TABLE public.project_signatures             RENAME CONSTRAINT ams_project_signatures_pkey         TO project_signatures_pkey;
-- ALTER TABLE public.project_validations            RENAME CONSTRAINT ams_project_validations_pkey        TO project_validations_pkey;
-- ALTER TABLE public.proyectos                      RENAME CONSTRAINT ams_proyectos_pkey                  TO proyectos_pkey;
-- ALTER TABLE public.proyectos_embeddings           RENAME CONSTRAINT ams_proyectos_embeddings_pkey       TO proyectos_embeddings_pkey;
-- ALTER TABLE public.proyectos_historico            RENAME CONSTRAINT ams_proyectos_historico_pkey        TO proyectos_historico_pkey;
-- ALTER TABLE public.proyectos_historico_archivos   RENAME CONSTRAINT ams_proyectos_historico_archivos_pkey    TO proyectos_historico_archivos_pkey;
-- ALTER TABLE public.proyectos_historico_documentos RENAME CONSTRAINT ams_proyectos_historico_documentos_pkey  TO proyectos_historico_documentos_pkey;
-- ALTER TABLE public.quotation_items                RENAME CONSTRAINT ams_quotation_items_pkey            TO quotation_items_pkey;
-- ALTER TABLE public.quotations                     RENAME CONSTRAINT ams_quotations_pkey                 TO quotations_pkey;
-- ALTER TABLE public.respuestas_formularios         RENAME CONSTRAINT ams_respuestas_formularios_pkey     TO respuestas_formularios_pkey;
-- ALTER TABLE public.tcds_embeddings                RENAME CONSTRAINT ams_tcds_embeddings_pkey            TO tcds_embeddings_pkey;
-- ALTER TABLE public.usuarios                       RENAME CONSTRAINT ams_usuarios_pkey                   TO usuarios_pkey;
-- ALTER TABLE public.workflow_state_config          RENAME CONSTRAINT ams_workflow_state_config_pkey      TO workflow_state_config_pkey;

-- -----------------------------------------------------------------------------
-- [5] OPCIONAL — Rename cosmético de índices (139 índices, ver query
--     `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND
--      indexname LIKE 'ams_%' OR indexname LIKE 'idx_ams_%';` para la lista
--     completa). Ejemplos:
-- -----------------------------------------------------------------------------
-- ALTER INDEX public.idx_ams_proyectos_estado_v2         RENAME TO idx_proyectos_estado_v2;
-- ALTER INDEX public.idx_ams_consultas_entrantes_estado  RENAME TO idx_consultas_entrantes_estado;
-- ... (generar script completo con `pg_indexes` antes de aplicar)

-- -----------------------------------------------------------------------------
-- [6] OPCIONAL — Rename cosmético de triggers (12 en total)
-- -----------------------------------------------------------------------------
-- ALTER TRIGGER trg_ams_chunks_updated_at                ON public.chunks          RENAME TO trg_chunks_updated_at;
-- ... (generar script completo con `pg_trigger` antes de aplicar)

COMMIT;

-- =============================================================================
-- POST-RENAME — Funciones que contienen `ams_` en su nombre o cuerpo.
-- Requieren DROP + CREATE OR REPLACE manual; no basta con RENAME.
-- Funciones detectadas:
--   - public.ams_part21_search_vector(...)
--   - public.ams_proyectos_historico_documentos_set_updated_at()
--   - public.ams_tcds_search_vector(...)
--   - public.set_ams_project_deliverables_updated_at()
--   - public.set_ams_project_deliveries_updated_at()
--   - public.set_ams_project_lessons_updated_at()
--   - public.update_ams_chunks_updated_at()
--   - public.update_ams_part21_embeddings_updated_at_column()
--   - public.update_ams_tcds_embeddings_updated_at_column()
-- Procedimiento: `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname LIKE
-- '%ams_%';` → editar cuerpos → CREATE OR REPLACE con nombre sin prefijo →
-- actualizar triggers que referencian la función vía `CREATE TRIGGER ...
-- EXECUTE FUNCTION ...`.
-- =============================================================================

-- =============================================================================
-- ROLLBACK (ejecutar sólo si algo falla tras el COMMIT y antes de que el
-- código Next.js / n8n se haya desplegado con los nuevos nombres).
-- =============================================================================
-- BEGIN;
-- ALTER TABLE public.aeronaves                     RENAME TO ams_aeronaves;
-- ALTER TABLE public.ai_response_cache             RENAME TO ams_ai_response_cache;
-- ... (mirror inverso de la sección [1])
-- ALTER MATERIALIZED VIEW public.project_metrics_mv RENAME TO ams_project_metrics_mv;
-- COMMIT;
