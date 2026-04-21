'use client'

/**
 * ============================================================================
 * SELECTOR DE ESTADO DEL PIPELINE DE PROYECTOS (MAQUINA V2)
 * ============================================================================
 *
 * Espejo visual/funcional de `QuotationStateSelector` adaptado a la maquina
 * de 13 estados de la ejecucion de proyectos. Se renderiza dentro de cada
 * `ProjectCard` del Tablero.
 *
 * Comportamiento:
 *   - Muestra solo estados permitidos desde el actual via
 *     `PROJECT_EXECUTION_TRANSITIONS` (DAG) + el propio actual (disabled).
 *   - Al cambiar, hace POST a `/api/proyectos/[id]/transicion`.
 *       - 200 → update optimistico confirmado, refresca la ruta.
 *       - 409 con `requires_input` → redirige a `redirect_url` (tab del
 *         detalle del proyecto) para completar el formulario.
 *       - error → revierte y muestra mensaje.
 *   - `stopPropagation` en clicks y cambios para que el Link padre de la
 *     card NO se dispare.
 * ============================================================================
 */

import { useEffect, useState, useTransition, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()
  const initial = currentState && isProjectExecutionStateCode(currentState)
    ? (currentState as ProjectExecutionState)
    : null
  const [selectedState, setSelectedState] = useState<ProjectExecutionState | null>(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    const next = currentState && isProjectExecutionStateCode(currentState)
      ? (currentState as ProjectExecutionState)
      : null
    setSelectedState(next)
    setStatus('idle')
    setMessage(null)
  }, [currentState])

  // Si no tenemos estado_v2 valido, no renderizamos selector (el padre
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

  async function handleChange(nextStateRaw: string) {
    if (!nextStateRaw) return
    if (!isProjectExecutionStateCode(nextStateRaw)) return
    const nextState = nextStateRaw as ProjectExecutionState
    if (nextState === selectedState) return

    const previousState = selectedState
    setSelectedState(nextState)
    setStatus('saving')
    setMessage(null)

    try {
      const response = await fetch(`/api/proyectos/${proyectoId}/transicion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_state: nextState }),
      })

      if (response.status === 409) {
        // Puede ser requires_input → redirect al tab del detalle.
        const data = (await response.json().catch(() => ({}))) as {
          requires_input?: boolean
          redirect_url?: string
          error?: string
        }
        if (data?.requires_input && typeof data.redirect_url === 'string') {
          // Revertimos el optimistic porque la transicion NO ocurrio aun
          // — se completa en el formulario del detalle.
          setSelectedState(previousState)
          setStatus('idle')
          router.push(data.redirect_url)
          return
        }
        throw new Error(data?.error ?? 'Conflicto en la transicion.')
      }

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(data?.error ?? `HTTP ${response.status}`)
      }

      setStatus('idle')
      startTransition(() => router.refresh())
    } catch (error) {
      setSelectedState(previousState)
      setStatus('error')
      setMessage(
        error instanceof Error ? error.message : 'Error al cambiar el estado.',
      )
    }
  }

  return (
    <div className="space-y-0.5" onClick={stopProp}>
      <label className="sr-only" htmlFor={`project-state-${proyectoId}`}>
        Cambiar estado del proyecto
      </label>
      <select
        id={`project-state-${proyectoId}`}
        value={selectedState}
        disabled={status === 'saving'}
        onClick={stopProp}
        onChange={(event) => {
          event.stopPropagation()
          void handleChange(event.target.value)
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
