/**
 * Panel de metricas operativas de proyectos — Sprint 4 (close-the-loop).
 *
 * Estrategia:
 *   1. Intenta leer `doa_project_metrics_mv` (materialized view).
 *   2. Si la MV no existe o falla, computa agregados live a partir de las
 *      tablas base (doa_proyectos + doa_project_deliverables + ...). En este
 *      caso marca `fallbackMode=true` para que el cliente muestre banner.
 *
 * Server component: requireUserAction() garantiza sesion o redirige a /login.
 */

import { TopBar } from '@/components/layout/TopBar'
import { requireUserAction } from '@/lib/auth/require-user'
import type { ClosureOutcome, ProjectMetricsRow } from '@/types/database'

import { MetricsClient } from './MetricsClient'

export const dynamic = 'force-dynamic'

type FallbackProjectRow = {
  id: string
  numero_proyecto: string | null
  titulo: string | null
  client_id: string | null
  estado_v2: string | null
  fase_actual: string | null
  created_at: string
  estado_updated_at: string | null
}

type FallbackDeliverable = { proyecto_id: string; estado: string }
type FallbackValidation = { proyecto_id: string; decision: string }
type FallbackDelivery = { proyecto_id: string; dispatch_status: string }
type FallbackLesson = { proyecto_id: string }
type FallbackClosure = { proyecto_id: string; outcome: string }

function countBy<T>(
  list: T[],
  key: (t: T) => string,
  pred: (t: T) => boolean = () => true,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const item of list) {
    if (!pred(item)) continue
    const k = key(item)
    out.set(k, (out.get(k) ?? 0) + 1)
  }
  return out
}

async function computeFallback(
  supabase: Awaited<ReturnType<typeof requireUserAction>>['supabase'],
): Promise<ProjectMetricsRow[]> {
  const { data: projectsData } = await supabase
    .from('doa_proyectos')
    .select(
      'id, numero_proyecto, titulo, client_id, estado_v2, fase_actual, created_at, estado_updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(500)

  const projects = (projectsData ?? []) as FallbackProjectRow[]
  const projectIds = projects.map((p) => p.id)
  if (projectIds.length === 0) return []

  const [delRes, valRes, entRes, lessRes, closRes] = await Promise.all([
    supabase
      .from('doa_project_deliverables')
      .select('proyecto_id, estado')
      .in('proyecto_id', projectIds),
    supabase
      .from('doa_project_validations')
      .select('proyecto_id, decision')
      .in('proyecto_id', projectIds),
    supabase
      .from('doa_project_deliveries')
      .select('proyecto_id, dispatch_status')
      .in('proyecto_id', projectIds),
    supabase
      .from('doa_project_lessons')
      .select('proyecto_id')
      .in('proyecto_id', projectIds),
    supabase
      .from('doa_project_closures')
      .select('proyecto_id, outcome')
      .in('proyecto_id', projectIds),
  ])

  const dels = (delRes.data ?? []) as FallbackDeliverable[]
  const vals = (valRes.data ?? []) as FallbackValidation[]
  const ents = (entRes.data ?? []) as FallbackDelivery[]
  const lessons = (lessRes.data ?? []) as FallbackLesson[]
  const closures = (closRes.data ?? []) as FallbackClosure[]

  const delTotal = countBy(dels, (d) => d.proyecto_id)
  const delCompleted = countBy(
    dels,
    (d) => d.proyecto_id,
    (d) => d.estado === 'completado',
  )
  const delNoAplica = countBy(
    dels,
    (d) => d.proyecto_id,
    (d) => d.estado === 'no_aplica',
  )
  const delBloqueado = countBy(
    dels,
    (d) => d.proyecto_id,
    (d) => d.estado === 'bloqueado',
  )
  const valTotal = countBy(vals, (v) => v.proyecto_id)
  const valApr = countBy(
    vals,
    (v) => v.proyecto_id,
    (v) => v.decision === 'aprobado',
  )
  const valDev = countBy(
    vals,
    (v) => v.proyecto_id,
    (v) => v.decision === 'devuelto',
  )
  const entTotal = countBy(ents, (e) => e.proyecto_id)
  const entEnv = countBy(
    ents,
    (e) => e.proyecto_id,
    (e) => e.dispatch_status === 'enviado' || e.dispatch_status === 'confirmado_cliente',
  )
  const entConf = countBy(
    ents,
    (e) => e.proyecto_id,
    (e) => e.dispatch_status === 'confirmado_cliente',
  )
  const lessCount = countBy(lessons, (l) => l.proyecto_id)
  const closureByProject = new Map<string, string>()
  for (const c of closures) closureByProject.set(c.proyecto_id, c.outcome)

  const now = Date.now()

  return projects.map<ProjectMetricsRow>((p) => {
    const createdMs = new Date(p.created_at).getTime()
    const diasTotales = Number.isFinite(createdMs)
      ? Math.round(((now - createdMs) / 86_400_000) * 100) / 100
      : null
    const outcome = closureByProject.get(p.id) ?? null
    return {
      proyecto_id: p.id,
      titulo: p.titulo ?? p.numero_proyecto ?? '(sin titulo)',
      cliente_id: p.client_id,
      estado_v2: p.estado_v2,
      fase_actual: p.fase_actual,
      created_at: p.created_at,
      estado_updated_at: p.estado_updated_at,
      deliverables_total: delTotal.get(p.id) ?? 0,
      deliverables_completado: delCompleted.get(p.id) ?? 0,
      deliverables_no_aplica: delNoAplica.get(p.id) ?? 0,
      deliverables_bloqueado: delBloqueado.get(p.id) ?? 0,
      validaciones_total: valTotal.get(p.id) ?? 0,
      validaciones_aprobadas: valApr.get(p.id) ?? 0,
      validaciones_devueltas: valDev.get(p.id) ?? 0,
      entregas_total: entTotal.get(p.id) ?? 0,
      entregas_enviadas: entEnv.get(p.id) ?? 0,
      entregas_confirmadas: entConf.get(p.id) ?? 0,
      horas_plan: null,
      horas_real: null,
      dias_en_ejecucion: null,
      dias_en_validacion: null,
      dias_en_entrega: null,
      dias_totales_cerrado_vs_abierto: diasTotales,
      closure_outcome: (outcome as ClosureOutcome | null) ?? null,
      lecciones_count: lessCount.get(p.id) ?? 0,
    }
  })
}

export default async function EngineeringMetricsPage() {
  const { supabase } = await requireUserAction()

  // 1) Intento MV
  let rows: ProjectMetricsRow[] = []
  let fallbackMode = false
  let fallbackReason: string | null = null

  try {
    const { data, error } = await supabase
      .from('doa_project_metrics_mv' as never)
      .select('*')
      .limit(500)

    if (error) {
      fallbackMode = true
      fallbackReason = error.message
    } else {
      rows = (data ?? []) as ProjectMetricsRow[]
    }
  } catch (e) {
    fallbackMode = true
    fallbackReason = e instanceof Error ? e.message : 'unknown'
  }

  if (fallbackMode) {
    rows = await computeFallback(supabase)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar
        title="Metricas operativas"
        subtitle="Panel agregado de proyectos, validaciones y entregas"
      />
      <MetricsClient
        rows={rows}
        fallbackMode={fallbackMode}
        fallbackReason={fallbackReason}
      />
    </div>
  )
}
