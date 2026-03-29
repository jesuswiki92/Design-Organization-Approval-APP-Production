'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  getAllowedProjectTransitions,
  getAllowedQuotationTransitions,
  getProjectStatusMeta,
  getQuotationStatusMeta,
  requiresWorkflowReason,
} from '@/lib/workflow-states'
import { cn } from '@/lib/utils'

type WorkflowStateChangerProps = {
  entity: 'project' | 'quotation'
  entityId: string
  currentState: string
  variant?: 'compact' | 'full'
  className?: string
}

export function WorkflowStateChanger({
  entity,
  entityId,
  currentState,
  variant = 'compact',
  className,
}: WorkflowStateChangerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedState, setSelectedState] = useState('')
  const [error, setError] = useState<string | null>(null)

  const nextStates = useMemo(
    () =>
      entity === 'project'
        ? getAllowedProjectTransitions(currentState)
        : getAllowedQuotationTransitions(currentState),
    [currentState, entity],
  )

  if (nextStates.length === 0) return null

  const isFull = variant === 'full'

  async function handleUpdate() {
    if (!selectedState) return

    let reason: string | null = null
    if (requiresWorkflowReason(entity, selectedState)) {
      const prompted = window.prompt('Motivo obligatorio para este cambio de estado:')
      if (prompted === null) return
      const trimmed = prompted.trim()
      if (!trimmed) {
        setError('Debes indicar un motivo para este estado.')
        return
      }
      reason = trimmed
    }

    setError(null)

    startTransition(async () => {
      const response = await fetch('/api/workflow/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity,
          id: entityId,
          nextState: selectedState,
          reason,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setError(payload?.error ?? 'No se pudo actualizar el estado.')
        return
      }

      setSelectedState('')
      router.refresh()
    })
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className={cn('flex gap-2', isFull ? 'flex-col sm:flex-row' : 'items-center')}>
        <select
          value={selectedState}
          onChange={(event) => setSelectedState(event.target.value)}
          className={cn(
            'rounded-xl border border-slate-200 bg-white text-slate-900 focus:border-sky-300 focus:outline-none',
            isFull ? 'min-w-[220px] px-3 py-2 text-sm' : 'max-w-[180px] px-2.5 py-1.5 text-xs',
          )}
          disabled={isPending}
        >
          <option value="">Cambiar estado...</option>
          {nextStates.map((state) => {
            const meta =
              entity === 'project' ? getProjectStatusMeta(state) : getQuotationStatusMeta(state)

            return (
              <option key={state} value={state}>
                {meta.label}
              </option>
            )
          })}
        </select>

        <button
          type="button"
          onClick={handleUpdate}
          disabled={!selectedState || isPending}
          className={cn(
            'rounded-xl font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40',
            isFull ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs',
            'bg-[linear-gradient(135deg,#2563EB,#38BDF8)] hover:opacity-90',
          )}
        >
          {isPending ? 'Guardando...' : 'Actualizar'}
        </button>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  )
}
