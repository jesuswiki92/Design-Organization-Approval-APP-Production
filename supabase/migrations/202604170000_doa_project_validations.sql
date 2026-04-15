-- ============================================================================
-- Migration: doa_project_validations (validation decisions register)
-- Date: 2026-04-17
-- Sprint: 2 (close-the-loop)
-- Description:
--   Records each DOH/DOS/reviewer decision for a project awaiting validation.
--   Each row is an immutable audit record: who validated, what role capacity,
--   what decision (aprobado/devuelto/pendiente), free-form comments, per-
--   deliverable observations and a snapshot of deliverable states at decision
--   time. Paired with doa_project_signatures for non-repudiation (Part 21J).
--
--   Populated by POST /api/proyectos/[id]/validar.
--   Read via GET /api/proyectos/[id]/validations.
-- ============================================================================

CREATE TABLE IF NOT EXISTS doa_project_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES doa_proyectos(id) ON DELETE CASCADE,
  validator_user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL CHECK (role IN ('doh','dos','reviewer')),
  decision text NOT NULL CHECK (decision IN ('aprobado','devuelto','pendiente')),
  comentarios text,
  observaciones jsonb NOT NULL DEFAULT '[]'::jsonb,
  deliverables_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doa_project_validations_proyecto
  ON doa_project_validations(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_doa_project_validations_validator
  ON doa_project_validations(validator_user_id);
CREATE INDEX IF NOT EXISTS idx_doa_project_validations_proyecto_created
  ON doa_project_validations(proyecto_id, created_at DESC);

ALTER TABLE doa_project_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY doa_project_validations_select ON doa_project_validations
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY doa_project_validations_service_all ON doa_project_validations
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE doa_project_validations IS
  'Immutable register of DOH/DOS/reviewer decisions on projects awaiting validation. '
  'Companion to doa_project_signatures for Part 21J non-repudiation.';
