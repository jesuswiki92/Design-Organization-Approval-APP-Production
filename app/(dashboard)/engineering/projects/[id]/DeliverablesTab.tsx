'use client'

/**
 * Tab "Deliverables" del detalle de proyecto (Sprint 1, read-only).
 *
 * Lista los deliverables del proyecto llamando a GET /api/proyectos/[id]/deliverables.
 * Si el proyecto esta en `proyecto_abierto` y no tiene deliverables, ofrece un
 * boton "Planificar proyecto" que llama a POST /api/proyectos/[id]/planificar.
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
import type { DeliverableEstado, ProjectDeliverable } from '@/types/database'

type Props = {
  proyectoId: string
  currentState: string | null
  onStateChange?: (nextState: string) => void
}

const ESTADO_STYLE: Record<DeliverableEstado, string> = {
  pendiente: 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)] border-[color:var(--ink-4)]',
  en_curso: 'bg-[color:var(--paper-2)] text-[color:var(--ink-2)] border-[color:var(--ink-4)]',
  en_revision: 'bg-amber-50 text-amber-700 border-amber-200',
  completado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  bloqueado: 'bg-rose-50 text-rose-700 border-rose-200',
  no_aplica: 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)] border-[color:var(--ink-4)]',
}

const ESTADO_LABEL: Record<DeliverableEstado, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  en_revision: 'En revision',
  completado: 'Completado',
  bloqueado: 'Bloqueado',
  no_aplica: 'No aplica',
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
      const res = await fetch(`/api/proyectos/${proyectoId}/deliverables`, {
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
      const res = await fetch(`/api/proyectos/${proyectoId}/planificar`, {
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
      setError(e instanceof Error ? e.message : 'Error planificando proyecto.')
    } finally {
      setPlanning(false)
    }
  }, [proyectoId, load])

  const canPlan =
    currentState !== null &&
    isProjectExecutionStateCode(currentState) &&
    currentState === PROJECT_EXECUTION_STATES.PROYECTO_ABIERTO

  // D6 (Sprint 2): ofrecer "Listo para validacion" cuando el proyecto esta en
  // ejecucion o revision interna y todos los deliverables estan listos. El
  // endpoint `enviar-a-validacion` admite la transicion desde esos estados
  // directamente y ya comprueba integridad por si cambia mientras lee.
  const readyForValidation = useMemo(() => {
    if (deliverables.length === 0) return false
    return deliverables.every((d) =>
      DELIVERABLE_VALIDATION_READY_STATES.includes(d.estado),
    )
  }, [deliverables])

  const canSendToValidation =
    currentState !== null &&
    isProjectExecutionStateCode(currentState) &&
    (currentState === PROJECT_EXECUTION_STATES.EN_EJECUCION ||
      currentState === PROJECT_EXECUTION_STATES.REVISION_INTERNA ||
      currentState === PROJECT_EXECUTION_STATES.LISTO_PARA_VALIDACION) &&
    readyForValidation

  const handleSendToValidation = useCallback(async () => {
    setSendingToValidation(true)
    setError(null)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/enviar-a-validacion`, {
        method: 'POST',
      })
      const json = (await res.json().catch(() => ({}))) as {
        proyecto?: { estado_v2?: string }
        error?: string
        blockers?: Array<{ titulo: string }>
      }
      if (!res.ok) {
        const extra = json.blockers?.length
          ? ` Bloqueantes: ${json.blockers.map((b) => b.titulo).join(', ')}`
          : ''
        throw new Error((json.error || `HTTP ${res.status}`) + extra)
      }
      if (json.proyecto?.estado_v2 && onStateChange) {
        onStateChange(json.proyecto.estado_v2)
      }
      await load()
    } catch (e) {
      console.error('DeliverablesTab enviar-a-validacion error:', e)
      setError(e instanceof Error ? e.message : 'Error enviando a validacion.')
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
            {planning ? 'Planificando...' : 'Planificar proyecto'}
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
            {sendingToValidation ? 'Enviando...' : 'Enviar a validacion'}
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
            Este proyecto aun no tiene deliverables registrados.
          </p>
          <p className="mt-1 text-xs text-[color:var(--ink-3)]">
            {canPlan
              ? 'Planifica el proyecto para sembrar los deliverables desde la consulta origen.'
              : 'Los deliverables se crean al planificar el proyecto desde el estado "Proyecto abierto".'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-left">
                {['Orden', 'Codigo', 'Subparte', 'Titulo', 'Owner', 'Estado', 'Version', 'Accion'].map(
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
                  ESTADO_STYLE[d.estado] ?? 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)] border-[color:var(--ink-4)]'
                const estadoLabel = ESTADO_LABEL[d.estado] ?? d.estado
                return (
                  <tr
                    key={d.id}
                    className={cn(
                      'border-b border-[color:var(--ink-4)] align-top',
                      idx % 2 === 0 ? 'bg-[color:var(--paper)]' : 'bg-[color:var(--paper-2)]/40',
                    )}
                  >
                    <td className="px-3 py-2.5 font-mono text-xs text-[color:var(--ink-3)]">
                      {d.orden}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-[color:var(--ink-2)]">
                      {d.template_code ?? '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-[color:var(--ink-3)]">
                      {d.subpart_easa ?? '-'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block font-medium text-[color:var(--ink)]">{d.titulo}</span>
                      {d.descripcion && (
                        <span className="block text-[11px] text-[color:var(--ink-3)]">
                          {d.descripcion}
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
                      v{d.version_actual}
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
