'use client'

/**
 * Tab "Deliverables" del detalle de project (Sprint 1, read-only).
 *
 * Lista los deliverables del project llamando a GET /api/projects/[id]/deliverables.
 * Si el project esta en `project_opened` y no tiene deliverables, ofrece un
 * boton "Planificar project" que llama a POST /api/projects/[id]/plan.
 *
 * Futuro (Sprint 2+): crear/editar/borrar deliverables desde la UI.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Loader2, Send, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  DELIVERABLE_VALIDATION_READY_STATES,
  PROJECT_EXECUTION_STATES,
  isProjectExecutionStateCode,
} from '@/lib/workflow-states'
import type { DeliverableStatus, ProjectDeliverable } from '@/types/database'

type Props = {
  proyectoId: string
  currentState: string | null
  onStateChange?: (nextState: string) => void
}

const ESTADO_STYLE: Record<DeliverableStatus, string> = {
  pending: 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)] border-[color:var(--ink-4)]',
  in_progress: 'bg-[color:var(--paper-2)] text-[color:var(--ink-2)] border-[color:var(--ink-4)]',
  in_review: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blocked: 'bg-rose-50 text-rose-700 border-rose-200',
  not_applicable: 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)] border-[color:var(--ink-4)]',
}

const ESTADO_LABEL: Record<DeliverableStatus, string> = {
  pending: 'Pending',
  in_progress: 'En curso',
  in_review: 'En review',
  completed: 'Completado',
  blocked: 'Bloqueado',
  not_applicable: 'No aplica',
}

export function DeliverablesTab({ proyectoId, currentState, onStateChange }: Props) {
  const [deliverables, setDeliverables] = useState<ProjectDeliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [planning, setPlanning] = useState(false)
  const [sendingToValidation, setSendingToValidation] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${proyectoId}/deliverables`, {
        method: 'GET',
      })
      const json = (await res.json().catch(() => ({}))) as {
        deliverables?: ProjectDeliverable[]
        error?: string
      }
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }
      setDeliverables(json.deliverables ?? [])
    } catch (e) {
      console.error('DeliverablesTab load error:', e)
      setError(e instanceof Error ? e.message : 'Error cargando deliverables.')
    } finally {
      setLoading(false)
    }
  }, [proyectoId])

  useEffect(() => {
    load()
  }, [load])

  const handlePlanificar = useCallback(async () => {
    setPlanning(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${proyectoId}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = (await res.json().catch(() => ({}))) as {
        deliverables?: ProjectDeliverable[]
        error?: string
      }
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }
      // Refetch para garantizar consistencia.
      await load()
    } catch (e) {
      console.error('DeliverablesTab planificar error:', e)
      setError(e instanceof Error ? e.message : 'Error planificando project.')
    } finally {
      setPlanning(false)
    }
  }, [proyectoId, load])

  const canPlan =
    currentState !== null &&
    isProjectExecutionStateCode(currentState) &&
    currentState === PROJECT_EXECUTION_STATES.PROJECT_OPENED

  // D6 (Sprint 2): ofrecer "Ready for validation" cuando el project esta en
  // execution o review internal y todos los deliverables estan listos. El
  // endpoint `send-a-validation` admite la transicion desde esos statuses
  // directamente y ya comprueba integridad por si cambia mientras lee.
  const readyForValidation = useMemo(() => {
    if (deliverables.length === 0) return false
    return deliverables.every((d) =>
      DELIVERABLE_VALIDATION_READY_STATES.includes(d.status),
    )
  }, [deliverables])

  const canSendToValidation =
    currentState !== null &&
    isProjectExecutionStateCode(currentState) &&
    (currentState === PROJECT_EXECUTION_STATES.IN_EXECUTION ||
      currentState === PROJECT_EXECUTION_STATES.INTERNAL_REVIEW ||
      currentState === PROJECT_EXECUTION_STATES.READY_FOR_VALIDATION) &&
    readyForValidation

  const handleSendToValidation = useCallback(async () => {
    setSendingToValidation(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${proyectoId}/send-to-validation`, {
        method: 'POST',
      })
      const json = (await res.json().catch(() => ({}))) as {
        project?: { execution_status?: string }
        error?: string
        blockers?: Array<{ title: string }>
      }
      if (!res.ok) {
        const extra = json.blockers?.length
          ? ` Bloqueantes: ${json.blockers.map((b) => b.title).join(', ')}`
          : ''
        throw new Error((json.error || `HTTP ${res.status}`) + extra)
      }
      if (json.project?.execution_status && onStateChange) {
        onStateChange(json.project.execution_status)
      }
      await load()
    } catch (e) {
      console.error('DeliverablesTab send-a-validation error:', e)
      setError(e instanceof Error ? e.message : 'Error sending a validation.')
    } finally {
      setSendingToValidation(false)
    }
  }, [proyectoId, load, onStateChange])

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[color:var(--ink-3)]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
            Deliverables
          </h2>
          <span className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--ink-3)]">
            {deliverables.length}
          </span>
        </div>
        {canPlan && deliverables.length === 0 && (
          <button
            type="button"
            onClick={handlePlanificar}
            disabled={planning}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {planning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {planning ? 'Planificando...' : 'Planificar project'}
          </button>
        )}
        {canSendToValidation && (
          <button
            type="button"
            onClick={handleSendToValidation}
            disabled={sendingToValidation}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            title="Todos los deliverables estan listos. Envialo a DOH/DOS."
          >
            {sendingToValidation ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sendingToValidation ? 'Enviando...' : 'Send a validation'}
          </button>
        )}
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[color:var(--ink-3)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando deliverables...
        </div>
      ) : deliverables.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper)] p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-[color:var(--ink-4)]" />
          <p className="mt-3 text-sm font-medium text-[color:var(--ink-2)]">
            Este project aun no tiene deliverables registrados.
          </p>
          <p className="mt-1 text-xs text-[color:var(--ink-3)]">
            {canPlan
              ? 'Planifica el project para sembrar los deliverables desde la request origen.'
              : 'Los deliverables se crean al planificar el project desde el status "Project opened".'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-left">
                {['Orden', 'Codigo', 'Subparte', 'Titulo', 'Owner', 'Status', 'Version', 'Accion'].map(
                  (col) => (
                    <th
                      key={col}
                      className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]"
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {deliverables.map((d, idx) => {
                const estadoStyle =
                  ESTADO_STYLE[d.status] ?? 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)] border-[color:var(--ink-4)]'
                const estadoLabel = ESTADO_LABEL[d.status] ?? d.status
                return (
                  <tr
                    key={d.id}
                    className={cn(
                      'border-b border-[color:var(--ink-4)] align-top',
                      idx % 2 === 0 ? 'bg-[color:var(--paper)]' : 'bg-[color:var(--paper-2)]/40',
                    )}
                  >
                    <td className="px-3 py-2.5 font-mono text-xs text-[color:var(--ink-3)]">
                      {d.sort_order}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-[color:var(--ink-2)]">
                      {d.template_code ?? '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-[color:var(--ink-3)]">
                      {d.subpart_easa ?? '-'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block font-medium text-[color:var(--ink)]">{d.title}</span>
                      {d.description && (
                        <span className="block text-[11px] text-[color:var(--ink-3)]">
                          {d.description}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-[color:var(--ink-3)]">
                      {d.owner_user_id ? d.owner_user_id.slice(0, 8) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                          estadoStyle,
                        )}
                      >
                        {estadoLabel}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-[color:var(--ink-3)]">
                      v{d.current_version}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-[color:var(--ink-3)]">
                      -
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
