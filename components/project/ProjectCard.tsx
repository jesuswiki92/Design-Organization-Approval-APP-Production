'use client'

/**
 * ============================================================================
 * TARJETA COMPACTA DE PROYECTO (TABLERO)
 * ============================================================================
 *
 * Card compacta para el Tablero de projects. Muestra codigo, title, client,
 * TCDS/aircraft, owner, date, progreso de deliverables y acciones rapidas.
 * Clic en la card abre el detalle del project.
 * ============================================================================
 */

import Link from 'next/link'
import { useState } from 'react'
import { Calendar, Plane, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import type { Project } from '@/types/database'

import { ProjectStateSelector } from './ProjectStateSelector'

export type ProjectCardData = Project & {
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
  const [deleteStatus] = useState<'idle' | 'deleting' | 'error'>('idle')
  const [deleteMessage] = useState<string | null>(null)
  const aircraft = project.tcds_code_short ?? project.aircraft ?? null
  const client = project.client_name ?? null
  const owner = project.owner ?? null
  const start = project.start_date ?? null
  const total = project.deliverables_total ?? 0
  const done = project.deliverables_completados ?? 0
  const hasDeliverables = total > 0

  function handleDelete() {
    const confirmed = window.confirm(
      `Seguro que quieres borrar el proyecto "${project.project_number}"? Se eliminara de la app, pero no se borraran las carpetas locales del proyecto.`,
    )
    if (!confirmed) return
    toast.info('Acción desconectada')
  }

  return (
    <article className="doa-kanban-card group relative">
      <Link
        href={`/engineering/projects/${project.id}`}
        className="block pr-8"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="doa-kanban-card-code">
            {project.project_number}
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

        <h4 className="doa-kanban-card-title mt-1.5 line-clamp-2 transition-colors group-hover:text-[color:var(--umber)]">
          {project.title}
        </h4>

        {client || aircraft ? (
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

        {owner || start ? (
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

        {showStateSelector ? (
          <div className="mt-3 pt-2 doa-kanban-card-foot">
            <ProjectStateSelector
              proyectoId={project.id}
              currentState={project.execution_status ?? null}
            />
          </div>
        ) : null}
      </Link>

      <button
        type="button"
        onClick={() => handleDelete()}
        disabled={deleteStatus === 'deleting'}
        className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] text-[color:var(--err)] transition-colors hover:bg-[color:var(--paper-3)] disabled:cursor-wait disabled:opacity-70"
        aria-label={`Borrar proyecto ${project.project_number}`}
        title="Borrar proyecto"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {deleteStatus === 'deleting' ? (
        <p className="mt-2 text-[11px] text-[color:var(--ink-3)]">
          Borrando proyecto...
        </p>
      ) : null}
      {deleteMessage ? (
        <p className="mt-2 text-[11px] text-[color:var(--err)]">
          {deleteMessage}
        </p>
      ) : null}
    </article>
  )
}
