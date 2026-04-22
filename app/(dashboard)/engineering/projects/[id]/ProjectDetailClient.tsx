/**
 * ============================================================================
 * COMPONENTE VISUAL DE DETALLE DE UN PROYECTO CON REGISTRO DE HORAS
 * ============================================================================
 *
 * Muestra la cabecera del project y una seccion completa de registro de horas
 * con table editable, resumen de metricas y suscripcion Realtime.
 *
 * Funcionalidades:
 *   - Cabecera con data clave del project
 *   - Resumen de horas (total, sesiones, medium)
 *   - Table de entradas de horas con edicion inline y borrado
 *   - Boton de temporizador (ProjectTimerButton)
 *   - Realtime: INSERT, UPDATE, DELETE en doa_project_time_entries
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
  FolderOpen,
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
import type { Project, ProjectTimeEntry } from '@/types/database'
import { ProjectTimerButton } from '@/app/(dashboard)/projects/ProjectTimerButton'
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

/** Calcula duracion en minutos entre dos dates ISO */
function calcMinutes(started_at: string, ended_at: string): number {
  const diff = new Date(ended_at).getTime() - new Date(started_at).getTime()
  return Math.max(0, diff / 60_000)
}

/** Formatea una date ISO a dd/mm/yyyy en zona local */
function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Formatea una date ISO a HH:mm en zona local */
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

/** Mapa de colores por status */
const ESTADO_COLORS: Record<string, string> = {
  new: 'bg-[color:var(--paper-2)] text-[color:var(--ink-2)] border-[color:var(--ink-4)]',
  in_progress: 'bg-[color:var(--paper-2)] text-[color:var(--ink-2)] border-[color:var(--ink-4)]',
  review: 'bg-amber-100 text-amber-700 border-amber-200',
  approval: 'bg-[color:var(--paper-2)] text-[color:var(--ink-2)] border-[color:var(--ink-4)]',
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  closed: 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)] border-[color:var(--ink-4)]',
  is_active: 'bg-[color:var(--paper-2)] text-[color:var(--ink-2)] border-[color:var(--ink-4)]',
  quote: 'bg-[color:var(--paper-2)] text-[color:var(--ink-2)] border-[color:var(--ink-4)]',
  in_review: 'bg-amber-100 text-amber-700 border-amber-200',
  paused: 'bg-orange-100 text-orange-700 border-orange-200',
  canceled: 'bg-red-100 text-red-700 border-red-200',
}

/** Traduce el status a text legible */
const ESTADO_LABELS: Record<string, string> = {
  new: 'New',
  in_progress: 'En progreso',
  review: 'Review',
  approval: 'Approval',
  delivered: 'Delivered',
  closed: 'Closed',
  is_active: 'Active',
  quote: 'Oferta',
  in_review: 'En review',
  paused: 'En pausa',
  canceled: 'Cancelado',
  pending_cve_approval: 'Pending CVE',
  pending_easa_approval: 'Pending EASA',
  saved_to_database: 'Archived',
}

// --- COMPONENTE PRINCIPAL ---

export function ProjectDetailClient({
  project,
  timeEntries: initialEntries,
}: {
  project: Project
  timeEntries: ProjectTimeEntry[]
}) {
  const [entries, setEntries] = useState<ProjectTimeEntry[]>(initialEntries)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editInicio, setEditInicio] = useState('')
  const [editFin, setEditFin] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Referencia para calcular duracion en vivo de sesiones abiertas
  const [now, setNow] = useState(Date.now())
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Hay alguna sesion abierta?
  const hasOpenSession = entries.some((e) => e.ended_at === null)

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
          table: 'doa_project_time_entries',
          filter: `project_id=eq.${project.id}`,
        },
        (payload) => {
          const newEntry = payload.new as ProjectTimeEntry
          setEntries((prev) => {
            // Evitar duplicados
            if (prev.some((e) => e.id === newEntry.id)) return prev
            // Insertar al principio (ordenado por started_at DESC)
            return [newEntry, ...prev]
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'doa_project_time_entries',
          filter: `project_id=eq.${project.id}`,
        },
        (payload) => {
          const updated = payload.new as ProjectTimeEntry
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
          table: 'doa_project_time_entries',
          filter: `project_id=eq.${project.id}`,
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
    if (e.duration_minutes !== null) return acc + e.duration_minutes
    if (e.ended_at === null) {
      // Sesion abierta: calcular en vivo
      return acc + (now - new Date(e.started_at).getTime()) / 60_000
    }
    return acc
  }, 0)

  const completedSessions = entries.filter((e) => e.ended_at !== null).length
  const totalSessions = entries.length
  const avgMinutes = completedSessions > 0
    ? entries
        .filter((e) => e.duration_minutes !== null)
        .reduce((acc, e) => acc + (e.duration_minutes ?? 0), 0) / completedSessions
    : 0

  // --- Handlers de edicion ---
  const startEdit = useCallback((entry: ProjectTimeEntry) => {
    setEditingId(entry.id)
    setEditInicio(toDatetimeLocal(entry.started_at))
    setEditFin(entry.ended_at ? toDatetimeLocal(entry.ended_at) : '')
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
          ? { ...e, started_at: newInicio, ended_at: newFin, duration_minutes: newDuracion }
          : e,
      ),
    )
    setEditingId(null)

    try {
      const supabase = createClient()
      const updatePayload: Record<string, unknown> = {
        started_at: newInicio,
        ended_at: newFin,
        duration_minutes: newDuracion,
      }

      const { error } = await supabase
        .from('doa_project_time_entries')
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
        entityCode: project.project_number,
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
        entityCode: project.project_number,
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
  }, [editingId, editInicio, editFin, entries, project.id, project.project_number])

  // --- Handler de borrado ---
  const handleDelete = useCallback(async (entryId: string) => {
    setDeletingId(entryId)

    // Optimista
    const prevEntries = [...entries]
    setEntries((prev) => prev.filter((e) => e.id !== entryId))

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('doa_project_time_entries')
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
        entityCode: project.project_number,
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
        entityCode: project.project_number,
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
  }, [entries, project.id, project.project_number])

  // --- Duracion para una fila (en vivo si abierta) ---
  function getRowDuration(entry: ProjectTimeEntry): string {
    if (entry.duration_minutes !== null) return formatDuration(entry.duration_minutes)
    if (entry.ended_at === null) {
      // Sesion abierta: calcular en vivo
      const elapsed = (now - new Date(entry.started_at).getTime()) / 60_000
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

  const estadoColor = ESTADO_COLORS[project.status] ?? 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)] border-[color:var(--ink-4)]'
  const estadoLabel = ESTADO_LABELS[project.status] ?? project.status

  // Sprint 1/2: el execution_status se mantiene en local para reflejar transiciones
  // disparadas desde ValidationTab sin recargar la page.
  const [estadoV2, setEstadoV2] = useState<string | null>(project.execution_status ?? null)
  const executionState: ProjectExecutionState | null =
    estadoV2 && isProjectExecutionStateCode(estadoV2) ? estadoV2 : null

  // Deep link ?tab=validation (tambien acepta horas, deliverables, delivery, closure).
  const searchParams = useSearchParams()
  const initialTab = (() => {
    const t = searchParams.get('tab')
    if (
      t === 'validation' ||
      t === 'deliverables' ||
      t === 'horas' ||
      t === 'delivery' ||
      t === 'closure'
    )
      return t
    return 'horas'
  })()
  const [activeTab, setActiveTab] = useState(initialTab)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 pb-8 pt-5">
      {/* Boton volver */}
      <Link
        href="/projects"
        className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--ink-4)] bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(37,99,235,0.22)] transition-colors hover:bg-sky-500"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Projects
      </Link>

      {/* Cabecera del project */}
      <section className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[color:var(--ink)]">
                {project.title}
              </h1>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${estadoColor}`}>
                {estadoLabel}
              </span>
              {project.drive_folder_url && (
                <a
                  href={project.drive_folder_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                  title={`Abrir carpeta Drive del proyecto ${project.project_number}`}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Abrir carpeta Drive
                </a>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--ink-3)]">
              <span className="inline-flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" />
                {project.project_number}
              </span>
              {project.client_name && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {project.client_name}
                </span>
              )}
              {project.aircraft && (
                <span className="inline-flex items-center gap-1">
                  <Plane className="h-3.5 w-3.5" />
                  {project.aircraft}
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

      {/* Stepper de la maquina de execution v2 (solo si el project ya migro a execution_status) */}
      {executionState && <ProjectStateStepper currentState={executionState} />}

      {/* Tabs: Horas + Deliverables (Sprint 1) + Validation (Sprint 2) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList variant="line" className="mb-3 border-b border-[color:var(--ink-4)]">
          <TabsTrigger value="horas">Horas</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="closure">Cierre</TabsTrigger>
        </TabsList>

        <TabsContent value="deliverables">
          <DeliverablesTab
            proyectoId={project.id}
            currentState={estadoV2}
            onStateChange={setEstadoV2}
          />
        </TabsContent>

        <TabsContent value="validation">
          <ValidationTab
            proyectoId={project.id}
            currentState={estadoV2}
            onStateChange={setEstadoV2}
          />
        </TabsContent>

        <TabsContent value="delivery">
          <DeliveryTab
            proyectoId={project.id}
            proyectoTitulo={project.title}
            proyectoNumero={project.project_number}
            defaultRecipientEmail={null}
            defaultRecipientName={project.client_name ?? null}
            currentState={estadoV2}
            onStateChange={setEstadoV2}
          />
        </TabsContent>

        <TabsContent value="closure">
          <ClosureTab
            proyectoId={project.id}
            currentState={estadoV2}
            onStateChange={setEstadoV2}
          />
        </TabsContent>

        <TabsContent value="horas">
      {/* Seccion Registro de Horas */}
      <section className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-sm">
        {/* Header de la seccion */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--ink-4)] px-5 py-4">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-[color:var(--ink-3)]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
              Registro de Horas
            </h2>
          </div>
          <ProjectTimerButton
            proyectoId={project.id}
            numeroProyecto={project.project_number}
          />
        </div>

        {/* Resumen de metricas */}
        <div className="grid grid-cols-1 gap-3 border-b border-[color:var(--ink-4)] px-5 py-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
              Total trabajado
            </p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--ink)]">
              {formatDuration(totalMinutes)}
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
              Sesiones
            </p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--ink)]">
              {totalSessions}
            </p>
          </div>
          <div className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
              Media por sesion
            </p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--ink)]">
              {formatDuration(avgMinutes)}
            </p>
          </div>
        </div>

        {/* Table de entradas */}
        {entries.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[color:var(--ink-3)]">
            No hay sesiones de trabajo registradas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--ink-4)] text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                    Date
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                    Inicio
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                    Fin
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                    Duracion
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const isEditing = editingId === entry.id
                  const isOpen = entry.ended_at === null
                  const rowBg = isEditing
                    ? 'bg-yellow-50'
                    : idx % 2 === 0
                      ? 'bg-[color:var(--paper)]'
                      : 'bg-[color:var(--paper-2)]'

                  return (
                    <tr key={entry.id} className={`border-b border-slate-50 ${rowBg}`}>
                      {/* Date */}
                      <td className="whitespace-nowrap px-5 py-3 text-sm text-[color:var(--ink-2)]">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-[color:var(--ink-3)]" />
                          {formatDate(entry.started_at)}
                        </span>
                      </td>

                      {/* Inicio */}
                      <td className="whitespace-nowrap px-5 py-3 text-sm text-[color:var(--ink-2)]">
                        {isEditing ? (
                          <input
                            type="datetime-local"
                            value={editInicio}
                            onChange={(e) => setEditInicio(e.target.value)}
                            className="rounded border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1 text-sm text-[color:var(--ink-2)] focus:border-[color:var(--ink-4)] focus:outline-none focus:ring-1 focus:ring-sky-400"
                          />
                        ) : (
                          formatTime(entry.started_at)
                        )}
                      </td>

                      {/* Fin */}
                      <td className="whitespace-nowrap px-5 py-3 text-sm text-[color:var(--ink-2)]">
                        {isEditing ? (
                          <input
                            type="datetime-local"
                            value={editFin}
                            onChange={(e) => setEditFin(e.target.value)}
                            className="rounded border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-1 text-sm text-[color:var(--ink-2)] focus:border-[color:var(--ink-4)] focus:outline-none focus:ring-1 focus:ring-sky-400"
                          />
                        ) : isOpen ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            En curso
                          </span>
                        ) : (
                          formatTime(entry.ended_at!)
                        )}
                      </td>

                      {/* Duracion */}
                      <td className="whitespace-nowrap px-5 py-3 text-sm font-medium text-[color:var(--ink)]">
                        {isEditing ? (
                          <span className="text-[color:var(--ink-3)]">{getEditDuration()}</span>
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
                              className="inline-flex items-center gap-1 rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2.5 py-1 text-xs font-medium text-[color:var(--ink-3)] transition-colors hover:bg-[color:var(--paper-3)]"
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
                              className="rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-1.5 text-[color:var(--ink-3)] transition-colors hover:bg-[color:var(--paper-3)] hover:text-[color:var(--ink)] disabled:opacity-30"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(entry.id)}
                              disabled={deletingId !== null}
                              title="Eliminar"
                              className="rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-1.5 text-[color:var(--ink-3)] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
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

      {/* Seccion Projects similares (precedentes) */}
      <PrecedentesSection projectId={project.id} projectNumber={project.project_number} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
