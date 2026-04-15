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
 * MATCH: mismo estilo visual que las cards de QuotationStatesBoard (BoardCard)
 * — border slate-200, bg white, sombra suave, hover con translate-y.
 * ============================================================================
 */

import Link from 'next/link'
import { Calendar, Plane, User } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Proyecto } from '@/types/database'

export type ProjectCardData = Proyecto & {
  deliverables_total?: number
  deliverables_completados?: number
}

export function ProjectCard({ project }: { project: ProjectCardData }) {
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
      className="group block rounded-[18px] border border-slate-200 bg-white p-3 shadow-[0_10px_24px_rgba(148,163,184,0.12)] transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50/40"
    >
      {/* Codigo + progreso deliverables */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[10px] tracking-[0.18em] text-slate-500">
          {project.numero_proyecto}
        </p>
        {hasDeliverables ? (
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]',
              done === total
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-600',
            )}
            title={`${done} de ${total} deliverables completados`}
          >
            {done}/{total}
          </span>
        ) : null}
      </div>

      {/* Titulo */}
      <h4 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-slate-950 transition-colors group-hover:text-sky-800">
        {project.titulo}
      </h4>

      {/* Cliente + aeronave */}
      {(client || aircraft) ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          {aircraft ? (
            <span className="inline-flex items-center gap-1">
              <Plane className="h-3 w-3" />
              {aircraft}
            </span>
          ) : null}
          {aircraft && client ? <span className="text-slate-300">·</span> : null}
          {client ? <span className="truncate">{client}</span> : null}
        </div>
      ) : null}

      {/* Owner + fecha */}
      {(owner || start) ? (
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
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
    </Link>
  )
}
