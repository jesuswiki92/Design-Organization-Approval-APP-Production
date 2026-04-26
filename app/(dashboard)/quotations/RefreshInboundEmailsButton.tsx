'use client'

/**
 * ============================================================================
 * BOTON MANUAL DE REFRESCO DE CORREOS ENTRANTES
 * ============================================================================
 * Llama al endpoint GET /api/automations/inbound-email/run y muestra un toast
 * con el resultado del procesado (clasificacion + insert + mark-as-read).
 * Tras un procesado correcto, dispara router.refresh() para que la nueva
 * tarjeta aparezca en el tablero sin recargar la pagina.
 * ============================================================================
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'

type InboundEmailRunResponse = {
  ok: boolean
  processed?: number
  errors?: { messageId: string; error: string }[]
  error?: string
}

export function RefreshInboundEmailsButton() {
  const [loading, setLoading] = useState<boolean>(false)
  const router = useRouter()

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

      const processed = json.processed ?? 0
      const errorCount = json.errors?.length ?? 0

      if (processed === 0 && errorCount === 0) {
        toast.info('Sin correos nuevos')
      } else if (processed > 0 && errorCount === 0) {
        toast.success(`${processed} correo(s) procesado(s)`)
      } else if (errorCount > 0) {
        toast.warning(`${processed} procesado(s), ${errorCount} fallo(s)`)
      }

      // Refrescar el server component de /quotations para mostrar las nuevas
      // tarjetas. Inocuo cuando processed === 0 (vuelve a cargar lo mismo).
      router.refresh()
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
