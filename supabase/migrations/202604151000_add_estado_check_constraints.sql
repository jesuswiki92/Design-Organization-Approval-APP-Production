-- Add CHECK constraint on doa_consultas_entrantes.estado
-- Includes BOTH consulta-namespace codes AND quotation-board-namespace codes,
-- because consulta.estado in this app holds both (dual-namespace pattern,
-- documented in audit). New PROYECTO_ABIERTO state added in hotfix 4.
--
-- Verified against production data (2026-04-15):
--   doa_consultas_entrantes.estado observed values:
--     definir_alcance (8), entrada_recibida (1),
--     esperando_respuesta_cliente (1), revision_final (1)
--   All are covered by the CHECK list below.
--   doa_proyectos is empty -> no legacy values to preserve.
ALTER TABLE doa_consultas_entrantes
  DROP CONSTRAINT IF EXISTS doa_consultas_entrantes_estado_check;

ALTER TABLE doa_consultas_entrantes
  ADD CONSTRAINT doa_consultas_entrantes_estado_check
  CHECK (estado IN (
    -- consulta-namespace
    'nuevo',
    'esperando_formulario',
    'formulario_recibido',
    'archivado',
    -- quotation-board-namespace
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
  ));

-- doa_proyectos.estado
ALTER TABLE doa_proyectos
  DROP CONSTRAINT IF EXISTS doa_proyectos_estado_check;

ALTER TABLE doa_proyectos
  ADD CONSTRAINT doa_proyectos_estado_check
  CHECK (estado IN (
    'nuevo',
    'en_progreso',
    'revision',
    'aprobacion',
    'entregado',
    'cerrado',
    'archivado'
  ));
