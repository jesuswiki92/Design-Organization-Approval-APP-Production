-- ============================================================================
-- Migration: doa_workflow_state_config -- widen scope CHECK + seed project_execution
-- Date: 2026-04-16
-- Description:
--   The table doa_workflow_state_config already exists with a UNIQUE constraint
--   on (scope, state_code) named doa_workflow_state_config_scope_state_code_key,
--   and a scope CHECK that originally only allowed ('incoming_queries',
--   'quotation_board'). This migration:
--     1) widens the scope CHECK to also allow 'project_board' (legacy) and
--        'project_execution' (Sprint 1 state machine v2),
--     2) inserts the 13 rows that describe the project_execution state machine.
--   Idempotent via ON CONFLICT on (scope, state_code).
-- ============================================================================

ALTER TABLE doa_workflow_state_config
  DROP CONSTRAINT IF EXISTS doa_workflow_state_config_scope_check;

ALTER TABLE doa_workflow_state_config
  ADD CONSTRAINT doa_workflow_state_config_scope_check
  CHECK (scope IN ('incoming_queries','quotation_board','project_board','project_execution'));

INSERT INTO doa_workflow_state_config
  (scope, state_code, label, short_label, description, color_token, sort_order, is_system, is_active)
VALUES
  ('project_execution','proyecto_abierto','Proyecto abierto','Abierto','Recien creado tras oferta aceptada, pendiente de planificar','slate',10,true,true),
  ('project_execution','planificacion','Planificacion','Planificacion','Definicion de deliverables y asignacion de owners','sky',20,true,true),
  ('project_execution','en_ejecucion','En ejecucion','En ejecucion','Trabajo tecnico en curso','cyan',30,true,true),
  ('project_execution','revision_interna','Revision interna','Revision','Check independiente por segundo ingeniero','indigo',40,true,true),
  ('project_execution','listo_para_validacion','Listo para validacion','Listo','Todos los deliverables completados, pendiente validar','violet',50,true,true),
  ('project_execution','en_validacion','En validacion','Validacion','DOH/DOS revisando y firmando','amber',60,true,true),
  ('project_execution','validado','Validado','Validado','Aprobado por DOH/DOS','green',70,true,true),
  ('project_execution','devuelto_a_ejecucion','Devuelto a ejecucion','Devuelto','Rechazado en validacion, vuelve a ejecucion','rose',65,true,true),
  ('project_execution','preparando_entrega','Preparando entrega','Entrega prep','Generando SoC y documentos de release','cyan',80,true,true),
  ('project_execution','entregado','Entregado','Entregado','SoC enviado al cliente','emerald',90,true,true),
  ('project_execution','confirmacion_cliente','Confirmacion cliente','Confirmado','Cliente acuso recibo','green',100,true,true),
  ('project_execution','cerrado','Cerrado','Cerrado','Lecciones y metricas capturadas','emerald',110,true,true),
  ('project_execution','archivado_proyecto','Archivado','Archivado','Movido a historico, alimenta precedentes','slate',120,true,true)
ON CONFLICT (scope, state_code) DO NOTHING;
