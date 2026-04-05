'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Calendar,
  ChevronDown,
  LayoutGrid,
  List,
  Plane,
  Plus,
  Search,
  User,
} from 'lucide-react'

import {
  PROJECT_PORTFOLIO_STATES,
  getProjectOperationalState,
  getProjectStatusMeta,
} from '@/lib/workflow-states'
import { cn } from '@/lib/utils'
import type { EstadoProyecto, Proyecto } from '@/types/database'

/**
 * Badge visual del estado de un proyecto.
 */
function StatusBadge({ estado }: { estado: string }) {
  const cfg = getProjectStatusMeta(estado)
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
 * Tarjeta individual del Kanban para un proyecto.
 * Usa los campos reales de la tabla doa_proyectos.
 */
function KanbanCard({ project }: { project: Proyecto }) {
  const aircraft = project.aeronave ?? '-'
  const client = project.cliente_nombre ?? '-'
  const owner = project.owner ?? '-'
  const delivery = project.fecha_entrega_estimada ?? '-'

  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-3 shadow-[0_10px_24px_rgba(148,163,184,0.12)] transition-all hover:border-sky-300 hover:bg-sky-50/40">
      <div className="mb-2 flex items-start justify-between gap-3">
        <Link
          href={`/engineering/projects/${project.id}`}
          className="font-mono text-[11px] tracking-wide text-slate-500 hover:text-sky-700"
        >
          {project.numero_proyecto}
        </Link>
        <StatusBadge estado={project.estado} />
      </div>

      <Link href={`/engineering/projects/${project.id}`} className="block">
        <p className="mb-2 line-clamp-2 text-sm font-medium leading-snug text-slate-950 transition-colors hover:text-sky-800">
          {project.titulo}
        </p>
      </Link>

      <div className="mb-3 flex items-center gap-1.5 text-[11px] text-slate-500">
        <Plane size={11} />
        <span>{aircraft}</span>
        <span className="text-slate-300">·</span>
        <span>{client}</span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <User size={11} />
          <span>{owner}</span>
        </div>
        {delivery !== '-' && (
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Calendar size={11} />
            <span>{delivery}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Vista Kanban: columnas por estado.
 */
function KanbanView({
  projects,
  statuses,
}: {
  projects: Proyecto[]
  statuses: EstadoProyecto[]
}) {
  return (
    <div className="flex min-h-0 flex-row gap-4 overflow-x-auto pb-4">
      {statuses.map((estado) => {
        const cfg = getProjectStatusMeta(estado)
        const cols = projects.filter(
          (project) => getProjectOperationalState(project.estado) === estado,
        )
        return (
          <div key={estado} className="min-w-[280px] flex-none">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
                <span className="text-sm font-medium text-slate-900">{cfg.label}</span>
              </div>
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-xs font-semibold',
                  cfg.color,
                  cfg.bg,
                  cfg.border,
                )}
              >
                {cols.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {cols.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                  Sin proyectos
                </div>
              ) : (
                cols.map((project) => <KanbanCard key={project.id} project={project} />)
              )}
            </div>
          </div>
        )
      })}
    </div>
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
                  <StatusBadge estado={project.estado} />
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
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
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
        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
          <button
            onClick={() => setView('kanban')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
              view === 'kanban'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-950',
            )}
          >
            <LayoutGrid size={14} />
            Kanban
          </button>
          <button
            onClick={() => setView('list')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
              view === 'list'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-950',
            )}
          >
            <List size={14} />
            Lista
          </button>
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
        ) : view === 'kanban' ? (
          <KanbanView projects={filtered} statuses={availableStates} />
        ) : (
          <ListView projects={filtered} />
        )}
      </div>
    </div>
  )
}
