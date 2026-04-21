-- ============================================================================
-- Migration: Create doa_proyectos table (active projects)
-- Date: 2026-04-05
-- Description: Table for active engineering projects, separate from
--              doa_proyectos_historico (archived/imported) and
--              doa_proyectos_generales (legacy).
-- ============================================================================

CREATE TABLE doa_proyectos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_proyecto text NOT NULL UNIQUE,        -- e.g., "IM.A.226-0002"
  titulo text NOT NULL,                         -- e.g., "Antenna installation in Cessna 208B"
  descripcion text,

  -- Relaciones
  consulta_id uuid REFERENCES doa_consultas_entrantes(id),  -- consulta origen (nullable)
  cliente_nombre text,
  client_id uuid,

  -- Aeronave
  aeronave text,                                -- e.g., "Cessna 208B"
  modelo text,                                  -- e.g., "208B"
  msn text,                                     -- Serial numbers
  tcds_code text,                               -- e.g., "EASA.IM.A.226"
  tcds_code_short text,                         -- e.g., "IM.A.226"

  -- Estado (workflow)
  estado text NOT NULL DEFAULT 'op_01_data_collection', -- from PROJECT_WORKFLOW_STATES

  -- Equipo asignado (engineer IDs/names stored as text for now)
  owner text,                                   -- Project owner/lead engineer
  checker text,                                 -- Checker
  approval text,                                -- Approval
  cve text,                                     -- CVE (Compliance Verification Engineer)

  -- Fechas
  fecha_inicio date,
  fecha_entrega_estimada date,
  fecha_cierre date,

  -- Carpeta
  ruta_proyecto text,                           -- filesystem path

  -- Metadata
  prioridad text DEFAULT 'normal',              -- baja, normal, alta, urgente
  anio integer DEFAULT EXTRACT(YEAR FROM NOW()),
  notas text,

  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Auto-update updated_at
CREATE TRIGGER update_doa_proyectos_updated_at
  BEFORE UPDATE ON doa_proyectos
  FOR EACH ROW EXECUTE FUNCTION update_doa_tcds_embeddings_updated_at_column();

-- Indexes (prefixed idx_doa_proy_ to avoid collision with doa_proyectos_generales)
CREATE INDEX idx_doa_proy_estado ON doa_proyectos(estado);
CREATE INDEX idx_doa_proy_tcds ON doa_proyectos(tcds_code_short);
CREATE INDEX idx_doa_proy_numero ON doa_proyectos(numero_proyecto);

-- RLS
ALTER TABLE doa_proyectos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON doa_proyectos FOR SELECT USING (true);
CREATE POLICY "Allow service role full access" ON doa_proyectos FOR ALL USING (auth.role() = 'service_role');
