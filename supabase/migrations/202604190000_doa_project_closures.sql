-- ============================================================================
-- Migration: doa_project_closures (project closure snapshots)
-- Date: 2026-04-19
-- Sprint: 4 (close-the-loop — cierre + lecciones + metricas)
-- Description:
--   One row per project closure. Captures the outcome of the project, an
--   immutable JSONB snapshot of the metrics computed at closure time, a
--   reference to the `closure` HMAC signature row in doa_project_signatures,
--   and optional free-form notes from the closer.
--
--   Populated by:
--     POST /api/proyectos/[id]/cerrar -> INSERT (single row per project)
--
--   The closure row is created in the same request as the lecciones
--   (doa_project_lessons) and the HMAC signature (doa_project_signatures
--   with signature_type='closure').
--
-- TODO(sprint-4+): enforce signer_role='doh' via RLS once a role table exists.
-- ============================================================================

CREATE TABLE IF NOT EXISTS doa_project_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL UNIQUE REFERENCES doa_proyectos(id) ON DELETE CASCADE,
  closer_user_id uuid NOT NULL REFERENCES auth.users(id),
  signature_id uuid REFERENCES doa_project_signatures(id),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome text NOT NULL CHECK (outcome IN (
    'exitoso','exitoso_con_reservas','problematico','abortado'
  )),
  notas_cierre text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doa_project_closures_proyecto
  ON doa_project_closures(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_doa_project_closures_closer
  ON doa_project_closures(closer_user_id);
CREATE INDEX IF NOT EXISTS idx_doa_project_closures_created
  ON doa_project_closures(created_at DESC);

ALTER TABLE doa_project_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doa_project_closures_select ON doa_project_closures;
CREATE POLICY doa_project_closures_select ON doa_project_closures
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS doa_project_closures_service_all ON doa_project_closures;
CREATE POLICY doa_project_closures_service_all ON doa_project_closures
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE doa_project_closures IS
  'Immutable snapshot of a project closure. One row per proyecto_id. '
  'Captures metrics (jsonb), outcome, notas and a reference to the closure '
  'HMAC signature. Created by POST /api/proyectos/[id]/cerrar.';
