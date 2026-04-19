/**
 * ============================================================================
 * COMPONENTE VISUAL DE DETALLE DE UN PROYECTO CON REGISTRO DE HORAS
 * ============================================================================
 *
 * Muestra la cabecera del proyecto y una seccion completa de registro de horas
 * con tabla editable, resumen de metricas y suscripcion Realtime.
 *
 * Funcionalidades:
 *   - Cabecera con datos clave del proyecto
 *   - Resumen de horas (total, sesiones, media)
 *   - Tabla de entradas de horas con edicion inline y borrado
 *   - Boton de temporizador (ProjectTimerButton)
 *   - Realtime: INSERT, UPDATE, DELETE en conteo_horas_proyectos
 * ============================================================================
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Pencil,
  Save,
  Trash2,
  X,
  Hash,
  User,
  Plane,
  Briefcase,
} from 'lucide-react'

import { trackUiEvent } from '@/lib/observability/client'
import { createClient } from '@/lib/supabase/client'
import type { Proyecto, ConteoHorasProyecto } from '@/types/database'
import { ProjectTimerButton } from '@/app/(dashboard)/proyectos/ProjectTimerButton'
import { PrecedentesSection } from './PrecedentesSection'
import { DeliverablesTab } from './DeliverablesTab'
import { ValidationTab } from './ValidationTab'
import { DeliveryTab } from './DeliveryTab'
import { ClosureTab } from './ClosureTab'
import { ProjectStateStepper } from '@/components/project/ProjectStateStepper'
import {
  isProjectExecutionStateCode,
  type ProjectExecutionState,
} from '@/lib/workflow-states'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// --- UTILIDADES ---

/** Formatea minutos a "Xh Ym" */
function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** Calcula duracion en minutos entre dos fechas ISO */
function calcMinutes(inicio: string, fin: string): number {
  const diff = new Date(fin).getTime() - new Date(inicio).getTime()
  return Math.max(0, diff / 60_000)
}

/** Formatea una fecha ISO a dd/mm/yyyy en zona local */
function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Formatea una fecha ISO a HH:mm en zona local */
function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

/** Convierte ISO a formato datetime-local para el input */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Mapa de colores por estado */
const ESTADO_COLORS: Record<string, string> = {
  nuevo: 'bg-sky-100 text-sky-700 border-sky-200',
  en_progreso: 'bg-blue-100 text-blue-700 border-blue-200',
  revision: 'bg-amber-100 text-amber-700 border-amber-200',
  aprobacion: 'bg-violet-100 text-violet-700 border-violet-200',
  entregado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cerrado: 'bg-slate-100 text-slate-600 border-slate-200',
  activo: 'bg-blue-100 text-blue-700 border-blue-200',
  oferta: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  en_revision: 'bg-amber-100 text-amber-700 border-amber-200',
  en_pausa: 'bg-orange-100 text-orange-700 border-orange-200',
  cancelado: 'bg-red-100 text-red-700 border-red-200',
}

/** Traduce el estado a texto legible */
const ESTADO_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  en_progreso: 'En progreso',
  revision: 'Revision',
  aprobacion: 'Aprobacion',
  entregado: 'Entregado',
  cerrado: 'Cerrado',
  activo: 'Activo',
  oferta: 'Oferta',
  en_revision: 'En revision',
  en_pausa: 'En pausa',
  cancelado: 'Cancelado',
  pendiente_aprobacion_cve: 'Pendiente CVE',
  pendiente_aprobacion_easa: 'Pendiente EASA',
  guardado_en_base_de_datos: 'Archivado',
}

// --- COMPONENTE PRINCIPAL ---

export function ProjectDetailClient({
  project,
  timeEntries: initialEntries,
}: {
  project: Proyecto
  timeEntries: ConteoHorasProyecto[]
}) {
  const [entries, setEntries] = useState<ConteoHorasProyecto[]>(initialEntries)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editInicio, setEditInicio] = useState('')
  const [editFin, setEditFin] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Referencia para calcular duracion en vivo de sesiones abiertas
  const [now, setNow] = useState(Date.now())
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Hay alguna sesion abierta?
  const hasOpenSession = entries.some((e) => e.fin === null)

  // Intervalo para actualizar "now" cada segundo si hay sesion abierta
  useEffect(() => {
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current)
      liveIntervalRef.current = null
    }

    if (hasOpenSession) {
      liveIntervalRef.current = setInterval(() => setNow(Date.now()), 1_000)
    }

    return () => {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current)
        liveIntervalRef.current = null
      }
    }
  }, [hasOpenSession])

  // --- Suscripcion Realtime ---
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`project-hours-${project.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conteo_horas_proyectos',
          filter: `proyecto_id=eq.${project.id}`,
        },
        (payload) => {
          const newEntry = payload.new as ConteoHorasProyecto
          setEntries((prev) => {
            // Evitar duplicados
            if (prev.some((e) => e.id === newEntry.id)) return prev
            // Insertar al principio (ordenado por inicio DESC)
            return [newEntry, ...prev]
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conteo_horas_proyectos',
          filter: `proyecto_id=eq.${project.id}`,
        },
        (payload) => {
          const updated = payload.new as ConteoHorasProyecto
          setEntries((prev) =>
            prev.map((e) => (e.id === updated.id ? updated : e)),
          )
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'conteo_horas_proyectos',
          filter: `proyecto_id=eq.${project.id}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id
          setEntries((prev) => prev.filter((e) => e.id !== deletedId))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [project.id])

  // --- Metricas de resumen ---
  const totalMinutes = entries.reduce((acc, e) => {
    if (e.duracion_minutos !== null) return acc + e.duracion_minutos
    if (e.fin === null) {
      // Sesion abierta: calcular en vivo
      return acc + (now - new Date(e.inicio).getTime()) / 60_000
    }
    return acc
  }, 0)

  const completedSessions = entries.filter((e) => e.fin !== null).length
  const totalSessions = entries.length
  const avgMinutes = completedSessions > 0
    ? entries
        .filter((e) => e.duracion_minutos !== null)
        .reduce((acc, e) => acc + (e.duracion_minutos ?? 0), 0) / completedSessions
    : 0

  // --- Handlers de edicion ---
  const startEdit = useCallback((entry: ConteoHorasProyecto) => {
    setEditingId(entry.id)
    setEditInicio(toDatetimeLocal(entry.inicio))
    setEditFin(entry.fin ? toDatetimeLocal(entry.fin) : '')
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditInicio('')
    setEditFin('')
  }, [])

  const saveEdit = useCallback(async () => {
    if (!editingId || !editInicio) return
    setSavingEdit(true)

    const entry = entries.find((e) => e.id === editingId)
    if (!entry) {
      setSavingEdit(false)
      return
    }

    const newInicio = new Date(editInicio).toISOString()
    const newFin = editFin ? new Date(editFin).toISOString() : null
    const newDuracion = newFin ? calcMinutes(newInicio, newFin) : null

    // Optimista
    const prevEntries = [...entries]
    setEntries((prev) =>
      prev.map((e) =>
        e.id === editingId
          ? { ...e, inicio: newInicio, fin: newFin, duracion_minutos: newDuracion }
          : e,
      ),
    )
    setEditingId(null)

    try {
      const supabase = createClient()
      const updatePayload: Record<string, unknown> = {
        inicio: newInicio,
        fin: newFin,
        duracion_minutos: newDuracion,
      }

      const { error } = await supabase
        .from('conteo_horas_proyectos')
        .update(updatePayload)
        .eq('id', editingId)

      if (error) throw error

      await trackUiEvent({
        eventName: 'time_tracking.entry_update',
        eventCategory: 'time_tracking',
        outcome: 'success',
        route: `/engineering/projects/${project.id}`,
        entityType: 'project',
        entityId: project.id,
        entityCode: project.numero_proyecto,
        metadata: {
          entry_id: editingId,
          duration_minutes: newDuracion,
          has_end_time: Boolean(newFin),
          source: 'browser_supabase',
        },
      })
    } catch (err) {
      console.error('Error al guardar edicion de hora:', err)
      await trackUiEvent({
        eventName: 'time_tracking.entry_update',
        eventCategory: 'time_tracking',
        outcome: 'failure',
        route: `/engineering/projects/${project.id}`,
        entityType: 'project',
        entityId: project.id,
        entityCode: project.numero_proyecto,
        metadata: {
          entry_id: editingId,
          duration_minutes: newDuracion,
          has_end_time: Boolean(newFin),
          error_name: err instanceof Error ? err.name : 'UnknownError',
          source: 'browser_supabase',
        },
      })
      // Revertir
      setEntries(prevEntries)
    }

    setSavingEdit(false)
  }, [editingId, editInicio, editFin, entries, project.id, project.numero_proyecto])

  // --- Handler de borrado ---
  const handleDelete = useCallback(async (entryId: string) => {
    setDeletingId(entryId)

    // Optimista
    const prevEntries = [...entries]
    setEntries((prev) => prev.filter((e) => e.id !== entryId))

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('conteo_horas_proyectos')
        .delete()
        .eq('id', entryId)

      if (error) throw error

      await trackUiEvent({
        eventName: 'time_tracking.entry_delete',
        eventCategory: 'time_tracking',
        outcome: 'success',
        route: `/engineering/projects/${project.id}`,
        entityType: 'project',
        entityId: project.id,
        entityCode: project.numero_proyecto,
        metadata: {
          entry_id: entryId,
          source: 'browser_supabase',
        },
      })
    } catch (err) {
      console.error('Error al borrar entrada de hora:', err)
      await trackUiEvent({
        eventName: 'time_tracking.entry_delete',
        eventCategory: 'time_tracking',
        outcome: 'failure',
        route: `/engineering/projects/${project.id}`,
        entityType: 'project',
        entityId: project.id,
        entityCode: project.numero_proyecto,
        metadata: {
          entry_id: entryId,
          error_name: err instanceof Error ? err.name : 'UnknownError',
          source: 'browser_supabase',
        },
      })
      // Revertir
      setEntries(prevEntries)
    }

    setDeletingId(null)
  }, [entries, project.id, project.numero_proyecto])

  // --- Duracion para una fila (en vivo si abierta) ---
  function getRowDuration(entry: ConteoHorasProyecto): string {
    if (entry.duracion_minutos !== null) return formatDuration(entry.duracion_minutos)
    if (entry.fin === null) {
      // Sesion abierta: calcular en vivo
      const elapsed = (now - new Date(entry.inicio).getTime()) / 60_000
      return formatDuration(elapsed)
    }
    return '-'
  }

  // --- Duracion calculada para el modo edicion ---
  function getEditDuration(): string {
    if (!editInicio || !editFin) return '-'
    const mins = calcMinutes(
      new Date(editInicio).toISOString(),
      new Date(editFin).toISOString(),
    )
    return formatDuration(mins)
  }

  const estadoColor = ESTADO_COLORS[project.estado] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  const estadoLabel = ESTADO_LABELS[project.estado] ?? project.estado

  // Sprint 1/2: el estado_v2 se mantiene en local para reflejar transiciones
  // disparadas desde ValidationTab sin recargar la pagina.
  const [estadoV2, setEstadoV2] = useState<string | null>(project.estado_v2 ?? null)
  const executionState: ProjectExecutionState | null =
    estadoV2 && isProjectExecutionStateCode(estadoV2) ? estadoV2 : null

  // Deep link ?tab=validacion (tambien acepta horas, deliverables, entrega, cierre).
  const searchParams = useSearchParams()
  const initialTab = (() => {
    const t = searchParams.get('tab')
    if (
      t === 'validacion' ||
      t === 'deliverables' ||
      t === 'horas' ||
      t === 'entrega' ||
      t === 'cierre'
    )
      return t
    return 'horas'
  })()
  const [activeTab, setActiveTab] = useState(initialTab)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 pb-8 pt-5">
      {/* Boton volver */}
      <Link
        href="/proyectos"
        className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(37,99,235,0.22)] transition-colors hover:bg-sky-500"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Proyectos
      </Link>

      {/* Cabecera del proyecto */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-900">
                {project.titulo}
              </h1>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${estadoColor}`}>
                {estadoLabel}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" />
                {project.numero_proyecto}
              </span>
              {project.cliente_nombre && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {project.cliente_nombre}
                </span>
              )}
              {project.aeronave && (
                <span className="inline-flex items-center gap-1">
                  <Plane className="h-3.5 w-3.5" />
                  {project.aeronave}
                </span>
              )}
              {project.owner && (
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  {project.owner}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stepper de la maquina de ejecucion v2 (solo si el proyecto ya migro a estado_v2) */}
      {executionState && <ProjectStateStepper currentState={executionState} />}

      {/* Tabs: Horas + Deliverables (Sprint 1) + Validacion (Sprint 2) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList variant="line" className="mb-3 border-b border-slate-200">
          <TabsTrigger value="horas">Horas</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="validacion">Validacion</TabsTrigger>
          <TabsTrigger value="entrega">Entrega</TabsTrigger>
          <TabsTrigger value="cierre">Cierre</TabsTrigger>
        </TabsList>

        <TabsContent value="deliverables">
          <DeliverablesTab
            proyectoId={project.id}
            currentState={estadoV2}
            onStateChange={setEstadoV2}
          />
        </TabsContent>

        <TabsContent value="validacion">
          <ValidationTab
            proyectoId={project.id}
            currentState={estadoV2}
            onStateChange={setEstadoV2}
          />
        </TabsContent>

        <TabsContent value="entrega">
          <DeliveryTab
            proyectoId={project.id}
            proyectoTitulo={project.titulo}
            proyectoNumero={project.numero_proyecto}
            defaultRecipientEmail={null}
            defaultRecipientName={project.cliente_nombre ?? null}
            currentState={estadoV2}
            onStateChange={setEstadoV2}
          />
        </TabsContent>

        <TabsContent value="cierre">
          <ClosureTab
            proyectoId={project.id}
            currentState={estadoV2}
            onStateChange={setEstadoV2}
          />
        </TabsContent>

        <TabsContent value="horas">
      {/* Seccion Registro de Horas */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Header de la seccion */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-slate-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Registro de Horas
            </h2>
          </div>
          <ProjectTimerButton
            proyectoId={project.id}
            numeroProyecto={project.numero_proyecto}
          />
        </div>

        {/* Resumen de metricas */}
        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 px-5 py-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total trabajado
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {formatDuration(totalMinutes)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Sesiones
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {totalSessions}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Media por sesion
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {formatDuration(avgMinutes)}
            </p>
          </div>
        </div>

        {/* Tabla de entradas */}
        {entries.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            No hay sesiones de trabajo registradas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Fecha
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Inicio
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Fin
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Duracion
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const isEditing = editingId === entry.id
                  const isOpen = entry.fin === null
                  const rowBg = isEditing
                    ? 'bg-yellow-50'
                    : idx % 2 === 0
                      ? 'bg-white'
                      : 'bg-slate-50'

                  return (
                    <tr key={entry.id} className={`border-b border-slate-50 ${rowBg}`}>
                      {/* Fecha */}
                      <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-700">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {formatDate(entry.inicio)}
                        </span>
                      </td>

                      {/* Inicio */}
                      <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-700">
                        {isEditing ? (
                          <input
                            type="datetime-local"
                            value={editInicio}
                            onChange={(e) => setEditInicio(e.target.value)}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                          />
                        ) : (
                          formatTime(entry.inicio)
                        )}
                      </td>

                      {/* Fin */}
                      <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-700">
                        {isEditing ? (
                          <input
                            type="datetime-local"
                            value={editFin}
                            onChange={(e) => setEditFin(e.target.value)}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                          />
                        ) : isOpen ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            En curso
                          </span>
                        ) : (
                          formatTime(entry.fin!)
                        )}
                      </td>

                      {/* Duracion */}
                      <td className="whitespace-nowrap px-5 py-3 text-sm font-medium text-slate-900">
                        {isEditing ? (
                          <span className="text-slate-500">{getEditDuration()}</span>
                        ) : (
                          getRowDuration(entry)
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="whitespace-nowrap px-5 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={savingEdit}
                              title="Guardar"
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                            >
                              <Save className="h-3 w-3" />
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              title="Cancelar"
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                            >
                              <X className="h-3 w-3" />
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(entry)}
                              disabled={editingId !== null}
                              title="Editar"
                              className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(entry.id)}
                              disabled={deletingId !== null}
                              title="Eliminar"
                              className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Seccion Proyectos similares (precedentes) */}
      <PrecedentesSection projectId={project.id} projectNumber={project.numero_proyecto} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
