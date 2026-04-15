'use client'

/**
 * ============================================================================
 * CABECERA DE FASE + GRUPO DE COLUMNAS DE ESTADO
 * ============================================================================
 *
 * Agrupa visualmente las columnas de estado que pertenecen a una misma fase
 * (Ejecucion, Validacion, Entrega, Cierre). La cabecera se pinta por encima
 * de sus N columnas de estado y las engloba con un border sutil y color
 * identificativo. Debajo se disponen horizontalmente las StateColumn hijas.
 *
 * Esto da la "sensacion Kanban v2" de fases + sub-estados sin complicar
 * el layout: sigue siendo un row horizontal al final, solo que las columnas
 * se agrupan visualmente por fase.
 * ============================================================================
 */

import type { ReactNode } from 'react'

import type { ProjectExecutionPhase } from '@/lib/workflow-states'
import { cn } from '@/lib/utils'

type PhaseStyle = {
  label: string
  accent: string
  bg: string
  border: string
  text: string
  dot: string
}

const PHASE_STYLES: Record<ProjectExecutionPhase, PhaseStyle> = {
  ejecucion: {
    label: 'Ejecucion',
    accent: 'cyan',
    bg: 'bg-cyan-50/60',
    border: 'border-cyan-200',
    text: 'text-cyan-800',
    dot: 'bg-cyan-500',
  },
  validacion: {
    label: 'Validacion',
    accent: 'amber',
    bg: 'bg-amber-50/60',
    border: 'border-amber-200',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
  },
  entrega: {
    label: 'Entrega',
    accent: 'emerald',
    bg: 'bg-emerald-50/60',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
  },
  cierre: {
    label: 'Cierre',
    accent: 'slate',
    bg: 'bg-slate-50/60',
    border: 'border-slate-200',
    text: 'text-slate-800',
    dot: 'bg-slate-500',
  },
}

export function getPhaseStyle(phase: ProjectExecutionPhase): PhaseStyle {
  return PHASE_STYLES[phase]
}

/**
 * Agrupa un set de StateColumn bajo una cabecera de fase.
 * El caller pasa las StateColumn como children en el orden canonico.
 */
export function PhaseColumnGroup({
  phase,
  projectCount,
  children,
}: {
  phase: ProjectExecutionPhase
  projectCount: number
  children: ReactNode
}) {
  const style = PHASE_STYLES[phase]

  return (
    <div
      className={cn(
        'flex flex-none flex-col rounded-[28px] border p-3',
        style.bg,
        style.border,
      )}
    >
      {/* Cabecera de la fase */}
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', style.dot)} />
          <h2
            className={cn(
              'text-[11px] font-semibold uppercase tracking-[0.18em]',
              style.text,
            )}
          >
            {style.label}
          </h2>
        </div>
        <span
          className={cn(
            'rounded-full border bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
            style.text,
            style.border,
          )}
        >
          {projectCount} proyectos
        </span>
      </div>

      {/* Columnas de estado en fila */}
      <div className="flex flex-1 gap-3">{children}</div>
    </div>
  )
}
