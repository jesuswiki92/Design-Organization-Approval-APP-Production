'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  LayoutGrid,
  List,
  Plane,
  Plus,
  Search,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProyectoConRelaciones } from '@/types/database'

type EstadoProyecto =
  | 'oferta'
  | 'activo'
  | 'en_revision'
  | 'pendiente_aprobacion_cve'
  | 'pendiente_aprobacion_easa'
  | 'en_pausa'
  | 'cancelado'
  | 'cerrado'

const STATUS_CONFIG: Record<
  EstadoProyecto,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  oferta: {
    label: 'Oferta',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    dot: 'bg-cyan-400',
  },
  activo: {
    label: 'Activo',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400',
  },
  en_revision: {
    label: 'En revision',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
  },
  pendiente_aprobacion_cve: {
    label: 'Pend. CVE',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    dot: 'bg-orange-400',
  },
  pendiente_aprobacion_easa: {
    label: 'Pend. EASA',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    dot: 'bg-purple-400',
  },
  en_pausa: {
    label: 'En pausa',
    color: 'text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    dot: 'bg-gray-400',
  },
  cancelado: {
    label: 'Cancelado',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    dot: 'bg-red-400',
  },
  cerrado: {
    label: 'Cerrado',
    color: 'text-gray-500',
    bg: 'bg-gray-700/20',
    border: 'border-gray-700/30',
    dot: 'bg-gray-600',
  },
}

const CLASIFICACION_COLORS: Record<string, string> = {
  mayor: 'text-purple-400 bg-purple-500/10',
  menor: 'text-blue-400 bg-blue-500/10',
  reparacion: 'text-orange-400 bg-orange-500/10',
  stc: 'text-pink-400 bg-pink-500/10',
  otro: 'text-gray-400 bg-gray-500/10',
}

const TIPO_LABELS: Record<string, string> = {
  antena_comms: 'Antena/Comms',
  cabina_it: 'Cabina IT',
  livery: 'Livery',
  cargo_cabina: 'Cargo/Cabina',
  equipamiento_medico: 'Equipamiento Medico',
  reparacion_estructural: 'Reparacion Estructural',
  mision_especial: 'Mision Especial',
  electrico: 'Electrico',
  otro: 'Otro',
}

const KANBAN_STATUSES: EstadoProyecto[] = [
  'activo',
  'en_revision',
  'pendiente_aprobacion_cve',
  'pendiente_aprobacion_easa',
  'en_pausa',
  'cerrado',
]

function StatusBadge({ estado }: { estado: EstadoProyecto }) {
  const cfg = STATUS_CONFIG[estado]
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

function ProgressBar({ value, estado }: { value: number; estado: EstadoProyecto }) {
  const colorMap: Record<EstadoProyecto, string> = {
    oferta: 'bg-cyan-500',
    activo: 'bg-blue-500',
    en_revision: 'bg-amber-500',
    pendiente_aprobacion_cve: 'bg-orange-500',
    pendiente_aprobacion_easa: 'bg-purple-500',
    en_pausa: 'bg-gray-500',
    cancelado: 'bg-red-500',
    cerrado: 'bg-gray-600',
  }

  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-[#2A2D3E]">
      <div
        className={cn('h-full rounded-full transition-all', colorMap[estado])}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function calcProgress(p: ProyectoConRelaciones): number {
  if (!p.horas_estimadas || p.horas_estimadas === 0) return 0
  const real = Number(p.horas_reales ?? 0)
  return Math.min(100, Math.round((real / p.horas_estimadas) * 100))
}

function KanbanCard({ project }: { project: ProyectoConRelaciones }) {
  const progress = calcProgress(project)
  const aircraft = project.modelo
    ? `${project.modelo.fabricante} ${project.modelo.modelo}`
    : '—'
  const client = project.cliente?.nombre ?? '—'
  const owner = project.owner
    ? `${project.owner.nombre}${project.owner.apellidos ? ` ${project.owner.apellidos[0]}.` : ''}`
    : '—'
  const delivery = project.fecha_prevista ?? '—'

  return (
    <Link href={`/engineering/projects/${project.id}`}>
      <div className="group cursor-pointer rounded-lg border border-[#2A2D3E] bg-[#1A1D27] p-3 transition-all hover:border-[#6366F1]/40 hover:bg-[#1E2130]">
        <div className="mb-2 flex items-start justify-between">
          <span className="font-mono text-[11px] tracking-wide text-[#6B7280]">
            {project.numero_proyecto}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-[#6B7280]">
            <CheckSquare size={11} />
            {project.num_aeronaves_afectadas}
          </span>
        </div>

        <p className="mb-2 line-clamp-2 text-sm font-medium leading-snug text-[#E8E9F0] transition-colors group-hover:text-white">
          {project.titulo}
        </p>

        <div className="mb-3 flex items-center gap-1.5 text-[11px] text-[#6B7280]">
          <Plane size={11} />
          <span>{aircraft}</span>
          <span className="text-[#2A2D3E]">·</span>
          <span>{client}</span>
        </div>

        <ProgressBar value={progress} estado={project.estado} />

        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-[#6B7280]">{progress}%</span>
          <div className="flex items-center gap-1 text-[11px] text-[#6B7280]">
            <User size={11} />
            <span>{owner}</span>
          </div>
          {delivery !== '—' && (
            <div className="flex items-center gap-1 text-[11px] text-[#6B7280]">
              <Calendar size={11} />
              <span>{delivery}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function KanbanView({ projects }: { projects: ProyectoConRelaciones[] }) {
  return (
    <div className="flex min-h-0 flex-row overflow-x-auto gap-4 pb-4">
      {KANBAN_STATUSES.map((estado) => {
        const cfg = STATUS_CONFIG[estado]
        const cols = projects.filter((p) => p.estado === estado)
        return (
          <div key={estado} className="min-w-[280px] flex-none">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
                <span className="text-sm font-medium text-[#E8E9F0]">{cfg.label}</span>
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
                <div className="rounded-lg border border-dashed border-[#2A2D3E] p-4 text-center text-xs text-[#6B7280]">
                  Sin proyectos
                </div>
              ) : (
                cols.map((p) => <KanbanCard key={p.id} project={p} />)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ListView({ projects }: { projects: ProyectoConRelaciones[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#2A2D3E] bg-[#1A1D27]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2A2D3E]">
            {[
              'Numero',
              'Proyecto',
              'Cliente',
              'Aeronave',
              'Estado',
              'Clasificacion',
              'Owner',
              'Entrega',
              'Progreso',
            ].map((col) => (
              <th
                key={col}
                className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280]"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((project, idx) => {
            const progress = calcProgress(project)
            const aircraft = project.modelo
              ? `${project.modelo.fabricante} ${project.modelo.modelo}`
              : '—'
            const client = project.cliente?.nombre ?? '—'
            const owner = project.owner
              ? `${project.owner.nombre}${project.owner.apellidos ? ` ${project.owner.apellidos[0]}.` : ''}`
              : '—'
            const delivery = project.fecha_prevista ?? '—'
            const clasificacion = project.clasificacion_cambio ?? 'otro'

            return (
              <tr
                key={project.id}
                className={cn(
                  'cursor-pointer border-b border-[#2A2D3E]/50 transition-colors hover:bg-[#1E2130]',
                  idx % 2 === 0 ? '' : 'bg-[#1A1D27]',
                )}
              >
                <td className="px-3 py-2.5">
                  <Link
                    href={`/engineering/projects/${project.id}`}
                    className="block font-mono text-xs text-[#6B7280]"
                  >
                    {project.numero_proyecto}
                  </Link>
                </td>
                <td className="max-w-[220px] px-3 py-2.5">
                  <Link href={`/engineering/projects/${project.id}`} className="block">
                    <span className="block truncate font-medium text-[#E8E9F0]">
                      {project.titulo}
                    </span>
                    <span className="text-[11px] text-[#6B7280]">
                      {TIPO_LABELS[project.tipo_modificacion] ?? project.tipo_modificacion}
                    </span>
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">{client}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">{aircraft}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge estado={project.estado} />
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-xs font-medium',
                      CLASIFICACION_COLORS[clasificacion] ?? 'bg-gray-500/10 text-gray-400',
                    )}
                  >
                    {clasificacion}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">
                  <div className="flex items-center gap-1.5">
                    <User size={12} />
                    {owner}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    {delivery}
                  </div>
                </td>
                <td className="min-w-[100px] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <ProgressBar value={progress} estado={project.estado} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs text-[#6B7280]">
                      {progress}%
                    </span>
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

export function PortfolioClient({ projects }: { projects: ProyectoConRelaciones[] }) {
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<EstadoProyecto | 'all'>('all')

  const filtered = projects.filter((p) => {
    const matchSearch =
      search === '' ||
      p.titulo.toLowerCase().includes(search.toLowerCase()) ||
      p.numero_proyecto.toLowerCase().includes(search.toLowerCase()) ||
      (p.cliente?.nombre ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || p.estado === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-lg border border-[#2A2D3E] bg-[#1A1D27] p-0.5">
          <button
            onClick={() => setView('kanban')}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-all',
              view === 'kanban'
                ? 'bg-[#6366F1] text-white'
                : 'text-[#6B7280] hover:text-[#E8E9F0]',
            )}
          >
            <LayoutGrid size={14} />
            Kanban
          </button>
          <button
            onClick={() => setView('list')}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-all',
              view === 'list'
                ? 'bg-[#6366F1] text-white'
                : 'text-[#6B7280] hover:text-[#E8E9F0]',
            )}
          >
            <List size={14} />
            Lista
          </button>
        </div>

        <div className="relative max-w-xs min-w-[200px] flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]"
          />
          <input
            type="text"
            placeholder="Buscar proyectos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#2A2D3E] bg-[#1A1D27] py-2 pl-9 pr-3 text-sm text-[#E8E9F0] placeholder-[#6B7280] transition-colors focus:border-[#6366F1]/60 focus:outline-none"
          />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EstadoProyecto | 'all')}
            className="cursor-pointer appearance-none rounded-lg border border-[#2A2D3E] bg-[#1A1D27] py-2 pl-3 pr-8 text-sm text-[#E8E9F0] transition-colors focus:border-[#6366F1]/60 focus:outline-none"
          >
            <option value="all">Todos los estados</option>
            <option value="oferta">Oferta</option>
            <option value="activo">Activo</option>
            <option value="en_revision">En revision</option>
            <option value="pendiente_aprobacion_cve">Pend. CVE</option>
            <option value="pendiente_aprobacion_easa">Pend. EASA</option>
            <option value="en_pausa">En pausa</option>
            <option value="cancelado">Cancelado</option>
            <option value="cerrado">Cerrado</option>
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]"
          />
        </div>

        <div className="flex-1" />

        <button className="flex items-center gap-2 rounded-lg bg-[#6366F1] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#5558E3]">
          <Plus size={16} />
          Nuevo Proyecto
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs text-[#6B7280]">
        <span>
          <span className="font-semibold text-[#E8E9F0]">{filtered.length}</span> proyectos
        </span>
        {KANBAN_STATUSES.map((s) => {
          const count = filtered.filter((p) => p.estado === s).length
          if (count === 0) return null
          return (
            <span key={s} className={cn('flex items-center gap-1', STATUS_CONFIG[s].color)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_CONFIG[s].dot)} />
              {count} {STATUS_CONFIG[s].label}
            </span>
          )
        })}
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto pr-4">
        {filtered.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-[#6B7280]">
            <p className="text-sm">No se encontraron proyectos</p>
          </div>
        ) : view === 'kanban' ? (
          <KanbanView projects={filtered} />
        ) : (
          <ListView projects={filtered} />
        )}
      </div>
    </div>
  )
}
