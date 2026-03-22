'use client'

import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Calendar,
  ChevronRight,
  ChevronDown,
  FileText,
  User,
  Users,
  Plane,
  Clock,
  Plus,
  Tag,
  BookOpen,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Circle,
  XCircle,
  Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type DocStatus = 'Vigente' | 'Obsoleto' | 'Pendiente' | 'N/A'
type TaskPriority = 'Crítica' | 'Alta' | 'Media' | 'Baja'
type TaskColumn = 'Todo' | 'En progreso' | 'Bloqueado' | 'Hecho'

interface Document {
  id: string
  name: string
  edition: string
  status: DocStatus
  author: string
  date: string
}

interface Folder {
  id: string
  name: string
  documents: Document[]
}

interface Task {
  id: string
  title: string
  priority: TaskPriority
  assignee: string
  dueDate: string
  column: TaskColumn
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_PROJECT = {
  id: '1',
  code: 'DOA-2024-001',
  name: 'Modificación Sistema de Combustible A320',
  status: 'active' as const,
  aircraft: 'A320-214',
  client: 'Iberia MRO',
  tl: 'J. García',
  delivery: '2025-03-15',
  progress: 62,
  description:
    'Modificación mayor del sistema de combustible del Airbus A320 para la instalación de una válvula de corte adicional en la línea de transfer, conforme a los requisitos de CS-25 y EASA Part 21J. El proyecto incluye análisis de seguridad, documentación de diseño y soporte a certificación.',
  classification: 'Major Change',
  certBasis: ['CS-25 Amdt 27', 'AMC 25.981', 'FAR 25.981'],
  normativa: 'EASA Part 21 Subpart J — Design Organisation Approval',
  createdAt: '2024-06-10',
  estimatedDelivery: '2025-03-15',
  daysRemaining: 52,
  team: {
    tl: 'J. García',
    engineer: 'A. Romero',
    client: 'P. Delgado (Iberia)',
  },
  docsTotal: 21,
  docsVigente: 13,
}

const MOCK_FOLDERS: Folder[] = [
  {
    id: 'f1',
    name: '01. Input Data',
    documents: [
      { id: 'd1', name: 'Aircraft Maintenance Manual Rev 45', edition: 'Ed01', status: 'Vigente', author: 'A. Romero', date: '2024-07-15' },
      { id: 'd2', name: 'Aircraft Wiring Manual Chapter 28', edition: 'Ed01', status: 'Vigente', author: 'A. Romero', date: '2024-07-15' },
      { id: 'd3', name: 'CS-25 Amendment 27 Extracts', edition: 'Ed01', status: 'Vigente', author: 'J. García', date: '2024-06-20' },
      { id: 'd4', name: 'Client Requirements Specification', edition: 'Ed02', status: 'Vigente', author: 'J. García', date: '2024-08-01' },
    ],
  },
  {
    id: 'f2',
    name: '02. Management Documents',
    documents: [
      { id: 'd5', name: 'Certification Plan', edition: 'Ed03', status: 'Vigente', author: 'J. García', date: '2024-09-10' },
      { id: 'd6', name: 'Project Plan', edition: 'Ed02', status: 'Obsoleto', author: 'J. García', date: '2024-07-01' },
      { id: 'd7', name: 'Risk Register', edition: 'Ed01', status: 'Vigente', author: 'M. López', date: '2024-08-15' },
    ],
  },
  {
    id: 'f3',
    name: '03. Compliance Documents',
    documents: [
      { id: 'd8', name: 'Design Definition Document', edition: 'Ed04', status: 'Vigente', author: 'A. Romero', date: '2024-11-20' },
      { id: 'd9', name: 'Safety Assessment Report', edition: 'Ed02', status: 'Vigente', author: 'J. García', date: '2024-10-05' },
      { id: 'd10', name: 'Compliance Checklist CS-25.981', edition: 'Ed01', status: 'Pendiente', author: 'A. Romero', date: '2025-01-10' },
      { id: 'd11', name: 'Stress Analysis Report', edition: 'Ed01', status: 'Pendiente', author: 'R. Fernández', date: '2025-02-01' },
      { id: 'd12', name: 'Fuel System Functional Analysis', edition: 'Ed03', status: 'Vigente', author: 'A. Romero', date: '2024-12-01' },
      { id: 'd13', name: 'Installation Drawing D28-001', edition: 'Ed02', status: 'Vigente', author: 'A. Romero', date: '2024-11-30' },
    ],
  },
  {
    id: 'f4',
    name: '04. Quality Documents',
    documents: [
      { id: 'd14', name: 'Inspection Report — Valve Assembly', edition: 'Ed01', status: 'Vigente', author: 'C. Navarro', date: '2024-12-15' },
      { id: 'd15', name: 'Non-Conformance Report NCR-001', edition: 'Ed01', status: 'Obsoleto', author: 'C. Navarro', date: '2024-10-20' },
      { id: 'd16', name: 'Ground Test Report', edition: 'Ed01', status: 'N/A', author: 'TBD', date: '—' },
    ],
  },
  {
    id: 'f5',
    name: '05. Sent Documents',
    documents: [
      { id: 'd17', name: 'Letter of Intent to EASA', edition: 'Ed01', status: 'Vigente', author: 'J. García', date: '2024-07-10' },
      { id: 'd18', name: 'Stage 1 Submission Package', edition: 'Ed01', status: 'Vigente', author: 'J. García', date: '2024-09-30' },
      { id: 'd19', name: 'EASA Response — Stage 1', edition: 'Ed01', status: 'Vigente', author: 'EASA', date: '2024-11-05' },
      { id: 'd20', name: 'Stage 2 Submission Package', edition: 'Ed01', status: 'Pendiente', author: 'J. García', date: '—' },
      { id: 'd21', name: 'Flight Test Request', edition: 'Ed01', status: 'N/A', author: 'TBD', date: '—' },
    ],
  },
]

const MOCK_TASKS: Task[] = [
  { id: 't1', title: 'Revisar CS-25.981 compliance matrix', priority: 'Crítica', assignee: 'JG', dueDate: '2025-01-20', column: 'Todo' },
  { id: 't2', title: 'Completar análisis de estrés en soporte', priority: 'Alta', assignee: 'RF', dueDate: '2025-02-01', column: 'Todo' },
  { id: 't3', title: 'Preparar Stage 2 submission package', priority: 'Alta', assignee: 'JG', dueDate: '2025-02-15', column: 'Todo' },
  { id: 't4', title: 'Actualizar Design Definition Document', priority: 'Media', assignee: 'AR', dueDate: '2025-01-25', column: 'En progreso' },
  { id: 't5', title: 'Ground test planning y coordinación', priority: 'Media', assignee: 'ML', dueDate: '2025-03-01', column: 'En progreso' },
  { id: 't6', title: 'Validación CFD del sistema de fuel', priority: 'Crítica', assignee: 'AR', dueDate: '2025-01-15', column: 'Bloqueado' },
  { id: 't7', title: 'Aprobación planos instalación', priority: 'Alta', assignee: 'JG', dueDate: '2025-01-10', column: 'Hecho' },
  { id: 't8', title: 'Reunión Stage 1 con EASA — Acta', priority: 'Media', assignee: 'JG', dueDate: '2024-11-10', column: 'Hecho' },
  { id: 't9', title: 'Safety Assessment — PSSA completada', priority: 'Crítica', assignee: 'JG', dueDate: '2024-10-20', column: 'Hecho' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active: { label: 'En curso', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  review: { label: 'En revisión', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  approved: { label: 'Aprobado', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  paused: { label: 'En pausa', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30', dot: 'bg-gray-400' },
  closed: { label: 'Cerrado', color: 'text-gray-500', bg: 'bg-gray-700/20', border: 'border-gray-700/30', dot: 'bg-gray-600' },
}

const DOC_STATUS_CONFIG: Record<DocStatus, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  Vigente: { label: 'Vigente', icon: <CheckCircle2 size={11} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  Obsoleto: { label: 'Obsoleto', icon: <XCircle size={11} />, color: 'text-red-400', bg: 'bg-red-500/10' },
  Pendiente: { label: 'Pendiente', icon: <Clock size={11} />, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  'N/A': { label: 'N/A', icon: <Minus size={11} />, color: 'text-gray-500', bg: 'bg-gray-700/20' },
}

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; bg: string }> = {
  Crítica: { color: 'text-red-400', bg: 'bg-red-500/10' },
  Alta: { color: 'text-amber-400', bg: 'bg-amber-500/10' },
  Media: { color: 'text-blue-400', bg: 'bg-blue-500/10' },
  Baja: { color: 'text-gray-400', bg: 'bg-gray-500/10' },
}

const TASK_COLUMNS: TaskColumn[] = ['Todo', 'En progreso', 'Bloqueado', 'Hecho']

const TASK_COLUMN_ICONS: Record<TaskColumn, React.ReactNode> = {
  Todo: <Circle size={13} className="text-gray-500" />,
  'En progreso': <Clock size={13} className="text-blue-400" />,
  Bloqueado: <AlertTriangle size={13} className="text-red-400" />,
  Hecho: <CheckCircle2 size={13} className="text-emerald-400" />,
}

function CollapsibleFolder({ folder }: { folder: Folder }) {
  const [open, setOpen] = useState(true)
  const vigente = folder.documents.filter((d) => d.status === 'Vigente').length

  return (
    <div className="border border-[#2A2D3E] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#1A1D27] hover:bg-[#1E2130] transition-colors"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown size={14} className="text-[#6B7280]" />
          ) : (
            <ChevronRight size={14} className="text-[#6B7280]" />
          )}
          <span className="text-sm font-semibold text-[#E8E9F0]">{folder.name}</span>
          <span className="text-xs text-[#6B7280]">
            {folder.documents.length} doc{folder.documents.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-xs text-emerald-400">
          {vigente}/{folder.documents.length} vigentes
        </span>
      </button>

      {open && (
        <div className="divide-y divide-[#2A2D3E]/50">
          {folder.documents.map((doc) => {
            const cfg = DOC_STATUS_CONFIG[doc.status]
            return (
              <div
                key={doc.id}
                className="flex items-center gap-4 px-4 py-2.5 hover:bg-[#1E2130] transition-colors"
              >
                <FileText size={13} className="text-[#6B7280] shrink-0" />
                <span className="flex-1 text-sm text-[#E8E9F0] truncate">{doc.name}</span>
                <span className="text-xs font-mono text-[#6B7280] shrink-0">{doc.edition}</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded shrink-0',
                    cfg.color,
                    cfg.bg,
                  )}
                >
                  {cfg.icon}
                  {cfg.label}
                </span>
                <div className="flex items-center gap-1 text-xs text-[#6B7280] shrink-0 w-24">
                  <User size={11} />
                  {doc.author}
                </div>
                <div className="flex items-center gap-1 text-xs text-[#6B7280] shrink-0 w-24">
                  <Calendar size={11} />
                  {doc.date}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TaskCard({ task }: { task: Task }) {
  const pri = PRIORITY_CONFIG[task.priority]
  return (
    <div className="bg-[#1A1D27] border border-[#2A2D3E] rounded-lg p-3 hover:border-[#6366F1]/30 transition-colors">
      <p className="text-sm text-[#E8E9F0] leading-snug mb-2">{task.title}</p>
      <div className="flex items-center justify-between">
        <span className={cn('text-xs px-2 py-0.5 rounded font-medium', pri.color, pri.bg)}>
          {task.priority}
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-[#6B7280]">
            <Calendar size={11} />
            {task.dueDate}
          </div>
          <div className="w-6 h-6 rounded-full bg-[#6366F1]/20 border border-[#6366F1]/30 flex items-center justify-center text-[10px] font-bold text-[#6366F1]">
            {task.assignee}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectWorkspacePage({
  params,
}: {
  params: { id: string }
}) {
  const project = { ...MOCK_PROJECT, id: params.id }
  const statusCfg = STATUS_CONFIG[project.status]
  const docsVigente = MOCK_FOLDERS.flatMap((f) => f.documents).filter(
    (d) => d.status === 'Vigente',
  ).length
  const docsTotal = MOCK_FOLDERS.flatMap((f) => f.documents).length
  const docsPercent = Math.round((docsVigente / docsTotal) * 100)

  return (
    <div className="flex flex-col h-full bg-[#0F1117]">
      <TopBar title={project.code} subtitle={project.name} />

      {/* Project header bar */}
      <div className="bg-[#1A1D27] border-b border-[#2A2D3E] px-5 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-mono text-xs text-[#6B7280] bg-[#0F1117] border border-[#2A2D3E] px-2.5 py-1 rounded">
            {project.code}
          </span>
          <span className="text-sm font-semibold text-[#E8E9F0]">{project.name}</span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border',
              statusCfg.color,
              statusCfg.bg,
              statusCfg.border,
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dot)} />
            {statusCfg.label}
          </span>

          <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <Plane size={12} />
            {project.aircraft}
          </div>
          <span className="text-[#2A2D3E]">·</span>
          <span className="text-xs text-[#6B7280]">{project.client}</span>
          <span className="text-[#2A2D3E]">·</span>
          <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <User size={12} />
            {project.tl}
          </div>

          <div className="flex-1" />

          {/* Delivery */}
          <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <Calendar size={12} />
            <span>Entrega:</span>
            <span className="text-[#E8E9F0] font-medium">{project.delivery}</span>
          </div>

          {/* Docs progress */}
          <div className="flex items-center gap-2 min-w-[160px]">
            <span className="text-xs text-[#6B7280] shrink-0">
              Docs {docsVigente}/{docsTotal}
            </span>
            <div className="flex-1 h-1.5 bg-[#2A2D3E] rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${docsPercent}%` }}
              />
            </div>
            <span className="text-xs text-emerald-400 shrink-0">{docsPercent}%</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-5">
        <Tabs defaultValue="resumen" className="flex flex-col flex-1 min-h-0">
          <TabsList className="bg-[#1A1D27] border border-[#2A2D3E] p-0.5 rounded-lg w-fit mb-4 shrink-0">
            <TabsTrigger
              value="resumen"
              className="px-4 py-1.5 text-sm rounded data-[state=active]:bg-[#6366F1] data-[state=active]:text-white text-[#6B7280] hover:text-[#E8E9F0]"
            >
              Resumen
            </TabsTrigger>
            <TabsTrigger
              value="documentos"
              className="px-4 py-1.5 text-sm rounded data-[state=active]:bg-[#6366F1] data-[state=active]:text-white text-[#6B7280] hover:text-[#E8E9F0]"
            >
              Documentos
            </TabsTrigger>
            <TabsTrigger
              value="tareas"
              className="px-4 py-1.5 text-sm rounded data-[state=active]:bg-[#6366F1] data-[state=active]:text-white text-[#6B7280] hover:text-[#E8E9F0]"
            >
              Tareas
            </TabsTrigger>
          </TabsList>

          {/* TAB: RESUMEN */}
          <TabsContent value="resumen" className="flex-1 min-h-0 overflow-auto">
            <div className="grid grid-cols-2 gap-4">
              {/* Left */}
              <div className="flex flex-col gap-4">
                {/* Description */}
                <div className="bg-[#1A1D27] border border-[#2A2D3E] rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <BookOpen size={13} />
                    Descripción
                  </h3>
                  <p className="text-sm text-[#E8E9F0] leading-relaxed">{project.description}</p>
                </div>

                {/* Classification */}
                <div className="bg-[#1A1D27] border border-[#2A2D3E] rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Tag size={13} />
                    Clasificación &amp; Base de Certificación
                  </h3>
                  <div className="flex flex-col gap-3">
                    <div>
                      <span className="text-xs text-[#6B7280] block mb-1.5">Clasificación</span>
                      <span className="text-xs px-2.5 py-1 rounded bg-purple-500/10 text-purple-400 font-medium">
                        {project.classification}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-[#6B7280] block mb-1.5">Base de Certificación</span>
                      <div className="flex flex-wrap gap-1.5">
                        {project.certBasis.map((b) => (
                          <span
                            key={b}
                            className="text-xs px-2 py-0.5 rounded bg-[#0F1117] border border-[#2A2D3E] text-[#E8E9F0] font-mono"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-[#6B7280] block mb-1.5">Normativa aplicable</span>
                      <div className="flex items-center gap-1.5">
                        <Shield size={12} className="text-[#6366F1]" />
                        <span className="text-xs text-[#E8E9F0]">{project.normativa}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right */}
              <div className="flex flex-col gap-4">
                {/* Team */}
                <div className="bg-[#1A1D27] border border-[#2A2D3E] rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Users size={13} />
                    Equipo
                  </h3>
                  <div className="flex flex-col gap-3">
                    {[
                      { role: 'Technical Leader', name: project.team.tl },
                      { role: 'Ingeniero de Diseño', name: project.team.engineer },
                      { role: 'Contacto Cliente', name: project.team.client },
                    ].map((m) => (
                      <div key={m.role} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#6366F1]/20 border border-[#6366F1]/30 flex items-center justify-center text-xs font-bold text-[#6366F1] shrink-0">
                          {m.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm text-[#E8E9F0] font-medium">{m.name}</div>
                          <div className="text-xs text-[#6B7280]">{m.role}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Schedule */}
                <div className="bg-[#1A1D27] border border-[#2A2D3E] rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Calendar size={13} />
                    Planificación
                  </h3>
                  <div className="flex flex-col gap-3">
                    {[
                      { label: 'Fecha de inicio', value: project.createdAt },
                      { label: 'Entrega estimada', value: project.estimatedDelivery },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-xs text-[#6B7280]">{item.label}</span>
                        <span className="text-sm text-[#E8E9F0] font-medium">{item.value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t border-[#2A2D3E]">
                      <span className="text-xs text-[#6B7280]">Días restantes</span>
                      <span
                        className={cn(
                          'text-sm font-bold',
                          project.daysRemaining <= 30 ? 'text-amber-400' : 'text-emerald-400',
                        )}
                      >
                        {project.daysRemaining}d
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-[#6B7280]">Progreso global</span>
                        <span className="text-xs text-blue-400 font-semibold">{project.progress}%</span>
                      </div>
                      <div className="h-2 bg-[#2A2D3E] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB: DOCUMENTOS */}
          <TabsContent value="documentos" className="flex-1 min-h-0 overflow-auto">
            <div className="flex flex-col gap-3">
              {/* Progress bar */}
              <div className="bg-[#1A1D27] border border-[#2A2D3E] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[#E8E9F0]">
                    Documentos Vigentes
                  </span>
                  <span className="text-sm text-[#6B7280]">
                    <span className="text-emerald-400 font-semibold">{docsVigente}</span>
                    {' '}/ {docsTotal} documentos
                  </span>
                </div>
                <div className="h-2 bg-[#2A2D3E] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${docsPercent}%` }}
                  />
                </div>
              </div>

              {MOCK_FOLDERS.map((folder) => (
                <CollapsibleFolder key={folder.id} folder={folder} />
              ))}
            </div>
          </TabsContent>

          {/* TAB: TAREAS */}
          <TabsContent value="tareas" className="flex-1 min-h-0 overflow-auto">
            <div className="flex gap-4 pb-4">
              {TASK_COLUMNS.map((col) => {
                const tasks = MOCK_TASKS.filter((t) => t.column === col)
                return (
                  <div key={col} className="flex-1 min-w-[220px]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {TASK_COLUMN_ICONS[col]}
                        <span className="text-sm font-medium text-[#E8E9F0]">{col}</span>
                      </div>
                      <span className="text-xs text-[#6B7280] bg-[#1A1D27] border border-[#2A2D3E] px-2 py-0.5 rounded-full">
                        {tasks.length}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2">
                      {tasks.map((task) => (
                        <TaskCard key={task.id} task={task} />
                      ))}

                      <button className="w-full flex items-center gap-2 text-xs text-[#6B7280] hover:text-[#E8E9F0] border border-dashed border-[#2A2D3E] hover:border-[#6366F1]/40 rounded-lg px-3 py-2 transition-colors">
                        <Plus size={13} />
                        Nueva tarea
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
