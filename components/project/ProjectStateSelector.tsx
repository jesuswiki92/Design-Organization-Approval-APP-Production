'use client'

/**
 * ============================================================================
 * SELECTOR DE ESTADO DEL PIPELINE DE PROYECTOS (MAQUINA V2)
 * ============================================================================
 *
 * Espejo visual/funcional de `QuotationStateSelector` adaptado a la maquina
 * de 13 statuses de la execution de projects. Se renderiza dentro de cada
 * `ProjectCard` del Tablero.
 *
 * Comportamiento:
 *   - Muestra solo statuses permitidos desde el actual via
 *     `PROJECT_EXECUTION_TRANSITIONS` (DAG) + el propio actual (disabled).
 *   - Al cambiar, hace POST a `/api/projects/[id]/transition`.
 *       - 200 → update optimistico confirmado, refresca la path.
 *       - 409 con `requires_input` → redirige a `redirect_url` (tab del
 *         detalle del project) para completar el form.
 *       - error → revierte y muestra mensaje.
 *   - `stopPropagation` en clicks y cambios para que el Link padre de la
 *     card NO se dispare.
 * ============================================================================
 */

import { useEffect, useState, type MouseEvent } from 'react'
import { toast } from 'sonner'

import {
  PROJECT_EXECUTION_STATE_CONFIG,
  PROJECT_EXECUTION_TRANSITIONS,
  isProjectExecutionStateCode,
  type ProjectExecutionState,
} from '@/lib/workflow-states'

type ProjectStateSelectorProps = {
  proyectoId: string
  currentState: string | null
}

export function ProjectStateSelector({
  proyectoId,
  currentState,
}: ProjectStateSelectorProps) {
  const initial = currentState && isProjectExecutionStateCode(currentState)
    ? (currentState as ProjectExecutionState)
    : null
  const [selectedState, setSelectedState] = useState<ProjectExecutionState | null>(initial)
  const [status] = useState<'idle' | 'saving' | 'error'>('idle')
  const [message] = useState<string | null>(null)

  useEffect(() => {
    const next = currentState && isProjectExecutionStateCode(currentState)
      ? (currentState as ProjectExecutionState)
      : null
    setSelectedState(next)
  }, [currentState])

  // Si no tenemos execution_status valido, no renderizamos selector (el padre
  // muestra el badge legacy si acaso). Esto evita seleccionar sobre null.
  if (!selectedState) return null

  const allowedTargets = PROJECT_EXECUTION_TRANSITIONS[selectedState] ?? []

  // Opciones: el actual (disabled) + targets permitidos.
  const options: Array<{ value: ProjectExecutionState; label: string; disabled?: boolean }> = [
    {
      value: selectedState,
      label: PROJECT_EXECUTION_STATE_CONFIG[selectedState].label,
      disabled: true,
    },
    ...allowedTargets.map((target) => ({
      value: target,
      label: PROJECT_EXECUTION_STATE_CONFIG[target].label,
    })),
  ]

  function stopProp(event: MouseEvent) {
    event.stopPropagation()
  }

  function handleChange(nextStateRaw: string) {
    if (!nextStateRaw) return
    if (!isProjectExecutionStateCode(nextStateRaw)) return
    const nextState = nextStateRaw as ProjectExecutionState
    if (nextState === selectedState) return
    setSelectedState(nextState)
    toast.info('Acción desconectada')
  }

  return (
    <div className="space-y-0.5" onClick={stopProp}>
      <label className="sr-only" htmlFor={`project-state-${proyectoId}`}>
        Cambiar status del project
      </label>
      <select
        id={`project-state-${proyectoId}`}
        value={selectedState}
        disabled={status === 'saving'}
        onClick={stopProp}
        onChange={(event) => {
          event.stopPropagation()
          handleChange(event.target.value)
        }}
        className="h-7 w-full truncate rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 outline-none transition-colors hover:border-sky-300 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 disabled:cursor-wait disabled:opacity-70"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {status === 'saving' ? (
        <p className="text-[10px] text-slate-400">Guardando...</p>
      ) : null}
      {message ? (
        <p className="text-[10px] text-rose-500 line-clamp-1">{message}</p>
      ) : null}
    </div>
  )
}
