/**
 * ============================================================================
 * COMPONENTE CLIENTE DE PROYECTOS ACTIVOS (TABLERO + LISTA)
 * ============================================================================
 *
 * Este componente replica la misma filosofia visual del modulo de Quotations:
 * columnas/filas con cabecera coloreada (dot + title + chip de conteo),
 * tarjetas con data del project, selector de status y acciones.
 *
 * Los colores se resuelven via COLOR_STYLE_MAP y boardAccent del sistema
 * de workflow-state-config, exactamente igual que QuotationStatesBoard.
 *
 * VISTAS DISPONIBLES:
 *   1. TABLERO (Kanban): una columna por cada status del workflow de projects
 *   2. LISTA: table con filas para cada project con sus data operativos
 *
 * COLUMNAS DEL TABLERO (resueltas desde workflow-state-config):
 *   - New: project recien creado
 *   - In Progress: trabajo de ingenieria en curso
 *   - Review: en process de review technical
 *   - Approval: pending de approval
 *   - Delivered: documentacion entregada al client
 *
 * NOTA TECNICA: El status "archived" no se muestra como columna en el
 * tablero, pero sigue siendo una transicion valida desde el selector de
 * status. Los projects archivados permanecen en la BD.
 *
 * CAMPOS DE LA TABLA doa_projects usados aqui:
 *   project_number, title, description, client_name, aircraft,
 *   owner, priority, start_date, status
 * ============================================================================
 */

'use client'

// --- IMPORTACIONES ---

import Link from 'next/link'
import { startTransition, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'
import {
  ChevronDown,
  Inbox,
  LayoutGrid,
  List,
  Plane,
  Plus,
  Search,
  Trash2,
  User,
} from 'lucide-react'

import { ProjectTimerButton } from './ProjectTimerButton'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  getResolvedProjectBoardStatusMeta,
  resolveWorkflowStateRows,
  WORKFLOW_STATE_SCOPES,
} from '@/lib/workflow-state-config'
import type { ResolvedWorkflowStateMeta } from '@/lib/workflow-state-config'
import {
  getProjectOperationalState,
  PROJECT_STATES,
  PROJECT_WORKFLOW_STATES,
} from '@/lib/workflow-states'
import type { PersistedProjectStatus, Project, WorkflowStateConfigRow } from '@/types/database'

// --- TIPOS INTERNOS ---

/** Vista activa: "board" (tablero) o "list" (lista) */
type BoardView = 'board' | 'list'

/** Opciones de vista con sus iconos */
const VIEW_OPTIONS: Array<{
  value: BoardView
  label: string
  icon: typeof LayoutGrid
}> = [
  { value: 'board', label: 'Tablero', icon: LayoutGrid },
  { value: 'list', label: 'Lista', icon: List },
]

// --- CONSTANTES DE PRIORIDAD ---

/** Colores de priority para badges */
const PRIORIDAD_COLORS: Record<string, string> = {
  high: 'text-rose-700 bg-rose-50 border-rose-200',
  urgent: 'text-rose-700 bg-rose-50 border-rose-200',
  medium: 'text-amber-700 bg-amber-50 border-amber-200',
  normal: 'text-amber-700 bg-amber-50 border-amber-200',
  low: 'text-green-700 bg-green-50 border-green-200',
}

// --- COMPONENTES AUXILIARES ---

/**
 * Badge visual de priority del project.
 * high/urgent = rojo, medium/normal = ambar, low = verde.
 */
function PrioridadBadge({ priority }: { priority: string | null }) {
  if (!priority) return null

  const colorClass =
    PRIORIDAD_COLORS[priority] ?? 'text-[color:var(--ink-3)] bg-[color:var(--paper-2)] border-[color:var(--ink-4)]'

  return (
    <span
      className={cn(
        'inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        colorClass,
      )}
    >
      {priority}
    </span>
  )
}

/**
 * Selector desplegable para cambiar el status de un project.
 * Muestra TODOS los statuses del workflow de projects para permitir
 * cambio manual a cualquier status sin restricciones de transicion.
 * Llama a la API PATCH y refresca la page al cambiar.
 * Usa labels resueltos desde workflow-state-config.
 */
function ProjectStateControl({
  project,
  stateConfigRows,
  onEstadoChange,
  onEstadoRevert,
}: {
  project: Project
  stateConfigRows: WorkflowStateConfigRow[]
  onEstadoChange?: (proyectoId: string, nuevoEstado: string) => void
  onEstadoRevert?: (proyectoId: string, estadoAnterior: string) => void
}) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  // El dropdown usa directamente project.status (que viene del status local del padre).
  // No mantenemos un selectedState propio para evitar desincronizaciones.

  async function handleChange(nextState: string) {
    if (!nextState || nextState === project.status) {
      return
    }

    const previousState = project.status

    // Actualizar optimistamente el status del padre PRIMERO (mueve la tarjeta)
    onEstadoChange?.(project.id, nextState)
    setStatus('saving')
    setMessage(null)

    try {
      const response = await fetch('/api/webhooks/project-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          status: nextState
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error || 'No se pudo actualizar el status del project.',
        )
      }

      setStatus('idle')
      // Supabase Realtime se encarga de actualizar el status local automaticamente.
      // No es necesario hacer router.refresh().
    } catch (error) {
      // REVERTIR: restaurar el status anterior en el padre y limpiar el override optimista
      onEstadoRevert?.(project.id, previousState)
      setStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'Se produjo un error actualizando el status.',
      )
    }
  }

  // Construir opciones: TODOS los 6 statuses del workflow de projects
  const allOptions = PROJECT_WORKFLOW_STATES.map((stateCode) => {
    const meta = getResolvedProjectBoardStatusMeta(stateCode, stateConfigRows)
    return {
      value: stateCode,
      label: meta.label,
      dot: meta.accent.dot,
    }
  })

  return (
    <div className="space-y-1">
      <label className="sr-only" htmlFor={`project-state-${project.id}`}>
        Cambiar status del project
      </label>
      <select
        id={`project-state-${project.id}`}
        value={project.status}
        disabled={status === 'saving'}
        onChange={(event) => void handleChange(event.target.value)}
        className="h-8 min-w-[140px] rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--ink-3)] outline-none transition-colors hover:border-[color:var(--ink-4)] focus:border-[color:var(--ink-4)] focus:ring-4 focus:ring-[color:var(--ink-4)] disabled:cursor-wait disabled:opacity-70"
      >
        {allOptions.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.value === project.status ? `● ${option.label}` : option.label}
          </option>
        ))}
      </select>
      {status === 'saving' ? (
        <p className="text-[11px] text-[color:var(--ink-3)]">Guardando...</p>
      ) : null}
      {message ? <p className="text-[11px] text-rose-600">{message}</p> : null}
    </div>
  )
}

/**
 * Boton para borrar un project del tablero.
 * Pide confirmacion al user_label antes de eliminar.
 * Llama a la API DELETE y refresca la page.
 * Replica el patron de IncomingQueryDeleteControl de QuotationStatesBoard.
 */
function ProjectDeleteControl({ project }: { project: Project }) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'deleting' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleDelete() {
    const confirmed = window.confirm(
      `¿Seguro que quieres borrar el project "${project.project_number} — ${project.title}"?`,
    )
    if (!confirmed) return

    setStatus('deleting')
    setMessage(null)

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      })

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo borrar el project.')
      }

      setStatus('idle')
      startTransition(() => router.refresh())
    } catch (error) {
      setStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'Se produjo un error borrando el project.',
      )
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={status === 'deleting'}
        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-wait disabled:opacity-70"
        aria-label={`Borrar project ${project.project_number}`}
        title="Borrar project"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {status === 'deleting' ? (
        <p className="text-[11px] text-[color:var(--ink-3)]">Borrando project...</p>
      ) : null}
      {message ? <p className="text-[11px] text-rose-600 mt-1">{message}</p> : null}
    </div>
  )
}

// --- TARJETA KANBAN ---

/**
 * Tarjeta individual de un project en la vista Kanban.
 * Replica el patron visual exacto de BoardCard en QuotationStatesBoard:
 *   - Codigo del project (project_number)
 *   - Titulo en negrita
 *   - Description en gris italica truncada
 *   - Bloque de client (client_name) en verde
 *   - Badge de aircraft
 *   - Badge de owner
 *   - Badge de priority
 *   - Date (start_date) abajo a la derecha
 *   - Selector de status al pie
 */
function BoardCard({
  project,
  stateConfigRows,
  onEstadoChange,
  onEstadoRevert,
}: {
  project: Project
  stateConfigRows: WorkflowStateConfigRow[]
  onEstadoChange?: (proyectoId: string, nuevoEstado: string) => void
  onEstadoRevert?: (proyectoId: string, estadoAnterior: string) => void
}) {
  return (
    <article className="rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-3.5 shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition-transform hover:-translate-y-0.5 hover:border-[color:var(--ink-4)]">
      {/* Cabecera: codigo de project */}
      <div className="space-y-1">
        <p className="font-mono text-[10px] tracking-[0.2em] text-[color:var(--ink-3)]">
          {project.project_number}
        </p>
        <Link
          href={`/engineering/projects/${project.id}`}
          className="block"
        >
          <h4 className="text-sm font-semibold leading-5 text-[color:var(--ink)] transition-colors hover:text-[color:var(--ink-2)]">
            {project.title}
          </h4>
        </Link>
      </div>

      {/* Description preview */}
      {project.description ? (
        <p className="mt-2 text-xs italic text-[color:var(--ink-3)] line-clamp-1">
          {project.description}
        </p>
      ) : null}

      {/* Bloque de client (replica el patron de IncomingClientIdentityBlock) */}
      {project.client_name ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
            Client
          </p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--ink)]">
            {project.client_name}
          </p>
        </div>
      ) : null}

      {/* Aircraft info */}
      {project.aircraft ? (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[color:var(--ink-3)]">
          <Plane size={11} />
          <span className="truncate">{project.aircraft}</span>
        </div>
      ) : null}

      {/* Owner + Prioridad badges */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {project.owner ? (
          <span className="inline-flex items-center gap-1 rounded border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--ink-3)]">
            <User size={10} />
            <span className="max-w-[80px] truncate">{project.owner}</span>
          </span>
        ) : null}
        <PrioridadBadge priority={project.priority} />
      </div>

      {/* Temporizador de horas (solo para statuses activos, no new ni closed) */}
      {project.status !== PROJECT_STATES.NEW && project.status !== PROJECT_STATES.CLOSED ? (
        <div className="mt-2">
          <ProjectTimerButton
            proyectoId={project.id}
            numeroProyecto={project.project_number}
          />
        </div>
      ) : null}

      {/* Date started_at alineada a la derecha */}
      {project.start_date ? (
        <p className="mt-2 text-right text-[11px] text-[color:var(--ink-3)]">
          {project.start_date}
        </p>
      ) : null}

      {/* Selector de status + boton detalle */}
      <div className="mt-3 space-y-2">
        <ProjectStateControl project={project} stateConfigRows={stateConfigRows} onEstadoChange={onEstadoChange} onEstadoRevert={onEstadoRevert} />
        <div className="flex items-center justify-between">
          <ProjectDeleteControl project={project} />
          <Link
            href={`/engineering/projects/${project.id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-[color:var(--ink-3)] transition-colors hover:border-[color:var(--ink-4)] hover:bg-[color:var(--paper-3)] hover:text-[color:var(--ink-2)]"
            title="Ver detalle"
          >
            <Plus className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  )
}

// --- COLUMNA KANBAN (BoardLane) ---

/**
 * Una columna del tablero Kanban.
 * Replica el patron EXACTO de BoardLane en QuotationStatesBoard:
 *   - Cabecera con dot coloreado + name del status + chip contador
 *   - Borde de la columna con el color del status
 *   - Tarjetas del project
 *   - Status vacio si no hay projects
 */
function BoardLane({
  stateMeta,
  projects,
  stateConfigRows,
  onEstadoChange,
  onEstadoRevert,
}: {
  stateMeta: ResolvedWorkflowStateMeta
  projects: Project[]
  stateConfigRows: WorkflowStateConfigRow[]
  onEstadoChange?: (proyectoId: string, nuevoEstado: string) => void
  onEstadoRevert?: (proyectoId: string, estadoAnterior: string) => void
}) {
  // Filtrar projects que estan en este status (incluyendo statuses legacy)
  const laneProyectos = projects.filter((project) => {
    const opState = getProjectOperationalState(project.status)
    return opState === stateMeta.state_code
  })

  return (
    <section
      className={cn(
        'flex h-full w-[320px] flex-none flex-col rounded-[30px] border bg-[color:var(--paper-2)] p-4 shadow-[0_18px_42px_rgba(148,163,184,0.14)]',
        stateMeta.boardAccent.border,
      )}
    >
      {/* Cabecera coloreada - patron identico a Quotations */}
      <div
        className={cn('rounded-[22px] border px-4 py-4', stateMeta.boardAccent.bg, stateMeta.boardAccent.border)}
        title={stateMeta.description ?? ''}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={cn('h-2.5 w-2.5 rounded-full', stateMeta.boardAccent.dot)} />
            <h3 className={cn('text-sm font-semibold', stateMeta.boardAccent.text)}>
              {stateMeta.label}
            </h3>
          </div>
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
              stateMeta.boardAccent.chip,
            )}
          >
            {laneProyectos.length}
          </span>
        </div>
      </div>

      {/* Tarjetas */}
      <div className="mt-4 flex-1 space-y-3">
        {laneProyectos.map((project) => (
          <BoardCard
            key={project.id}
            project={project}
            stateConfigRows={stateConfigRows}
            onEstadoChange={onEstadoChange}
            onEstadoRevert={onEstadoRevert}
          />
        ))}

        {laneProyectos.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper)]/80 px-4 py-5 text-center">
            <p className="text-sm font-medium text-[color:var(--ink)]">Sin projects</p>
            <p className="mt-1 text-sm text-[color:var(--ink-3)]">
              Esta columna queda preparada para recibir projects.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

// --- VISTA TABLERO (KANBAN) ---

function TableroView({
  projects,
  resolvedStates,
  stateConfigRows,
  onEstadoChange,
  onEstadoRevert,
}: {
  projects: Project[]
  resolvedStates: ResolvedWorkflowStateMeta[]
  stateConfigRows: WorkflowStateConfigRow[]
  onEstadoChange?: (proyectoId: string, nuevoEstado: string) => void
  onEstadoRevert?: (proyectoId: string, estadoAnterior: string) => void
}) {
  return (
    <div className="px-5 py-5">
      <div className="mb-4 rounded-[28px] border border-[color:var(--ink-4)] bg-[color:var(--paper)]/85 px-4 py-3 text-sm text-[color:var(--ink-3)] shadow-sm">
        El tablero usa scroll horizontal. Usa la barra de desplazamiento o el trackpad para navegar entre columnas.
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex min-w-max gap-4 pr-2">
          {resolvedStates
            .filter((meta) => meta.state_code !== 'archived')
            .map((meta) => (
              <BoardLane
                key={meta.state_code}
                stateMeta={meta}
                projects={projects}
                stateConfigRows={stateConfigRows}
                onEstadoChange={onEstadoChange}
                onEstadoRevert={onEstadoRevert}
              />
            ))}
        </div>
      </div>
    </div>
  )
}

// --- VISTA LISTA ---

function ListaView({
  projects,
  stateConfigRows,
  onEstadoChange,
  onEstadoRevert,
}: {
  projects: Project[]
  stateConfigRows: WorkflowStateConfigRow[]
  onEstadoChange?: (proyectoId: string, nuevoEstado: string) => void
  onEstadoRevert?: (proyectoId: string, estadoAnterior: string) => void
}) {
  return (
    <div className="px-5 py-5">
      <div className="overflow-hidden rounded-[30px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-[0_18px_42px_rgba(148,163,184,0.12)]">
        <div className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-5 py-4">
          <h3 className="text-base font-semibold text-[color:var(--ink)]">
            Lista de projects
          </h3>
          <p className="mt-1 text-sm leading-6 text-[color:var(--ink-3)]">
            Vista compacta de todos los projects activos con sus data operativos.
          </p>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[1060px] w-full border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-10 bg-[color:var(--paper)]">
              <tr className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)]">
                {[
                  'Codigo',
                  'Titulo',
                  'Client',
                  'Status',
                  'Aircraft',
                  'Owner',
                  'Prioridad',
                  'Date started_at',
                  'Horas',
                ].map((label) => (
                  <th
                    key={label}
                    className="whitespace-nowrap border-b border-[color:var(--ink-4)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((project, idx) => {
                const meta = getResolvedProjectBoardStatusMeta(project.status, stateConfigRows)
                return (
                  <tr
                    key={project.id}
                    className={cn(
                      'border-b border-[color:var(--ink-4)]/60 align-top transition-colors hover:bg-[color:var(--paper-3)]/60',
                      idx % 2 === 0 ? 'bg-[color:var(--paper)]' : 'bg-[color:var(--paper-2)]/40',
                    )}
                  >
                    {/* Codigo / Numero de project */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/engineering/projects/${project.id}`}
                        className="block font-mono text-xs text-[color:var(--ink-3)] hover:text-[color:var(--ink-2)]"
                      >
                        {project.project_number}
                      </Link>
                    </td>

                    {/* Titulo + Description */}
                    <td className="max-w-[260px] px-4 py-3">
                      <Link
                        href={`/engineering/projects/${project.id}`}
                        className="block"
                      >
                        <span className="block truncate text-sm font-medium text-[color:var(--ink)] hover:text-[color:var(--ink-2)]">
                          {project.title}
                        </span>
                        {project.description ? (
                          <span className="block truncate text-[11px] italic text-[color:var(--ink-3)]">
                            {project.description}
                          </span>
                        ) : null}
                      </Link>
                    </td>

                    {/* Client */}
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[color:var(--ink-3)]">
                      {project.client_name ?? '-'}
                    </td>

                    {/* Status con badge coloreado + selector de cambio */}
                    <td className="min-w-[200px] px-4 py-3">
                      <div className="space-y-1.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium',
                            meta.badge.color,
                          )}
                        >
                          {meta.label}
                        </span>
                        <ProjectStateControl project={project} stateConfigRows={stateConfigRows} onEstadoChange={onEstadoChange} onEstadoRevert={onEstadoRevert} />
                      </div>
                    </td>

                    {/* Aircraft */}
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[color:var(--ink-3)]">
                      {project.aircraft ?? '-'}
                    </td>

                    {/* Owner */}
                    <td className="whitespace-nowrap px-4 py-3">
                      {project.owner ? (
                        <div className="flex items-center gap-1.5 text-sm text-[color:var(--ink-3)]">
                          <User size={12} />
                          <span className="max-w-[100px] truncate">
                            {project.owner}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-[color:var(--ink-3)]">-</span>
                      )}
                    </td>

                    {/* Prioridad */}
                    <td className="px-4 py-3">
                      <PrioridadBadge priority={project.priority} />
                    </td>

                    {/* Date started_at */}
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[color:var(--ink-3)]">
                      {project.start_date ?? '-'}
                    </td>

                    {/* Horas (temporizador) */}
                    <td className="px-4 py-3">
                      {project.status !== PROJECT_STATES.NEW && project.status !== PROJECT_STATES.CLOSED ? (
                        <ProjectTimerButton
                          proyectoId={project.id}
                          numeroProyecto={project.project_number}
                        />
                      ) : (
                        <span className="text-sm text-[color:var(--ink-3)]">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// --- COMPONENTE PRINCIPAL ---

/**
 * Componente primary de Projects activos.
 * Ofrece toggle entre vista Tablero (Kanban) y Lista,
 * con barra de search y filtro de status.
 *
 * Los colores de las columnas, badges y chips se resuelven desde
 * workflow-state-config usando el sistema de COLOR_STYLE_MAP,
 * siguiendo la misma filosofia que el modulo de Quotations.
 */
export function ProjectsClient({
  initialProyectos,
  initialStateConfigRows,
}: {
  initialProyectos: Project[]
  initialStateConfigRows: WorkflowStateConfigRow[]
}) {
  const [view, setView] = useState<BoardView>('board')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Status local de projects. Se inicializa con los data del servidor
  // y se actualiza en tiempo real via Supabase Realtime.
  const [projects, setProyectos] = useState<Project[]>(initialProyectos)

  // Sincronizar si los data iniciales del servidor cambian (navegacion, etc.)
  useEffect(() => {
    setProyectos(initialProyectos)
  }, [initialProyectos])

  // --- Supabase Realtime: suscripcion a cambios en doa_projects ---
  // Escucha INSERT, UPDATE y DELETE en la table y actualiza el status local
  // automaticamente sin necesidad de router.refresh().
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('projects-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'doa_projects' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setProyectos((prev) =>
              prev.map((p) =>
                p.id === (payload.new as Project).id
                  ? { ...p, ...(payload.new as Project) }
                  : p,
              ),
            )
          } else if (payload.eventType === 'INSERT') {
            setProyectos((prev) => [...prev, payload.new as Project])
          } else if (payload.eventType === 'DELETE') {
            setProyectos((prev) =>
              prev.filter((p) => p.id !== (payload.old as { id: string }).id),
            )
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Callback para actualizar el status de un project localmente (optimista).
  // La tarjeta se mueve inmediatamente; luego Supabase Realtime confirma el cambio real.
  const handleEstadoChange = useCallback((proyectoId: string, nuevoEstado: string) => {
    setProyectos((prev) =>
      prev.map((p) =>
        p.id === proyectoId ? { ...p, status: nuevoEstado as PersistedProjectStatus } : p,
      ),
    )
  }, [])

  // Callback para revertir un cambio optimista (cuando la API falla).
  const handleEstadoRevert = useCallback((proyectoId: string, estadoAnterior: string) => {
    setProyectos((prev) =>
      prev.map((p) =>
        p.id === proyectoId ? { ...p, status: estadoAnterior as PersistedProjectStatus } : p,
      ),
    )
  }, [])

  // Resolver los statuses del tablero de projects con la configuracion actual
  const resolvedStates = useMemo(
    () => resolveWorkflowStateRows(WORKFLOW_STATE_SCOPES.PROJECT_BOARD, initialStateConfigRows),
    [initialStateConfigRows],
  )

  // Filtrar projects por search y status
  const filtered = useMemo(
    () =>
      projects.filter((project) => {
        // Filtro de search por text
        const matchSearch =
          search === '' ||
          project.title.toLowerCase().includes(search.toLowerCase()) ||
          project.project_number
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (project.description ?? '')
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (project.client_name ?? '')
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (project.aircraft ?? '')
            .toLowerCase()
            .includes(search.toLowerCase())

        // Filtro por status
        const matchStatus =
          statusFilter === 'all' ||
          getProjectOperationalState(project.status) === statusFilter

        return matchSearch && matchStatus
      }),
    [projects, search, statusFilter],
  )

  // Metricas de resumen por columna (usando los statuses resueltos)
  const metrics = useMemo(() => {
    const byColumn = resolvedStates
      .filter((meta) => meta.state_code !== 'archived')
      .map((meta) => ({
        stateCode: meta.state_code,
        title: meta.label,
        count: filtered.filter((p) => {
          const opState = getProjectOperationalState(p.status)
          return opState === meta.state_code
        }).length,
        accent: meta.boardAccent,
      }))
    return { total: filtered.length, byColumn }
  }, [filtered, resolvedStates])

  // Statuses disponibles para el filtro (solo los que tienen projects)
  const availableStates = useMemo(
    () =>
      resolvedStates.filter((meta) =>
        projects.some(
          (p) => getProjectOperationalState(p.status) === meta.state_code,
        ),
      ),
    [projects, resolvedStates],
  )

  return (
    <Tabs
      value={view}
      onValueChange={(nextValue) => setView(nextValue as BoardView)}
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden p-5 text-[color:var(--ink)]"
    >
      {/* Seccion primary con borde redondeado */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[34px] border border-[color:var(--ink-4)] bg-[radial-gradient(circle_at_top_left,#eff8ff_0%,#ffffff_45%,#f8fafc_100%)] shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
        {/* Cabecera con title, metricas y controles */}
        <div className="border-b border-[color:var(--ink-4)] px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Titulo e indicador */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-2)]">
                <LayoutGrid className="h-3.5 w-3.5" />
                Projects activos
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-[color:var(--ink)]">
                  Tablero de projects de ingenieria
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-[color:var(--ink-3)]">
                  Seguimiento operativo de los projects agrupados por fase del
                  workflow. Usa las columnas del tablero o la vista lista para
                  gestionar el avance.
                </p>
              </div>
            </div>

            {/* Metricas de resumen */}
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
                  Projects
                </p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--ink)]">
                  {metrics.total}
                </p>
              </div>
              {metrics.byColumn
                .filter((col) => col.count > 0)
                .map((col) => (
                  <div
                    key={col.stateCode}
                    className="rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-4 py-3"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
                      {col.title}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-[color:var(--ink)]">
                      {col.count}
                    </p>
                  </div>
                ))}
            </div>
          </div>

          {/* Barra de search, filtro y toggle de vista */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {/* Toggle Tablero / Lista */}
            <TabsList
              variant="default"
              className="flex w-auto gap-2 rounded-[24px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-2"
            >
              {VIEW_OPTIONS.map((option) => {
                const Icon = option.icon
                return (
                  <TabsTrigger
                    key={option.value}
                    value={option.value}
                    className="rounded-[18px] px-4 py-2.5 text-sm font-semibold text-[color:var(--ink-3)] transition-all data-active:bg-[color:var(--paper)] data-active:text-[color:var(--ink)] data-active:shadow-sm"
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {/* Barra de search */}
            <div className="relative max-w-xs min-w-[200px] flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-3)]"
              />
              <input
                type="text"
                placeholder="Buscar projects..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] py-2 pl-9 pr-3 text-sm text-[color:var(--ink)] placeholder-[color:var(--ink-4)] transition-colors focus:border-[color:var(--ink-4)] focus:outline-none focus:ring-4 focus:ring-[color:var(--ink-4)]"
              />
            </div>

            {/* Filtro por status */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="cursor-pointer appearance-none rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] py-2 pl-3 pr-8 text-sm text-[color:var(--ink)] transition-colors focus:border-[color:var(--ink-4)] focus:outline-none focus:ring-4 focus:ring-[color:var(--ink-4)]"
              >
                <option value="all">Todos los statuses</option>
                {availableStates.map((meta) => (
                  <option key={meta.state_code} value={meta.state_code}>
                    {meta.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--ink-3)]"
              />
            </div>
          </div>
        </div>

        {/* Contenido de las vistas */}
        <div className="min-h-0 flex-1 overflow-auto">
          {filtered.length === 0 ? (
            /* Status vacio */
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-[color:var(--ink-3)]">
              <Inbox className="h-10 w-10" />
              <p className="text-sm">
                No hay projects activos. Los projects se crean desde las
                requests entrantes.
              </p>
            </div>
          ) : (
            <>
              <TabsContent value="board" className="min-h-0">
                <TableroView
                  projects={filtered}
                  resolvedStates={resolvedStates}
                  stateConfigRows={initialStateConfigRows}
                  onEstadoChange={handleEstadoChange}
                  onEstadoRevert={handleEstadoRevert}
                />
              </TabsContent>

              <TabsContent value="list">
                <ListaView
                  projects={filtered}
                  stateConfigRows={initialStateConfigRows}
                  onEstadoChange={handleEstadoChange}
                  onEstadoRevert={handleEstadoRevert}
                />
              </TabsContent>
            </>
          )}
        </div>
      </section>
    </Tabs>
  )
}
