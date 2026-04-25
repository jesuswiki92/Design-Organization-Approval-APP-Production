'use client'

/**
 * ============================================================================
 * SELECTOR DE ESTADO DEL PIPELINE DE COTIZACIONES
 * ============================================================================
 *
 * Componente reutilizable que muestra un desplegable con todos los statuses
 * del pipeline de cotizaciones (10 statuses). Al cambiar el status, llama
 * al webhook de n8n que actualiza Supabase. La app lee el status desde
 * Supabase (mismo patron que el cambio de status de projects).
 *
 * Se usa en:
 * - Las tarjetas del tablero Kanban (QuotationStatesBoard)
 * - La page de detalle de request entrante (incoming/[id])
 * ============================================================================
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

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
  consultaCodigo: _consultaCodigo,
  currentEstado,
}: QuotationStateSelectorProps) {
  const [selectedState, setSelectedState] = useState(currentEstado)
  const [status] = useState<'idle' | 'saving' | 'error'>('idle')
  const [message] = useState<string | null>(null)

  useEffect(() => {
    setSelectedState(currentEstado)
  }, [currentEstado])

  function handleChange(nextState: string) {
    if (!nextState || nextState === selectedState) return
    setSelectedState(nextState)
    toast.info('Acción desconectada')
  }

  return (
    <div className="relative z-20 space-y-0.5 overflow-visible">
      <label className="sr-only" htmlFor={`quotation-state-${consultaId}`}>
        Cambiar status en el pipeline
      </label>
      <select
        id={`quotation-state-${consultaId}`}
        value={selectedState}
        disabled={status === 'saving'}
        onChange={(event) => handleChange(event.target.value)}
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
