/**
 * ============================================================================
 * COMPONENTE CLIENTE DE PROYECTOS ACTIVOS (TABLERO + LISTA)
 * ============================================================================
 *
 * Este componente replica la misma filosofia visual del modulo de Quotations:
 * columnas/filas con cabecera coloreada (dot + titulo + chip de conteo),
 * tarjetas con datos del proyecto, selector de estado y acciones.
 *
 * Los colores se resuelven via COLOR_STYLE_MAP y boardAccent del sistema
 * de workflow-state-config, exactamente igual que QuotationStatesBoard.
 *
 * VISTAS DISPONIBLES:
 *   1. TABLERO (Kanban): una columna por cada estado del workflow de proyectos
 *   2. LISTA: tabla con filas para cada proyecto con sus datos operativos
 *
 * COLUMNAS DEL TABLERO (resueltas desde workflow-state-config):
 *   - Nuevo: proyecto recien creado
 *   - En Progreso: trabajo de ingenieria en curso
 *   - Revision: en proceso de revision tecnica
 *   - Aprobacion: pendiente de aprobacion
 *   - Entregado: documentacion entregada al cliente
 *
 * NOTA TECNICA: El estado "archivado" no se muestra como columna en el
 * tablero, pero sigue siendo una transicion valida desde el selector de
 * estado. Los proyectos archivados permanecen en la BD.
 *
 * CAMPOS DE LA TABLA doa_proyectos usados aqui:
 *   numero_proyecto, titulo, descripcion, cliente_nombre, aeronave,
 *   owner, prioridad, fecha_inicio, estado
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
import type { EstadoProyectoPersistido, Proyecto, WorkflowStateConfigRow } from '@/types/database'

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

/** Colores de prioridad para badges */
const PRIORIDAD_COLORS: Record<string, string> = {
  alta: 'text-rose-700 bg-rose-50 border-rose-200',
  urgente: 'text-rose-700 bg-rose-50 border-rose-200',
  media: 'text-amber-700 bg-amber-50 border-amber-200',
  normal: 'text-amber-700 bg-amber-50 border-amber-200',
  baja: 'text-green-700 bg-green-50 border-green-200',
}

// --- COMPONENTES AUXILIARES ---

/**
 * Badge visual de prioridad del proyecto.
 * alta/urgente = rojo, media/normal = ambar, baja = verde.
 */
function PrioridadBadge({ prioridad }: { prioridad: string | null }) {
  if (!prioridad) return null

  const colorClass =
    PRIORIDAD_COLORS[prioridad] ?? 'text-slate-600 bg-slate-100 border-slate-200'

  return (
    <span
      className={cn(
        'inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        colorClass,
      )}
    >
      {prioridad}
    </span>
  )
}

/**
 * Selector desplegable para cambiar el estado de un proyecto.
 * Muestra TODOS los estados del workflow de proyectos para permitir
 * cambio manual a cualquier estado sin restricciones de transicion.
 * Llama a la API PATCH y refresca la pagina al cambiar.
 * Usa labels resueltos desde workflow-state-config.
 */
function ProjectStateControl({
  proyecto,
  stateConfigRows,
  onEstadoChange,
  onEstadoRevert,
}: {
  proyecto: Proyecto
  stateConfigRows: WorkflowStateConfigRow[]
  onEstadoChange?: (proyectoId: string, nuevoEstado: string) => void
  onEstadoRevert?: (proyectoId: string, estadoAnterior: string) => void
}) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  // El dropdown usa directamente proyecto.estado (que viene del estado local del padre).
  // No mantenemos un selectedState propio para evitar desincronizaciones.

  async function handleChange(nextState: string) {
    if (!nextState || nextState === proyecto.estado) {
      return
    }

    const previousState = proyecto.estado

    // Actualizar optimistamente el estado del padre PRIMERO (mueve la tarjeta)
    onEstadoChange?.(proyecto.id, nextState)
    setStatus('saving')
    setMessage(null)

    try {
      const response = await fetch('/api/webhooks/project-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyecto.id,
          estado: nextState
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error || 'No se pudo actualizar el estado del proyecto.',
        )
      }

      setStatus('idle')
      // Supabase Realtime se encarga de actualizar el estado local automaticamente.
      // No es necesario hacer router.refresh().
    } catch (error) {
      // REVERTIR: restaurar el estado anterior en el padre y limpiar el override optimista
      onEstadoRevert?.(proyecto.id, previousState)
      setStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'Se produjo un error actualizando el estado.',
      )
    }
  }

  // Construir opciones: TODOS los 6 estados del workflow de proyectos
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
      <label className="sr-only" htmlFor={`project-state-${proyecto.id}`}>
        Cambiar estado del proyecto
      </label>
      <select
        id={`project-state-${proyecto.id}`}
        value={proyecto.estado}
        disabled={status === 'saving'}
        onChange={(event) => void handleChange(event.target.value)}
        className="h-8 min-w-[140px] rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-600 outline-none transition-colors hover:border-sky-300 focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-wait disabled:opacity-70"
      >
        {allOptions.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.value === proyecto.estado ? `● ${option.label}` : option.label}
          </option>
        ))}
      </select>
      {status === 'saving' ? (
        <p className="text-[11px] text-slate-500">Guardando...</p>
      ) : null}
      {message ? <p className="text-[11px] text-rose-600">{message}</p> : null}
    </div>
  )
}

/**
 * Boton para borrar un proyecto del tablero.
 * Pide confirmacion al usuario antes de eliminar.
 * Llama a la API DELETE y refresca la pagina.
 * Replica el patron de IncomingQueryDeleteControl de QuotationStatesBoard.
 */
function ProjectDeleteControl({ proyecto }: { proyecto: Proyecto }) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'deleting' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleDelete() {
    const confirmed = window.confirm(
      `¿Seguro que quieres borrar el proyecto "${proyecto.numero_proyecto} — ${proyecto.titulo}"?`,
    )
    if (!confirmed) return

    setStatus('deleting')
    setMessage(null)

    try {
      const response = await fetch(`/api/proyectos/${proyecto.id}`, {
        method: 'DELETE',
      })

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo borrar el proyecto.')
      }

      setStatus('idle')
      startTransition(() => router.refresh())
    } catch (error) {
      setStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'Se produjo un error borrando el proyecto.',
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
        aria-label={`Borrar proyecto ${proyecto.numero_proyecto}`}
        title="Borrar proyecto"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {status === 'deleting' ? (
        <p className="text-[11px] text-slate-500">Borrando proyecto...</p>
      ) : null}
      {message ? <p className="text-[11px] text-rose-600 mt-1">{message}</p> : null}
    </div>
  )
}

// --- TARJETA KANBAN ---

/**
 * Tarjeta individual de un proyecto en la vista Kanban.
 * Replica el patron visual exacto de BoardCard en QuotationStatesBoard:
 *   - Codigo del proyecto (numero_proyecto)
 *   - Titulo en negrita
 *   - Descripcion en gris italica truncada
 *   - Bloque de cliente (cliente_nombre) en verde
 *   - Badge de aeronave
 *   - Badge de owner
 *   - Badge de prioridad
 *   - Fecha (fecha_inicio) abajo a la derecha
 *   - Selector de estado al pie
 */
function BoardCard({
  proyecto,
  stateConfigRows,
  onEstadoChange,
  onEstadoRevert,
}: {
  proyecto: Proyecto
  stateConfigRows: WorkflowStateConfigRow[]
  onEstadoChange?: (proyectoId: string, nuevoEstado: string) => void
  onEstadoRevert?: (proyectoId: string, estadoAnterior: string) => void
}) {
  return (
    <article className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition-transform hover:-translate-y-0.5 hover:border-sky-300">
      {/* Cabecera: codigo de proyecto */}
      <div className="space-y-1">
        <p className="font-mono text-[10px] tracking-[0.2em] text-slate-500">
          {proyecto.numero_proyecto}
        </p>
        <Link
          href={`/engineering/projects/${proyecto.id}`}
          className="block"
        >
          <h4 className="text-sm font-semibold leading-5 text-slate-950 transition-colors hover:text-sky-800">
            {proyecto.titulo}
          </h4>
        </Link>
      </div>

      {/* Descripcion preview */}
      {proyecto.descripcion ? (
        <p className="mt-2 text-xs italic text-slate-400 line-clamp-1">
          {proyecto.descripcion}
        </p>
      ) : null}

      {/* Bloque de cliente (replica el patron de IncomingClientIdentityBlock) */}
      {proyecto.cliente_nombre ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
            Cliente
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            {proyecto.cliente_nombre}
          </p>
        </div>
      ) : null}

      {/* Aeronave info */}
      {proyecto.aeronave ? (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
          <Plane size={11} />
          <span className="truncate">{proyecto.aeronave}</span>
        </div>
      ) : null}

      {/* Owner + Prioridad badges */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {proyecto.owner ? (
          <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
            <User size={10} />
            <span className="max-w-[80px] truncate">{proyecto.owner}</span>
          </span>
        ) : null}
        <PrioridadBadge prioridad={proyecto.prioridad} />
      </div>

      {/* Temporizador de horas (solo para estados activos, no nuevo ni cerrado) */}
      {proyecto.estado !== PROJECT_STATES.NUEVO && proyecto.estado !== PROJECT_STATES.CERRADO ? (
        <div className="mt-2">
          <ProjectTimerButton
            proyectoId={proyecto.id}
            numeroProyecto={proyecto.numero_proyecto}
          />
        </div>
      ) : null}

      {/* Fecha inicio alineada a la derecha */}
      {proyecto.fecha_inicio ? (
        <p className="mt-2 text-right text-[11px] text-slate-400">
          {proyecto.fecha_inicio}
        </p>
      ) : null}

      {/* Selector de estado + boton detalle */}
      <div className="mt-3 space-y-2">
        <ProjectStateControl proyecto={proyecto} stateConfigRows={stateConfigRows} onEstadoChange={onEstadoChange} onEstadoRevert={onEstadoRevert} />
        <div className="flex items-center justify-between">
          <ProjectDeleteControl proyecto={proyecto} />
          <Link
            href={`/engineering/projects/${proyecto.id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
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
 *   - Cabecera con dot coloreado + nombre del estado + chip contador
 *   - Borde de la columna con el color del estado
 *   - Tarjetas del proyecto
 *   - Estado vacio si no hay proyectos
 */
function BoardLane({
  stateMeta,
  proyectos,
  stateConfigRows,
  onEstadoChange,
  onEstadoRevert,
}: {
  stateMeta: ResolvedWorkflowStateMeta
  proyectos: Proyecto[]
  stateConfigRows: WorkflowStateConfigRow[]
  onEstadoChange?: (proyectoId: string, nuevoEstado: string) => void
  onEstadoRevert?: (proyectoId: string, estadoAnterior: string) => void
}) {
  // Filtrar proyectos que estan en este estado (incluyendo estados legacy)
  const laneProyectos = proyectos.filter((proyecto) => {
    const opState = getProjectOperationalState(proyecto.estado)
    return opState === stateMeta.state_code
  })

  return (
    <section
      className={cn(
        'flex h-full w-[320px] flex-none flex-col rounded-[30px] border bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_18px_42px_rgba(148,163,184,0.14)]',
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
        {laneProyectos.map((proyecto) => (
          <BoardCard
            key={proyecto.id}
            proyecto={proyecto}
            stateConfigRows={stateConfigRows}
            onEstadoChange={onEstadoChange}
            onEstadoRevert={onEstadoRevert}
          />
        ))}

        {laneProyectos.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/80 px-4 py-5 text-center">
            <p className="text-sm font-medium text-slate-900">Sin proyectos</p>
            <p className="mt-1 text-sm text-slate-500">
              Esta columna queda preparada para recibir proyectos.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

// --- VISTA TABLERO (KANBAN) ---

function TableroView({
  proyectos,
  resolvedStates,
  stateConfigRows,
  onEstadoChange,
  onEstadoRevert,
}: {
  proyectos: Proyecto[]
  resolvedStates: ResolvedWorkflowStateMeta[]
  stateConfigRows: WorkflowStateConfigRow[]
  onEstadoChange?: (proyectoId: string, nuevoEstado: string) => void
  onEstadoRevert?: (proyectoId: string, estadoAnterior: string) => void
}) {
  return (
    <div className="px-5 py-5">
      <div className="mb-4 rounded-[28px] border border-sky-100 bg-white/85 px-4 py-3 text-sm text-slate-600 shadow-sm">
        El tablero usa scroll horizontal. Usa la barra de desplazamiento o el trackpad para navegar entre columnas.
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex min-w-max gap-4 pr-2">
          {resolvedStates
            .filter((meta) => meta.state_code !== 'archivado')
            .map((meta) => (
              <BoardLane
                key={meta.state_code}
                stateMeta={meta}
                proyectos={proyectos}
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
  proyectos,
  stateConfigRows,
  onEstadoChange,
  onEstadoRevert,
}: {
  proyectos: Proyecto[]
  stateConfigRows: WorkflowStateConfigRow[]
  onEstadoChange?: (proyectoId: string, nuevoEstado: string) => void
  onEstadoRevert?: (proyectoId: string, estadoAnterior: string) => void
}) {
  return (
    <div className="px-5 py-5">
      <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_42px_rgba(148,163,184,0.12)]">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-950">
            Lista de proyectos
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Vista compacta de todos los proyectos activos con sus datos operativos.
          </p>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[1060px] w-full border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-200 bg-slate-50">
                {[
                  'Codigo',
                  'Titulo',
                  'Cliente',
                  'Estado',
                  'Aeronave',
                  'Owner',
                  'Prioridad',
                  'Fecha inicio',
                  'Horas',
                ].map((label) => (
                  <th
                    key={label}
                    className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {proyectos.map((proyecto, idx) => {
                const meta = getResolvedProjectBoardStatusMeta(proyecto.estado, stateConfigRows)
                return (
                  <tr
                    key={proyecto.id}
                    className={cn(
                      'border-b border-slate-200/60 align-top transition-colors hover:bg-sky-50/60',
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40',
                    )}
                  >
                    {/* Codigo / Numero de proyecto */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/engineering/projects/${proyecto.id}`}
                        className="block font-mono text-xs text-slate-500 hover:text-sky-700"
                      >
                        {proyecto.numero_proyecto}
                      </Link>
                    </td>

                    {/* Titulo + Descripcion */}
                    <td className="max-w-[260px] px-4 py-3">
                      <Link
                        href={`/engineering/projects/${proyecto.id}`}
                        className="block"
                      >
                        <span className="block truncate text-sm font-medium text-slate-950 hover:text-sky-800">
                          {proyecto.titulo}
                        </span>
                        {proyecto.descripcion ? (
                          <span className="block truncate text-[11px] italic text-slate-500">
                            {proyecto.descripcion}
                          </span>
                        ) : null}
                      </Link>
                    </td>

                    {/* Cliente */}
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {proyecto.cliente_nombre ?? '-'}
                    </td>

                    {/* Estado con badge coloreado + selector de cambio */}
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
                        <ProjectStateControl proyecto={proyecto} stateConfigRows={stateConfigRows} onEstadoChange={onEstadoChange} onEstadoRevert={onEstadoRevert} />
                      </div>
                    </td>

                    {/* Aeronave */}
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {proyecto.aeronave ?? '-'}
                    </td>

                    {/* Owner */}
                    <td className="whitespace-nowrap px-4 py-3">
                      {proyecto.owner ? (
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <User size={12} />
                          <span className="max-w-[100px] truncate">
                            {proyecto.owner}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>

                    {/* Prioridad */}
                    <td className="px-4 py-3">
                      <PrioridadBadge prioridad={proyecto.prioridad} />
                    </td>

                    {/* Fecha inicio */}
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {proyecto.fecha_inicio ?? '-'}
                    </td>

                    {/* Horas (temporizador) */}
                    <td className="px-4 py-3">
                      {proyecto.estado !== PROJECT_STATES.NUEVO && proyecto.estado !== PROJECT_STATES.CERRADO ? (
                        <ProjectTimerButton
                          proyectoId={proyecto.id}
                          numeroProyecto={proyecto.numero_proyecto}
                        />
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
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
 * Componente principal de Proyectos activos.
 * Ofrece toggle entre vista Tablero (Kanban) y Lista,
 * con barra de busqueda y filtro de estado.
 *
 * Los colores de las columnas, badges y chips se resuelven desde
 * workflow-state-config usando el sistema de COLOR_STYLE_MAP,
 * siguiendo la misma filosofia que el modulo de Quotations.
 */
export function ProyectosClient({
  initialProyectos,
  initialStateConfigRows,
}: {
  initialProyectos: Proyecto[]
  initialStateConfigRows: WorkflowStateConfigRow[]
}) {
  const [view, setView] = useState<BoardView>('board')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Estado local de proyectos. Se inicializa con los datos del servidor
  // y se actualiza en tiempo real via Supabase Realtime.
  const [proyectos, setProyectos] = useState<Proyecto[]>(initialProyectos)

  // Sincronizar si los datos iniciales del servidor cambian (navegacion, etc.)
  useEffect(() => {
    setProyectos(initialProyectos)
  }, [initialProyectos])

  // --- Supabase Realtime: suscripcion a cambios en doa_proyectos ---
  // Escucha INSERT, UPDATE y DELETE en la tabla y actualiza el estado local
  // automaticamente sin necesidad de router.refresh().
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('proyectos-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'doa_proyectos' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setProyectos((prev) =>
              prev.map((p) =>
                p.id === (payload.new as Proyecto).id
                  ? { ...p, ...(payload.new as Proyecto) }
                  : p,
              ),
            )
          } else if (payload.eventType === 'INSERT') {
            setProyectos((prev) => [...prev, payload.new as Proyecto])
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

  // Callback para actualizar el estado de un proyecto localmente (optimista).
  // La tarjeta se mueve inmediatamente; luego Supabase Realtime confirma el cambio real.
  const handleEstadoChange = useCallback((proyectoId: string, nuevoEstado: string) => {
    setProyectos((prev) =>
      prev.map((p) =>
        p.id === proyectoId ? { ...p, estado: nuevoEstado as EstadoProyectoPersistido } : p,
      ),
    )
  }, [])

  // Callback para revertir un cambio optimista (cuando la API falla).
  const handleEstadoRevert = useCallback((proyectoId: string, estadoAnterior: string) => {
    setProyectos((prev) =>
      prev.map((p) =>
        p.id === proyectoId ? { ...p, estado: estadoAnterior as EstadoProyectoPersistido } : p,
      ),
    )
  }, [])

  // Resolver los estados del tablero de proyectos con la configuracion actual
  const resolvedStates = useMemo(
    () => resolveWorkflowStateRows(WORKFLOW_STATE_SCOPES.PROJECT_BOARD, initialStateConfigRows),
    [initialStateConfigRows],
  )

  // Filtrar proyectos por busqueda y estado
  const filtered = useMemo(
    () =>
      proyectos.filter((proyecto) => {
        // Filtro de busqueda por texto
        const matchSearch =
          search === '' ||
          proyecto.titulo.toLowerCase().includes(search.toLowerCase()) ||
          proyecto.numero_proyecto
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (proyecto.descripcion ?? '')
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (proyecto.cliente_nombre ?? '')
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (proyecto.aeronave ?? '')
            .toLowerCase()
            .includes(search.toLowerCase())

        // Filtro por estado
        const matchStatus =
          statusFilter === 'all' ||
          getProjectOperationalState(proyecto.estado) === statusFilter

        return matchSearch && matchStatus
      }),
    [proyectos, search, statusFilter],
  )

  // Metricas de resumen por columna (usando los estados resueltos)
  const metrics = useMemo(() => {
    const byColumn = resolvedStates
      .filter((meta) => meta.state_code !== 'archivado')
      .map((meta) => ({
        stateCode: meta.state_code,
        title: meta.label,
        count: filtered.filter((p) => {
          const opState = getProjectOperationalState(p.estado)
          return opState === meta.state_code
        }).length,
        accent: meta.boardAccent,
      }))
    return { total: filtered.length, byColumn }
  }, [filtered, resolvedStates])

  // Estados disponibles para el filtro (solo los que tienen proyectos)
  const availableStates = useMemo(
    () =>
      resolvedStates.filter((meta) =>
        proyectos.some(
          (p) => getProjectOperationalState(p.estado) === meta.state_code,
        ),
      ),
    [proyectos, resolvedStates],
  )

  return (
    <Tabs
      value={view}
      onValueChange={(nextValue) => setView(nextValue as BoardView)}
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden p-5 text-slate-900"
    >
      {/* Seccion principal con borde redondeado */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[34px] border border-sky-100 bg-[radial-gradient(circle_at_top_left,#eff8ff_0%,#ffffff_45%,#f8fafc_100%)] shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
        {/* Cabecera con titulo, metricas y controles */}
        <div className="border-b border-sky-100 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Titulo e indicador */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                <LayoutGrid className="h-3.5 w-3.5" />
                Proyectos activos
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  Tablero de proyectos de ingenieria
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  Seguimiento operativo de los proyectos agrupados por fase del
                  workflow. Usa las columnas del tablero o la vista lista para
                  gestionar el avance.
                </p>
              </div>
            </div>

            {/* Metricas de resumen */}
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="rounded-[22px] border border-sky-200 bg-white/90 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Proyectos
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {metrics.total}
                </p>
              </div>
              {metrics.byColumn
                .filter((col) => col.count > 0)
                .map((col) => (
                  <div
                    key={col.stateCode}
                    className="rounded-[22px] border border-sky-200 bg-white/90 px-4 py-3"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {col.title}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {col.count}
                    </p>
                  </div>
                ))}
            </div>
          </div>

          {/* Barra de busqueda, filtro y toggle de vista */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {/* Toggle Tablero / Lista */}
            <TabsList
              variant="default"
              className="flex w-auto gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-2"
            >
              {VIEW_OPTIONS.map((option) => {
                const Icon = option.icon
                return (
                  <TabsTrigger
                    key={option.value}
                    value={option.value}
                    className="rounded-[18px] px-4 py-2.5 text-sm font-semibold text-slate-500 transition-all data-active:bg-white data-active:text-slate-950 data-active:shadow-sm"
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {/* Barra de busqueda */}
            <div className="relative max-w-xs min-w-[200px] flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Buscar proyectos..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-950 placeholder-slate-400 transition-colors focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
              />
            </div>

            {/* Filtro por estado */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-950 transition-colors focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
              >
                <option value="all">Todos los estados</option>
                {availableStates.map((meta) => (
                  <option key={meta.state_code} value={meta.state_code}>
                    {meta.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Contenido de las vistas */}
        <div className="min-h-0 flex-1 overflow-auto">
          {filtered.length === 0 ? (
            /* Estado vacio */
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
              <Inbox className="h-10 w-10" />
              <p className="text-sm">
                No hay proyectos activos. Los proyectos se crean desde las
                consultas entrantes.
              </p>
            </div>
          ) : (
            <>
              <TabsContent value="board" className="min-h-0">
                <TableroView
                  proyectos={filtered}
                  resolvedStates={resolvedStates}
                  stateConfigRows={initialStateConfigRows}
                  onEstadoChange={handleEstadoChange}
                  onEstadoRevert={handleEstadoRevert}
                />
              </TabsContent>

              <TabsContent value="list">
                <ListaView
                  proyectos={filtered}
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
