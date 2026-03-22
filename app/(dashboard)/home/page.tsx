import { TopBar } from '@/components/layout/TopBar'
import {
  FolderKanban, AlertTriangle, Clock, Mail, ShieldAlert,
  ArrowUpRight, MoreHorizontal, CheckCircle2, Circle, Timer
} from 'lucide-react'

// Mock data — will be replaced with Supabase queries
const kpis = [
  { label: 'Proyectos activos', value: '7', icon: FolderKanban, color: '#3B82F6', change: '+2 este mes' },
  { label: 'Tareas urgentes', value: '3', icon: AlertTriangle, color: '#EF4444', change: '2 vencidas ayer' },
  { label: 'Horas esta semana', value: '24h', icon: Clock, color: '#10B981', change: '↑ 6h vs semana anterior' },
  { label: 'Correos pendientes', value: '8', icon: Mail, color: '#F59E0B', change: '3 de clientes' },
  { label: 'Alertas compliance', value: '2', icon: ShieldAlert, color: '#EF4444', change: 'Documentos críticos' },
]

const projects = [
  { code: 'DOA-2024-047', name: 'Antena SATCOM Cessna 208B', status: 'active', aircraft: 'C208B', client: 'AeroSur', pct: 65, tasks: 4, delivery: '2026-04-15' },
  { code: 'DOA-2024-051', name: 'Mod. Aviónica King Air 350', status: 'review', aircraft: 'BE350', client: 'NovAir', pct: 88, tasks: 1, delivery: '2026-03-30' },
  { code: 'DOA-2024-039', name: 'Instalación ELT 406 MHz', status: 'approved', aircraft: 'C172', client: 'Sky Club', pct: 100, tasks: 0, delivery: '2026-03-10' },
  { code: 'DOA-2025-003', name: 'Modificación estructura ala', status: 'active', aircraft: 'PA28', client: 'FlyNow', pct: 22, tasks: 7, delivery: '2026-06-30' },
]

const tasks = [
  { title: 'Revisar Structural Analysis Ed02', project: 'DOA-2024-047', priority: 'critical', due: 'Hoy', status: 'todo' },
  { title: 'Emitir Certification Plan Ed01', project: 'DOA-2025-003', priority: 'high', due: 'Mañana', status: 'in_progress' },
  { title: 'Responder comentarios EASA', project: 'DOA-2024-051', priority: 'high', due: 'Hoy', status: 'todo' },
  { title: 'Actualizar Master Document List', project: 'DOA-2024-047', priority: 'medium', due: 'Viernes', status: 'todo' },
]

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: 'En curso',    color: '#3B82F6', bg: '#3B82F6/10' },
  review:   { label: 'En revisión', color: '#F59E0B', bg: '#F59E0B/10' },
  approved: { label: 'Aprobado',    color: '#10B981', bg: '#10B981/10' },
  paused:   { label: 'En pausa',    color: '#6B7280', bg: '#6B7280/10' },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  critical: { label: 'Crítica', color: '#EF4444' },
  high:     { label: 'Alta',    color: '#F59E0B' },
  medium:   { label: 'Media',   color: '#3B82F6' },
  low:      { label: 'Baja',    color: '#6B7280' },
}

export default function HomePage() {
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Inicio" subtitle={today.charAt(0).toUpperCase() + today.slice(1)} />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Welcome */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#E8E9F0]">Buenos días, Ingeniero</h2>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Tienes <span className="text-[#EF4444] font-medium">3 tareas urgentes</span> y{' '}
              <span className="text-[#F59E0B] font-medium">2 expedientes</span> con alertas de compliance.
            </p>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-5 gap-3">
          {kpis.map((kpi) => {
            const Icon = kpi.icon
            return (
              <div key={kpi.label} className="bg-[#1A1D27] border border-[#2A2D3E] rounded-xl p-4 hover:border-[#6366F1]/30 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-[#6B7280] font-medium uppercase tracking-wider leading-tight">{kpi.label}</span>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: kpi.color + '20' }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: kpi.color }} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-[#E8E9F0]">{kpi.value}</p>
                <p className="text-xs text-[#6B7280] mt-1">{kpi.change}</p>
              </div>
            )
          })}
        </div>

        {/* Projects + Tasks */}
        <div className="grid grid-cols-3 gap-5">

          {/* My Projects (2/3) */}
          <div className="col-span-2 bg-[#1A1D27] border border-[#2A2D3E] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2D3E]">
              <h3 className="text-sm font-semibold text-[#E8E9F0]">Mis proyectos activos</h3>
              <button className="text-xs text-[#6366F1] hover:text-[#4F46E5] flex items-center gap-1 transition-colors">
                Ver todos <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-[#2A2D3E]">
              {projects.map((p) => {
                const s = statusConfig[p.status]
                return (
                  <div key={p.code} className="px-5 py-3.5 hover:bg-[#0F1117]/50 transition-colors cursor-pointer group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-[#6B7280]">{p.code}</span>
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ color: s.color, backgroundColor: s.color + '20' }}
                          >
                            {s.label}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-[#E8E9F0] truncate">{p.name}</p>
                        <p className="text-xs text-[#6B7280] mt-0.5">{p.aircraft} · {p.client}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-[#6B7280]">{new Date(p.delivery).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
                        {p.tasks > 0 && (
                          <p className="text-xs text-[#F59E0B] mt-0.5">{p.tasks} tarea{p.tasks > 1 ? 's' : ''}</p>
                        )}
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-[#2A2D3E] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${p.pct}%`, backgroundColor: p.pct === 100 ? '#10B981' : '#6366F1' }}
                        />
                      </div>
                      <span className="text-[10px] text-[#6B7280] tabular-nums">{p.pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* My Tasks (1/3) */}
          <div className="bg-[#1A1D27] border border-[#2A2D3E] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2D3E]">
              <h3 className="text-sm font-semibold text-[#E8E9F0]">Mis tareas</h3>
              <span className="text-xs text-[#6B7280]">Hoy / semana</span>
            </div>
            <div className="divide-y divide-[#2A2D3E]">
              {tasks.map((t, i) => {
                const pr = priorityConfig[t.priority]
                return (
                  <div key={i} className="px-4 py-3 hover:bg-[#0F1117]/50 transition-colors cursor-pointer">
                    <div className="flex items-start gap-2.5">
                      {t.status === 'in_progress'
                        ? <Timer className="w-4 h-4 text-[#6366F1] shrink-0 mt-0.5" />
                        : <Circle className="w-4 h-4 text-[#2A2D3E] shrink-0 mt-0.5" />
                      }
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-[#E8E9F0] leading-tight">{t.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-mono text-[#6B7280]">{t.project}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-medium" style={{ color: pr.color }}>
                            {pr.label}
                          </span>
                          <span className="text-[10px] text-[#6B7280]">· {t.due}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>

        {/* Email stub */}
        <div className="bg-[#1A1D27] border border-[#2A2D3E] border-dashed rounded-xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-[#6B7280]" />
            <div>
              <p className="text-sm text-[#6B7280]">Bandeja de correos de proyectos</p>
              <p className="text-xs text-[#6B7280]/60">Integración Outlook — Fase 2</p>
            </div>
          </div>
          <span className="text-xs text-[#6B7280] bg-[#2A2D3E] px-2 py-1 rounded-md">Coming soon</span>
        </div>

      </main>
    </div>
  )
}
