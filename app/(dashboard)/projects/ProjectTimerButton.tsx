/**
 * ============================================================================
 * BOTONES DE CONTEO DE HORAS DE PROYECTO (PUNCH-CLOCK) — UI ONLY
 * ============================================================================
 *
 * Frame visual del temporizador. Sin Supabase, sin webhook, sin Realtime.
 * Los botones siguen visibles y muestran toast 'Acción desconectada' al pulsar.
 * ============================================================================
 */

'use client'

import { useState } from 'react'
import { Play, Square } from 'lucide-react'
import { toast } from 'sonner'

interface ProjectTimerButtonProps {
  proyectoId: string
  numeroProyecto: string
}

export function ProjectTimerButton({ proyectoId: _proyectoId, numeroProyecto: _numeroProyecto }: ProjectTimerButtonProps) {
  const [isRunning, setIsRunning] = useState(false)

  function handleStart() {
    if (isRunning) return
    setIsRunning(true)
    toast.info('Acción desconectada')
  }

  function handleStop() {
    if (!isRunning) return
    setIsRunning(false)
    toast.info('Acción desconectada')
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleStart}
        disabled={isRunning}
        title="Iniciar conteo"
        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Play size={10} />
        Iniciar
      </button>

      <button
        type="button"
        onClick={handleStop}
        disabled={!isRunning}
        title="Parar conteo"
        className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Square size={9} />
        Parar
      </button>

      {isRunning && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[color:var(--ink-3)]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          0m
        </span>
      )}
    </div>
  )
}
