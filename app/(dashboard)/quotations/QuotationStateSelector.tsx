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
      const webhookUrl =
        process.env.NEXT_PUBLIC_DOA_QUOTATION_STATE_WEBHOOK_URL
      if (!webhookUrl) {
        throw new Error(
          'Webhook de cambio de estado de cotizaciones no configurado.',
        )
      }

      const response = await fetch(webhookUrl, {
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
    <div className="space-y-0.5">
      <label className="sr-only" htmlFor={`quotation-state-${consultaId}`}>
        Cambiar estado en el pipeline
      </label>
      <select
        id={`quotation-state-${consultaId}`}
        value={selectedState}
        disabled={status === 'saving'}
        onChange={(event) => void handleChange(event.target.value)}
        className="h-7 w-full truncate rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 outline-none transition-colors hover:border-sky-300 focus:border-sky-300 focus:ring-2 focus:ring-sky-100 disabled:cursor-wait disabled:opacity-70"
      >
        {BOARD_STATE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {status === 'saving' ? (
        <p className="text-[10px] text-slate-400">Guardando...</p>
      ) : null}
      {message ? (
        <p className="text-[10px] text-rose-500 line-clamp-1">{message}</p>
      ) : null}
    </div>
  )
}
