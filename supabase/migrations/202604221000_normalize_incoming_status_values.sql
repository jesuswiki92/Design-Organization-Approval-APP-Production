-- Normalize legacy Spanish status values on public.doa_incoming_requests.
--
-- Context
-- -------
-- The earlier `202604211200_english_schema_contract.sql` migration renamed the
-- Spanish columns (`estado` -> `status`) and added a CHECK constraint that only
-- accepts the English canonical codes defined in
-- `lib/workflow-states.ts::INCOMING_REQUEST_STATUSES`. That migration also
-- attempted to translate persisted row values via a CASE statement, but in
-- practice some rows appear to have been written by older pipelines (pre-rename)
-- with Spanish codes that did not match the CASE branches there, or by runtime
-- writers that emitted other aliases the app normalizes at read time through
-- `normalizeIncomingStatus` (see `app/(dashboard)/quotations/incoming-queries.ts`).
--
-- The runtime normalizer is still the safety net (do NOT remove it), but DB
-- rows should be canonical so dashboards, CHECK-backed writers, and queries
-- that filter on `status` work without surprise. This migration rewrites any
-- non-canonical status VALUE to its English counterpart and then raises an
-- exception if any row still holds a value outside the canonical set.
--
-- Canonical values (must mirror INCOMING_REQUEST_STATUSES):
--   new, awaiting_form, form_received, archived
--
-- Writers audited (all produce English already, kept here as a safety net):
--   - Next.js API: app/api/incoming-requests/[id]/state/route.ts (validates via
--     isIncomingQueryStateCode / isQuotationBoardStateCode before UPDATE)
--   - Next.js API: app/api/incoming-requests/[id]/open-project/route.ts
--     (sets INCOMING_REQUEST_STATUSES.ARCHIVED)
--   - n8n workflow "DOA - 0 - Outlook a App" (inserts status='new')
--   - n8n workflow "DOA - Enviar Correo al Cliente" (updates status='awaiting_form')
--   - n8n workflow "DOA - Receptor Formularios Clientes (POST)"
--     (updates status='form_received')
--
-- Defensive scope
-- ---------------
-- The Spanish aliases below are a superset of what should still be in the
-- table. This is intentional: we keep the DDL/DML auditable and idempotent,
-- so if a stray writer re-emits a Spanish value between releases it still
-- gets normalized the next time this migration runs on a fresh environment.

BEGIN;

-- Gate the entire block on the table + status column existing. Environments
-- that have not yet run the English schema contract migration should not
-- attempt the normalization (the column may still be named `estado` there).
DO $$
BEGIN
  IF to_regclass('public.doa_incoming_requests') IS NULL THEN
    RAISE NOTICE 'Skip: public.doa_incoming_requests does not exist in this environment.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'doa_incoming_requests'
      AND column_name  = 'status'
  ) THEN
    RAISE NOTICE 'Skip: public.doa_incoming_requests.status column is missing.';
    RETURN;
  END IF;

  -- Single normalization pass. Covers:
  --   * Spanish aliases found directly in normalizeIncomingStatus
  --       nuevo                       -> new
  --       espera_formulario_cliente   -> awaiting_form
  --       formulario_recibido         -> form_received
  --   * English aliases handled by the normalizer at read time but not
  --     present in INCOMING_REQUEST_STATUSES (must collapse to the canonical
  --     set because the CHECK constraint rejects them on write)
  --       awaiting_client_form        -> awaiting_form
  --       waiting_customer_form       -> awaiting_form
  --       new_entry                   -> new
  --       pending                     -> new
  --   * Legacy Spanish codes from 202604211200_english_schema_contract.sql
  --     that share the `doa_incoming_requests.status` column (quotation-board
  --     namespace overlap, see workflow-states.ts comments). They are
  --     retranslated defensively — if any row slipped past the earlier CASE
  --     because of whitespace/casing or because a writer re-emitted them,
  --     the row becomes canonical here.
  UPDATE public.doa_incoming_requests
     SET status = CASE lower(btrim(status))
       -- incoming-request namespace
       WHEN 'nuevo'                     THEN 'new'
       WHEN 'new_entry'                 THEN 'new'
       WHEN 'pending'                   THEN 'new'
       WHEN 'espera_formulario_cliente' THEN 'awaiting_form'
       WHEN 'awaiting_client_form'      THEN 'awaiting_form'
       WHEN 'waiting_customer_form'     THEN 'awaiting_form'
       WHEN 'esperando_formulario'      THEN 'awaiting_form'
       WHEN 'formulario_recibido'       THEN 'form_received'
       WHEN 'formulario_completado'     THEN 'form_received'
       WHEN 'archivado'                 THEN 'archived'
       -- quotation-board namespace (shared column)
       WHEN 'entrada_recibida'              THEN 'request_received'
       WHEN 'formulario_enviado'            THEN 'form_sent'
       WHEN 'definir_alcance'               THEN 'define_scope'
       WHEN 'esperando_respuesta_cliente'   THEN 'awaiting_client_response'
       WHEN 'alcance_definido'              THEN 'scope_defined'
       WHEN 'oferta_en_revision'            THEN 'quote_in_review'
       WHEN 'oferta_enviada'                THEN 'quote_sent'
       WHEN 'oferta_aceptada'               THEN 'quote_accepted'
       WHEN 'oferta_rechazada'              THEN 'quote_rejected'
       WHEN 'revision_final'                THEN 'final_review'
       WHEN 'proyecto_abierto'              THEN 'project_opened'
       ELSE status
     END
   WHERE lower(btrim(status)) IN (
           'nuevo',
           'new_entry',
           'pending',
           'espera_formulario_cliente',
           'awaiting_client_form',
           'waiting_customer_form',
           'esperando_formulario',
           'formulario_recibido',
           'formulario_completado',
           'archivado',
           'entrada_recibida',
           'formulario_enviado',
           'definir_alcance',
           'esperando_respuesta_cliente',
           'alcance_definido',
           'oferta_en_revision',
           'oferta_enviada',
           'oferta_aceptada',
           'oferta_rechazada',
           'revision_final',
           'proyecto_abierto'
         );
END $$;

-- Post-condition assertion: after normalization every row must be in the
-- canonical set accepted by doa_incoming_requests_status_check (defined in
-- 202604211200_english_schema_contract.sql). If a row remains outside it,
-- fail the migration so the operator can audit before the CHECK blocks
-- future writes.
DO $$
DECLARE
  stray_count  bigint;
  stray_sample text;
BEGIN
  IF to_regclass('public.doa_incoming_requests') IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*), string_agg(DISTINCT status, ', ')
    INTO stray_count, stray_sample
    FROM public.doa_incoming_requests
   WHERE status IS NOT NULL
     AND status NOT IN (
       -- INCOMING_REQUEST_STATUSES
       'new', 'awaiting_form', 'form_received', 'archived',
       -- QUOTATION_BOARD_STATES (shared column)
       'request_received', 'form_sent', 'define_scope', 'awaiting_client_response',
       'scope_defined', 'quote_in_review', 'quote_sent', 'quote_accepted',
       'quote_rejected', 'final_review', 'project_opened'
     );

  IF stray_count > 0 THEN
    RAISE EXCEPTION
      'Non-canonical status value(s) remain in doa_incoming_requests after normalization (% row(s)): %',
      stray_count,
      stray_sample;
  END IF;
END $$;

-- Expected final state:
--   SELECT status, COUNT(*) FROM public.doa_incoming_requests GROUP BY 1;
-- should only return rows whose `status` is one of:
--   new | awaiting_form | form_received | archived
--   request_received | form_sent | define_scope | awaiting_client_response |
--   scope_defined | quote_in_review | quote_sent | quote_accepted |
--   quote_rejected | final_review | project_opened

COMMIT;
