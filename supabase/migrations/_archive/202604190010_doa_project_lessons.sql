-- ============================================================================
-- Migration: doa_project_lessons (lessons learned per project)
-- Date: 2026-04-19
-- Sprint: 4 (close-the-loop — lecciones)
-- Description:
--   Structured lecciones aprendidas captured during or after project closure.
--   One row per leccion. closure_id is nullable so lecciones can be appended
--   after closure (closure_id filled when available).
--
--   Populated by:
--     POST /api/proyectos/[id]/cerrar     -> bulk INSERT (closure_id set)
--     POST /api/proyectos/[id]/lessons    -> INSERT (closure_id may be null)
-- ============================================================================

CREATE TABLE IF NOT EXISTS doa_project_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES doa_proyectos(id) ON DELETE CASCADE,
  closure_id uuid REFERENCES doa_project_closures(id) ON DELETE SET NULL,
  author_user_id uuid NOT NULL REFERENCES auth.users(id),
  categoria text NOT NULL CHECK (categoria IN (
    'tecnica','proceso','cliente','calidad','planificacion',
    'herramientas','regulatoria','otro'
  )),
  tipo text NOT NULL CHECK (tipo IN ('positiva','negativa','mejora','riesgo')),
  titulo text NOT NULL,
  descripcion text NOT NULL,
  impacto text,
  recomendacion text,
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doa_project_lessons_proyecto
  ON doa_project_lessons(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_doa_project_lessons_closure
  ON doa_project_lessons(closure_id);
CREATE INDEX IF NOT EXISTS idx_doa_project_lessons_cat_tipo
  ON doa_project_lessons(categoria, tipo);
CREATE INDEX IF NOT EXISTS idx_doa_project_lessons_tags
  ON doa_project_lessons USING GIN (tags);

ALTER TABLE doa_project_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doa_project_lessons_select ON doa_project_lessons;
CREATE POLICY doa_project_lessons_select ON doa_project_lessons
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS doa_project_lessons_service_all ON doa_project_lessons;
CREATE POLICY doa_project_lessons_service_all ON doa_project_lessons
  FOR ALL USING (auth.role() = 'service_role');

-- updated_at trigger (mirrors doa_project_deliveries pattern)
CREATE OR REPLACE FUNCTION set_doa_project_lessons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_doa_project_lessons_updated_at ON doa_project_lessons;
CREATE TRIGGER trg_doa_project_lessons_updated_at
  BEFORE UPDATE ON doa_project_lessons
  FOR EACH ROW EXECUTE FUNCTION set_doa_project_lessons_updated_at();

COMMENT ON TABLE doa_project_lessons IS
  'Lessons learned per project. Can be captured at closure time (closure_id '
  'set) or added later (closure_id NULL). Categorized by (categoria, tipo) '
  'and tagged for precedentes reindexing.';
