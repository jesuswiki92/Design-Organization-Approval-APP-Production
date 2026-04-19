-- ============================================================================
-- Migration: doa_proyectos.estado_v2 (project execution state machine v2)
-- Date: 2026-04-16
-- Description:
--   Introduce estado_v2 (new 13-state machine) alongside legacy `estado`.
--   Existing `estado` is preserved; `estado_v2` becomes the new authoritative
--   execution state for Sprint 1+. Also adds `fase_actual` (aggregate phase),
--   `estado_updated_at`, and `estado_updated_by` for audit.
-- ============================================================================

ALTER TABLE doa_proyectos
  ADD COLUMN IF NOT EXISTS estado_v2 text,
  ADD COLUMN IF NOT EXISTS fase_actual text,
  ADD COLUMN IF NOT EXISTS estado_updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS estado_updated_by uuid REFERENCES auth.users(id);

-- Backfill estado_v2 from legacy estado
UPDATE doa_proyectos SET estado_v2 = CASE estado
  WHEN 'nuevo' THEN 'proyecto_abierto'
  WHEN 'en_progreso' THEN 'en_ejecucion'
  WHEN 'revision' THEN 'revision_interna'
  WHEN 'aprobacion' THEN 'en_validacion'
  WHEN 'entregado' THEN 'entregado'
  WHEN 'cerrado' THEN 'cerrado'
  WHEN 'archivado' THEN 'archivado_proyecto'
  ELSE 'proyecto_abierto'
END WHERE estado_v2 IS NULL;

-- Backfill fase_actual from estado_v2
UPDATE doa_proyectos SET fase_actual = CASE
  WHEN estado_v2 IN ('proyecto_abierto','planificacion','en_ejecucion','revision_interna','listo_para_validacion') THEN 'ejecucion'
  WHEN estado_v2 IN ('en_validacion','validado','devuelto_a_ejecucion') THEN 'validacion'
  WHEN estado_v2 IN ('preparando_entrega','entregado','confirmacion_cliente') THEN 'entrega'
  WHEN estado_v2 IN ('cerrado','archivado_proyecto') THEN 'cierre'
  ELSE 'ejecucion'
END WHERE fase_actual IS NULL;

-- CHECK constraint on estado_v2
ALTER TABLE doa_proyectos
  DROP CONSTRAINT IF EXISTS doa_proyectos_estado_v2_check;
ALTER TABLE doa_proyectos
  ADD CONSTRAINT doa_proyectos_estado_v2_check
  CHECK (estado_v2 IN (
    'proyecto_abierto','planificacion','en_ejecucion','revision_interna',
    'listo_para_validacion','en_validacion','validado','devuelto_a_ejecucion',
    'preparando_entrega','entregado','confirmacion_cliente','cerrado',
    'archivado_proyecto'
  ));

ALTER TABLE doa_proyectos
  DROP CONSTRAINT IF EXISTS doa_proyectos_fase_actual_check;
ALTER TABLE doa_proyectos
  ADD CONSTRAINT doa_proyectos_fase_actual_check
  CHECK (fase_actual IN ('ejecucion','validacion','entrega','cierre'));

CREATE INDEX IF NOT EXISTS idx_doa_proyectos_estado_v2 ON doa_proyectos(estado_v2);
CREATE INDEX IF NOT EXISTS idx_doa_proyectos_fase_actual ON doa_proyectos(fase_actual);
