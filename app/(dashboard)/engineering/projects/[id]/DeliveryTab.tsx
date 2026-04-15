'use client'

/**
 * Tab "Entrega" del detalle de proyecto (Sprint 3 - close the loop).
 *
 * Estados:
 *   - validado             -> CTA "Preparar entrega" -> muestra PDF iframe + form.
 *   - preparando_entrega   -> carga delivery pendiente, muestra PDF iframe + form de envio.
 *   - entregado            -> "Esperando confirmacion del cliente".
 *   - confirmacion_cliente -> confirmada; timeline.
 *   - otros estados        -> read-only, solo timeline de entregas.
 *
 * En todos los casos se lista el timeline de entregas abajo.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Mail,
  Send,
  Truck,
  XCircle,
} from 'lucide-react'

import { PROJECT_EXECUTION_STATES } from '@/lib/workflow-states'
import type { ProjectDelivery } from '@/types/database'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  proyectoId: string
  proyectoTitulo: string
  proyectoNumero: string
  defaultRecipientEmail?: string | null
  defaultRecipientName?: string | null
  currentState: string | null
  onStateChange?: (nextState: string) => void
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

const DISPATCH_STATUS_LABEL: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  pendiente: {
    label: 'Pendiente',
    cls: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: Clock,
  },
  enviando: {
    label: 'Enviando',
    cls: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: Loader2,
  },
  enviado: {
    label: 'Enviado',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Mail,
  },
  fallo: {
    label: 'Fallo',
    cls: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: XCircle,
  },
  confirmado_cliente: {
    label: 'Confirmado',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
}

export function DeliveryTab({
  proyectoId,
  proyectoTitulo,
  proyectoNumero,
  defaultRecipientEmail,
  defaultRecipientName,
  currentState,
  onStateChange,
}: Props) {
  const [deliveries, setDeliveries] = useState<ProjectDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<null | 'prepare' | 'send'>(null)

  // Preview del PDF tras "Preparar entrega"
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)
  const [pendingDelivery, setPendingDelivery] = useState<ProjectDelivery | null>(null)

  // Form state
  const [formRecipientEmail, setFormRecipientEmail] = useState('')
  const [formRecipientName, setFormRecipientName] = useState('')
  const [formCcEmails, setFormCcEmails] = useState('')
  const [formSubject, setFormSubject] = useState('')
  const [formBody, setFormBody] = useState('')

  const canPrepare = currentState === PROJECT_EXECUTION_STATES.VALIDADO
  const canSend = currentState === PROJECT_EXECUTION_STATES.PREPARANDO_ENTREGA
  const isAwaitingClient = currentState === PROJECT_EXECUTION_STATES.ENTREGADO
  const isConfirmed = currentState === PROJECT_EXECUTION_STATES.CONFIRMACION_CLIENTE

  const defaultSubject = useMemo(
    () => `Statement of Compliance — ${proyectoTitulo}`,
    [proyectoTitulo],
  )

  const defaultBody = useMemo(
    () =>
      `Estimado cliente,\n\nAdjuntamos el Statement of Compliance del proyecto ${proyectoNumero}.\n\nConfirma la recepcion pulsando el enlace incluido en este email.\n\nUn saludo,\nEquipo DOA`,
    [proyectoNumero],
  )

  const loadDeliveries = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/deliveries`, {
        method: 'GET',
      })
      const json = (await res.json().catch(() => ({}))) as {
        deliveries?: ProjectDelivery[]
        error?: string
      }
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      const list = json.deliveries ?? []
      setDeliveries(list)

      // Si estamos en preparando_entrega, buscar la delivery pendiente
      if (currentState === PROJECT_EXECUTION_STATES.PREPARANDO_ENTREGA) {
        const pending = list.find((d) => d.dispatch_status === 'pendiente') ?? null
        setPendingDelivery(pending)
        if (pending) {
          setFormRecipientEmail(
            pending.recipient_email && pending.recipient_email !== 'pendiente@doa.local'
              ? pending.recipient_email
              : defaultRecipientEmail ?? '',
          )
          setFormRecipientName(pending.recipient_name ?? defaultRecipientName ?? '')
          setFormCcEmails((pending.cc_emails ?? []).join(', '))
          setFormSubject(pending.subject || defaultSubject)
          setFormBody(pending.body ?? defaultBody)
          // Cargar el PDF via endpoint (redirect a signed URL)
          setPdfPreviewUrl(
            `/api/proyectos/${proyectoId}/deliveries/${pending.id}/soc-pdf`,
          )
        }
      }
    } catch (e) {
      console.error('DeliveryTab load error:', e)
      setError(e instanceof Error ? e.message : 'Error cargando entregas.')
    } finally {
      setLoading(false)
    }
  }, [
    proyectoId,
    currentState,
    defaultRecipientEmail,
    defaultRecipientName,
    defaultSubject,
    defaultBody,
  ])

  useEffect(() => {
    loadDeliveries()
  }, [loadDeliveries])

  const handlePrepare = useCallback(async () => {
    setSubmitting('prepare')
    setError(null)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/preparar-entrega`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = (await res.json().catch(() => ({}))) as {
        delivery_id?: string
        signed_url_preview?: string | null
        proyecto?: { estado_v2?: string }
        error?: string
      }
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)

      if (json.signed_url_preview) setPdfPreviewUrl(json.signed_url_preview)
      if (json.proyecto?.estado_v2 && onStateChange) {
        onStateChange(json.proyecto.estado_v2)
      }
      // Prefills del form
      setFormRecipientEmail(defaultRecipientEmail ?? '')
      setFormRecipientName(defaultRecipientName ?? '')
      setFormSubject(defaultSubject)
      setFormBody(defaultBody)
      setFormCcEmails('')
      await loadDeliveries()
    } catch (e) {
      console.error('preparar-entrega error:', e)
      setError(e instanceof Error ? e.message : 'No se pudo preparar la entrega.')
    } finally {
      setSubmitting(null)
    }
  }, [
    proyectoId,
    onStateChange,
    defaultRecipientEmail,
    defaultRecipientName,
    defaultSubject,
    defaultBody,
    loadDeliveries,
  ])

  const handleSend = useCallback(async () => {
    if (!pendingDelivery) {
      setError('No hay delivery pendiente de envio.')
      return
    }
    if (!formRecipientEmail.trim() || !formRecipientEmail.includes('@')) {
      setError('Introduce un email del destinatario valido.')
      return
    }
    setSubmitting('send')
    setError(null)
    try {
      const cc = formCcEmails
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

      const res = await fetch(`/api/proyectos/${proyectoId}/enviar-entrega`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_id: pendingDelivery.id,
          recipient_email: formRecipientEmail.trim(),
          recipient_name: formRecipientName.trim() || undefined,
          cc_emails: cc.length > 0 ? cc : undefined,
          subject: formSubject.trim() || undefined,
          body: formBody.trim() || undefined,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        proyecto?: { estado_v2?: string }
        error?: string
      }
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      if (json.proyecto?.estado_v2 && onStateChange) {
        onStateChange(json.proyecto.estado_v2)
      }
      await loadDeliveries()
    } catch (e) {
      console.error('enviar-entrega error:', e)
      setError(e instanceof Error ? e.message : 'No se pudo enviar la entrega.')
    } finally {
      setSubmitting(null)
    }
  }, [
    pendingDelivery,
    proyectoId,
    formRecipientEmail,
    formRecipientName,
    formCcEmails,
    formSubject,
    formBody,
    onStateChange,
    loadDeliveries,
  ])

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Entrega al cliente
        </h2>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* CTA preparar */}
      {canPrepare && !pdfPreviewUrl && (
        <section className="rounded-2xl border border-lime-200 bg-lime-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-lime-900">
                Listo para preparar la entrega
              </h3>
              <p className="mt-1 text-xs text-lime-700">
                Se generara el Statement of Compliance en PDF firmado (HMAC) y
                se subira a Storage. No se envia ningun email todavia.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePrepare}
              disabled={submitting !== null}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-lime-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting === 'prepare' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Preparar entrega
            </button>
          </div>
        </section>
      )}

      {/* Iframe + form en preparando_entrega */}
      {(canSend || (canPrepare && pdfPreviewUrl)) && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Preview PDF */}
          <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <FileText className="h-3.5 w-3.5" />
              Statement of Compliance
            </h3>
            {pdfPreviewUrl ? (
              <iframe
                title="SoC PDF preview"
                src={pdfPreviewUrl}
                className="h-[560px] w-full rounded-lg border border-slate-200 bg-slate-50"
              />
            ) : (
              <div className="flex h-[560px] items-center justify-center text-sm text-slate-500">
                PDF no disponible.
              </div>
            )}
          </div>

          {/* Form envio */}
          <div className="lg:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Send className="h-4 w-4" />
              Enviar al cliente
            </h3>
            <p className="mt-1 text-xs text-amber-700">
              Al enviar se firma HMAC la liberacion, se dispara el workflow n8n
              que manda el email y se transita el proyecto a &quot;entregado&quot;.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <label className="block text-xs font-medium text-slate-700">
                Destinatario (email)
                <input
                  type="email"
                  value={formRecipientEmail}
                  onChange={(e) => setFormRecipientEmail(e.target.value)}
                  placeholder="cliente@empresa.com"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                Nombre del destinatario
                <input
                  type="text"
                  value={formRecipientName}
                  onChange={(e) => setFormRecipientName(e.target.value)}
                  placeholder="Nombre (opcional)"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                CC (separados por coma)
                <input
                  type="text"
                  value={formCcEmails}
                  onChange={(e) => setFormCcEmails(e.target.value)}
                  placeholder="a@x.com, b@y.com"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                Asunto
                <input
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                Mensaje
                <Textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  rows={6}
                  className="mt-1 bg-white"
                />
              </label>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={submitting !== null || !canSend}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                  title={canSend ? 'Enviar al cliente' : 'Primero pulsa "Preparar entrega"'}
                >
                  {submitting === 'send' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Enviar entrega
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Esperando cliente */}
      {isAwaitingClient && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 text-amber-500" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                Esperando confirmacion del cliente
              </h3>
              <p className="mt-1 text-xs text-amber-700">
                El Statement of Compliance ya se envio. Cuando el cliente pulse
                el enlace de confirmacion en el email, el proyecto avanzara a
                &quot;confirmacion cliente&quot;.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Confirmado */}
      {isConfirmed && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
            <div>
              <h3 className="text-sm font-semibold text-emerald-900">
                Cliente confirmo recepcion
              </h3>
              <p className="mt-1 text-xs text-emerald-700">
                La evidencia no repudiable queda archivada. El proyecto puede
                pasar a cierre en el siguiente paso.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Timeline de entregas */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Box className="h-3.5 w-3.5" />
          Historial de entregas
        </h3>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        ) : deliveries.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aun no hay entregas registradas para este proyecto.
          </p>
        ) : (
          <ol className="space-y-3">
            {deliveries.map((d) => {
              const cfg = DISPATCH_STATUS_LABEL[d.dispatch_status] ?? {
                label: d.dispatch_status,
                cls: 'bg-slate-50 text-slate-700 border-slate-200',
                icon: Clock,
              }
              const Icon = cfg.icon
              return (
                <li
                  key={d.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/40 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}
                    >
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {formatDateTime(d.created_at)}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-1 gap-1 text-xs text-slate-600 md:grid-cols-2">
                    <div>
                      <strong className="text-slate-500">Destinatario:</strong>{' '}
                      {d.recipient_email}
                    </div>
                    <div>
                      <strong className="text-slate-500">Asunto:</strong>{' '}
                      {d.subject}
                    </div>
                    {d.dispatched_at && (
                      <div>
                        <strong className="text-slate-500">Enviado:</strong>{' '}
                        {formatDateTime(d.dispatched_at)}
                      </div>
                    )}
                    {d.client_confirmed_at && (
                      <div>
                        <strong className="text-slate-500">Confirmado:</strong>{' '}
                        {formatDateTime(d.client_confirmed_at)}
                      </div>
                    )}
                    {d.soc_pdf_sha256 && (
                      <div className="md:col-span-2 truncate font-mono text-[10px] text-slate-500">
                        SHA-256: {d.soc_pdf_sha256}
                      </div>
                    )}
                  </div>
                  {d.soc_pdf_storage_path && (
                    <a
                      href={`/api/proyectos/${proyectoId}/deliveries/${d.id}/soc-pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-600"
                    >
                      <FileText className="h-3 w-3" />
                      Abrir PDF
                    </a>
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
