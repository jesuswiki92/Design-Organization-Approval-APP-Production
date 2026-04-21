'use client'

/**
 * ============================================================================
 * SELECTOR DE ESTADO DEL PIPELINE DE COTIZACIONES
 * ============================================================================
 *
 * Componente reutilizable que muestra un desplegable con todos los estados
 * del pipeline de cotizaciones (10 estados). Al cambiar el estado, llama
 * al webhook de n8n que actualiza Supabase. La app lee el estado desde
 * Supabase (mismo patron que el cambio de estado de proyectos).
 *
 * Se usa en:
 * - Las tarjetas del tablero Kanban (QuotationStatesBoard)
 * - La pagina de detalle de consulta entrante (incoming/[id])
 * ============================================================================
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  QUOTATION_BOARD_STATE_CONFIG,
  QUOTATION_BOARD_STATES,
} from '@/lib/workflow-states'

type QuotationStateSelectorProps = {
  consultaId: string
  consultaCodigo: string
  currentEstado: string
}

const BOARD_STATE_OPTIONS = Object.entries(QUOTATION_BOARD_STATES).map(
  ([, code]) => ({
    value: code,
    label: QUOTATION_BOARD_STATE_CONFIG[code].label,
  }),
)

export function QuotationStateSelector({
  consultaId,
  consultaCodigo,
  currentEstado,
}: QuotationStateSelectorProps) {
  const router = useRouter()
  const [selectedState, setSelectedState] = useState(currentEstado)
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    setSelectedState(currentEstado)
    setStatus('idle')
    setMessage(null)
  }, [currentEstado])

  async function handleChange(nextState: string) {
    if (!nextState || nextState === selectedState) return

    const previousState = selectedState
    setSelectedState(nextState)
    setStatus('saving')
    setMessage(null)

    try {
      const response = await fetch('/api/webhooks/quotation-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consulta_id: consultaId,
          consulta_codigo: consultaCodigo,
          estado_anterior: previousState,
          estado_nuevo: nextState,
          fecha_hora: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error('El webhook devolvio un error.')
      }

      setStatus('idle')
      startTransition(() => router.refresh())
    } catch (error) {
      setSelectedState(previousState)
      setStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'Error al cambiar el estado.',
      )
    }
  }

  return (
    <div className="relative z-20 space-y-0.5 overflow-visible">
      <label className="sr-only" htmlFor={`quotation-state-${consultaId}`}>
        Cambiar estado en el pipeline
      </label>
      <select
        id={`quotation-state-${consultaId}`}
        value={selectedState}
        disabled={status === 'saving'}
        onChange={(event) => void handleChange(event.target.value)}
        className="relative z-20 h-8 w-full truncate rounded-md border border-[color:var(--line-strong)] bg-[color:var(--paper-2)] px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink)] shadow-[0_1px_0_rgba(255,255,255,0.6)_inset] outline-none transition-colors hover:border-[color:var(--umber)] focus:border-[color:var(--umber)] focus:ring-2 focus:ring-[color:var(--umber)]/20 disabled:cursor-wait disabled:opacity-70 [color-scheme:light]"
      >
        {BOARD_STATE_OPTIONS.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-[color:var(--paper-2)] text-[color:var(--ink)]"
          >
            {option.label}
          </option>
        ))}
      </select>
      {status === 'saving' ? (
        <p className="text-[10px] text-[color:var(--ink-3)]">Guardando...</p>
      ) : null}
      {message ? (
        <p className="text-[10px] text-rose-500 line-clamp-1">{message}</p>
      ) : null}
    </div>
  )
}
