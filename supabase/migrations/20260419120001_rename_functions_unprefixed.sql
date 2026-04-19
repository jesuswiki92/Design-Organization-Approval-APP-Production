-- APLICADO: 2026-04-19
-- =============================================================================
-- Migración: rename_functions_unprefixed
-- Fecha: 2026-04-19
-- Objetivo: Reescribir las 12 funciones que tenían `ams_` en su nombre o cuerpo
--           tras el rename de tablas. Algunas simplemente necesitan actualizar
--           el body (auto_generate_numero_entrada, generate_quotation_number,
--           match_proyectos_precedentes) y otras necesitan además un nuevo
--           nombre sin prefijo.
-- Procedimiento: DROP FUNCTION ... CASCADE (porque hay triggers atados) y
--           recreación de funciones + triggers.
-- =============================================================================

BEGIN;

-- =============================================================================
-- [A] Drop triggers que usan funciones con `ams_` en el nombre (CASCADE en la
--     función los tumbaría, pero es más limpio dropearlos explícitamente).
-- =============================================================================
DROP TRIGGER IF EXISTS trg_ams_chunks_updated_at ON public.chunks;
DROP TRIGGER IF EXISTS update_ams_part21_embeddings_updated_at ON public.part21_embeddings;
DROP TRIGGER IF EXISTS trg_ams_project_deliverables_updated_at ON public.project_deliverables;
DROP TRIGGER IF EXISTS trg_ams_project_deliveries_updated_at ON public.project_deliveries;
DROP TRIGGER IF EXISTS trg_ams_project_lessons_updated_at ON public.project_lessons;
DROP TRIGGER IF EXISTS update_ams_proyectos_updated_at ON public.proyectos;
DROP TRIGGER IF EXISTS ams_proyectos_historico_documentos_set_updated_at ON public.proyectos_historico_documentos;
DROP TRIGGER IF EXISTS update_ams_tcds_embeddings_updated_at ON public.tcds_embeddings;
DROP TRIGGER IF EXISTS trg_ams_workflow_state_config_updated_at ON public.workflow_state_config;

-- =============================================================================
-- [B.0] Drop índices funcionales que dependen de funciones con `ams_`.
--      Se recrean al final con los nombres nuevos.
-- =============================================================================
DROP INDEX IF EXISTS public.idx_ams_part21_search_text;
DROP INDEX IF EXISTS public.idx_ams_tcds_embeddings_search_text;

-- =============================================================================
-- [B] Drop funciones con `ams_` en el nombre.
-- =============================================================================
DROP FUNCTION IF EXISTS public.ams_part21_search_vector(text, jsonb);
DROP FUNCTION IF EXISTS public.ams_proyectos_historico_documentos_set_updated_at();
DROP FUNCTION IF EXISTS public.ams_tcds_search_vector(text, jsonb);
DROP FUNCTION IF EXISTS public.set_ams_project_deliverables_updated_at();
DROP FUNCTION IF EXISTS public.set_ams_project_deliveries_updated_at();
DROP FUNCTION IF EXISTS public.set_ams_project_lessons_updated_at();
DROP FUNCTION IF EXISTS public.update_ams_chunks_updated_at();
DROP FUNCTION IF EXISTS public.update_ams_part21_embeddings_updated_at_column();
DROP FUNCTION IF EXISTS public.update_ams_tcds_embeddings_updated_at_column();

-- =============================================================================
-- [C] Re-crear funciones con nombres sin prefijo (mismos bodies, sin cambios).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.part21_search_vector(content text, metadata jsonb)
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
$function$;

CREATE OR REPLACE FUNCTION public.proyectos_historico_documentos_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tcds_search_vector(content text, metadata jsonb)
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
$function$;

CREATE OR REPLACE FUNCTION public.set_project_deliverables_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_project_deliveries_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_project_lessons_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_chunks_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_part21_embeddings_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_tcds_embeddings_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- =============================================================================
-- [D] Actualizar funciones que mantienen su nombre pero cambian el body.
--     (auto_generate_numero_entrada, generate_quotation_number,
--      match_proyectos_precedentes)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.auto_generate_numero_entrada()
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
    FROM consultas_entrantes
    WHERE numero_entrada LIKE current_prefix || '%';

    next_num := max_num + 1;
    NEW.numero_entrada := current_prefix || LPAD(next_num::TEXT, 4, '0');
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_quotation_number()
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
  FROM quotations
  WHERE quotation_number LIKE 'Q-' || current_year || '-%';

  RETURN 'Q-' || current_year || '-' || LPAD(next_seq::text, 6, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_proyectos_precedentes(query_embedding vector, match_count integer DEFAULT 10, exclude_project text DEFAULT NULL::text)
 RETURNS TABLE(project_number text, project_title text, chunk_idx integer, chunk_text text, similarity double precision, metadata jsonb)
 LANGUAGE sql
 STABLE
AS $function$
  select
    e.project_number,
    e.project_title,
    e.chunk_idx,
    e.chunk_text,
    1 - ((e.embedding::halfvec(3072)) <=> (query_embedding::halfvec(3072))) as similarity,
    e.metadata
  from public.proyectos_embeddings e
  where exclude_project is null or e.project_number <> exclude_project
  order by (e.embedding::halfvec(3072)) <=> (query_embedding::halfvec(3072))
  limit match_count;
$function$;

-- =============================================================================
-- [E] Recrear triggers con nombres sin prefijo y apuntando a las funciones
--     renombradas.
-- =============================================================================

CREATE TRIGGER trg_chunks_updated_at
  BEFORE UPDATE ON public.chunks
  FOR EACH ROW EXECUTE FUNCTION update_chunks_updated_at();

CREATE TRIGGER update_part21_embeddings_updated_at
  BEFORE UPDATE ON public.part21_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_part21_embeddings_updated_at_column();

CREATE TRIGGER trg_project_deliverables_updated_at
  BEFORE UPDATE ON public.project_deliverables
  FOR EACH ROW EXECUTE FUNCTION set_project_deliverables_updated_at();

CREATE TRIGGER trg_project_deliveries_updated_at
  BEFORE UPDATE ON public.project_deliveries
  FOR EACH ROW EXECUTE FUNCTION set_project_deliveries_updated_at();

CREATE TRIGGER trg_project_lessons_updated_at
  BEFORE UPDATE ON public.project_lessons
  FOR EACH ROW EXECUTE FUNCTION set_project_lessons_updated_at();

-- NOTE: update_ams_proyectos_updated_at usaba (incorrectamente) la función
-- update_ams_tcds_embeddings_updated_at_column. Se preserva el comportamiento
-- apuntando a update_tcds_embeddings_updated_at_column (el body es idéntico
-- — sólo actualiza NEW.updated_at a NOW(), por lo que es funcionalmente
-- equivalente a cualquiera de las otras funciones set_*_updated_at).
CREATE TRIGGER update_proyectos_updated_at
  BEFORE UPDATE ON public.proyectos
  FOR EACH ROW EXECUTE FUNCTION update_tcds_embeddings_updated_at_column();

CREATE TRIGGER proyectos_historico_documentos_set_updated_at
  BEFORE UPDATE ON public.proyectos_historico_documentos
  FOR EACH ROW EXECUTE FUNCTION proyectos_historico_documentos_set_updated_at();

CREATE TRIGGER update_tcds_embeddings_updated_at
  BEFORE UPDATE ON public.tcds_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_tcds_embeddings_updated_at_column();

CREATE TRIGGER trg_workflow_state_config_updated_at
  BEFORE UPDATE ON public.workflow_state_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- [F] Recrear los índices funcionales con nombres sin prefijo y usando las
--     nuevas funciones.
-- =============================================================================
CREATE INDEX idx_part21_search_text
  ON public.part21_embeddings USING gin (part21_search_vector(content, metadata));

CREATE INDEX idx_tcds_embeddings_search_text
  ON public.tcds_embeddings USING gin (tcds_search_vector(content, metadata));

COMMIT;
