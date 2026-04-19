'use client'

/**
 * Panel de decision para la pagina de detalle de consulta entrante.
 *
 * Muestra tres CTAs conectados a los endpoints reales:
 *  - "Crear proyecto"      -> POST /api/consultas/[id]/abrir-proyecto
 *  - "Solicitar mas info"  -> PATCH /api/consultas/[id]/state con estado `formulario_enviado`
 *  - "Rechazar"            -> PATCH /api/consultas/[id]/state con estado `oferta_rechazada`
 *
 * Todos los CTAs marcan loading, refrescan la pagina via router.refresh() tras
 * exito y muestran errores con contexto.
 */

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, MessageSquarePlus, XCircle } from 'lucide-react'

import { QUOTATION_BOARD_STATES } from '@/lib/workflow-states'

type Props = {
  consultaId: string
}

type Action = 'crear_proyecto' | 'solicitar_info' | 'rechazar'

export function DecisionPanel({ consultaId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busy, setBusy] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleCrearProyecto() {
    if (busy) return
    setBusy('crear_proyecto')
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/consultas/${consultaId}/abrir-proyecto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = (await res.json().catch(() => null)) as
        | { id?: string; numero_proyecto?: string; error?: string }
        | null

      if (!res.ok) {
        throw new Error(data?.error ?? 'No se pudo crear el proyecto.')
      }

      setNotice(
        `Proyecto ${data?.numero_proyecto ?? ''} creado. Redirigiendo...`.trim(),
      )
      const targetHref = data?.id
        ? `/engineering/projects/${data.id}`
        : '/engineering'
      startTransition(() => {
        router.refresh()
        router.push(targetHref)
      })
    } catch (err) {
      console.error('DecisionPanel crear-proyecto error:', err)
      setError(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setBusy(null)
    }
  }

  async function handleSolicitarInfo() {
    if (busy) return
    setBusy('solicitar_info')
    setError(null)
    setNotice(null)
    try {
      // No existe endpoint de texto libre; reutilizamos el PATCH de estado
      // para mover la consulta a `formulario_enviado` (equivalente a esperando
      // info del cliente). La redaccion y envio del correo se hace desde el
      // hilo de emails una vez la consulta este en ese estado.
      const res = await fetch(`/api/consultas/${consultaId}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: QUOTATION_BOARD_STATES.FORMULARIO_ENVIADO,
        }),
      })
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null
      if (!res.ok) {
        throw new Error(
          data?.error ?? 'No se pudo transicionar la consulta.',
        )
      }
      setNotice(
        'Consulta marcada como "Formulario enviado. Esperando respuesta".',
      )
      startTransition(() => router.refresh())
    } catch (err) {
      console.error('DecisionPanel solicitar-info error:', err)
      setError(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setBusy(null)
    }
  }

  async function handleRechazar() {
    if (busy) return
    const confirmed = window.confirm(
      '¿Seguro que quieres rechazar esta consulta? Se marcara como "Oferta rechazada" y saldra del flujo activo.',
    )
    if (!confirmed) return

    setBusy('rechazar')
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/consultas/${consultaId}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: QUOTATION_BOARD_STATES.OFERTA_RECHAZADA,
        }),
      })
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null
      if (!res.ok) {
        throw new Error(data?.error ?? 'No se pudo rechazar la consulta.')
      }
      setNotice('Consulta rechazada correctamente.')
      startTransition(() => router.refresh())
    } catch (err) {
      console.error('DecisionPanel rechazar error:', err)
      setError(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setBusy(null)
    }
  }

  const disabled = busy !== null || isPending

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
      <h2 className="text-sm font-semibold text-slate-950">Panel de decision</h2>
      <p className="mt-1 text-xs text-slate-500">
        Revisa toda la informacion y decide como proceder con esta consulta.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleCrearProyecto}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === 'crear_proyecto' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Crear proyecto
        </button>

        <button
          type="button"
          onClick={handleSolicitarInfo}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-700 shadow-sm transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === 'solicitar_info' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageSquarePlus className="h-4 w-4" />
          )}
          Solicitar mas informacion
        </button>

        <button
          type="button"
          onClick={handleRechazar}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === 'rechazar' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          Rechazar
        </button>
      </div>

      {notice ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{notice}</span>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </section>
  )
}

export default DecisionPanel
