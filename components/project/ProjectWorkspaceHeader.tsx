'use client'

import { ClipboardPlus, Copy, History, Plane, Shield, Timer, User } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { WorkflowStateChanger } from '@/components/workflow/WorkflowStateChanger'
import { cn } from '@/lib/utils'
import type { ProyectoConRelaciones } from '@/types/database'

import {
  calcProjectProgress,
  daysRemaining,
  getAircraftLabel,
  getClientLabel,
  getProjectStatusMeta,
  userName,
} from './workspace-utils'

export function ProjectWorkspaceHeader({
  project,
  docsCount,
  tasksCount,
  onOpenExpert,
  onCreateTask,
  onRegisterHour,
  onCopyReference,
}: {
  project: ProyectoConRelaciones
  docsCount: number
  tasksCount: number
  onOpenExpert: () => void
  onCreateTask: () => void
  onRegisterHour: () => void
  onCopyReference: () => void
}) {
  const status = getProjectStatusMeta(project.estado)
  const projectProgress = calcProjectProgress(project)
  const deliveryDays = daysRemaining(project.fecha_prevista)
  const lastStateChange = project.estado_updated_at
    ? new Date(project.estado_updated_at).toLocaleString('es-ES')
    : null

  return (
    <section className="overflow-hidden rounded-[24px] border border-sky-200 bg-white shadow-[0_18px_45px_rgba(148,163,184,0.16)]">
      <div className="border-b border-sky-100 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_52%,#e0f2fe_100%)] px-6 py-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 font-mono text-[11px] tracking-[0.16em] text-slate-500 uppercase">
                {project.numero_proyecto}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
                  status.badge,
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', status.dot)} />
                {status.label}
              </span>
              {project.clasificacion_cambio && (
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-slate-700">
                  {project.clasificacion_cambio}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <h1 className="text-[28px] leading-[1.1] font-semibold text-slate-950">
                {project.titulo}
              </h1>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <Plane className="h-4 w-4 text-slate-400" />
                  {getAircraftLabel(project.modelo)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-400" />
                  {getClientLabel(project.cliente)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Shield className="h-4 w-4 text-slate-400" />
                  {project.base_certificacion ?? 'Cert Basis pendiente'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <WorkflowStateChanger
                  entity="project"
                  entityId={project.id}
                  currentState={project.estado}
                  variant="full"
                />
                {lastStateChange && (
                  <span className="text-xs text-slate-500">
                    Ultimo cambio: {lastStateChange}
                  </span>
                )}
                {project.estado_motivo && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">
                    Motivo: {project.estado_motivo}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 xl:max-w-[420px] xl:justify-end">
            <ActionButton
              icon={<ClipboardPlus className="h-4 w-4" />}
              label="Crear tarea"
              title="Convierte el siguiente paso sugerido en una acción trazable"
              onClick={onCreateTask}
            />
            <ActionButton
              icon={<Timer className="h-4 w-4" />}
              label="Registrar hora"
              title="Registra tiempo sin salir del expediente"
              onClick={onRegisterHour}
            />
            <ActionButton
              icon={<History className="h-4 w-4" />}
              label="Abrir experto"
              title="Lanza el experto contextual con el proyecto activo"
              onClick={onOpenExpert}
            />
            <ActionButton
              icon={<Copy className="h-4 w-4" />}
              label="Copiar referencia"
              title="Copia la referencia breve del expediente"
              onClick={onCopyReference}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Estado del expediente"
            value={status.label}
            hint="Nivel operativo actual del proyecto"
          />
          <MetricCard
            label="Progreso documental"
            value={`${docsCount} docs`}
            hint="La tabla documental concentra la lectura principal"
          />
          <MetricCard
            label="Tareas abiertas"
            value={String(tasksCount)}
            hint="Control operativo visible sin dominar la pantalla"
          />
          <MetricCard
            label="Próximo hito"
            value={project.fecha_prevista ?? 'Sin fecha'}
            hint={
              deliveryDays === null
                ? 'Planificación aún abierta'
                : deliveryDays <= 0
                  ? 'Hito vencido o en revisión de plazo'
                  : `${deliveryDays} días restantes`
            }
            tone={
              deliveryDays !== null && deliveryDays <= 7
                ? 'high'
                : deliveryDays !== null && deliveryDays <= 21
                  ? 'medium'
                  : 'low'
            }
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400">
            <span>Control operativo</span>
            <span>{projectProgress}% estimado</span>
          </div>
          <div className="space-y-3">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#2563EB,#38BDF8)] transition-all"
                style={{ width: `${Math.max(projectProgress, 8)}%` }}
              />
            </div>
            <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
              <InfoPill label="Owner" value={userName(project.owner)} />
              <InfoPill
                label="Aeronaves"
                value={String(project.num_aeronaves_afectadas ?? 0)}
              />
              <InfoPill
                label="Alertas"
                value={
                  deliveryDays !== null && deliveryDays <= 7
                    ? 'Plazo crítico'
                    : status.emphasis === 'high'
                      ? 'Atención'
                      : 'Controlado'
                }
                danger={deliveryDays !== null && deliveryDays <= 7}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ActionButton({
  icon,
  label,
  title,
  onClick,
}: {
  icon: ReactNode
  label: string
  title: string
  onClick: () => void
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="border-[#334155] bg-slate-50 text-slate-700 hover:border-[#3B82F6]/40 hover:bg-slate-200 hover:text-white"
      onClick={onClick}
      title={title}
    >
      {icon}
      {label}
    </Button>
  )
}

function MetricCard({
  label,
  value,
  hint,
  tone = 'low',
}: {
  label: string
  value: string
  hint: string
  tone?: 'low' | 'medium' | 'high'
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        tone === 'high'
          ? 'border-orange-500/25 bg-orange-500/6'
          : tone === 'medium'
            ? 'border-amber-500/20 bg-amber-500/5'
            : 'border-slate-200 bg-slate-50',
      )}
    >
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-3 text-lg font-semibold text-slate-950">{value}</div>
      <div className="mt-2 text-sm leading-6 text-slate-500">{hint}</div>
    </div>
  )
}

function InfoPill({
  label,
  value,
  danger = false,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className={cn('mt-1 text-sm', danger ? 'text-orange-600' : 'text-slate-950')}>{value}</div>
    </div>
  )
}
