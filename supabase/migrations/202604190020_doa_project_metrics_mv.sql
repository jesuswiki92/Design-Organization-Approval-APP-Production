-- ============================================================================
-- Migration: doa_project_metrics_mv (aggregated project metrics materialized view)
-- Date: 2026-04-19
-- Sprint: 4 (close-the-loop — metricas)
-- Description:
--   One row per project. Aggregates counts and day-diffs across
--   doa_proyectos, doa_project_deliverables, doa_project_validations,
--   doa_project_deliveries, doa_project_closures, doa_project_lessons.
--
--   IMPORTANT: the app reads from this MV via the metrics page. Refresh it
--   on project state changes that affect counts (Sprint 4 `archivar` endpoint
--   refreshes it opportunistically; future sprints should wire triggers or a
--   scheduled refresh).
--
--   Refresh with:
--     REFRESH MATERIALIZED VIEW CONCURRENTLY doa_project_metrics_mv;
--
-- TODO: horas_plan and horas_real are not stored on doa_proyectos today
--   (only fecha_inicio / fecha_entrega_estimada / fecha_cierre). We surface
--   NULL and rely on the live metrics endpoint to compute `dias_*` as proxies.
-- TODO: exact per-state dwell times would need a state_history table. For
--   Sprint 4 we fall back to coarse proxies based on doa_proyectos timestamps
--   and the most-recent validation / delivery rows.
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS doa_project_metrics_mv;

CREATE MATERIALIZED VIEW doa_project_metrics_mv AS
WITH del_agg AS (
  SELECT
    d.proyecto_id,
    COUNT(*) FILTER (WHERE TRUE) AS deliverables_total,
    COUNT(*) FILTER (WHERE d.estado = 'completado') AS deliverables_completado,
    COUNT(*) FILTER (WHERE d.estado = 'no_aplica') AS deliverables_no_aplica,
    COUNT(*) FILTER (WHERE d.estado = 'bloqueado') AS deliverables_bloqueado
  FROM doa_project_deliverables d
  GROUP BY d.proyecto_id
),
val_agg AS (
  SELECT
    v.proyecto_id,
    COUNT(*) AS validaciones_total,
    COUNT(*) FILTER (WHERE v.decision = 'aprobado') AS validaciones_aprobadas,
    COUNT(*) FILTER (WHERE v.decision = 'devuelto') AS validaciones_devueltas
  FROM doa_project_validations v
  GROUP BY v.proyecto_id
),
ent_agg AS (
  SELECT
    e.proyecto_id,
    COUNT(*) AS entregas_total,
    COUNT(*) FILTER (WHERE e.dispatch_status IN ('enviado','confirmado_cliente'))
      AS entregas_enviadas,
    COUNT(*) FILTER (WHERE e.dispatch_status = 'confirmado_cliente')
      AS entregas_confirmadas
  FROM doa_project_deliveries e
  GROUP BY e.proyecto_id
),
less_agg AS (
  SELECT
    l.proyecto_id,
    COUNT(*) AS lecciones_count
  FROM doa_project_lessons l
  GROUP BY l.proyecto_id
)
SELECT
  p.id AS proyecto_id,
  p.titulo,
  p.client_id AS cliente_id,
  p.estado_v2,
  p.fase_actual,
  p.created_at,
  p.estado_updated_at,
  COALESCE(da.deliverables_total, 0) AS deliverables_total,
  COALESCE(da.deliverables_completado, 0) AS deliverables_completado,
  COALESCE(da.deliverables_no_aplica, 0) AS deliverables_no_aplica,
  COALESCE(da.deliverables_bloqueado, 0) AS deliverables_bloqueado,
  COALESCE(va.validaciones_total, 0) AS validaciones_total,
  COALESCE(va.validaciones_aprobadas, 0) AS validaciones_aprobadas,
  COALESCE(va.validaciones_devueltas, 0) AS validaciones_devueltas,
  COALESCE(ea.entregas_total, 0) AS entregas_total,
  COALESCE(ea.entregas_enviadas, 0) AS entregas_enviadas,
  COALESCE(ea.entregas_confirmadas, 0) AS entregas_confirmadas,
  NULL::numeric AS horas_plan,  -- TODO: no stored on doa_proyectos yet.
  NULL::numeric AS horas_real,  -- TODO: would require aggregating doa_conteo_horas_proyectos.
  -- Proxy day-diffs: from created_at to the relevant timestamp. Coarse but
  -- available without a state_history table.
  EXTRACT(EPOCH FROM (COALESCE(p.estado_updated_at, now()) - p.created_at)) / 86400.0
    AS dias_en_ejecucion,
  -- No per-phase dwell; reuse estado_updated_at as a proxy for "time since last transition".
  NULL::numeric AS dias_en_validacion,  -- TODO: needs state_history.
  NULL::numeric AS dias_en_entrega,     -- TODO: needs state_history.
  CASE
    WHEN p.estado_v2 IN ('cerrado','archivado_proyecto') THEN
      EXTRACT(EPOCH FROM (COALESCE(p.estado_updated_at, now()) - p.created_at)) / 86400.0
    ELSE
      EXTRACT(EPOCH FROM (now() - p.created_at)) / 86400.0
  END AS dias_totales_cerrado_vs_abierto,
  c.outcome AS closure_outcome,
  COALESCE(la.lecciones_count, 0) AS lecciones_count
FROM doa_proyectos p
LEFT JOIN del_agg da ON da.proyecto_id = p.id
LEFT JOIN val_agg va ON va.proyecto_id = p.id
LEFT JOIN ent_agg ea ON ea.proyecto_id = p.id
LEFT JOIN less_agg la ON la.proyecto_id = p.id
LEFT JOIN doa_project_closures c ON c.proyecto_id = p.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_doa_project_metrics_mv_proyecto
  ON doa_project_metrics_mv(proyecto_id);

CREATE INDEX IF NOT EXISTS idx_doa_project_metrics_mv_fase
  ON doa_project_metrics_mv(fase_actual);

CREATE INDEX IF NOT EXISTS idx_doa_project_metrics_mv_estado
  ON doa_project_metrics_mv(estado_v2);

COMMENT ON MATERIALIZED VIEW doa_project_metrics_mv IS
  'Aggregated per-project metrics. Refresh on state change (Sprint 4 archivar '
  'endpoint refreshes it opportunistically). Use REFRESH MATERIALIZED VIEW '
  'CONCURRENTLY to avoid locking.';
