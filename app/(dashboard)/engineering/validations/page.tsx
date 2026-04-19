/**
 * Cola de proyectos pendientes de validacion (Sprint 2). Server component.
 *
 * Lista `proyectos` con `estado_v2 = 'en_validacion'`. Para cada proyecto
 * cuenta deliverables totales y bloqueantes (estado distinto de completado/
 * no_aplica) y calcula tiempo en cola a partir de `estado_updated_at`.
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
  numero_proyecto: string
  titulo: string
  cliente_nombre: string | null
  estado_updated_at: string | null
}

type DeliverableRow = {
  proyecto_id: string
  estado: string
}

export default async function ValidationsQueuePage() {
  const supabase = await createClient()

  const { data: proyectosData, error: proyectosError } = await supabase
    .from('proyectos')
    .select('id, numero_proyecto, titulo, cliente_nombre, estado_updated_at')
    .eq('estado_v2', PROJECT_EXECUTION_STATES.EN_VALIDACION)
    .order('estado_updated_at', { ascending: true })

  if (proyectosError) {
    console.error('ValidationsQueue: error leyendo proyectos:', proyectosError)
  }

  const proyectos = (proyectosData ?? []) as ProyectoRow[]
  const ids = proyectos.map((p) => p.id)

  let deliverables: DeliverableRow[] = []
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from('project_deliverables')
      .select('proyecto_id, estado')
      .in('proyecto_id', ids)

    if (error) {
      console.error('ValidationsQueue: error leyendo deliverables:', error)
    } else {
      deliverables = (data ?? []) as DeliverableRow[]
    }
  }

  const countsByProyecto = new Map<string, { total: number; completed: number }>()
  for (const d of deliverables) {
    const prev = countsByProyecto.get(d.proyecto_id) ?? { total: 0, completed: 0 }
    prev.total += 1
    if (DELIVERABLE_VALIDATION_READY_STATES.includes(d.estado)) {
      prev.completed += 1
    }
    countsByProyecto.set(d.proyecto_id, prev)
  }

  const items: ValidationQueueItem[] = proyectos.map((p) => {
    const counts = countsByProyecto.get(p.id) ?? { total: 0, completed: 0 }
    return {
      id: p.id,
      numero_proyecto: p.numero_proyecto,
      titulo: p.titulo,
      cliente_nombre: p.cliente_nombre,
      received_at: p.estado_updated_at,
      deliverables_total: counts.total,
      deliverables_completed: counts.completed,
    }
  })

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar
        title="Validaciones"
        subtitle="Proyectos pendientes de validacion DOH/DOS"
      />
      <ValidationsClient items={items} />
    </div>
  )
}
