'use client'

/**
 * Stepper horizontal de la maquina de ejecucion de proyecto (v2, Sprint 1+).
 * Muestra las 4 fases agrupadas (ejecucion / validacion / entrega / cierre)
 * y dentro de cada una, los 13 estados ordenados. El estado actual se
 * destaca, los anteriores se marcan como completados.
 */

import { CheckCircle2, Circle, PlayCircle } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  PROJECT_EXECUTION_PHASES,
  PROJECT_EXECUTION_STATE_CONFIG,
  PROJECT_EXECUTION_STATE_LIST,
  PROJECT_EXECUTION_STATE_TO_PHASE,
  type ProjectExecutionPhase,
  type ProjectExecutionState,
} from '@/lib/workflow-states'

type Props = {
  currentState: ProjectExecutionState
  className?: string
}

const PHASE_LABELS: Record<ProjectExecutionPhase, string> = {
  ejecucion: 'Ejecucion',
  validacion: 'Validacion',
  entrega: 'Entrega',
  cierre: 'Cierre',
}

const PHASE_ORDER: ProjectExecutionPhase[] = [
  PROJECT_EXECUTION_PHASES.EJECUCION,
  PROJECT_EXECUTION_PHASES.VALIDACION,
  PROJECT_EXECUTION_PHASES.ENTREGA,
  PROJECT_EXECUTION_PHASES.CIERRE,
]

export function ProjectStateStepper({ currentState, className }: Props) {
  const currentIndex = PROJECT_EXECUTION_STATE_LIST.indexOf(currentState)

  return (
    <div
      className={cn(
        'w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm',
        className,
      )}
    >
      <div className="flex min-w-fit items-start gap-6">
        {PHASE_ORDER.map((phase) => {
          const phaseStates = PROJECT_EXECUTION_STATE_LIST.filter(
            (s) => PROJECT_EXECUTION_STATE_TO_PHASE[s] === phase,
          )
          return (
            <div key={phase} className="flex flex-col gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {PHASE_LABELS[phase]}
              </span>
              <div className="flex items-center gap-2">
                {phaseStates.map((state, idx) => {
                  const stateIndex = PROJECT_EXECUTION_STATE_LIST.indexOf(state)
                  const isCurrent = state === currentState
                  const isDone = stateIndex < currentIndex
                  const cfg = PROJECT_EXECUTION_STATE_CONFIG[state]

                  const Icon = isCurrent ? PlayCircle : isDone ? CheckCircle2 : Circle

                  return (
                    <div key={state} className="flex items-center gap-2">
                      <div
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                          isCurrent
                            ? cn(cfg.bg, cfg.border, cfg.color, 'shadow-sm')
                            : isDone
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-white text-slate-400',
                        )}
                        title={cfg.description}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="whitespace-nowrap">{cfg.shortLabel}</span>
                      </div>
                      {idx < phaseStates.length - 1 && (
                        <span
                          className={cn(
                            'h-px w-3',
                            isDone ? 'bg-emerald-300' : 'bg-slate-200',
                          )}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
