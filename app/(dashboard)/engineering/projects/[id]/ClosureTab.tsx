'use client'

/**
 * Tab "Cierre" del detalle de proyecto — Sprint 4 (close-the-loop).
 *
 * Estados admitidos y comportamiento:
 *   - confirmacion_cliente -> formulario de cierre (outcome, notas, lecciones).
 *                             POST /api/proyectos/[id]/cerrar.
 *   - cerrado              -> vista read-only del closure, firma, lecciones +
 *                             boton "Archivar proyecto".
 *   - archivado_proyecto   -> vista read-only completa + boton "Reindexar
 *                             precedente" (fail-soft).
 *   - resto                -> mensaje informativo, sin acciones.
 *
 * Siempre muestra, si hay closure_id disponible, el bloque de metricas
 * computadas al cierre y la lista de lecciones aprendidas.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Flag,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

import { Textarea } from '@/components/ui/textarea'
import {
  CLOSURE_OUTCOMES,
  CLOSURE_OUTCOME_LABELS,
  LESSON_CATEGORIA_LABELS,
  LESSON_TIPO_LABELS,
  PROJECT_EXECUTION_STATES,
} from '@/lib/workflow-states'
import type {
  ClosureMetricsSnapshot,
  ClosureOutcome,
  LessonCategoria,
  LessonTipo,
  ProjectClosure,
  ProjectLesson,
} from '@/types/database'

type SignatureSummary = {
  id: string
  signature_type: string
  signer_role: string
  signer_user_id: string
  payload_hash: string
  hmac_key_id: string
  created_at: string
}

type ClosureResponse = {
  closure: ProjectClosure | null
  signature: SignatureSummary | null
  lessons: ProjectLesson[]
}

type LessonDraft = {
  key: string
  categoria: LessonCategoria
  tipo: LessonTipo
  titulo: string
  descripcion: string
  impacto: string
  recomendacion: string
  tagsRaw: string
}

type Props = {
  proyectoId: string
  currentState: string | null
  onStateChange?: (nextState: string) => void
}

const OUTCOME_OPTIONS: ClosureOutcome[] = [
  CLOSURE_OUTCOMES.EXITOSO,
  CLOSURE_OUTCOMES.EXITOSO_CON_RESERVAS,
  CLOSURE_OUTCOMES.PROBLEMATICO,
  CLOSURE_OUTCOMES.ABORTADO,
]

const CATEGORIA_OPTIONS: LessonCategoria[] = [
  'tecnica',
  'proceso',
  'cliente',
  'calidad',
  'planificacion',
  'herramientas',
  'regulatoria',
  'otro',
]

const TIPO_OPTIONS: LessonTipo[] = ['positiva', 'negativa', 'mejora', 'riesgo']

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-ES', {
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

function formatNumber(n: number | null | undefined, suffix = ''): string {
  if (n === null || n === undefined) return '—'
  if (!Number.isFinite(n)) return '—'
  const rounded = Math.round(n * 100) / 100
  return `${rounded}${suffix}`
}

function makeDraft(): LessonDraft {
  return {
    key: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    categoria: 'proceso',
    tipo: 'mejora',
    titulo: '',
    descripcion: '',
    impacto: '',
    recomendacion: '',
    tagsRaw: '',
  }
}

export function ClosureTab({ proyectoId, currentState, onStateChange }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [closure, setClosure] = useState<ProjectClosure | null>(null)
  const [signature, setSignature] = useState<SignatureSummary | null>(null)
  const [lessons, setLessons] = useState<ProjectLesson[]>([])

  // Form (solo en confirmacion_cliente)
  const [outcome, setOutcome] = useState<ClosureOutcome>(CLOSURE_OUTCOMES.EXITOSO)
  const [notas, setNotas] = useState('')
  const [drafts, setDrafts] = useState<LessonDraft[]>([])
  const [submitting, setSubmitting] = useState<
    null | 'cerrar' | 'archivar' | 'reindex' | 'add-lesson'
  >(null)

  // Add-lesson form (cuando ya hay closure y queremos agregar lecciones sueltas)
  const [showAddLesson, setShowAddLesson] = useState(false)
  const [newLesson, setNewLesson] = useState<LessonDraft>(() => makeDraft())

  const [reindexMsg, setReindexMsg] = useState<string | null>(null)

  const canCerrar = currentState === PROJECT_EXECUTION_STATES.CONFIRMACION_CLIENTE
  const isCerrado = currentState === PROJECT_EXECUTION_STATES.CERRADO
  const isArchivado = currentState === PROJECT_EXECUTION_STATES.ARCHIVADO_PROYECTO

  const loadClosure = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/closure`, {
        method: 'GET',
      })
      const json = (await res.json().catch(() => ({}))) as
        | ClosureResponse
        | { error?: string }
      if (!res.ok) {
        const msg =
          (json as { error?: string }).error || `HTTP ${res.status}`
        throw new Error(msg)
      }
      const payload = json as ClosureResponse
      setClosure(payload.closure ?? null)
      setSignature(payload.signature ?? null)
      setLessons(payload.lessons ?? [])
    } catch (e) {
      console.error('ClosureTab load error:', e)
      setError(e instanceof Error ? e.message : 'Error cargando cierre.')
    } finally {
      setLoading(false)
    }
  }, [proyectoId])

  useEffect(() => {
    loadClosure()
  }, [loadClosure])

  // --- Handlers del formulario de cierre ---

  const addDraft = useCallback(() => {
    setDrafts((prev) => [...prev, makeDraft()])
  }, [])

  const removeDraft = useCallback((key: string) => {
    setDrafts((prev) => prev.filter((d) => d.key !== key))
  }, [])

  const updateDraft = useCallback(
    <K extends keyof LessonDraft>(key: string, field: K, value: LessonDraft[K]) => {
      setDrafts((prev) =>
        prev.map((d) => (d.key === key ? { ...d, [field]: value } : d)),
      )
    },
    [],
  )

  const draftsValid = useMemo(() => {
    return drafts.every(
      (d) => d.titulo.trim().length > 0 && d.descripcion.trim().length > 0,
    )
  }, [drafts])

  const handleCerrar = useCallback(async () => {
    if (!draftsValid) {
      setError('Todas las lecciones deben tener titulo y descripcion.')
      return
    }
    setSubmitting('cerrar')
    setError(null)
    try {
      const lecciones = drafts.map((d) => ({
        categoria: d.categoria,
        tipo: d.tipo,
        titulo: d.titulo.trim(),
        descripcion: d.descripcion.trim(),
        impacto: d.impacto.trim() || undefined,
        recomendacion: d.recomendacion.trim() || undefined,
        tags: d.tagsRaw
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
      }))

      const res = await fetch(`/api/proyectos/${proyectoId}/cerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome,
          notas_cierre: notas.trim() || undefined,
          lecciones,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        closure?: ProjectClosure
        signature?: SignatureSummary
        lessons?: ProjectLesson[]
        proyecto?: { estado_v2?: string }
        error?: string
      }
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)

      if (json.closure) setClosure(json.closure)
      if (json.signature) setSignature(json.signature)
      if (json.lessons) setLessons(json.lessons)
      if (json.proyecto?.estado_v2 && onStateChange) {
        onStateChange(json.proyecto.estado_v2)
      }
      setDrafts([])
      setNotas('')
      await loadClosure()
    } catch (e) {
      console.error('cerrar error:', e)
      setError(e instanceof Error ? e.message : 'No se pudo cerrar el proyecto.')
    } finally {
      setSubmitting(null)
    }
  }, [draftsValid, drafts, outcome, notas, proyectoId, onStateChange, loadClosure])

  const handleArchivar = useCallback(async () => {
    setSubmitting('archivar')
    setError(null)
    setReindexMsg(null)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/archivar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = (await res.json().catch(() => ({}))) as {
        proyecto?: { estado_v2?: string }
        reindex?: { upserted: boolean; reason: string | null }
        mv_refreshed?: boolean
        error?: string
      }
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)

      if (json.proyecto?.estado_v2 && onStateChange) {
        onStateChange(json.proyecto.estado_v2)
      }
      const r = json.reindex
      if (r) {
        setReindexMsg(
          r.upserted
            ? 'Proyecto archivado y reindexado en Pinecone.'
            : `Proyecto archivado. Reindex de precedente pendiente: ${r.reason ?? 'sin razon'}.`,
        )
      } else {
        setReindexMsg('Proyecto archivado.')
      }
    } catch (e) {
      console.error('archivar error:', e)
      setError(e instanceof Error ? e.message : 'No se pudo archivar el proyecto.')
    } finally {
      setSubmitting(null)
    }
  }, [proyectoId, onStateChange])

  const handleReindex = useCallback(async () => {
    setSubmitting('reindex')
    setError(null)
    setReindexMsg(null)
    try {
      const res = await fetch('/api/engineering/precedentes/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: proyectoId }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        upserted?: boolean
        records?: Array<{ proyecto_id: string; upserted: boolean; reason?: string }>
        error?: string
      }
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)

      const record = json.records?.[0]
      if (record?.upserted) {
        setReindexMsg('Precedente reindexado correctamente en Pinecone.')
      } else {
        setReindexMsg(
          `Reindex pendiente: ${record?.reason ?? 'sin respuesta del endpoint'}.`,
        )
      }
    } catch (e) {
      console.error('reindex error:', e)
      setError(e instanceof Error ? e.message : 'No se pudo reindexar.')
    } finally {
      setSubmitting(null)
    }
  }, [proyectoId])

  const handleAddLesson = useCallback(async () => {
    if (!newLesson.titulo.trim() || !newLesson.descripcion.trim()) {
      setError('Titulo y descripcion son obligatorios.')
      return
    }
    setSubmitting('add-lesson')
    setError(null)
    try {
      const body = {
        categoria: newLesson.categoria,
        tipo: newLesson.tipo,
        titulo: newLesson.titulo.trim(),
        descripcion: newLesson.descripcion.trim(),
        impacto: newLesson.impacto.trim() || undefined,
        recomendacion: newLesson.recomendacion.trim() || undefined,
        tags: newLesson.tagsRaw
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
      }
      const res = await fetch(`/api/proyectos/${proyectoId}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => ({}))) as {
        lesson?: ProjectLesson
        error?: string
      }
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      if (json.lesson) {
        setLessons((prev) => [...prev, json.lesson!])
      }
      setNewLesson(makeDraft())
      setShowAddLesson(false)
    } catch (e) {
      console.error('add lesson error:', e)
      setError(e instanceof Error ? e.message : 'No se pudo guardar la leccion.')
    } finally {
      setSubmitting(null)
    }
  }, [newLesson, proyectoId])

  // --- Bloques renderizados ---

  const metrics: ClosureMetricsSnapshot | null = closure?.metrics ?? null

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <Flag className="h-4 w-4 text-[color:var(--ink-3)]" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
          Cierre del proyecto
        </h2>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {reindexMsg && (
        <div className="rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-3 py-2 text-sm text-[color:var(--ink-2)]">
          {reindexMsg}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-[color:var(--ink-3)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando cierre...
        </div>
      )}

      {/* Metricas (si hay closure) */}
      {!loading && closure && metrics && (
        <section className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
            <Sparkles className="h-3.5 w-3.5" />
            Metricas del cierre
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <MetricCard
              label="Outcome"
              value={CLOSURE_OUTCOME_LABELS[closure.outcome]}
              accent="emerald"
            />
            <MetricCard
              label="Deliverables completados"
              value={`${metrics.deliverables_completado ?? 0}/${metrics.deliverables_total ?? 0}`}
            />
            <MetricCard
              label="Validaciones aprobadas"
              value={`${metrics.validaciones_aprobadas ?? 0}/${metrics.validaciones_count ?? 0}`}
            />
            <MetricCard
              label="Devoluciones"
              value={String(metrics.devoluciones_count ?? 0)}
            />
            <MetricCard
              label="Entregas confirmadas"
              value={`${metrics.entregas_confirmadas ?? 0}/${metrics.entregas_count ?? 0}`}
            />
            <MetricCard
              label="Dias totales"
              value={formatNumber(metrics.dias_total ?? null, ' d')}
            />
            <MetricCard
              label="Confirmacion cliente"
              value={formatNumber(metrics.client_confirmation_days ?? null, ' d')}
            />
            <MetricCard
              label="Cerrado el"
              value={formatDateTime(closure.created_at)}
            />
          </div>
          {closure.notas_cierre && (
            <div className="mt-3 rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-3 text-sm text-[color:var(--ink-2)]">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                Notas de cierre
              </span>
              {closure.notas_cierre}
            </div>
          )}
          {signature && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-3 text-xs text-[color:var(--ink-3)]">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
              <div className="min-w-0">
                <div className="font-semibold text-[color:var(--ink-2)]">
                  Firma HMAC ({signature.hmac_key_id})
                </div>
                <div className="truncate font-mono text-[10px] text-[color:var(--ink-3)]">
                  hash: {signature.payload_hash}
                </div>
                <div className="text-[color:var(--ink-3)]">
                  Firmado por {signature.signer_role} el{' '}
                  {formatDateTime(signature.created_at)}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Formulario de cierre (solo confirmacion_cliente y sin closure) */}
      {!loading && canCerrar && !closure && (
        <section className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--ink)]">
                Cerrar proyecto
              </h3>
              <p className="mt-1 text-xs text-[color:var(--ink-3)]">
                Se computara un snapshot de metricas, se firmara HMAC el cierre y
                el proyecto pasara al estado &quot;cerrado&quot;. Podras archivarlo
                despues para reindexar el precedente.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <label className="block text-xs font-medium text-[color:var(--ink-2)]">
              Outcome del proyecto
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as ClosureOutcome)}
                className="mt-1 w-full rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2.5 py-2 text-sm text-[color:var(--ink-2)] focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              >
                {OUTCOME_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {CLOSURE_OUTCOME_LABELS[o]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-3 block text-xs font-medium text-[color:var(--ink-2)]">
            Notas de cierre (opcional)
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              className="mt-1 bg-[color:var(--paper)]"
              placeholder="Resumen breve, aspectos clave..."
            />
          </label>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--ink)]">
                <BookOpen className="h-3.5 w-3.5" />
                Lecciones aprendidas ({drafts.length})
              </h4>
              <button
                type="button"
                onClick={addDraft}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-[color:var(--paper)] px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              >
                <Plus className="h-3 w-3" />
                Anadir leccion
              </button>
            </div>

            {drafts.length === 0 ? (
              <p className="rounded-md border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper)]/40 px-3 py-4 text-center text-xs text-[color:var(--ink-3)]">
                No hay lecciones capturadas todavia. Puedes anadirlas aqui o
                despues del cierre.
              </p>
            ) : (
              <ul className="space-y-3">
                {drafts.map((d) => (
                  <li
                    key={d.key}
                    className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={d.categoria}
                          onChange={(e) =>
                            updateDraft(
                              d.key,
                              'categoria',
                              e.target.value as LessonCategoria,
                            )
                          }
                          className="rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1 text-xs text-[color:var(--ink-2)]"
                        >
                          {CATEGORIA_OPTIONS.map((c) => (
                            <option key={c} value={c}>
                              {LESSON_CATEGORIA_LABELS[c]}
                            </option>
                          ))}
                        </select>
                        <select
                          value={d.tipo}
                          onChange={(e) =>
                            updateDraft(
                              d.key,
                              'tipo',
                              e.target.value as LessonTipo,
                            )
                          }
                          className="rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1 text-xs text-[color:var(--ink-2)]"
                        >
                          {TIPO_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {LESSON_TIPO_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDraft(d.key)}
                        title="Quitar"
                        className="rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-1 text-[color:var(--ink-3)] hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={d.titulo}
                      onChange={(e) => updateDraft(d.key, 'titulo', e.target.value)}
                      placeholder="Titulo"
                      className="mt-2 w-full rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1.5 text-sm text-[color:var(--ink-2)]"
                    />
                    <Textarea
                      value={d.descripcion}
                      onChange={(e) =>
                        updateDraft(d.key, 'descripcion', e.target.value)
                      }
                      rows={2}
                      placeholder="Descripcion"
                      className="mt-2 bg-[color:var(--paper)]"
                    />
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <input
                        type="text"
                        value={d.impacto}
                        onChange={(e) =>
                          updateDraft(d.key, 'impacto', e.target.value)
                        }
                        placeholder="Impacto (opcional)"
                        className="w-full rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1.5 text-xs text-[color:var(--ink-2)]"
                      />
                      <input
                        type="text"
                        value={d.recomendacion}
                        onChange={(e) =>
                          updateDraft(d.key, 'recomendacion', e.target.value)
                        }
                        placeholder="Recomendacion (opcional)"
                        className="w-full rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1.5 text-xs text-[color:var(--ink-2)]"
                      />
                    </div>
                    <input
                      type="text"
                      value={d.tagsRaw}
                      onChange={(e) =>
                        updateDraft(d.key, 'tagsRaw', e.target.value)
                      }
                      placeholder="Tags (separados por coma)"
                      className="mt-2 w-full rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1.5 text-xs text-[color:var(--ink-2)]"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleCerrar}
              disabled={submitting !== null || !draftsValid}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting === 'cerrar' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Cerrar proyecto
            </button>
          </div>
        </section>
      )}

      {/* Cerrado: CTA archivar */}
      {!loading && isCerrado && closure && (
        <section className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--ink)]">
                Proyecto cerrado
              </h3>
              <p className="mt-1 text-xs text-[color:var(--ink-2)]">
                Puedes archivarlo para congelar el expediente y reindexar el
                precedente en el motor de busqueda (Pinecone).
              </p>
            </div>
            <button
              type="button"
              onClick={handleArchivar}
              disabled={submitting !== null}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting === 'archivar' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              Archivar proyecto
            </button>
          </div>
        </section>
      )}

      {/* Archivado: CTA reindex */}
      {!loading && isArchivado && closure && (
        <section className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--ink)]">
                <Lock className="h-4 w-4" />
                Proyecto archivado
              </h3>
              <p className="mt-1 text-xs text-[color:var(--ink-2)]">
                El expediente es de solo lectura. Puedes forzar un reindex del
                precedente si cambio el contexto (lecciones anadidas, etc.).
              </p>
            </div>
            <button
              type="button"
              onClick={handleReindex}
              disabled={submitting !== null}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting === 'reindex' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Reindexar precedente
            </button>
          </div>
        </section>
      )}

      {/* Estado no admitido */}
      {!loading && !canCerrar && !isCerrado && !isArchivado && !closure && (
        <section className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-4 text-sm text-[color:var(--ink-3)] shadow-sm">
          El proyecto no esta en un estado que admita cierre. Para cerrarlo debe
          llegar primero a &quot;confirmacion cliente&quot;.
        </section>
      )}

      {/* Lista de lecciones (si hay closure o lessons cargadas) */}
      {!loading && (closure || lessons.length > 0) && (
        <section className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
              <ClipboardList className="h-3.5 w-3.5" />
              Lecciones aprendidas ({lessons.length})
            </h3>
            {(isCerrado || isArchivado) && !showAddLesson && !isArchivado && (
              <button
                type="button"
                onClick={() => setShowAddLesson(true)}
                className="inline-flex items-center gap-1 rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2.5 py-1 text-xs font-medium text-[color:var(--ink-2)] hover:bg-[color:var(--paper-3)]"
              >
                <Plus className="h-3 w-3" />
                Anadir leccion
              </button>
            )}
          </div>

          {showAddLesson && (
            <div className="mb-3 rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <select
                    value={newLesson.categoria}
                    onChange={(e) =>
                      setNewLesson((l) => ({
                        ...l,
                        categoria: e.target.value as LessonCategoria,
                      }))
                    }
                    className="rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1 text-xs text-[color:var(--ink-2)]"
                  >
                    {CATEGORIA_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {LESSON_CATEGORIA_LABELS[c]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newLesson.tipo}
                    onChange={(e) =>
                      setNewLesson((l) => ({
                        ...l,
                        tipo: e.target.value as LessonTipo,
                      }))
                    }
                    className="rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1 text-xs text-[color:var(--ink-2)]"
                  >
                    {TIPO_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {LESSON_TIPO_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddLesson(false)
                    setNewLesson(makeDraft())
                  }}
                  title="Cancelar"
                  className="rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-1 text-[color:var(--ink-3)] hover:bg-[color:var(--paper-3)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={newLesson.titulo}
                onChange={(e) =>
                  setNewLesson((l) => ({ ...l, titulo: e.target.value }))
                }
                placeholder="Titulo"
                className="mt-2 w-full rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1.5 text-sm text-[color:var(--ink-2)]"
              />
              <Textarea
                value={newLesson.descripcion}
                onChange={(e) =>
                  setNewLesson((l) => ({ ...l, descripcion: e.target.value }))
                }
                rows={2}
                placeholder="Descripcion"
                className="mt-2 bg-[color:var(--paper)]"
              />
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input
                  type="text"
                  value={newLesson.impacto}
                  onChange={(e) =>
                    setNewLesson((l) => ({ ...l, impacto: e.target.value }))
                  }
                  placeholder="Impacto (opcional)"
                  className="w-full rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1.5 text-xs text-[color:var(--ink-2)]"
                />
                <input
                  type="text"
                  value={newLesson.recomendacion}
                  onChange={(e) =>
                    setNewLesson((l) => ({ ...l, recomendacion: e.target.value }))
                  }
                  placeholder="Recomendacion (opcional)"
                  className="w-full rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1.5 text-xs text-[color:var(--ink-2)]"
                />
              </div>
              <input
                type="text"
                value={newLesson.tagsRaw}
                onChange={(e) =>
                  setNewLesson((l) => ({ ...l, tagsRaw: e.target.value }))
                }
                placeholder="Tags (separados por coma)"
                className="mt-2 w-full rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1.5 text-xs text-[color:var(--ink-2)]"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleAddLesson}
                  disabled={submitting !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {submitting === 'add-lesson' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Guardar leccion
                </button>
              </div>
            </div>
          )}

          {lessons.length === 0 ? (
            <p className="text-sm text-[color:var(--ink-3)]">
              Aun no hay lecciones registradas para este proyecto.
            </p>
          ) : (
            <ul className="space-y-3">
              {lessons.map((l) => (
                <li
                  key={l.id}
                  className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/40 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--ink-2)]">
                        {LESSON_CATEGORIA_LABELS[l.categoria]}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--ink-2)]">
                        {LESSON_TIPO_LABELS[l.tipo]}
                      </span>
                    </div>
                    <span className="text-[11px] text-[color:var(--ink-3)]">
                      {formatDateTime(l.created_at)}
                    </span>
                  </div>
                  <h4 className="mt-2 text-sm font-semibold text-[color:var(--ink-2)]">
                    {l.titulo}
                  </h4>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-[color:var(--ink-3)]">
                    {l.descripcion}
                  </p>
                  {(l.impacto || l.recomendacion) && (
                    <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                      {l.impacto && (
                        <div className="rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-2">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                            Impacto
                          </span>
                          {l.impacto}
                        </div>
                      )}
                      {l.recomendacion && (
                        <div className="rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-2">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                            Recomendacion
                          </span>
                          {l.recomendacion}
                        </div>
                      )}
                    </div>
                  )}
                  {l.tags && l.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {l.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-0.5 text-[10px] text-[color:var(--ink-3)]"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'emerald'
}) {
  const valueCls =
    accent === 'emerald'
      ? 'text-emerald-700'
      : 'text-[color:var(--ink)]'
  return (
    <div className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
        {label}
      </p>
      <p className={`mt-0.5 text-sm font-semibold ${valueCls}`}>{value}</p>
    </div>
  )
}
