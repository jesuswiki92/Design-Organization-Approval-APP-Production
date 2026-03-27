import { TopBar } from '@/components/layout/TopBar'
import {
  FolderKanban,
  AlertTriangle,
  Clock,
  Mail,
  ShieldAlert,
  ArrowUpRight,
  Circle,
  Timer,
  Sparkles,
} from 'lucide-react'

const kpis = [
  { label: 'Proyectos activos', value: '7', icon: FolderKanban, color: '#2563EB', change: '+2 este mes' },
  { label: 'Tareas urgentes', value: '3', icon: AlertTriangle, color: '#E11D48', change: '2 vencidas ayer' },
  { label: 'Horas esta semana', value: '24h', icon: Clock, color: '#059669', change: '↑ 6h vs semana anterior' },
  { label: 'Correos pendientes', value: '8', icon: Mail, color: '#D97706', change: '3 de clientes' },
  { label: 'Alertas compliance', value: '2', icon: ShieldAlert, color: '#DC2626', change: 'Documentos críticos' },
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
  active: { label: 'En curso', color: '#2563EB', bg: '#DBEAFE' },
  review: { label: 'En revisión', color: '#D97706', bg: '#FEF3C7' },
  approved: { label: 'Aprobado', color: '#059669', bg: '#D1FAE5' },
  paused: { label: 'En pausa', color: '#64748B', bg: '#E2E8F0' },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  critical: { label: 'Crítica', color: '#E11D48' },
  high: { label: 'Alta', color: '#D97706' },
  medium: { label: 'Media', color: '#2563EB' },
  low: { label: 'Baja', color: '#64748B' },
}

export default function HomePage() {
  const now = new Date()
  const today = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const updatedAt = now.toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Inicio" subtitle={today.charAt(0).toUpperCase() + today.slice(1)} />

      <main className="flex-1 space-y-6 overflow-y-auto p-6 text-slate-900">
        <section className="rounded-[24px] border border-sky-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_55%,#e0f2fe_100%)] px-6 py-5 shadow-[0_18px_45px_rgba(148,163,184,0.16)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                <Sparkles className="h-3.5 w-3.5" />
                Visual refresh activa
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">Buenos días, Ingeniero</h2>
              <p className="mt-1 text-sm text-slate-600">
                Tienes <span className="font-medium text-rose-600">3 tareas urgentes</span> y{' '}
                <span className="font-medium text-amber-600">2 expedientes</span> con alertas de compliance.
              </p>
            </div>

            <div className="rounded-2xl border border-sky-200 bg-white/85 px-4 py-3 text-right shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Updated</div>
              <div className="mt-1 font-mono text-sm text-slate-900">{updatedAt}</div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
          {kpis.map((kpi) => {
            const Icon = kpi.icon
            return (
              <div key={kpi.label} className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(148,163,184,0.12)] transition-colors hover:border-sky-300 hover:bg-sky-50/40">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] leading-tight text-slate-500">{kpi.label}</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200" style={{ backgroundColor: `${kpi.color}14` }}>
                    <Icon className="h-4 w-4" style={{ color: kpi.color }} />
                  </div>
                </div>
                <p className="text-2xl font-semibold text-slate-950">{kpi.value}</p>
                <p className="mt-1 text-xs text-slate-500">{kpi.change}</p>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)] xl:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Mis proyectos activos</h3>
              <button className="flex items-center gap-1 text-xs text-sky-700 transition-colors hover:text-sky-900">
                Ver todos <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {projects.map((p) => {
                const s = statusConfig[p.status]
                return (
                  <div key={p.code} className="group cursor-pointer px-5 py-4 transition-colors hover:bg-sky-50/60">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-500">{p.code}</span>
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: s.color, backgroundColor: s.bg }}>
                            {s.label}
                          </span>
                        </div>
                        <p className="truncate text-sm font-medium text-slate-950">{p.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{p.aircraft} · {p.client}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-slate-500">{new Date(p.delivery).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
                        {p.tasks > 0 && <p className="mt-0.5 text-xs text-amber-600">{p.tasks} tarea{p.tasks > 1 ? 's' : ''}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-[linear-gradient(90deg,#2563EB,#38BDF8)]" style={{ width: `${p.pct}%` }} />
                      </div>
                      <span className="text-[10px] tabular-nums text-slate-500">{p.pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Mis tareas</h3>
              <span className="text-xs text-slate-500">Hoy / semana</span>
            </div>
            <div className="divide-y divide-slate-200">
              {tasks.map((t, i) => {
                const pr = priorityConfig[t.priority]
                return (
                  <div key={i} className="cursor-pointer px-4 py-3 transition-colors hover:bg-sky-50/60">
                    <div className="flex items-start gap-2.5">
                      {t.status === 'in_progress' ? <Timer className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-tight text-slate-900">{t.title}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-500">{t.project}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] font-medium" style={{ color: pr.color }}>{pr.label}</span>
                          <span className="text-[10px] text-slate-500">· {t.due}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-[22px] border border-dashed border-sky-200 bg-white/70 px-5 py-4 shadow-[0_10px_24px_rgba(148,163,184,0.10)]">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-sm text-slate-700">Bandeja de correos de proyectos</p>
              <p className="text-xs text-slate-500">Integración Outlook — Fase 2</p>
            </div>
          </div>
          <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-700">Updated {updatedAt}</span>
        </div>
      </main>
    </div>
  )
}
