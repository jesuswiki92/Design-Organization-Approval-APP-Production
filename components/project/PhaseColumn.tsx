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
  dot: string
}

/**
 * Phase color is expressed ONLY via the small accent dot now — the group
 * container uses Warm Executive neutrals. This keeps Projects visually unified
 * with Quotations (where color only lives in the state dot).
 */
const PHASE_STYLES: Record<ProjectExecutionPhase, PhaseStyle> = {
  ejecucion: {
    label: 'Ejecucion',
    accent: 'cyan',
    dot: 'bg-cyan-500',
  },
  validacion: {
    label: 'Validacion',
    accent: 'amber',
    dot: 'bg-amber-500',
  },
  entrega: {
    label: 'Entrega',
    accent: 'emerald',
    dot: 'bg-emerald-500',
  },
  cierre: {
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
          {projectCount} proyectos
        </span>
      </div>

      {/* Columnas de estado en fila */}
      <div className="flex flex-1 gap-3">{children}</div>
    </div>
  )
}
