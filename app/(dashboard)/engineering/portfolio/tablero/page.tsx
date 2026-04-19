/**
 * ============================================================================
 * PAGINA SERVIDOR: TABLERO DE PROYECTOS (KANBAN POR ESTADO V2)
 * ============================================================================
 *
 * Lee `doa_proyectos` y, en un segundo query, `doa_project_deliverables`
 * para calcular total/completados por proyecto. Luego adjunta esos contadores
 * a cada Proyecto antes de pasarlos al client component.
 *
 * Nota: si el join de deliverables falla (p.ej. RLS o tabla sin datos), el
 * tablero sigue funcionando — los contadores simplemente no se muestran en
 * las cards (`hasDeliverables === false`).
 * ============================================================================
 */
import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import type { Proyecto } from '@/types/database'

import type { ProjectCardData } from '@/components/project/ProjectCard'
import { TableroClient } from './TableroClient'

export const dynamic = 'force-dynamic'

type DeliverableCountRow = {
  proyecto_id: string
  estado: string | null
}

export default async function EngineeringPortfolioTableroPage() {
  const supabase = await createClient()

  const { data: projectsData, error: projectsError } = await supabase
    .from('doa_proyectos')
    .select(
      'id, numero_proyecto, titulo, descripcion, aeronave, modelo, cliente_nombre, ' +
        'estado, estado_v2, fase_actual, estado_updated_at, ruta_proyecto, consulta_id, ' +
        'owner, checker, approval, cve, fecha_inicio, fecha_entrega_estimada, fecha_cierre, ' +
        'prioridad, anio, notas, tcds_code, tcds_code_short, msn, client_id, created_at, updated_at',
    )
    .order('created_at', { ascending: false })

  if (projectsError) {
    console.error('Tablero: error leyendo doa_proyectos:', projectsError)
  }

  const projects = (projectsData ?? []) as unknown as Proyecto[]

  // Contar deliverables por proyecto (total + completados).
  // Consulta light: solo las columnas necesarias. Si falla, los contadores
  // quedan en 0 y las cards no muestran el badge (fail-soft).
  const counts = new Map<string, { total: number; done: number }>()
  if (projects.length > 0) {
    const { data: deliverablesData, error: deliverablesError } = await supabase
      .from('doa_project_deliverables')
      .select('proyecto_id, estado')

    if (deliverablesError) {
      console.error(
        'Tablero: error leyendo doa_project_deliverables (continuamos sin contadores):',
        deliverablesError,
      )
    } else if (deliverablesData) {
      for (const row of deliverablesData as DeliverableCountRow[]) {
        const entry = counts.get(row.proyecto_id) ?? { total: 0, done: 0 }
        entry.total += 1
        if (row.estado === 'completado') entry.done += 1
        counts.set(row.proyecto_id, entry)
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
      <TopBar title="Proyectos" subtitle="Tablero por fase y estado" />
      <TableroClient projects={enriched} />
    </div>
  )
}
