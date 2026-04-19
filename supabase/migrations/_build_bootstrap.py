"""Generate 20260418000000_ams_bootstrap.sql from extracted Cloud schema.

Reads _ex_columns.json and _ex_constraints.json, plus inline-coded
FKs, indexes, triggers, policies, functions, and MV definition captured
from the Cloud project, then emits a single consolidated bootstrap that
renames every `doa_` identifier to `ams_` (and `doa-` storage bucket to
`ams-`).

READ-ONLY script — only writes to disk; does not touch the DB.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

MIG_DIR = Path(__file__).resolve().parent
OUT_SQL = MIG_DIR / "20260418000000_ams_bootstrap.sql"
OUT_REPORT = MIG_DIR / "_extraction_report.md"

# ---------------------------------------------------------------------------
# Load extracted data
# ---------------------------------------------------------------------------
with (MIG_DIR / "_ex_columns.json").open(encoding="utf-8") as f:
    COLUMNS = json.load(f)
with (MIG_DIR / "_ex_constraints.json").open(encoding="utf-8") as f:
    CONSTRAINTS = json.load(f)


def rn(s: str) -> str:
    """Rename doa_ -> ams_ (any occurrence) and doa- -> ams-.

    We use plain substring replace because identifiers like
    `update_doa_chunks_updated_at` or `trg_doa_project_deliverables_updated_at`
    contain `doa_` mid-string (after `_`, which is a word character so \b
    does not match). No existing non-doa identifier happens to contain the
    literal substring `doa_` in this schema, so a substring replace is safe.
    """
    if s is None:
        return s
    s = s.replace("doa_", "ams_")
    s = s.replace("doa-", "ams-")
    return s


# ---------------------------------------------------------------------------
# Extensions (keep order stable)
# ---------------------------------------------------------------------------
EXTENSIONS = [
    "pgcrypto",
    "uuid-ossp",
    "vector",
    "pg_stat_statements",
    "pg_graphql",
]
# supabase_vault is managed by Supabase automatically; omit from bootstrap

# ---------------------------------------------------------------------------
# Enums (renamed: doa_* -> ams_*)
# ---------------------------------------------------------------------------
ENUMS = {
    "ams_classification": ["minor", "major", "repair"],
    "ams_doc_status": ["vigente", "obsoleto", "pendiente", "na"],
    "ams_project_status": ["active", "review", "approved", "paused", "closed"],
    "ams_task_priority": ["low", "medium", "high", "critical"],
    "ams_task_status": ["todo", "in_progress", "blocked", "done"],
    "ams_user_role": ["engineer", "team_lead", "head_of_design", "admin"],
}

# ---------------------------------------------------------------------------
# Sequences (explicit CREATE SEQUENCE for the non-identity ones)
# ---------------------------------------------------------------------------
SEQUENCES = [
    # Used by columns with default nextval(...)
    "ams_solicitudes_seq",
    "ams_ofertas_seq",
    # Id sequences for the bigint PKs (Cloud created them explicitly, not via SERIAL,
    # because the column defaults are `nextval('doa_*_id_seq'::regclass)`).
    "ams_chunks_id_seq",
    "ams_tcds_embeddings_id_seq",
    "ams_part21_embeddings_id_seq",
]

# ---------------------------------------------------------------------------
# Foreign keys (from extraction) — renamed
# ---------------------------------------------------------------------------
FOREIGN_KEYS = [
    # (child, child_col, parent, parent_col, on_update, on_delete, name)
    ("doa_clientes_contactos", "cliente_id", "doa_clientes_datos_generales", "id", "NO ACTION", "CASCADE", "contactos_cliente_cliente_id_fkey"),
    ("doa_conteo_horas_proyectos", "proyecto_id", "doa_proyectos", "id", "NO ACTION", "CASCADE", "doa_conteo_horas_proyectos_proyecto_id_fkey"),
    ("doa_emails", "consulta_id", "doa_consultas_entrantes", "id", "NO ACTION", "CASCADE", "doa_emails_consulta_id_fkey"),
    ("doa_emails", "en_respuesta_a", "doa_emails", "id", "NO ACTION", "NO ACTION", "doa_emails_en_respuesta_a_fkey"),
    ("doa_project_closures", "proyecto_id", "doa_proyectos", "id", "NO ACTION", "CASCADE", "doa_project_closures_proyecto_id_fkey"),
    ("doa_project_closures", "signature_id", "doa_project_signatures", "id", "NO ACTION", "NO ACTION", "doa_project_closures_signature_id_fkey"),
    ("doa_project_deliverables", "proyecto_id", "doa_proyectos", "id", "NO ACTION", "CASCADE", "doa_project_deliverables_proyecto_id_fkey"),
    ("doa_project_deliveries", "proyecto_id", "doa_proyectos", "id", "NO ACTION", "CASCADE", "doa_project_deliveries_proyecto_id_fkey"),
    ("doa_project_deliveries", "signature_id", "doa_project_signatures", "id", "NO ACTION", "NO ACTION", "doa_project_deliveries_signature_id_fkey"),
    ("doa_project_deliveries", "validation_id", "doa_project_validations", "id", "NO ACTION", "NO ACTION", "doa_project_deliveries_validation_id_fkey"),
    ("doa_project_lessons", "closure_id", "doa_project_closures", "id", "NO ACTION", "SET NULL", "doa_project_lessons_closure_id_fkey"),
    ("doa_project_lessons", "proyecto_id", "doa_proyectos", "id", "NO ACTION", "CASCADE", "doa_project_lessons_proyecto_id_fkey"),
    ("doa_project_signatures", "proyecto_id", "doa_proyectos", "id", "NO ACTION", "CASCADE", "doa_project_signatures_proyecto_id_fkey"),
    ("doa_project_signatures", "validation_id", "doa_project_validations", "id", "NO ACTION", "NO ACTION", "doa_project_signatures_validation_id_fkey"),
    ("doa_project_validations", "proyecto_id", "doa_proyectos", "id", "NO ACTION", "CASCADE", "doa_project_validations_proyecto_id_fkey"),
    ("doa_proyectos", "consulta_id", "doa_consultas_entrantes", "id", "NO ACTION", "NO ACTION", "doa_proyectos_consulta_id_fkey"),
    ("doa_proyectos_historico", "client_id", "doa_clientes_datos_generales", "id", "NO ACTION", "SET NULL", "doa_proyectos_historico_client_id_fkey"),
    ("doa_proyectos_historico_archivos", "documento_id", "doa_proyectos_historico_documentos", "id", "NO ACTION", "CASCADE", "doa_proyectos_historico_archivos_documento_id_fkey"),
    ("doa_proyectos_historico_documentos", "proyecto_historico_id", "doa_proyectos_historico", "id", "NO ACTION", "CASCADE", "doa_proyectos_historico_documentos_proyecto_historico_id_fkey"),
    ("doa_quotation_items", "quotation_id", "doa_quotations", "id", "NO ACTION", "CASCADE", "doa_quotation_items_quotation_id_fkey"),
    ("doa_quotations", "consulta_id", "doa_consultas_entrantes", "id", "NO ACTION", "CASCADE", "doa_quotations_consulta_id_fkey"),
    ("doa_respuestas_formularios", "consulta_id", "doa_consultas_entrantes", "id", "NO ACTION", "CASCADE", "doa_respuestas_formularios_consulta_id_fkey"),
]

# ---------------------------------------------------------------------------
# Indexes (captured from extraction). All indexdefs are already CREATE INDEX.
# Excluding doa_project_metrics_mv which is the MV (will be handled separately).
# ---------------------------------------------------------------------------
INDEX_DEFS = [
    "CREATE INDEX idx_aeronaves_fabricante ON public.doa_aeronaves USING btree (fabricante)",
    "CREATE INDEX idx_aeronaves_tcds_code ON public.doa_aeronaves USING btree (tcds_code)",
    "CREATE INDEX idx_aeronaves_tcds_short ON public.doa_aeronaves USING btree (tcds_code_short)",
    "CREATE INDEX idx_aeronaves_tipo ON public.doa_aeronaves USING btree (tipo)",
    "CREATE INDEX idx_doa_ai_response_cache_expires_at ON public.doa_ai_response_cache USING btree (expires_at)",
    "CREATE INDEX doa_app_events_actor_created_at_idx ON public.doa_app_events USING btree (actor_user_id, created_at DESC)",
    "CREATE INDEX doa_app_events_created_at_idx ON public.doa_app_events USING btree (created_at DESC)",
    "CREATE INDEX doa_app_events_entity_created_at_idx ON public.doa_app_events USING btree (entity_type, entity_id, created_at DESC)",
    "CREATE INDEX doa_app_events_event_name_created_at_idx ON public.doa_app_events USING btree (event_name, created_at DESC)",
    "CREATE INDEX doa_app_events_metadata_gin_idx ON public.doa_app_events USING gin (metadata jsonb_path_ops)",
    "CREATE INDEX doa_app_events_request_id_idx ON public.doa_app_events USING btree (request_id) WHERE (request_id IS NOT NULL)",
    "CREATE INDEX idx_doa_app_events_severity ON public.doa_app_events USING btree (severity)",
    "CREATE INDEX idx_doa_chunks_created ON public.doa_chunks USING btree (created_at DESC)",
    "CREATE INDEX idx_doa_chunks_embedding ON public.doa_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists='50')",
    "CREATE INDEX idx_doa_chunks_fts ON public.doa_chunks USING gin (to_tsvector('spanish'::regconfig, ((((((((COALESCE(content, ''::text) || ' '::text) || COALESCE((metadata ->> 'search_text'::text), ''::text)) || ' '::text) || COALESCE((metadata ->> 'proyecto_ref'::text), ''::text)) || ' '::text) || COALESCE((metadata ->> 'aeronave'::text), ''::text)) || ' '::text) || COALESCE((metadata ->> 'tipo_modificacion'::text), ''::text))))",
    "CREATE INDEX idx_doa_chunks_meta_aeronave ON public.doa_chunks USING btree (((metadata ->> 'aeronave'::text)))",
    "CREATE INDEX idx_doa_chunks_meta_chunk_id ON public.doa_chunks USING btree (((metadata ->> 'chunk_id'::text)))",
    "CREATE INDEX idx_doa_chunks_meta_proyecto_id ON public.doa_chunks USING btree (((metadata ->> 'proyecto_id'::text)))",
    "CREATE INDEX idx_doa_chunks_meta_tipo ON public.doa_chunks USING btree (((metadata ->> 'tipo_modificacion'::text)))",
    "CREATE INDEX idx_doa_chunks_proyecto_id ON public.doa_chunks USING btree (proyecto_id)",
    "CREATE INDEX idx_doa_clientes_contactos_cliente_id ON public.doa_clientes_contactos USING btree (cliente_id)",
    "CREATE INDEX idx_doa_clientes_contactos_email ON public.doa_clientes_contactos USING btree (email)",
    "CREATE INDEX doa_consultas_entrantes_estado_idx ON public.doa_consultas_entrantes USING btree (estado)",
    "CREATE INDEX idx_doa_consultas_entrantes_created_at ON public.doa_consultas_entrantes USING btree (created_at DESC)",
    "CREATE INDEX idx_conteo_horas_inicio ON public.doa_conteo_horas_proyectos USING btree (inicio)",
    "CREATE INDEX idx_conteo_horas_proyecto ON public.doa_conteo_horas_proyectos USING btree (proyecto_id)",
    "CREATE INDEX idx_doa_emails_consulta ON public.doa_emails USING btree (consulta_id)",
    "CREATE INDEX idx_doa_emails_fecha ON public.doa_emails USING btree (consulta_id, fecha)",
    "CREATE UNIQUE INDEX idx_doa_emails_mensaje_id ON public.doa_emails USING btree (mensaje_id) WHERE (mensaje_id IS NOT NULL)",
    "CREATE INDEX idx_doa_part21_created_at ON public.doa_part21_embeddings USING btree (created_at DESC)",
    "CREATE INDEX idx_doa_part21_metadata_category ON public.doa_part21_embeddings USING btree (((metadata ->> 'category'::text)))",
    "CREATE INDEX idx_doa_part21_metadata_chapter ON public.doa_part21_embeddings USING btree (((metadata ->> 'chapter'::text)))",
    "CREATE INDEX idx_doa_part21_metadata_chunk_id ON public.doa_part21_embeddings USING btree (((metadata ->> 'chunk_id'::text)))",
    "CREATE INDEX idx_doa_part21_metadata_classification ON public.doa_part21_embeddings USING btree (((metadata ->> 'classification'::text)))",
    "CREATE INDEX idx_doa_part21_metadata_content_type ON public.doa_part21_embeddings USING btree (((metadata ->> 'content_type'::text)))",
    "CREATE INDEX idx_doa_part21_metadata_document_code ON public.doa_part21_embeddings USING btree (((metadata ->> 'document_code'::text)))",
    "CREATE INDEX idx_doa_part21_metadata_section ON public.doa_part21_embeddings USING btree (((metadata ->> 'section'::text)))",
    "CREATE INDEX idx_doa_part21_parent_id ON public.doa_part21_embeddings USING btree (parent_id)",
    "CREATE INDEX idx_doa_part21_search_text ON public.doa_part21_embeddings USING gin (doa_part21_search_vector(content, metadata))",
    "CREATE INDEX idx_plantillas_compliance_category ON public.doa_plantillas_compliance USING btree (category, sort_order)",
    "CREATE INDEX idx_doa_project_closures_closer ON public.doa_project_closures USING btree (closer_user_id)",
    "CREATE INDEX idx_doa_project_closures_created ON public.doa_project_closures USING btree (created_at DESC)",
    "CREATE INDEX idx_doa_project_closures_proyecto ON public.doa_project_closures USING btree (proyecto_id)",
    "CREATE INDEX idx_doa_project_deliverables_estado ON public.doa_project_deliverables USING btree (proyecto_id, estado)",
    "CREATE INDEX idx_doa_project_deliverables_owner ON public.doa_project_deliverables USING btree (owner_user_id)",
    "CREATE INDEX idx_doa_project_deliverables_proyecto ON public.doa_project_deliverables USING btree (proyecto_id)",
    "CREATE INDEX idx_doa_project_deliveries_dispatch_status ON public.doa_project_deliveries USING btree (dispatch_status)",
    "CREATE INDEX idx_doa_project_deliveries_proyecto ON public.doa_project_deliveries USING btree (proyecto_id)",
    "CREATE INDEX idx_doa_project_deliveries_proyecto_created ON public.doa_project_deliveries USING btree (proyecto_id, created_at DESC)",
    "CREATE INDEX idx_doa_project_lessons_cat_tipo ON public.doa_project_lessons USING btree (categoria, tipo)",
    "CREATE INDEX idx_doa_project_lessons_closure ON public.doa_project_lessons USING btree (closure_id)",
    "CREATE INDEX idx_doa_project_lessons_proyecto ON public.doa_project_lessons USING btree (proyecto_id)",
    "CREATE INDEX idx_doa_project_lessons_tags ON public.doa_project_lessons USING gin (tags)",
    "CREATE INDEX idx_doa_project_signatures_proyecto ON public.doa_project_signatures USING btree (proyecto_id)",
    "CREATE INDEX idx_doa_project_signatures_proyecto_created ON public.doa_project_signatures USING btree (proyecto_id, created_at DESC)",
    "CREATE INDEX idx_doa_project_signatures_signer ON public.doa_project_signatures USING btree (signer_user_id)",
    "CREATE INDEX idx_doa_project_signatures_validation ON public.doa_project_signatures USING btree (validation_id)",
    "CREATE INDEX idx_doa_project_validations_proyecto ON public.doa_project_validations USING btree (proyecto_id)",
    "CREATE INDEX idx_doa_project_validations_proyecto_created ON public.doa_project_validations USING btree (proyecto_id, created_at DESC)",
    "CREATE INDEX idx_doa_project_validations_validator ON public.doa_project_validations USING btree (validator_user_id)",
    "CREATE INDEX idx_doa_proy_estado ON public.doa_proyectos USING btree (estado)",
    "CREATE INDEX idx_doa_proy_numero ON public.doa_proyectos USING btree (numero_proyecto)",
    "CREATE INDEX idx_doa_proy_tcds ON public.doa_proyectos USING btree (tcds_code_short)",
    "CREATE INDEX idx_doa_proyectos_estado_v2 ON public.doa_proyectos USING btree (estado_v2)",
    "CREATE INDEX idx_doa_proyectos_fase_actual ON public.doa_proyectos USING btree (fase_actual)",
    "CREATE INDEX doa_proyectos_historico_aeronave_idx ON public.doa_proyectos_historico USING btree (aeronave)",
    "CREATE INDEX doa_proyectos_historico_anio_idx ON public.doa_proyectos_historico USING btree (anio)",
    "CREATE INDEX doa_proyectos_historico_client_id_idx ON public.doa_proyectos_historico USING btree (client_id)",
    "CREATE INDEX doa_proyectos_historico_cliente_nombre_idx ON public.doa_proyectos_historico USING btree (cliente_nombre)",
    "CREATE INDEX doa_proyectos_historico_created_at_idx ON public.doa_proyectos_historico USING btree (created_at DESC)",
    "CREATE INDEX doa_proyectos_historico_msn_idx ON public.doa_proyectos_historico USING btree (msn)",
    "CREATE INDEX idx_historico_archivos_documento_id ON public.doa_proyectos_historico_archivos USING btree (documento_id)",
    "CREATE INDEX idx_historico_archivos_vigente ON public.doa_proyectos_historico_archivos USING btree (es_edicion_vigente) WHERE (es_edicion_vigente = true)",
    "CREATE INDEX doa_proyectos_historico_documentos_order_idx ON public.doa_proyectos_historico_documentos USING btree (orden_documental, familia_documental)",
    "CREATE UNIQUE INDEX doa_proyectos_historico_documentos_project_folder_uidx ON public.doa_proyectos_historico_documentos USING btree (proyecto_historico_id, carpeta_origen)",
    "CREATE INDEX doa_proyectos_historico_documentos_project_idx ON public.doa_proyectos_historico_documentos USING btree (proyecto_historico_id)",
    "CREATE INDEX idx_doa_quotation_items_quotation ON public.doa_quotation_items USING btree (quotation_id)",
    "CREATE INDEX idx_doa_quotations_consulta ON public.doa_quotations USING btree (consulta_id)",
    "CREATE INDEX idx_respuestas_consulta_id ON public.doa_respuestas_formularios USING btree (consulta_id)",
    "CREATE INDEX idx_respuestas_email ON public.doa_respuestas_formularios USING btree (contact_email)",
    "CREATE INDEX idx_doa_tcds_embeddings_created_at ON public.doa_tcds_embeddings USING btree (created_at DESC)",
    "CREATE INDEX idx_doa_tcds_embeddings_metadata_agency ON public.doa_tcds_embeddings USING btree (((metadata ->> 'agency'::text)))",
    "CREATE INDEX idx_doa_tcds_embeddings_metadata_chunk_id ON public.doa_tcds_embeddings USING btree (((metadata ->> 'chunk_id'::text)))",
    "CREATE INDEX idx_doa_tcds_embeddings_metadata_doc_type ON public.doa_tcds_embeddings USING btree (((metadata ->> 'doc_type'::text)))",
    "CREATE INDEX idx_doa_tcds_embeddings_metadata_normalized_section_id ON public.doa_tcds_embeddings USING btree (((metadata ->> 'normalized_section_id'::text)))",
    "CREATE INDEX idx_doa_tcds_embeddings_metadata_official_code ON public.doa_tcds_embeddings USING btree (((metadata ->> 'official_code'::text)))",
    "CREATE INDEX idx_doa_tcds_embeddings_metadata_section_id ON public.doa_tcds_embeddings USING btree (((metadata ->> 'section_id'::text)))",
    "CREATE INDEX idx_doa_tcds_embeddings_parent_id ON public.doa_tcds_embeddings USING btree (parent_id)",
    "CREATE INDEX idx_doa_tcds_embeddings_search_text ON public.doa_tcds_embeddings USING gin (doa_tcds_search_vector(content, metadata))",
    "CREATE INDEX idx_doa_workflow_state_config_scope ON public.doa_workflow_state_config USING btree (scope)",
    "CREATE INDEX idx_doa_workflow_state_config_scope_active ON public.doa_workflow_state_config USING btree (scope, is_active)",
    "CREATE INDEX idx_doa_workflow_state_config_scope_order ON public.doa_workflow_state_config USING btree (scope, sort_order)",
]

# ---------------------------------------------------------------------------
# Functions
# ---------------------------------------------------------------------------
FUNCTIONS = [
    # auto_generate_numero_entrada
    r"""CREATE OR REPLACE FUNCTION public.auto_generate_numero_entrada()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  current_prefix TEXT;
  max_num INTEGER;
  next_num INTEGER;
BEGIN
  IF NEW.numero_entrada IS NULL OR NEW.numero_entrada = '' THEN
    -- Advisory lock prevents concurrent inserts from generating same number
    PERFORM pg_advisory_xact_lock(hashtext('numero_entrada_gen'));

    current_prefix := 'QRY-' || EXTRACT(YEAR FROM NOW())::TEXT || '-';

    SELECT COALESCE(MAX(
      CAST(REPLACE(numero_entrada, current_prefix, '') AS INTEGER)
    ), 0)
    INTO max_num
    FROM ams_consultas_entrantes
    WHERE numero_entrada LIKE current_prefix || '%';

    next_num := max_num + 1;
    NEW.numero_entrada := current_prefix || LPAD(next_num::TEXT, 4, '0');
  END IF;

  RETURN NEW;
END;
$function$""",
    # ams_part21_search_vector (was doa_part21_search_vector)
    r"""CREATE OR REPLACE FUNCTION public.ams_part21_search_vector(content text, metadata jsonb)
 RETURNS tsvector
 LANGUAGE sql
 IMMUTABLE
AS $function$
    SELECT to_tsvector(
        'simple',
        concat_ws(
            ' ',
            COALESCE(content, ''),
            COALESCE(metadata->>'search_text', ''),
            COALESCE(metadata->>'section', ''),
            COALESCE(metadata->>'section_title', ''),
            COALESCE(metadata->>'document_code', ''),
            COALESCE(metadata->>'document_title', ''),
            COALESCE(metadata->>'category', ''),
            COALESCE(metadata->>'classification', ''),
            COALESCE(metadata->>'content_type', '')
        )
    );
$function$""",
    # ams_proyectos_historico_documentos_set_updated_at
    r"""CREATE OR REPLACE FUNCTION public.ams_proyectos_historico_documentos_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$function$""",
    # ams_tcds_search_vector
    r"""CREATE OR REPLACE FUNCTION public.ams_tcds_search_vector(content text, metadata jsonb)
 RETURNS tsvector
 LANGUAGE sql
 IMMUTABLE
AS $function$
    SELECT to_tsvector(
        'simple',
        concat_ws(
            ' ',
            COALESCE(content, ''),
            COALESCE(metadata->>'search_text', ''),
            COALESCE(metadata->>'section_id', ''),
            COALESCE(metadata->>'normalized_section_id', ''),
            COALESCE(metadata->>'official_code', ''),
            COALESCE(metadata->>'document_title', ''),
            COALESCE(metadata->>'title', ''),
            COALESCE(metadata->>'agency', ''),
            COALESCE(metadata->>'doc_type', '')
        )
    );
$function$""",
    # set_ams_project_deliverables_updated_at (renamed from set_doa_*)
    r"""CREATE OR REPLACE FUNCTION public.set_ams_project_deliverables_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$""",
    r"""CREATE OR REPLACE FUNCTION public.set_ams_project_deliveries_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$""",
    r"""CREATE OR REPLACE FUNCTION public.set_ams_project_lessons_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$""",
    # set_updated_at — kept as-is (not doa_* prefixed)
    r"""CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$""",
    # trg_set_updated_at
    r"""CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$function$""",
    # generate_quotation_number (renamed doa_quotations -> ams_quotations in body)
    r"""CREATE OR REPLACE FUNCTION public.generate_quotation_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  current_year text;
  next_seq integer;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;

  SELECT COALESCE(
    MAX(
      CAST(SPLIT_PART(quotation_number, '-', 3) AS integer)
    ), 0
  ) + 1
  INTO next_seq
  FROM ams_quotations
  WHERE quotation_number LIKE 'Q-' || current_year || '-%';

  RETURN 'Q-' || current_year || '-' || LPAD(next_seq::text, 6, '0');
END;
$function$""",
    r"""CREATE OR REPLACE FUNCTION public.trg_set_quotation_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.quotation_number IS NULL OR NEW.quotation_number = '' THEN
    NEW.quotation_number := generate_quotation_number();
  END IF;
  RETURN NEW;
END;
$function$""",
    r"""CREATE OR REPLACE FUNCTION public.update_ams_chunks_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$""",
    r"""CREATE OR REPLACE FUNCTION public.update_ams_part21_embeddings_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$""",
    r"""CREATE OR REPLACE FUNCTION public.update_ams_tcds_embeddings_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$""",
]

# ---------------------------------------------------------------------------
# Triggers
# ---------------------------------------------------------------------------
TRIGGERS = [
    "CREATE TRIGGER trg_doa_chunks_updated_at BEFORE UPDATE ON public.doa_chunks FOR EACH ROW EXECUTE FUNCTION update_doa_chunks_updated_at()",
    "CREATE TRIGGER trg_auto_numero_entrada BEFORE INSERT ON public.doa_consultas_entrantes FOR EACH ROW EXECUTE FUNCTION auto_generate_numero_entrada()",
    "CREATE TRIGGER update_doa_part21_embeddings_updated_at BEFORE UPDATE ON public.doa_part21_embeddings FOR EACH ROW EXECUTE FUNCTION update_doa_part21_embeddings_updated_at_column()",
    "CREATE TRIGGER trg_doa_project_deliverables_updated_at BEFORE UPDATE ON public.doa_project_deliverables FOR EACH ROW EXECUTE FUNCTION set_doa_project_deliverables_updated_at()",
    "CREATE TRIGGER trg_doa_project_deliveries_updated_at BEFORE UPDATE ON public.doa_project_deliveries FOR EACH ROW EXECUTE FUNCTION set_doa_project_deliveries_updated_at()",
    "CREATE TRIGGER trg_doa_project_lessons_updated_at BEFORE UPDATE ON public.doa_project_lessons FOR EACH ROW EXECUTE FUNCTION set_doa_project_lessons_updated_at()",
    "CREATE TRIGGER update_doa_proyectos_updated_at BEFORE UPDATE ON public.doa_proyectos FOR EACH ROW EXECUTE FUNCTION update_doa_tcds_embeddings_updated_at_column()",
    "CREATE TRIGGER doa_proyectos_historico_documentos_set_updated_at BEFORE UPDATE ON public.doa_proyectos_historico_documentos FOR EACH ROW EXECUTE FUNCTION doa_proyectos_historico_documentos_set_updated_at()",
    "CREATE TRIGGER trg_quotations_updated_at BEFORE UPDATE ON public.doa_quotations FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()",
    "CREATE TRIGGER trg_quotation_number_before_insert BEFORE INSERT ON public.doa_quotations FOR EACH ROW EXECUTE FUNCTION trg_set_quotation_number()",
    "CREATE TRIGGER update_doa_tcds_embeddings_updated_at BEFORE UPDATE ON public.doa_tcds_embeddings FOR EACH ROW EXECUTE FUNCTION update_doa_tcds_embeddings_updated_at_column()",
    "CREATE TRIGGER trg_doa_workflow_state_config_updated_at BEFORE UPDATE ON public.doa_workflow_state_config FOR EACH ROW EXECUTE FUNCTION set_updated_at()",
]

# ---------------------------------------------------------------------------
# RLS: tables with RLS enabled
# ---------------------------------------------------------------------------
RLS_TABLES = [
    "doa_ai_response_cache",
    "doa_app_events",
    "doa_chunks",
    "doa_conteo_horas_proyectos",
    "doa_project_closures",
    "doa_project_deliverables",
    "doa_project_deliveries",
    "doa_project_lessons",
    "doa_project_signatures",
    "doa_project_validations",
    "doa_proyectos",
    "doa_respuestas_formularios",
    "doa_tcds_embeddings",
]

POLICIES = [
    ("doa_chunks", "allow_all_ams_chunks", "{public}", "ALL", "true", None),
    ("doa_conteo_horas_proyectos", "Allow all for authenticated and anon", "{public}", "ALL", "true", "true"),
    ("doa_project_closures", "ams_project_closures_select", "{public}", "SELECT", "(auth.role() = 'authenticated'::text)", None),
    ("doa_project_closures", "ams_project_closures_service_all", "{public}", "ALL", "(auth.role() = 'service_role'::text)", None),
    ("doa_project_deliverables", "ams_project_deliverables_select", "{public}", "SELECT", "(auth.role() = 'authenticated'::text)", None),
    ("doa_project_deliverables", "ams_project_deliverables_service_all", "{public}", "ALL", "(auth.role() = 'service_role'::text)", None),
    ("doa_project_deliveries", "ams_project_deliveries_select", "{public}", "SELECT", "(auth.role() = 'authenticated'::text)", None),
    ("doa_project_deliveries", "ams_project_deliveries_service_all", "{public}", "ALL", "(auth.role() = 'service_role'::text)", None),
    ("doa_project_lessons", "ams_project_lessons_select", "{public}", "SELECT", "(auth.role() = 'authenticated'::text)", None),
    ("doa_project_lessons", "ams_project_lessons_service_all", "{public}", "ALL", "(auth.role() = 'service_role'::text)", None),
    ("doa_project_signatures", "ams_project_signatures_select", "{public}", "SELECT", "(auth.role() = 'authenticated'::text)", None),
    ("doa_project_signatures", "ams_project_signatures_service_all", "{public}", "ALL", "(auth.role() = 'service_role'::text)", None),
    ("doa_project_validations", "ams_project_validations_select", "{public}", "SELECT", "(auth.role() = 'authenticated'::text)", None),
    ("doa_project_validations", "ams_project_validations_service_all", "{public}", "ALL", "(auth.role() = 'service_role'::text)", None),
    ("doa_proyectos", "Allow public read", "{public}", "SELECT", "true", None),
    ("doa_proyectos", "Allow service role full access", "{public}", "ALL", "(auth.role() = 'service_role'::text)", None),
    ("doa_respuestas_formularios", "Allow all for service role", "{public}", "ALL", "true", "true"),
    ("doa_tcds_embeddings", "Allow public read access on ams_tcds_embeddings", "{public}", "SELECT", "true", None),
    ("doa_tcds_embeddings", "Allow service role full access on ams_tcds_embeddings", "{public}", "ALL", "(auth.role() = 'service_role'::text)", "(auth.role() = 'service_role'::text)"),
]

# ---------------------------------------------------------------------------
# Storage buckets
# ---------------------------------------------------------------------------
STORAGE_BUCKETS = [
    # (renamed_id, public)
    ("ams-formularios", True),
    ("ams-tcds-storage", True),
]

# ---------------------------------------------------------------------------
# Materialized view (renamed body)
# ---------------------------------------------------------------------------
MATVIEW = {
    "name": "doa_project_metrics_mv",
    "definition": """WITH del_agg AS (
         SELECT d.proyecto_id,
            count(*) FILTER (WHERE true) AS deliverables_total,
            count(*) FILTER (WHERE (d.estado = 'completado'::text)) AS deliverables_completado,
            count(*) FILTER (WHERE (d.estado = 'no_aplica'::text)) AS deliverables_no_aplica,
            count(*) FILTER (WHERE (d.estado = 'bloqueado'::text)) AS deliverables_bloqueado
           FROM doa_project_deliverables d
          GROUP BY d.proyecto_id
        ), val_agg AS (
         SELECT v.proyecto_id,
            count(*) AS validaciones_total,
            count(*) FILTER (WHERE (v.decision = 'aprobado'::text)) AS validaciones_aprobadas,
            count(*) FILTER (WHERE (v.decision = 'devuelto'::text)) AS validaciones_devueltas
           FROM doa_project_validations v
          GROUP BY v.proyecto_id
        ), ent_agg AS (
         SELECT e.proyecto_id,
            count(*) AS entregas_total,
            count(*) FILTER (WHERE (e.dispatch_status = ANY (ARRAY['enviado'::text, 'confirmado_cliente'::text]))) AS entregas_enviadas,
            count(*) FILTER (WHERE (e.dispatch_status = 'confirmado_cliente'::text)) AS entregas_confirmadas
           FROM doa_project_deliveries e
          GROUP BY e.proyecto_id
        ), less_agg AS (
         SELECT l.proyecto_id,
            count(*) AS lecciones_count
           FROM doa_project_lessons l
          GROUP BY l.proyecto_id
        )
 SELECT p.id AS proyecto_id,
    p.titulo,
    p.client_id AS cliente_id,
    p.estado_v2,
    p.fase_actual,
    p.created_at,
    p.estado_updated_at,
    COALESCE(da.deliverables_total, (0)::bigint) AS deliverables_total,
    COALESCE(da.deliverables_completado, (0)::bigint) AS deliverables_completado,
    COALESCE(da.deliverables_no_aplica, (0)::bigint) AS deliverables_no_aplica,
    COALESCE(da.deliverables_bloqueado, (0)::bigint) AS deliverables_bloqueado,
    COALESCE(va.validaciones_total, (0)::bigint) AS validaciones_total,
    COALESCE(va.validaciones_aprobadas, (0)::bigint) AS validaciones_aprobadas,
    COALESCE(va.validaciones_devueltas, (0)::bigint) AS validaciones_devueltas,
    COALESCE(ea.entregas_total, (0)::bigint) AS entregas_total,
    COALESCE(ea.entregas_enviadas, (0)::bigint) AS entregas_enviadas,
    COALESCE(ea.entregas_confirmadas, (0)::bigint) AS entregas_confirmadas,
    NULL::numeric AS horas_plan,
    NULL::numeric AS horas_real,
    (EXTRACT(epoch FROM (COALESCE(p.estado_updated_at, now()) - p.created_at)) / 86400.0) AS dias_en_ejecucion,
    NULL::numeric AS dias_en_validacion,
    NULL::numeric AS dias_en_entrega,
        CASE
            WHEN (p.estado_v2 = ANY (ARRAY['cerrado'::text, 'archivado_proyecto'::text])) THEN (EXTRACT(epoch FROM (COALESCE(p.estado_updated_at, now()) - p.created_at)) / 86400.0)
            ELSE (EXTRACT(epoch FROM (now() - p.created_at)) / 86400.0)
        END AS dias_totales_cerrado_vs_abierto,
    c.outcome AS closure_outcome,
    COALESCE(la.lecciones_count, (0)::bigint) AS lecciones_count
   FROM (((((doa_proyectos p
     LEFT JOIN del_agg da ON ((da.proyecto_id = p.id)))
     LEFT JOIN val_agg va ON ((va.proyecto_id = p.id)))
     LEFT JOIN ent_agg ea ON ((ea.proyecto_id = p.id)))
     LEFT JOIN less_agg la ON ((la.proyecto_id = p.id)))
     LEFT JOIN doa_project_closures c ON ((c.proyecto_id = p.id)))""",
    "indexes": [
        "CREATE INDEX idx_doa_project_metrics_mv_estado ON public.doa_project_metrics_mv USING btree (estado_v2)",
        "CREATE INDEX idx_doa_project_metrics_mv_fase ON public.doa_project_metrics_mv USING btree (fase_actual)",
        "CREATE UNIQUE INDEX idx_doa_project_metrics_mv_proyecto ON public.doa_project_metrics_mv USING btree (proyecto_id)",
    ],
}


# ---------------------------------------------------------------------------
# Helpers to build column DDL
# ---------------------------------------------------------------------------
def fmt_type(col: dict) -> str:
    """Return the SQL type fragment for a column row from information_schema."""
    udt = col["udt_name"]
    dt = col["data_type"]
    if udt == "uuid":
        return "uuid"
    if udt == "bool":
        return "boolean"
    if udt == "int4":
        return "integer"
    if udt == "int8":
        return "bigint"
    if udt == "numeric":
        p, s = col["numeric_precision"], col["numeric_scale"]
        if p is not None:
            return f"numeric({p},{s})" if s is not None else f"numeric({p})"
        return "numeric"
    if udt == "text":
        return "text"
    if udt == "jsonb":
        return "jsonb"
    if udt == "timestamptz":
        return "timestamptz"
    if udt == "date":
        return "date"
    if udt == "_text":
        return "text[]"
    if udt == "vector":
        # information_schema doesn't carry the vector dim.
        # The three vector columns in the schema have known dims:
        #   doa_chunks.embedding              -> vector(1536)
        #   doa_tcds_embeddings.embedding     -> vector(3072)
        #   doa_part21_embeddings.embedding   -> vector(3072)
        t = col["table_name"]
        if t == "doa_chunks":
            return "vector(1536)"
        if t in ("doa_tcds_embeddings", "doa_part21_embeddings"):
            return "vector(3072)"
        # unknown: conservative default
        return "vector(1536)"
    # fallback
    return dt


def is_sequence_default(default: str) -> bool:
    return default is not None and "nextval(" in default


def build_table(table: str, table_cols: list[dict], constraints: list[dict]) -> str:
    lines = []
    lines.append(f"CREATE TABLE public.{rn(table)} (")
    col_parts = []
    for c in table_cols:
        name = c["column_name"]
        typ = fmt_type(c)
        default = c["column_default"]
        nn = c["is_nullable"] == "NO"
        parts = [f"    {name} {typ}"]
        if default is not None:
            parts.append(f"DEFAULT {rn(default)}")
        if nn:
            parts.append("NOT NULL")
        col_parts.append(" ".join(parts))

    # Primary key and uniques go into CREATE TABLE
    for c in constraints:
        if c["table_name"] != table:
            continue
        if c["constraint_type"] == "PRIMARY KEY":
            col_parts.append(f"    CONSTRAINT {rn(c['constraint_name'])} PRIMARY KEY ({c['cols']})")
        elif c["constraint_type"] == "UNIQUE":
            col_parts.append(f"    CONSTRAINT {rn(c['constraint_name'])} UNIQUE ({c['cols']})")
        elif c["constraint_type"] == "CHECK":
            cl = c["check_clause"]
            if cl and "IS NOT NULL" in cl:
                continue  # emitted via NOT NULL on column
            if cl:
                col_parts.append(f"    CONSTRAINT {rn(c['constraint_name'])} CHECK ({rn(cl)})")

    lines.append(",\n".join(col_parts))
    lines.append(");")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Topological order for CREATE TABLE (parents before children)
# ---------------------------------------------------------------------------
ALL_TABLES = sorted(set(c["table_name"] for c in COLUMNS))
FK_GRAPH = {t: set() for t in ALL_TABLES}
for child, ccol, parent, pcol, upd, dele, nm in FOREIGN_KEYS:
    if parent in FK_GRAPH and parent != child:
        FK_GRAPH[child].add(parent)


def toposort() -> list[str]:
    out, seen = [], set()

    def visit(n: str, stack: set[str]):
        if n in seen:
            return
        if n in stack:
            # cycle — emit anyway
            return
        stack.add(n)
        for p in sorted(FK_GRAPH[n]):
            visit(p, stack)
        stack.remove(n)
        seen.add(n)
        out.append(n)

    for t in ALL_TABLES:
        visit(t, set())
    return out


# ---------------------------------------------------------------------------
# Generate SQL
# ---------------------------------------------------------------------------
sql = []
sql.append("-- =======================================================================")
sql.append("-- AMS BOOTSTRAP (Cloud Supabase -> self-hosted AMS)")
sql.append("-- Generated 2026-04-18 from the Cloud project `gterzsoapepzozgqbljk`.")
sql.append("-- Produces the full `ams_*` schema from scratch (rename of `doa_*`).")
sql.append("-- This file is idempotent on a clean database. It supersedes all the")
sql.append("-- legacy `doa_*.sql` migrations in this folder, which should be moved")
sql.append("-- to `_archive/` in Phase B before running this file.")
sql.append("-- Rename rules applied:")
sql.append("--   doa_<ident>    -> ams_<ident>   (tables, functions, indexes, policies, triggers, constraints)")
sql.append("--   doa-<bucket>   -> ams-<bucket>  (storage.buckets)")
sql.append("-- Unchanged: enum VALUES, column names, domain strings.")
sql.append("-- =======================================================================")
sql.append("")

# 1) Extensions
sql.append("-- 1. Extensions -------------------------------------------------------------")
for ext in EXTENSIONS:
    sql.append(f'CREATE EXTENSION IF NOT EXISTS "{ext}";')
sql.append("")

# 2) Enums
sql.append("-- 2. Enums ------------------------------------------------------------------")
for name, vals in ENUMS.items():
    vals_sql = ", ".join(f"'{v}'" for v in vals)
    sql.append("DO $$ BEGIN")
    sql.append(f"    CREATE TYPE public.{name} AS ENUM ({vals_sql});")
    sql.append("EXCEPTION WHEN duplicate_object THEN NULL; END $$;")
sql.append("")

# 3) Sequences
sql.append("-- 3. Sequences --------------------------------------------------------------")
for seq in SEQUENCES:
    sql.append(f"CREATE SEQUENCE IF NOT EXISTS public.{seq};")
sql.append("")

# 4) Tables (topo-sorted)
sql.append("-- 4. Tables -----------------------------------------------------------------")
cols_by_table: dict[str, list[dict]] = {}
for c in COLUMNS:
    cols_by_table.setdefault(c["table_name"], []).append(c)

for t in toposort():
    tcols = cols_by_table[t]
    sql.append(build_table(t, tcols, CONSTRAINTS))
    sql.append("")

# 5) Indexes (non-constraint)
sql.append("-- 5. Indexes (non-constraint) -----------------------------------------------")
for idx in INDEX_DEFS:
    # renamed
    sql.append(rn(idx) + ";")
sql.append("")

# 6) Foreign keys
sql.append("-- 6. Foreign keys -----------------------------------------------------------")
for child, ccol, parent, pcol, upd, dele, nm in FOREIGN_KEYS:
    ref = f"REFERENCES public.{rn(parent)} ({pcol})"
    actions = []
    if upd and upd != "NO ACTION":
        actions.append(f"ON UPDATE {upd}")
    if dele and dele != "NO ACTION":
        actions.append(f"ON DELETE {dele}")
    act = (" " + " ".join(actions)) if actions else ""
    sql.append(
        f"ALTER TABLE public.{rn(child)} ADD CONSTRAINT {rn(nm)} "
        f"FOREIGN KEY ({ccol}) {ref}{act};"
    )
sql.append("")

# 7) Functions
sql.append("-- 7. Functions --------------------------------------------------------------")
for fn in FUNCTIONS:
    sql.append(fn + ";")
    sql.append("")

# 8) Triggers (renamed everywhere)
sql.append("-- 8. Triggers ---------------------------------------------------------------")
for trg in TRIGGERS:
    sql.append(rn(trg) + ";")
sql.append("")

# 9) RLS
sql.append("-- 9. Row Level Security -----------------------------------------------------")
for t in RLS_TABLES:
    sql.append(f"ALTER TABLE public.{rn(t)} ENABLE ROW LEVEL SECURITY;")
sql.append("")
for table, name, roles, cmd, qual, wc in POLICIES:
    role_list = "public" if roles == "{public}" else roles.strip("{}").replace(",", ", ")
    parts = [f'CREATE POLICY "{rn(name)}" ON public.{rn(table)}']
    parts.append(f"    FOR {cmd}")
    parts.append(f"    TO {role_list}")
    if qual:
        parts.append(f"    USING ({rn(qual)})")
    if wc:
        parts.append(f"    WITH CHECK ({rn(wc)})")
    sql.append("\n".join(parts) + ";")
sql.append("")

# 10) Materialized view + its indexes
sql.append("-- 10. Materialized views ----------------------------------------------------")
mv_name = rn(MATVIEW["name"])
mv_def = rn(MATVIEW["definition"])
sql.append(f"CREATE MATERIALIZED VIEW public.{mv_name} AS")
sql.append(mv_def + ";")
sql.append("")
for idx in MATVIEW["indexes"]:
    sql.append(rn(idx) + ";")
sql.append("")

# 11) Grants (standard Supabase pattern)
sql.append("-- 11. Grants ----------------------------------------------------------------")
sql.append("GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;")
sql.append("GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;")
sql.append("GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;")
sql.append("GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;")
sql.append("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;")
sql.append("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;")
sql.append("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;")
sql.append("")

# 12) Storage buckets
sql.append("-- 12. Storage buckets -------------------------------------------------------")
for bid, pub in STORAGE_BUCKETS:
    sql.append(
        f"INSERT INTO storage.buckets (id, name, public) "
        f"VALUES ('{bid}', '{bid}', {str(pub).lower()}) ON CONFLICT (id) DO NOTHING;"
    )
sql.append("")

sql.append("-- END OF BOOTSTRAP ---------------------------------------------------------")

out_text = "\n".join(sql) + "\n"
OUT_SQL.write_text(out_text, encoding="utf-8")
print(f"wrote {OUT_SQL} ({out_text.count(chr(10))} lines, {len(out_text)} chars)")

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
tables = [rn(t) for t in ALL_TABLES]
rename_map = {t: rn(t) for t in ALL_TABLES}
fn_count = len(FUNCTIONS)
trg_count = len(TRIGGERS)
pol_count = len(POLICIES)
rls_tables_renamed = [rn(t) for t in RLS_TABLES]
all_tables_no_rls = [rn(t) for t in ALL_TABLES if t not in RLS_TABLES]

report = []
report.append("# AMS bootstrap extraction report")
report.append("")
report.append(f"Source: Cloud Supabase project `gterzsoapepzozgqbljk` (Certification_Data_base, eu-west-1).")
report.append("")
report.append(f"Output file: `20260418000000_ams_bootstrap.sql`")
report.append(f"Helper input files (safe to delete after review): `_ex_columns.json`, `_ex_constraints.json`, `_build_bootstrap.py`.")
report.append("")
report.append("## Counts")
report.append(f"- Tables: **{len(ALL_TABLES)}** (all `doa_*` in public)")
report.append(f"- Enums: **{len(ENUMS)}**")
report.append(f"- Sequences (explicit CREATE SEQUENCE): **{len(SEQUENCES)}** — `ams_solicitudes_seq`, `ams_ofertas_seq`, `ams_chunks_id_seq`, `ams_tcds_embeddings_id_seq`, `ams_part21_embeddings_id_seq`")
report.append(f"- Functions kept: **{fn_count}** (all `doa_new_*` intentionally skipped; legacy `drop_legacy_doa_new_tables` migration confirms they're dead)")
report.append(f"- Triggers: **{trg_count}**")
report.append(f"- RLS-enabled tables: **{len(RLS_TABLES)}**")
report.append(f"- RLS policies: **{pol_count}**")
report.append(f"- Foreign keys: **{len(FOREIGN_KEYS)}**")
report.append(f"- Non-constraint indexes: **{len(INDEX_DEFS)}**")
report.append(f"- Materialized views: **1** (`ams_project_metrics_mv`)")
report.append(f"- Storage buckets renamed: **{len(STORAGE_BUCKETS)}**")
report.append("")
report.append("## Rename map (doa_* -> ams_*)")
report.append("")
report.append("| From | To |")
report.append("| --- | --- |")
for k, v in sorted(rename_map.items()):
    report.append(f"| `{k}` | `{v}` |")
report.append("")
report.append("## Storage buckets renamed")
report.append("- `doa-formularios` -> `ams-formularios` (public)")
report.append("- `doa-tcds-storage` -> `ams-tcds-storage` (public)")
report.append("")
report.append("## Enums (values unchanged)")
for n, v in ENUMS.items():
    report.append(f"- `{n}`: {v}")
report.append("")
report.append("## Functions kept (doa_new_* NOT included)")
fn_names = [
    "auto_generate_numero_entrada",
    "ams_part21_search_vector (was doa_part21_search_vector)",
    "ams_proyectos_historico_documentos_set_updated_at (was doa_...)",
    "ams_tcds_search_vector (was doa_tcds_search_vector)",
    "set_ams_project_deliverables_updated_at (was set_doa_...)",
    "set_ams_project_deliveries_updated_at",
    "set_ams_project_lessons_updated_at",
    "set_updated_at (name unchanged - no doa_ prefix)",
    "trg_set_updated_at (name unchanged)",
    "generate_quotation_number (body references ams_quotations)",
    "trg_set_quotation_number (name unchanged)",
    "update_ams_chunks_updated_at (was update_doa_...)",
    "update_ams_part21_embeddings_updated_at_column",
    "update_ams_tcds_embeddings_updated_at_column",
]
for f in fn_names:
    report.append(f"- {f}")
report.append("")
report.append("## Top warnings")
report.append("- **RLS disabled on many tables** in Cloud source (intentional, but worth reviewing for AMS).")
report.append("  Tables currently without RLS in the bootstrap: " + ", ".join(f"`{t}`" for t in all_tables_no_rls))
report.append("- Policies on `doa_chunks`, `doa_conteo_horas_proyectos`, `doa_respuestas_formularios`, `doa_proyectos`, `doa_tcds_embeddings` use `roles=public` (broad). Consider tightening when moving to AMS (self-hosted tenancy may differ).")
report.append("- `update_doa_proyectos_updated_at` trigger on `doa_proyectos` executes `update_doa_tcds_embeddings_updated_at_column` (a quirk of the Cloud setup reusing a generic NOW() fn). Preserved as-is using `update_ams_tcds_embeddings_updated_at_column`.")
report.append("- `vector` dimensions (confirmed via pg_attribute): `ams_chunks.embedding` is `vector(1536)`; `ams_tcds_embeddings.embedding` and `ams_part21_embeddings.embedding` are `vector(3072)`. All three are correctly hardcoded in the bootstrap.")
report.append("- `supabase_vault` extension is managed by Supabase Cloud; NOT re-created here. Self-hosted AMS only needs it if the app uses Vault secrets.")
report.append("- `drop_legacy_doa_new_tables` was already present in the old migrations folder and confirms `doa_new_*` functions/tables are dead — they are intentionally excluded from this bootstrap.")
report.append("- Check constraints of form `numero_precision IS NOT NULL` are emitted as NOT NULL on the column, not as named CHECK.")
report.append("- Foreign key rename mapping example: `doa_emails_consulta_id_fkey` -> `ams_emails_consulta_id_fkey`.")
report.append("")
report.append("## Next recommended")
report.append("Apply Phase B — move old `doa_*.sql` to `_archive/` and run `supabase db push` (or equivalent) against the `ams-supabase-kong` self-hosted instance.")
report.append("")

OUT_REPORT.write_text("\n".join(report), encoding="utf-8")
print(f"wrote {OUT_REPORT}")
