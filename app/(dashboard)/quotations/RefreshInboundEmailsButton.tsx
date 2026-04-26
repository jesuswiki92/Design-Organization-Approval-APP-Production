'use client'

/**
 * ============================================================================
 * BOTON MANUAL DE REFRESCO DE CORREOS ENTRANTES
 * ============================================================================
 * Llama al endpoint GET /api/automations/inbound-email/run y muestra un toast
 * con el resultado. Pensado para disparar la automatizacion sin esperar al
 * cron (aun no programado). Es puramente aditivo: no modifica la UI base.
 * ============================================================================
 */

import { useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'

type InboundEmailRunResponse = {
  ok: boolean
  count?: number
  error?: string
}

export function RefreshInboundEmailsButton() {
  const [loading, setLoading] = useState<boolean>(false)

  async function handleClick(): Promise<void> {
    setLoading(true)
    try {
      const res = await fetch('/api/automations/inbound-email/run', {
        method: 'GET',
      })
      const json = (await res.json()) as InboundEmailRunResponse

      if (!res.ok || json.ok !== true) {
        toast.error(`Error al leer correos: ${json.error ?? res.statusText}`)
        return
      }

      const count = json.count ?? 0
      if (count === 0) {
        toast.info('Sin correos nuevos')
      } else {
        toast.success(`${count} correo(s) nuevo(s) detectado(s)`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Error al leer correos: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center rounded-xl border border-[color:var(--line)] bg-transparent px-4 py-2 text-sm font-semibold text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      Actualizar correos
    </button>
  )
}
