/**
 * ============================================================================
 * PAGINA SERVIDOR: TABLERO DE PROYECTOS (KANBAN POR ESTADO V2)
 * ============================================================================
 *
 * Lee `doa_projects` y, en un segundo query, `doa_project_deliverables`
 * para calcular total/completados por project. Luego adjunta esos contadores
 * a cada Project antes de pasarlos al client component.
 *
 * Nota: si el join de deliverables falla (p.ej. RLS o table sin data), el
 * tablero sigue funcionando — los contadores simplemente no se muestran en
 * las cards (`hasDeliverables === false`).
 * ============================================================================
 */
import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import type { Project } from '@/types/database'

import type { ProjectCardData } from '@/components/project/ProjectCard'
import { TableroClient } from './TableroClient'

export const dynamic = 'force-dynamic'

type DeliverableCountRow = {
  project_id: string
  status: string | null
}

export default async function EngineeringPortfolioTableroPage() {
  const supabase = await createClient()

  const { data: projectsData, error: projectsError } = await supabase
    .from('doa_projects')
    .select(
      'id, project_number, title, description, aircraft, model, client_name, ' +
        'status, execution_status, current_phase, status_updated_at, project_path, incoming_request_id, ' +
        'owner, checker, approval, cve, start_date, estimated_delivery_date, closed_at, ' +
        'priority, year, notes, tcds_code, tcds_code_short, msn, client_id, created_at, updated_at',
    )
    .order('created_at', { ascending: false })

  if (projectsError) {
    console.error('Tablero: error leyendo doa_projects:', projectsError)
  }

  const projects = (projectsData ?? []) as unknown as Project[]

  // Contar deliverables por project (total + completados).
  // Request light: solo las columnas necesarias. Si falla, los contadores
  // quedan en 0 y las cards no muestran el badge (fail-soft).
  const counts = new Map<string, { total: number; done: number }>()
  if (projects.length > 0) {
    const { data: deliverablesData, error: deliverablesError } = await supabase
      .from('doa_project_deliverables')
      .select('project_id, status')

    if (deliverablesError) {
      console.error(
        'Tablero: error leyendo doa_project_deliverables (continuamos sin contadores):',
        deliverablesError,
      )
    } else if (deliverablesData) {
      for (const row of deliverablesData as DeliverableCountRow[]) {
        const entry = counts.get(row.project_id) ?? { total: 0, done: 0 }
        entry.total += 1
        if (row.status === 'completed') entry.done += 1
        counts.set(row.project_id, entry)
      }
    }
  }

  const enriched: ProjectCardData[] = projects.map((project) => {
    const c = counts.get(project.id)
    return {
      ...project,
      deliverables_total: c?.total ?? 0,
      deliverables_completados: c?.done ?? 0,
    }
  })

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar title="Projects" subtitle="Tablero por fase y status" />
      <TableroClient projects={enriched} />
    </div>
  )
}
