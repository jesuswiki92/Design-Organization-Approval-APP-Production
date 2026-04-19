'use client'

/**
 * ============================================================================
 * TARJETA COMPACTA DE PROYECTO (TABLERO)
 * ============================================================================
 *
 * Card compacta para el Tablero de proyectos. Diseñada para columnas
 * estrechas (13 columnas = mucho scroll horizontal). Muestra solo lo
 * esencial: codigo, titulo, cliente, TCDS/aeronave, owner, fecha, y un
 * badge con el progreso de deliverables si esta disponible (Sprint 1).
 *
 * Clic en la card abre el detalle del proyecto.
 *
 * Si `showStateSelector` es true, se renderiza un dropdown en el footer que
 * dispara transiciones via `/api/proyectos/[id]/transicion` (patron espejo
 * de QuotationStateSelector). El Link padre sigue activo: los clicks/cambios
 * del select usan stopPropagation para no navegar al detalle.
 *
 * MATCH: mismo estilo visual que las cards de QuotationStatesBoard (BoardCard)
 * — border slate-200, bg white, sombra suave, hover con translate-y.
 * ============================================================================
 */

import Link from 'next/link'
import { Calendar, Plane, User } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Proyecto } from '@/types/database'

import { ProjectStateSelector } from './ProjectStateSelector'

export type ProjectCardData = Proyecto & {
  deliverables_total?: number
  deliverables_completados?: number
}

export function ProjectCard({
  project,
  showStateSelector = false,
}: {
  project: ProjectCardData
  showStateSelector?: boolean
}) {
  const aircraft = project.tcds_code_short ?? project.aeronave ?? null
  const client = project.cliente_nombre ?? null
  const owner = project.owner ?? null
  const start = project.fecha_inicio ?? null
  const total = project.deliverables_total ?? 0
  const done = project.deliverables_completados ?? 0
  const hasDeliverables = total > 0

  return (
    <Link
      href={`/engineering/projects/${project.id}`}
      className="doa-kanban-card group block"
    >
      {/* Codigo + progreso deliverables */}
      <div className="flex items-start justify-between gap-2">
        <p className="doa-kanban-card-code">
          {project.numero_proyecto}
        </p>
        {hasDeliverables ? (
          <span
            className={cn(
              'doa-kanban-chip',
              done === total && 'text-[color:var(--ok)]',
            )}
            title={`${done} de ${total} deliverables completados`}
          >
            {done}/{total}
          </span>
        ) : null}
      </div>

      {/* Titulo */}
      <h4 className="doa-kanban-card-title mt-1.5 line-clamp-2 transition-colors group-hover:text-[color:var(--umber)]">
        {project.titulo}
      </h4>

      {/* Cliente + aeronave */}
      {(client || aircraft) ? (
        <div className="doa-kanban-card-meta mt-2 flex flex-wrap items-center gap-1.5">
          {aircraft ? (
            <span className="inline-flex items-center gap-1">
              <Plane className="h-3 w-3" />
              {aircraft}
            </span>
          ) : null}
          {aircraft && client ? <span className="text-[color:var(--ink-4)]">·</span> : null}
          {client ? <span className="truncate">{client}</span> : null}
        </div>
      ) : null}

      {/* Owner + fecha */}
      {(owner || start) ? (
        <div className="doa-kanban-card-meta mt-2 flex items-center justify-between">
          {owner ? (
            <span className="inline-flex items-center gap-1 truncate">
              <User className="h-3 w-3" />
              {owner}
            </span>
          ) : <span />}
          {start ? (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {start}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Selector de estado (opt-in) */}
      {showStateSelector ? (
        <div className="mt-3 pt-2 doa-kanban-card-foot">
          <ProjectStateSelector
            proyectoId={project.id}
            currentState={project.estado_v2 ?? null}
          />
        </div>
      ) : null}
    </Link>
  )
}
