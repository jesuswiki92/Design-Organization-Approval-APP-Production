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
}: {
  stateCode: string
  projects: ProjectCardData[]
}) {
  const meta = getProjectExecutionStateMeta(stateCode)

  return (
    <section
      className={cn(
        'flex h-full w-[260px] flex-none flex-col rounded-[24px] border bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3 shadow-[0_14px_32px_rgba(148,163,184,0.12)]',
        meta.border,
      )}
    >
      {/* Cabecera */}
      <div
        className={cn(
          'rounded-[18px] border px-3 py-2.5',
          meta.bg,
          meta.border,
        )}
        title={meta.description}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn('h-2 w-2 flex-none rounded-full', meta.dot)} />
            <h3 className={cn('truncate text-xs font-semibold', meta.color)}>
              {meta.label}
            </h3>
          </div>
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
              meta.color,
              meta.border,
              'bg-white/70',
            )}
          >
            {projects.length}
          </span>
        </div>
      </div>

      {/* Lista de cards */}
      <div className="mt-3 flex-1 space-y-2">
        {projects.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-slate-200 bg-white/80 px-3 py-4 text-center">
            <p className="text-[11px] text-slate-400">Sin proyectos</p>
          </div>
        ) : (
          projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))
        )}
      </div>
    </section>
  )
}
