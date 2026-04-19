/**
 * ============================================================================
 * BOTONES DE CONTEO DE HORAS DE PROYECTO (PUNCH-CLOCK)
 * ============================================================================
 *
 * Dos botones siempre visibles:
 *   - "Iniciar" (verde): crea una fila nueva con inicio = ahora
 *   - "Parar" (rojo): actualiza la fila abierta con fin = ahora + duracion
 *
 * Una fila en conteo_horas_proyectos = una sesion de trabajo.
 * Al iniciar: INSERT {proyecto_id, numero_proyecto, inicio}.
 * Al parar: n8n busca la fila con fin=null y hace UPDATE {fin, duracion_minutos}.
 *
 * El estado se determina consultando la ultima fila del proyecto:
 *   - Si fin IS NULL → timer corriendo (Iniciar deshabilitado, Parar activo)
 *   - Si fin IS NOT NULL o no hay filas → parado (Iniciar activo, Parar deshabilitado)
 *
 * Incluye Realtime para sincronizar entre usuarios.
 * ============================================================================
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import type { ConteoHorasProyecto } from '@/types/database'

// --- TIPOS ---

interface ProjectTimerButtonProps {
  proyectoId: string
  numeroProyecto: string
}

// --- UTILIDADES ---

function formatElapsed(ms: number): string {
  if (ms < 0) return '0m'
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

// --- COMPONENTE ---

export function ProjectTimerButton({ proyectoId, numeroProyecto }: ProjectTimerButtonProps) {
  // null = cargando, 'stopped' = parado, 'running' = en marcha
  const [timerState, setTimerState] = useState<'stopped' | 'running' | null>(null)
  // Fecha/hora del inicio de la sesion abierta (para calcular elapsed)
  const [startTime, setStartTime] = useState<Date | null>(null)
  // Texto del tiempo transcurrido (actualizado cada segundo)
  const [elapsedText, setElapsedText] = useState('0m')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [saving, setSaving] = useState(false)

  // --- Cargar estado inicial: buscar ultima fila del proyecto ---
  useEffect(() => {
    const supabase = createClient()

    async function fetchLastEntry() {
      const { data, error } = await supabase
        .from('conteo_horas_proyectos')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .order('inicio', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Error cargando estado del temporizador:', error)
        setTimerState('stopped')
        return
      }

      if (!data || data.length === 0) {
        setTimerState('stopped')
        return
      }

      const last = data[0] as ConteoHorasProyecto
      if (last.fin === null) {
        // Sesion abierta
        setTimerState('running')
        setStartTime(new Date(last.inicio))
      } else {
        setTimerState('stopped')
        setStartTime(null)
      }
    }

    void fetchLastEntry()
  }, [proyectoId])

  // --- Intervalo para actualizar elapsed ---
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (timerState === 'running' && startTime) {
      setElapsedText(formatElapsed(Date.now() - startTime.getTime()))
      intervalRef.current = setInterval(() => {
        setElapsedText(formatElapsed(Date.now() - startTime.getTime()))
      }, 1_000)
    } else {
      setElapsedText('0m')
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [timerState, startTime])

  // --- Suscripcion Realtime (INSERT + UPDATE) ---
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`timer-${proyectoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conteo_horas_proyectos',
          filter: `proyecto_id=eq.${proyectoId}`,
        },
        (payload) => {
          const entry = payload.new as ConteoHorasProyecto
          if (entry.fin === null) {
            setTimerState('running')
            setStartTime(new Date(entry.inicio))
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conteo_horas_proyectos',
          filter: `proyecto_id=eq.${proyectoId}`,
        },
        (payload) => {
          const entry = payload.new as ConteoHorasProyecto
          if (entry.fin !== null) {
            setTimerState('stopped')
            setStartTime(null)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [proyectoId])

  // --- Handler INICIAR ---
  const handleStart = useCallback(async () => {
    if (saving || timerState === 'running') return
    setSaving(true)

    const now = new Date().toISOString()

    // Optimista
    setTimerState('running')
    setStartTime(new Date(now))

    try {
      const res = await fetch('/api/webhooks/conteo-horas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          numero_proyecto: numeroProyecto,
          tipo: 'inicio',
          fecha_hora: now,
        }),
      })

      if (!res.ok) throw new Error(`Webhook error: ${res.status}`)
    } catch (err) {
      console.error('Error al iniciar temporizador:', err)
      setTimerState('stopped')
      setStartTime(null)
    }

    setSaving(false)
  }, [saving, timerState, proyectoId, numeroProyecto])

  // --- Handler PARAR ---
  const handleStop = useCallback(async () => {
    if (saving || timerState === 'stopped') return
    setSaving(true)

    const now = new Date().toISOString()
    const prevStartTime = startTime

    // Optimista
    setTimerState('stopped')
    setStartTime(null)

    try {
      const res = await fetch('/api/webhooks/conteo-horas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          numero_proyecto: numeroProyecto,
          tipo: 'fin',
          fecha_hora: now,
        }),
      })

      if (!res.ok) throw new Error(`Webhook error: ${res.status}`)
    } catch (err) {
      console.error('Error al parar temporizador:', err)
      setTimerState('running')
      setStartTime(prevStartTime)
    }

    setSaving(false)
  }, [saving, timerState, startTime, proyectoId, numeroProyecto])

  // --- Render: cargando ---
  if (timerState === null) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-7 w-16 animate-pulse rounded-full bg-slate-100" />
        <div className="h-7 w-16 animate-pulse rounded-full bg-slate-100" />
      </div>
    )
  }

  const isRunning = timerState === 'running'

  return (
    <div className="flex items-center gap-1.5">
      {/* BOTON INICIAR */}
      <button
        type="button"
        onClick={handleStart}
        disabled={saving || isRunning}
        title="Iniciar conteo"
        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Play size={10} />
        Iniciar
      </button>

      {/* BOTON PARAR */}
      <button
        type="button"
        onClick={handleStop}
        disabled={saving || !isRunning}
        title="Parar conteo"
        className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Square size={9} />
        Parar
      </button>

      {/* TIEMPO TRANSCURRIDO (solo visible cuando esta corriendo) */}
      {isRunning && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {elapsedText}
        </span>
      )}
    </div>
  )
}
