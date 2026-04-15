'use client'

/**
 * ============================================================================
 * VISTA LISTA DEL PORTFOLIO DE PROYECTOS
 * ============================================================================
 *
 * Tabla ligera con todos los proyectos y sus datos principales. Tiene un
 * toggle en la cabecera para alternar con la vista Tablero (Kanban por fase
 * y estado), que vive en /engineering/portfolio/tablero.
 *
 * NOTA: La vista Kanban antigua (agrupada por los 4 estados legacy
 * PROJECT_PORTFOLIO_STATES) fue sustituida por el Tablero v2 en
 * /engineering/portfolio/tablero, que agrupa por la maquina de 13 estados.
 * ============================================================================
 */

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Calendar,
  ChevronDown,
  LayoutGrid,
  List,
  Plus,
  Search,
  User,
} from 'lucide-react'

import {
  PROJECT_PORTFOLIO_STATES,
  getProjectExecutionStateMeta,
  getProjectOperationalState,
  getProjectStatusMeta,
  isProjectExecutionStateCode,
} from '@/lib/workflow-states'
import { cn } from '@/lib/utils'
import type { EstadoProyecto, Proyecto } from '@/types/database'

/**
 * Devuelve el codigo de estado a mostrar para un proyecto.
 * Prioriza `estado_v2` (maquina de ejecucion Sprint 1) si esta presente;
 * si no, cae al flujo legacy `estado`.
 */
function resolveDisplayStateCode(project: Proyecto): string {
  return project.estado_v2 ?? project.estado
}

/**
 * Metadatos visuales unificados para un estado: si es de la maquina v2 usa
 * `getProjectExecutionStateMeta`, si no usa `getProjectStatusMeta` (legacy).
 */
function getDisplayStateMeta(code: string) {
  if (isProjectExecutionStateCode(code)) {
    return getProjectExecutionStateMeta(code)
  }
  return getProjectStatusMeta(code)
}

/**
 * Badge visual del estado de un proyecto.
 */
function StatusBadge({ estado }: { estado: string }) {
  const cfg = getDisplayStateMeta(estado)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium',
        cfg.color,
        cfg.bg,
        cfg.border,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

/**
 * Vista Lista: tabla con datos del proyecto.
 */
function ListView({ projects }: { projects: Proyecto[] }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {[
              'Numero',
              'Proyecto',
              'Cliente',
              'Aeronave',
              'Estado',
              'Prioridad',
              'Owner',
              'Entrega',
            ].map((column) => (
              <th
                key={column}
                className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((project, idx) => {
            const aircraft = project.aeronave ?? '-'
            const client = project.cliente_nombre ?? '-'
            const owner = project.owner ?? '-'
            const delivery = project.fecha_entrega_estimada ?? '-'
            const prioridad = project.prioridad ?? '-'

            return (
              <tr
                key={project.id}
                className={cn(
                  'border-b border-slate-200/60 align-top transition-colors hover:bg-sky-50/60',
                  idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40',
                )}
              >
                <td className="px-3 py-2.5">
                  <Link
                    href={`/engineering/projects/${project.id}`}
                    className="block font-mono text-xs text-slate-500"
                  >
                    {project.numero_proyecto}
                  </Link>
                </td>
                <td className="max-w-[220px] px-3 py-2.5">
                  <Link href={`/engineering/projects/${project.id}`} className="block">
                    <span className="block truncate font-medium text-slate-950">
                      {project.titulo}
                    </span>
                    {project.descripcion ? (
                      <span className="block truncate text-[11px] italic text-slate-500">
                        {project.descripcion}
                      </span>
                    ) : null}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{client}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{aircraft}</td>
                <td className="min-w-[220px] px-3 py-2.5">
                  <StatusBadge estado={resolveDisplayStateCode(project)} />
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-xs text-slate-600">{prioridad}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <User size={12} />
                    {owner}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    {delivery}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function PortfolioClient({ projects }: { projects: Proyecto[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<EstadoProyecto | 'all'>('all')

  const filtered = useMemo(
    () =>
      projects.filter((project) => {
        const matchSearch =
          search === '' ||
          project.titulo.toLowerCase().includes(search.toLowerCase()) ||
          project.numero_proyecto.toLowerCase().includes(search.toLowerCase()) ||
          (project.cliente_nombre ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (project.aeronave ?? '').toLowerCase().includes(search.toLowerCase())
        const matchStatus =
          statusFilter === 'all' || getProjectOperationalState(project.estado) === statusFilter
        return matchSearch && matchStatus
      }),
    [projects, search, statusFilter],
  )

  const availableStates = useMemo(
    () =>
      PROJECT_PORTFOLIO_STATES.filter((state) =>
        filtered.some((project) => getProjectOperationalState(project.estado) === state),
      ),
    [filtered],
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-5 text-slate-900">
      <div className="flex flex-wrap items-center gap-3">
        {/* Toggle Lista (activa) / Tablero (link) — espejo del patron Quotations */}
        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
              'bg-sky-600 text-white shadow-sm',
            )}
          >
            <List size={14} />
            Lista
          </span>
          <Link
            href="/engineering/portfolio/tablero"
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
              'text-slate-500 hover:text-slate-950',
            )}
          >
            <LayoutGrid size={14} />
            Tablero
          </Link>
        </div>

        <div className="relative max-w-xs min-w-[200px] flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Buscar proyectos..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-950 placeholder-slate-400 transition-colors focus:border-sky-300 focus:outline-none"
          />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as EstadoProyecto | 'all')}
            className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-8 text-sm text-slate-950 transition-colors focus:border-sky-300 focus:outline-none"
          >
            <option value="all">Todos los estados</option>
            {PROJECT_PORTFOLIO_STATES.map((state) => {
              const meta = getProjectStatusMeta(state)
              return (
                <option key={state} value={state}>
                  {meta.label}
                </option>
              )
            })}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>

        <div className="flex-1" />

        <button className="flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#2563EB,#38BDF8)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90">
          <Plus size={16} />
          Nuevo Proyecto
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span>
          <span className="font-semibold text-slate-950">{filtered.length}</span> proyectos
        </span>
        {availableStates.map((state) => {
          const count = filtered.filter(
            (project) => getProjectOperationalState(project.estado) === state,
          ).length
          if (count === 0) return null
          const meta = getProjectStatusMeta(state)
          return (
            <span key={state} className={cn('flex items-center gap-1', meta.color)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
              {count} {meta.label}
            </span>
          )
        })}
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto pr-4">
        {filtered.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-slate-400">
            <p className="text-sm">No se encontraron proyectos</p>
          </div>
        ) : (
          <ListView projects={filtered} />
        )}
      </div>
    </div>
  )
}
