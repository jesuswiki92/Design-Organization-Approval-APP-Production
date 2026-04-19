'use client'

/**
 * ============================================================================
 * COLUMNA DE ESTADO DEL TABLERO DE PROYECTOS
 * ============================================================================
 *
 * Una columna por estado de la maquina v2 (13 en total). Muestra la cabecera
 * con el color/etiqueta del estado y la lista de cards. Ancho fijo estrecho
 * (para que quepan 13 columnas con scroll horizontal comodo).
 *
 * MATCH: mismo patron que BoardLane de QuotationStatesBoard (border en
 * top-header, chip con contador, empty state con borde discontinuo).
 * ============================================================================
 */

import { getProjectExecutionStateMeta } from '@/lib/workflow-states'
import { cn } from '@/lib/utils'

import { ProjectCard, type ProjectCardData } from './ProjectCard'

export function StateColumn({
  stateCode,
  projects,
  showStateSelector = false,
}: {
  stateCode: string
  projects: ProjectCardData[]
  showStateSelector?: boolean
}) {
  const meta = getProjectExecutionStateMeta(stateCode)

  return (
    <section
      className="doa-kanban-column flex h-full w-[260px] flex-none flex-col"
      title={meta.description}
    >
      {/* Cabecera — unified kanban lane head (Warm Executive) */}
      <div className="doa-kanban-lane-head">
        <span className={cn('doa-kanban-dot', meta.dot)} />
        <h3 className="doa-kanban-lane-title truncate">{meta.label}</h3>
        <span className="doa-kanban-lane-count">{projects.length}</span>
      </div>

      {/* Lista de cards */}
      <div className="mt-3 flex-1 space-y-3">
        {projects.length === 0 ? (
          <div className="doa-kanban-empty">
            <p>Sin proyectos</p>
          </div>
        ) : (
          projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              showStateSelector={showStateSelector}
            />
          ))
        )}
      </div>
    </section>
  )
}
