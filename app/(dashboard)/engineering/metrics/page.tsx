/**
 * Panel de metricas operativas de projects — Sprint 4 (close-the-loop).
 *
 * Estrategia:
 *   1. Intenta leer `doa_project_metrics_mv` (materialized view).
 *   2. Si la MV no existe o falla, computa agregados live a partir de las
 *      tablas base (doa_projects + doa_project_deliverables + ...). En este
 *      caso marca `fallbackMode=true` para que el client muestre banner.
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
  project_number: string | null
  title: string | null
  client_id: string | null
  execution_status: string | null
  current_phase: string | null
  created_at: string
  status_updated_at: string | null
}

type FallbackDeliverable = { project_id: string; status: string }
type FallbackValidation = { project_id: string; decision: string }
type FallbackDelivery = { project_id: string; dispatch_status: string }
type FallbackLesson = { project_id: string }
type FallbackClosure = { project_id: string; outcome: string }

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
    .from('doa_projects')
    .select(
      'id, project_number, title, client_id, execution_status, current_phase, created_at, status_updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(500)

  const projects = (projectsData ?? []) as FallbackProjectRow[]
  const projectIds = projects.map((p) => p.id)
  if (projectIds.length === 0) return []

  const [delRes, valRes, entRes, lessRes, closRes] = await Promise.all([
    supabase
      .from('doa_project_deliverables')
      .select('project_id, status')
      .in('project_id', projectIds),
    supabase
      .from('doa_project_validations')
      .select('project_id, decision')
      .in('project_id', projectIds),
    supabase
      .from('doa_project_deliveries')
      .select('project_id, dispatch_status')
      .in('project_id', projectIds),
    supabase
      .from('doa_project_lessons')
      .select('project_id')
      .in('project_id', projectIds),
    supabase
      .from('doa_project_closures')
      .select('project_id, outcome')
      .in('project_id', projectIds),
  ])

  const dels = (delRes.data ?? []) as FallbackDeliverable[]
  const vals = (valRes.data ?? []) as FallbackValidation[]
  const ents = (entRes.data ?? []) as FallbackDelivery[]
  const lessons = (lessRes.data ?? []) as FallbackLesson[]
  const closures = (closRes.data ?? []) as FallbackClosure[]

  const delTotal = countBy(dels, (d) => d.project_id)
  const delCompleted = countBy(
    dels,
    (d) => d.project_id,
    (d) => d.status === 'completed',
  )
  const delNoAplica = countBy(
    dels,
    (d) => d.project_id,
    (d) => d.status === 'not_applicable',
  )
  const delBloqueado = countBy(
    dels,
    (d) => d.project_id,
    (d) => d.status === 'blocked',
  )
  const valTotal = countBy(vals, (v) => v.project_id)
  const valApr = countBy(
    vals,
    (v) => v.project_id,
    (v) => v.decision === 'approved',
  )
  const valDev = countBy(
    vals,
    (v) => v.project_id,
    (v) => v.decision === 'returned',
  )
  const entTotal = countBy(ents, (e) => e.project_id)
  const entEnv = countBy(
    ents,
    (e) => e.project_id,
    (e) => e.dispatch_status === 'sent' || e.dispatch_status === 'client_confirmed',
  )
  const entConf = countBy(
    ents,
    (e) => e.project_id,
    (e) => e.dispatch_status === 'client_confirmed',
  )
  const lessCount = countBy(lessons, (l) => l.project_id)
  const closureByProject = new Map<string, string>()
  for (const c of closures) closureByProject.set(c.project_id, c.outcome)

  const now = Date.now()

  return projects.map<ProjectMetricsRow>((p) => {
    const createdMs = new Date(p.created_at).getTime()
    const diasTotales = Number.isFinite(createdMs)
      ? Math.round(((now - createdMs) / 86_400_000) * 100) / 100
      : null
    const outcome = closureByProject.get(p.id) ?? null
    return {
      project_id: p.id,
      title: p.title ?? p.project_number ?? '(sin title)',
      client_id: p.client_id,
      execution_status: p.execution_status,
      current_phase: p.current_phase,
      created_at: p.created_at,
      status_updated_at: p.status_updated_at,
      deliverables_total: delTotal.get(p.id) ?? 0,
      deliverables_completado: delCompleted.get(p.id) ?? 0,
      deliverables_not_applicable: delNoAplica.get(p.id) ?? 0,
      deliverables_bloqueado: delBloqueado.get(p.id) ?? 0,
      validations_total: valTotal.get(p.id) ?? 0,
      validations_approved: valApr.get(p.id) ?? 0,
      validations_returned: valDev.get(p.id) ?? 0,
      deliveries_total: entTotal.get(p.id) ?? 0,
      deliveries_sent: entEnv.get(p.id) ?? 0,
      deliveries_confirmed: entConf.get(p.id) ?? 0,
      planned_hours: null,
      actual_hours: null,
      days_in_execution: null,
      days_in_validation: null,
      days_in_delivery: null,
      total_days_closed_vs_opened: diasTotales,
      closure_outcome: (outcome as ClosureOutcome | null) ?? null,
      lessons_count: lessCount.get(p.id) ?? 0,
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
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar
        title="Metricas operativas"
        subtitle="Panel agregado de projects, validaciones y deliveries"
      />
      <MetricsClient
        rows={rows}
        fallbackMode={fallbackMode}
        fallbackReason={fallbackReason}
      />
    </div>
  )
}
