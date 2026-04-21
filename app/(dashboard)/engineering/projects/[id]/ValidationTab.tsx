'use client'

/**
 * Tab "Validation" del detalle de project (Sprint 2).
 *
 * - Timeline de validaciones previas (GET /api/projects/[id]/validations).
 * - Form de decision cuando execution_status = 'in_validation'.
 * - CTA "Send a validation" cuando execution_status = 'ready_for_validation'.
 * - CTA "Retomar execution" cuando execution_status = 'returned_to_execution'.
 * - En otros statuses: read-only del timeline.
 *
 * TODO(RLS): restringir quien puede decidir ("approve"/"return") segun role
 * del user_label (DOH/DOS) - por ahora cualquier user_label autenticado puede.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  OBSERVATION_SEVERITY_LABELS,
  PROJECT_EXECUTION_STATES,
  VALIDATION_DECISION_LABELS,
  VALIDATION_ROLE_LABELS,
} from '@/lib/workflow-states'
import type {
  ObservationSeverity,
  ProjectDeliverable,
  ProjectValidation,
  ValidationObservation,
  ValidationRole,
} from '@/types/database'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  proyectoId: string
  currentState: string | null
  onStateChange?: (nextState: string) => void
}

type ValidationWithEmail = ProjectValidation & {
  validator_email: string | null
}

type ObservationDraft = {
  deliverable_id: string
  text: string
  severity: ObservationSeverity
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function ValidationTab({ proyectoId, currentState, onStateChange }: Props) {
  const [validations, setValidations] = useState<ValidationWithEmail[]>([])
  const [deliverables, setDeliverables] = useState<ProjectDeliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<null | 'send' | 'approve' | 'return' | 'resume'>(
    null,
  )

  // Form state
  const [role, setRole] = useState<ValidationRole>('doh')
  const [comments, setComentarios] = useState('')
  const [observations, setObservations] = useState<ObservationDraft[]>([])

  const canDecide = currentState === PROJECT_EXECUTION_STATES.IN_VALIDATION
  const canSend = currentState === PROJECT_EXECUTION_STATES.READY_FOR_VALIDATION
  const canResume = currentState === PROJECT_EXECUTION_STATES.RETURNED_TO_EXECUTION

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [vRes, dRes] = await Promise.all([
        fetch(`/api/projects/${proyectoId}/validations`, { method: 'GET' }),
        fetch(`/api/projects/${proyectoId}/deliverables`, { method: 'GET' }),
      ])
      const vJson = (await vRes.json().catch(() => ({}))) as {
        validations?: ValidationWithEmail[]
        error?: string
      }
      const dJson = (await dRes.json().catch(() => ({}))) as {
        deliverables?: ProjectDeliverable[]
        error?: string
      }
      if (!vRes.ok) throw new Error(vJson.error || `HTTP ${vRes.status}`)
      setValidations(vJson.validations ?? [])
      if (dRes.ok) setDeliverables(dJson.deliverables ?? [])
    } catch (e) {
      console.error('ValidationTab load error:', e)
      setError(e instanceof Error ? e.message : 'Error cargando validaciones.')
    } finally {
      setLoading(false)
    }
  }, [proyectoId])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const lastReturn = useMemo(() => {
    return validations.find((v) => v.decision === 'returned') ?? null
  }, [validations])

  const addObservation = useCallback(() => {
    setObservations((prev) => [
      ...prev,
      { deliverable_id: '', text: '', severity: 'info' },
    ])
  }, [])

  const updateObservation = useCallback(
    (idx: number, patch: Partial<ObservationDraft>) => {
      setObservations((prev) =>
        prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
      )
    },
    [],
  )

  const removeObservation = useCallback((idx: number) => {
    setObservations((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const clearForm = useCallback(() => {
    setComentarios('')
    setObservations([])
  }, [])

  const handleSend = useCallback(async () => {
    setSubmitting('send')
    setError(null)
    try {
      const res = await fetch(`/api/projects/${proyectoId}/send-to-validation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = (await res.json().catch(() => ({}))) as {
        project?: { execution_status?: string }
        error?: string
        blockers?: unknown
      }
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }
      if (json.project?.execution_status && onStateChange) {
        onStateChange(json.project.execution_status)
      }
      await loadAll()
    } catch (e) {
      console.error('send-a-validation error:', e)
      setError(e instanceof Error ? e.message : 'No se pudo send a validation.')
    } finally {
      setSubmitting(null)
    }
  }, [proyectoId, loadAll, onStateChange])

  const handleResume = useCallback(async () => {
    setSubmitting('resume')
    setError(null)
    try {
      const res = await fetch(`/api/projects/${proyectoId}/resume`, {
        method: 'POST',
      })
      const json = (await res.json().catch(() => ({}))) as {
        project?: { execution_status?: string }
        error?: string
      }
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      if (json.project?.execution_status && onStateChange) {
        onStateChange(json.project.execution_status)
      }
      await loadAll()
    } catch (e) {
      console.error('retomar error:', e)
      setError(e instanceof Error ? e.message : 'No se pudo retomar.')
    } finally {
      setSubmitting(null)
    }
  }, [proyectoId, loadAll, onStateChange])

  const handleDecide = useCallback(
    async (decision: 'approved' | 'returned') => {
      if (decision === 'returned' && observations.length === 0) {
        setError('Para devolver a execution necesitas al menos una observation.')
        return
      }

      setSubmitting(decision === 'approved' ? 'approve' : 'return')
      setError(null)

      const cleanObservations: ValidationObservation[] = []
      for (const o of observations) {
        const text = o.text.trim()
        if (!text) continue
        cleanObservations.push({
          deliverable_id: o.deliverable_id || undefined,
          text,
          severity: o.severity,
        })
      }

      try {
        const res = await fetch(`/api/projects/${proyectoId}/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision,
            role,
            comments: comments.trim() || undefined,
            observations: cleanObservations,
          }),
        })
        const json = (await res.json().catch(() => ({}))) as {
          project?: { execution_status?: string }
          error?: string
        }
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
        if (json.project?.execution_status && onStateChange) {
          onStateChange(json.project.execution_status)
        }
        clearForm()
        await loadAll()
      } catch (e) {
        console.error('validar error:', e)
        setError(e instanceof Error ? e.message : 'No se pudo registrar la decision.')
      } finally {
        setSubmitting(null)
      }
    },
    [proyectoId, role, comments, observations, loadAll, clearForm, onStateChange],
  )

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[color:var(--ink-3)]" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
          Validation DOH/DOS
        </h2>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* CTA: Send a validation */}
      {canSend && (
        <section className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--ink)]">
                Ready for validation
              </h3>
              <p className="mt-1 text-xs text-[color:var(--ink-2)]">
                Todos los deliverables estan completos. Envia el project a
                DOH/DOS para que firmen la approval.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={submitting !== null}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting === 'send' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send a validation
            </button>
          </div>
        </section>
      )}

      {/* CTA: Retomar execution + mostrar ultimo return */}
      {canResume && (
        <section className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[color:var(--ink)]">
                Returned to execution
              </h3>
              {lastReturn ? (
                <div className="mt-2 space-y-2 text-xs text-[color:var(--ink-2)]">
                  <p>
                    <strong>Decidido por:</strong>{' '}
                    {lastReturn.validator_email ?? lastReturn.validator_user_id.slice(0, 8)}{' '}
                    ({VALIDATION_ROLE_LABELS[lastReturn.role]}) el{' '}
                    {formatDateTime(lastReturn.created_at)}
                  </p>
                  {lastReturn.comments && (
                    <p className="italic">&quot;{lastReturn.comments}&quot;</p>
                  )}
                  {lastReturn.observations.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-5">
                      {lastReturn.observations.map((o, i) => (
                        <li key={i}>
                          <span className="font-mono text-[10px] uppercase">
                            [{o.severity ?? 'info'}]
                          </span>{' '}
                          {o.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-xs text-[color:var(--ink-3)]">
                  Atiende las observations y retoma cuando esten resueltas.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleResume}
              disabled={submitting !== null}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting === 'resume' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Retomar execution
            </button>
          </div>
        </section>
      )}

      {/* Form de decision */}
      {canDecide && (
        <section className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-4">
          <h3 className="text-sm font-semibold text-[color:var(--ink)]">
            Registrar decision
          </h3>
          <p className="mt-1 text-xs text-[color:var(--ink-3)]">
            Al aprobar o devolver se firma HMAC la decision y se registra en el
            historial de auditoria.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <label className="block text-xs font-medium text-[color:var(--ink-2)]">
              Capacidad
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as ValidationRole)}
                className="mt-1 w-full rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2.5 py-2 text-sm text-[color:var(--ink-2)] focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                {(Object.keys(VALIDATION_ROLE_LABELS) as ValidationRole[]).map(
                  (r) => (
                    <option key={r} value={r}>
                      {VALIDATION_ROLE_LABELS[r]}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="block text-xs font-medium text-[color:var(--ink-2)]">
              Comentarios
              <Textarea
                value={comments}
                onChange={(e) => setComentarios(e.target.value)}
                placeholder="Resumen de la review..."
                className="mt-1 bg-[color:var(--paper)]"
              />
            </label>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[color:var(--ink-2)]">
                  Observaciones ({observations.length})
                </span>
                <button
                  type="button"
                  onClick={addObservation}
                  className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1 text-xs text-[color:var(--ink-2)] hover:bg-[color:var(--paper-3)]"
                >
                  <Plus className="h-3 w-3" />
                  Anadir
                </button>
              </div>
              {observations.length === 0 && (
                <p className="mt-1 text-[11px] text-[color:var(--ink-3)]">
                  Para devolver a execution hace falta al menos una observation.
                </p>
              )}
              <div className="mt-2 space-y-2">
                {observations.map((o, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-2 md:grid-cols-12"
                  >
                    <select
                      value={o.deliverable_id}
                      onChange={(e) =>
                        updateObservation(idx, { deliverable_id: e.target.value })
                      }
                      className="rounded border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1 text-xs text-[color:var(--ink-2)] md:col-span-4"
                    >
                      <option value="">(Project completo)</option>
                      {deliverables.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.template_code ? `${d.template_code} — ` : ''}
                          {d.title}
                        </option>
                      ))}
                    </select>
                    <select
                      value={o.severity}
                      onChange={(e) =>
                        updateObservation(idx, {
                          severity: e.target.value as ObservationSeverity,
                        })
                      }
                      className="rounded border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1 text-xs text-[color:var(--ink-2)] md:col-span-2"
                    >
                      {(
                        Object.keys(OBSERVATION_SEVERITY_LABELS) as ObservationSeverity[]
                      ).map((s) => (
                        <option key={s} value={s}>
                          {OBSERVATION_SEVERITY_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={o.text}
                      onChange={(e) =>
                        updateObservation(idx, { text: e.target.value })
                      }
                      placeholder="Describe la observation"
                      className="rounded border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1 text-xs text-[color:var(--ink-2)] md:col-span-5"
                    />
                    <button
                      type="button"
                      onClick={() => removeObservation(idx)}
                      className="inline-flex items-center justify-center rounded border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-1 text-[color:var(--ink-3)] hover:text-rose-600 md:col-span-1"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleDecide('approved')}
                disabled={submitting !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {submitting === 'approve' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Aprobar
              </button>
              <button
                type="button"
                onClick={() => handleDecide('returned')}
                disabled={submitting !== null || observations.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {submitting === 'return' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Devolver a execution
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Timeline */}
      <section className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
          Historial de validaciones
        </h3>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[color:var(--ink-3)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        ) : validations.length === 0 ? (
          <p className="text-sm text-[color:var(--ink-3)]">
            Aun no hay decisiones registradas para este project.
          </p>
        ) : (
          <ol className="space-y-3">
            {validations.map((v) => {
              const badge =
                v.decision === 'approved'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : v.decision === 'returned'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-[color:var(--paper-2)] text-[color:var(--ink-2)] border-[color:var(--ink-4)]'
              return (
                <li
                  key={v.id}
                  className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/40 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                          badge,
                        )}
                      >
                        {VALIDATION_DECISION_LABELS[v.decision]}
                      </span>
                      <span className="text-xs text-[color:var(--ink-3)]">
                        {VALIDATION_ROLE_LABELS[v.role]}
                      </span>
                    </div>
                    <span className="text-[11px] text-[color:var(--ink-3)]">
                      {formatDateTime(v.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--ink-3)]">
                    <ChevronRight className="mr-1 inline h-3 w-3" />
                    {v.validator_email ?? v.validator_user_id.slice(0, 8)}
                  </p>
                  {v.comments && (
                    <p className="mt-1 text-sm text-[color:var(--ink-2)]">{v.comments}</p>
                  )}
                  {Array.isArray(v.observations) && v.observations.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-[color:var(--ink-3)]">
                      {v.observations.map((o, i) => (
                        <li key={i}>
                          <span className="mr-1 font-mono text-[10px] uppercase text-[color:var(--ink-3)]">
                            [{o.severity ?? 'info'}]
                          </span>
                          {o.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
