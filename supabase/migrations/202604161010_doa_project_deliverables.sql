-- ============================================================================
-- Migration: doa_project_deliverables (deliverables register per project)
-- Date: 2026-04-16
-- Description:
--   Table that tracks the list of compliance deliverables for each project.
--   Seeded from doa_consultas_entrantes.doc_g12_xx selections when the project
--   transitions from proyecto_abierto -> planificacion via
--   POST /api/proyectos/[id]/planificar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS doa_project_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES doa_proyectos(id) ON DELETE CASCADE,
  template_code text,
  subpart_easa text,
  titulo text NOT NULL,
  descripcion text,
  owner_user_id uuid REFERENCES auth.users(id),
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','en_curso','en_revision','completado','bloqueado','no_aplica')),
  storage_path text,
  version_actual int NOT NULL DEFAULT 1,
  orden int NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doa_project_deliverables_proyecto ON doa_project_deliverables(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_doa_project_deliverables_estado ON doa_project_deliverables(proyecto_id, estado);
CREATE INDEX IF NOT EXISTS idx_doa_project_deliverables_owner ON doa_project_deliverables(owner_user_id);

ALTER TABLE doa_project_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY doa_project_deliverables_select ON doa_project_deliverables
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY doa_project_deliverables_service_all ON doa_project_deliverables
  FOR ALL USING (auth.role() = 'service_role');

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_doa_project_deliverables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_doa_project_deliverables_updated_at ON doa_project_deliverables;
CREATE TRIGGER trg_doa_project_deliverables_updated_at
  BEFORE UPDATE ON doa_project_deliverables
  FOR EACH ROW EXECUTE FUNCTION set_doa_project_deliverables_updated_at();
