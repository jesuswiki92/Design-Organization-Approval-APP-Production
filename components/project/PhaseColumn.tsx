'use client'

/**
 * ============================================================================
 * CABECERA DE FASE + GRUPO DE COLUMNAS DE ESTADO
 * ============================================================================
 *
 * Agrupa visualmente las columnas de status que pertenecen a una misma fase
 * (Ejecucion, Validation, Delivery, Cierre). La cabecera se pinta por encima
 * de sus N columnas de status y las engloba con un border sutil y color
 * identificativo. Debajo se disponen horizontalmente las StateColumn hijas.
 *
 * Esto da la "sensacion Kanban v2" de fases + sub-statuses sin complicar
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
  dot: string
}

/**
 * Phase color is expressed ONLY via the small accent dot now — the group
 * container uses Warm Executive neutrals. This keeps Projects visually unified
 * with Quotations (where color only lives in the state dot).
 */
const PHASE_STYLES: Record<ProjectExecutionPhase, PhaseStyle> = {
  execution: {
    label: 'Ejecucion',
    accent: 'cyan',
    dot: 'bg-cyan-500',
  },
  validation: {
    label: 'Validation',
    accent: 'amber',
    dot: 'bg-amber-500',
  },
  delivery: {
    label: 'Delivery',
    accent: 'emerald',
    dot: 'bg-emerald-500',
  },
  closure: {
    label: 'Cierre',
    accent: 'slate',
    dot: 'bg-[color:var(--ink-3)]',
  },
}

export function getPhaseStyle(phase: ProjectExecutionPhase): PhaseStyle {
  return PHASE_STYLES[phase]
}

/**
 * Agrupa un set de StateColumn bajo una cabecera de fase.
 * El caller pasa las StateColumn como children en el sort_order canonico.
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
    <div className="flex flex-none flex-col rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)]/40 p-3">
      {/* Cabecera de la fase */}
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', style.dot)} />
          <h2 className="doa-label-mono text-[color:var(--ink-2)]">
            {style.label}
          </h2>
        </div>
        <span className="doa-kanban-chip">
          {projectCount} projects
        </span>
      </div>

      {/* Columnas de status en fila */}
      <div className="flex flex-1 gap-3">{children}</div>
    </div>
  )
}
