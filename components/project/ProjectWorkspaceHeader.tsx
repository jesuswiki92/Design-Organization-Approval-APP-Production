'use client'

import { ClipboardPlus, Copy, History, Plane, Shield, Timer, User } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
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

  return (
    <section className="overflow-hidden rounded-[20px] border border-[#243041] bg-[#111827] shadow-[0_24px_60px_rgba(2,6,23,0.32)]">
      <div className="border-b border-[#243041] bg-[linear-gradient(135deg,rgba(59,130,246,0.08),rgba(20,184,166,0.02)_52%,rgba(11,18,32,0.8))] px-6 py-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[#334155] bg-[#0B1220] px-3 py-1 font-mono text-[11px] tracking-[0.16em] text-[#94A3B8] uppercase">
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
                <span className="rounded-full border border-[#334155] bg-[#172033] px-3 py-1 text-xs text-[#CBD5E1]">
                  {project.clasificacion_cambio}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <h1 className="text-[28px] leading-[1.1] font-semibold text-[#E5E7EB]">
                {project.titulo}
              </h1>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#94A3B8]">
                <span className="inline-flex items-center gap-2">
                  <Plane className="h-4 w-4 text-[#64748B]" />
                  {getAircraftLabel(project.modelo)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <User className="h-4 w-4 text-[#64748B]" />
                  {getClientLabel(project.cliente)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[#64748B]" />
                  {project.base_certificacion ?? 'Cert Basis pendiente'}
                </span>
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

        <div className="rounded-2xl border border-[#243041] bg-[#0B1220]/70 p-4">
          <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-[#64748B]">
            <span>Control operativo</span>
            <span>{projectProgress}% estimado</span>
          </div>
          <div className="space-y-3">
            <div className="h-2 overflow-hidden rounded-full bg-[#172033]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#3B82F6,#14B8A6)] transition-all"
                style={{ width: `${Math.max(projectProgress, 8)}%` }}
              />
            </div>
            <div className="grid gap-2 text-sm text-[#CBD5E1] sm:grid-cols-3">
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
      className="border-[#334155] bg-[#0B1220]/70 text-[#CBD5E1] hover:border-[#3B82F6]/40 hover:bg-[#172033] hover:text-white"
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
            : 'border-[#243041] bg-[#0B1220]/55',
      )}
    >
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#64748B]">{label}</div>
      <div className="mt-3 text-lg font-semibold text-[#E5E7EB]">{value}</div>
      <div className="mt-2 text-sm leading-6 text-[#94A3B8]">{hint}</div>
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
    <div className="rounded-xl border border-[#243041] bg-[#111827] px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[#64748B]">{label}</div>
      <div className={cn('mt-1 text-sm', danger ? 'text-orange-300' : 'text-[#E5E7EB]')}>{value}</div>
    </div>
  )
}
