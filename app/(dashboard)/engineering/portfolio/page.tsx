'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import {
  LayoutGrid,
  List,
  Search,
  ChevronDown,
  Plus,
  Calendar,
  CheckSquare,
  User,
  Plane,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ProjectStatus = 'active' | 'review' | 'approved' | 'paused' | 'closed'
type Classification = 'Major Change' | 'Minor Change' | 'Repair' | 'STC' | 'HIRF/Lightning'

interface Project {
  id: string
  code: string
  name: string
  aircraft: string
  client: string
  status: ProjectStatus
  classification: Classification
  tl: string
  delivery: string
  progress: number
  taskCount: number
  tasksDone: number
}

const MOCK_PROJECTS: Project[] = [
  {
    id: '1',
    code: 'DOA-2024-001',
    name: 'Modificación Sistema de Combustible A320',
    aircraft: 'A320-214',
    client: 'Iberia MRO',
    status: 'active',
    classification: 'Major Change',
    tl: 'J. García',
    delivery: '2025-03-15',
    progress: 62,
    taskCount: 24,
    tasksDone: 15,
  },
  {
    id: '2',
    code: 'DOA-2024-002',
    name: 'Instalación WiFi Cabin B737',
    aircraft: 'B737-800',
    client: 'Vueling',
    status: 'review',
    classification: 'Minor Change',
    tl: 'M. López',
    delivery: '2025-02-28',
    progress: 88,
    taskCount: 18,
    tasksDone: 16,
  },
  {
    id: '3',
    code: 'DOA-2024-003',
    name: 'Reparación Estructura Ala ATR72',
    aircraft: 'ATR 72-600',
    client: 'Air Nostrum',
    status: 'approved',
    classification: 'Repair',
    tl: 'P. Martínez',
    delivery: '2025-01-10',
    progress: 100,
    taskCount: 12,
    tasksDone: 12,
  },
  {
    id: '4',
    code: 'DOA-2024-004',
    name: 'STC Equipamiento Médico Emergencia',
    aircraft: 'EC135',
    client: 'SUMMA 112',
    status: 'paused',
    classification: 'STC',
    tl: 'R. Fernández',
    delivery: '2025-06-30',
    progress: 34,
    taskCount: 31,
    tasksDone: 11,
  },
  {
    id: '5',
    code: 'DOA-2024-005',
    name: 'Análisis HIRF Aviónica PC-12',
    aircraft: 'PC-12/47E',
    client: 'Flexjet Spain',
    status: 'active',
    classification: 'HIRF/Lightning',
    tl: 'A. Romero',
    delivery: '2025-04-20',
    progress: 47,
    taskCount: 20,
    tasksDone: 9,
  },
  {
    id: '6',
    code: 'DOA-2023-089',
    name: 'Modificación Tren de Aterrizaje CRJ',
    aircraft: 'CRJ-900',
    client: 'Air Europa Express',
    status: 'closed',
    classification: 'Major Change',
    tl: 'C. Navarro',
    delivery: '2024-11-30',
    progress: 100,
    taskCount: 28,
    tasksDone: 28,
  },
]

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  active: {
    label: 'En curso',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400',
  },
  review: {
    label: 'En revisión',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
  },
  approved: {
    label: 'Aprobado',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  paused: {
    label: 'En pausa',
    color: 'text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    dot: 'bg-gray-400',
  },
  closed: {
    label: 'Cerrado',
    color: 'text-gray-500',
    bg: 'bg-gray-700/20',
    border: 'border-gray-700/30',
    dot: 'bg-gray-600',
  },
}

const CLASSIFICATION_COLORS: Record<Classification, string> = {
  'Major Change': 'text-purple-400 bg-purple-500/10',
  'Minor Change': 'text-blue-400 bg-blue-500/10',
  Repair: 'text-orange-400 bg-orange-500/10',
  STC: 'text-pink-400 bg-pink-500/10',
  'HIRF/Lightning': 'text-yellow-400 bg-yellow-500/10',
}

const KANBAN_STATUSES: ProjectStatus[] = ['active', 'review', 'approved', 'paused', 'closed']

function StatusBadge({ status }: { status: ProjectStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border',
        cfg.color,
        cfg.bg,
        cfg.border,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

function ProgressBar({ value, status }: { value: number; status: ProjectStatus }) {
  const colorMap: Record<ProjectStatus, string> = {
    active: 'bg-blue-500',
    review: 'bg-amber-500',
    approved: 'bg-emerald-500',
    paused: 'bg-gray-500',
    closed: 'bg-gray-600',
  }
  return (
    <div className="w-full h-1 bg-[#2A2D3E] rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all', colorMap[status])}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function KanbanCard({ project }: { project: Project }) {
  return (
    <Link href={`/engineering/projects/${project.id}`}>
      <div className="bg-[#1A1D27] border border-[#2A2D3E] rounded-lg p-3 hover:border-[#6366F1]/40 hover:bg-[#1E2130] transition-all cursor-pointer group">
        <div className="flex items-start justify-between mb-2">
          <span className="font-mono text-[11px] text-[#6B7280] tracking-wide">
            {project.code}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-[#6B7280]">
            <CheckSquare size={11} />
            {project.tasksDone}/{project.taskCount}
          </span>
        </div>

        <p className="text-sm font-medium text-[#E8E9F0] leading-snug mb-2 group-hover:text-white transition-colors line-clamp-2">
          {project.name}
        </p>

        <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280] mb-3">
          <Plane size={11} />
          <span>{project.aircraft}</span>
          <span className="text-[#2A2D3E]">·</span>
          <span>{project.client}</span>
        </div>

        <ProgressBar value={project.progress} status={project.status} />

        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-[#6B7280]">{project.progress}%</span>
          <div className="flex items-center gap-1 text-[11px] text-[#6B7280]">
            <Calendar size={11} />
            <span>{project.delivery}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function KanbanView({ projects }: { projects: Project[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-0">
      {KANBAN_STATUSES.map((status) => {
        const cfg = STATUS_CONFIG[status]
        const cols = projects.filter((p) => p.status === status)
        return (
          <div key={status} className="flex-none w-72">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                <span className="text-sm font-medium text-[#E8E9F0]">{cfg.label}</span>
              </div>
              <span
                className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full border',
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
                <div className="border border-dashed border-[#2A2D3E] rounded-lg p-4 text-center text-xs text-[#6B7280]">
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

function ListView({ projects }: { projects: Project[] }) {
  return (
    <div className="bg-[#1A1D27] border border-[#2A2D3E] rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2A2D3E]">
            {[
              'Código',
              'Proyecto',
              'Cliente',
              'Aeronave',
              'Estado',
              'Clasificación',
              'TL',
              'Entrega',
              'Progreso',
            ].map((col) => (
              <th
                key={col}
                className="px-3 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((project, idx) => (
            <Link key={project.id} href={`/engineering/projects/${project.id}`} legacyBehavior>
              <tr
                className={cn(
                  'hover:bg-[#1E2130] cursor-pointer transition-colors border-b border-[#2A2D3E]/50',
                  idx % 2 === 0 ? '' : 'bg-[#1A1D27]',
                )}
              >
                <td className="px-3 py-2.5">
                  <span className="font-mono text-xs text-[#6B7280]">{project.code}</span>
                </td>
                <td className="px-3 py-2.5 max-w-[220px]">
                  <span className="text-[#E8E9F0] font-medium truncate block">{project.name}</span>
                </td>
                <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{project.client}</td>
                <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{project.aircraft}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={project.status} />
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded font-medium',
                      CLASSIFICATION_COLORS[project.classification],
                    )}
                  >
                    {project.classification}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <User size={12} />
                    {project.tl}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    {project.delivery}
                  </div>
                </td>
                <td className="px-3 py-2.5 min-w-[100px]">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <ProgressBar value={project.progress} status={project.status} />
                    </div>
                    <span className="text-xs text-[#6B7280] w-8 text-right shrink-0">
                      {project.progress}%
                    </span>
                  </div>
                </td>
              </tr>
            </Link>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function EngineeringPortfolioPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')

  const filtered = MOCK_PROJECTS.filter((p) => {
    const matchSearch =
      search === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.client.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="flex flex-col h-full bg-[#0F1117]">
      <TopBar title="Engineering" subtitle="Portfolio de proyectos" />

      <div className="flex flex-col flex-1 min-h-0 p-5 gap-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center bg-[#1A1D27] border border-[#2A2D3E] rounded-lg p-0.5">
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all',
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
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all',
                view === 'list'
                  ? 'bg-[#6366F1] text-white'
                  : 'text-[#6B7280] hover:text-[#E8E9F0]',
              )}
            >
              <List size={14} />
              Lista
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]"
            />
            <input
              type="text"
              placeholder="Buscar proyectos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1A1D27] border border-[#2A2D3E] rounded-lg pl-9 pr-3 py-2 text-sm text-[#E8E9F0] placeholder-[#6B7280] focus:outline-none focus:border-[#6366F1]/60 transition-colors"
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
              className="appearance-none bg-[#1A1D27] border border-[#2A2D3E] rounded-lg pl-3 pr-8 py-2 text-sm text-[#E8E9F0] focus:outline-none focus:border-[#6366F1]/60 transition-colors cursor-pointer"
            >
              <option value="all">Todos los estados</option>
              <option value="active">En curso</option>
              <option value="review">En revisión</option>
              <option value="approved">Aprobado</option>
              <option value="paused">En pausa</option>
              <option value="closed">Cerrado</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none"
            />
          </div>

          <div className="flex-1" />

          {/* New project */}
          <button className="flex items-center gap-2 bg-[#6366F1] hover:bg-[#5558E3] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} />
            Nuevo Proyecto
          </button>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-4 text-xs text-[#6B7280]">
          <span>
            <span className="text-[#E8E9F0] font-semibold">{filtered.length}</span> proyectos
          </span>
          {KANBAN_STATUSES.map((s) => {
            const count = filtered.filter((p) => p.status === s).length
            if (count === 0) return null
            return (
              <span key={s} className={cn('flex items-center gap-1', STATUS_CONFIG[s].color)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_CONFIG[s].dot)} />
                {count} {STATUS_CONFIG[s].label}
              </span>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          {view === 'kanban' ? (
            <KanbanView projects={filtered} />
          ) : (
            <ListView projects={filtered} />
          )}
        </div>
      </div>
    </div>
  )
}
