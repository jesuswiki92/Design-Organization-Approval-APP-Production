/**
 * Cola de projects pendientes de validation (Sprint 2). Server component.
 *
 * Lista `doa_projects` con `execution_status = 'in_validation'`. Para cada project
 * cuenta deliverables totales y bloqueantes (status distinto de completed/
 * not_applicable) y calcula tiempo en cola a partir de `status_updated_at`.
 */
import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import {
  DELIVERABLE_VALIDATION_READY_STATES,
  PROJECT_EXECUTION_STATES,
} from '@/lib/workflow-states'

import { ValidationsClient, type ValidationQueueItem } from './ValidationsClient'

export const dynamic = 'force-dynamic'

type ProyectoRow = {
  id: string
  project_number: string
  title: string
  client_name: string | null
  status_updated_at: string | null
}

type DeliverableRow = {
  project_id: string
  status: string
}

export default async function ValidationsQueuePage() {
  const supabase = await createClient()

  const { data: proyectosData, error: proyectosError } = await supabase
    .from('doa_projects')
    .select('id, project_number, title, client_name, status_updated_at')
    .eq('execution_status', PROJECT_EXECUTION_STATES.IN_VALIDATION)
    .order('status_updated_at', { ascending: true })

  if (proyectosError) {
    console.error('ValidationsQueue: error leyendo doa_projects:', proyectosError)
  }

  const projects = (proyectosData ?? []) as ProyectoRow[]
  const ids = projects.map((p) => p.id)

  let deliverables: DeliverableRow[] = []
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from('doa_project_deliverables')
      .select('project_id, status')
      .in('project_id', ids)

    if (error) {
      console.error('ValidationsQueue: error leyendo deliverables:', error)
    } else {
      deliverables = (data ?? []) as DeliverableRow[]
    }
  }

  const countsByProyecto = new Map<string, { total: number; completed: number }>()
  for (const d of deliverables) {
    const prev = countsByProyecto.get(d.project_id) ?? { total: 0, completed: 0 }
    prev.total += 1
    if (DELIVERABLE_VALIDATION_READY_STATES.includes(d.status)) {
      prev.completed += 1
    }
    countsByProyecto.set(d.project_id, prev)
  }

  const items: ValidationQueueItem[] = projects.map((p) => {
    const counts = countsByProyecto.get(p.id) ?? { total: 0, completed: 0 }
    return {
      id: p.id,
      project_number: p.project_number,
      title: p.title,
      client_name: p.client_name,
      received_at: p.status_updated_at,
      deliverables_total: counts.total,
      deliverables_completed: counts.completed,
    }
  })

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar
        title="Validaciones"
        subtitle="Projects pendientes de validation DOH/DOS"
      />
      <ValidationsClient items={items} />
    </div>
  )
}
