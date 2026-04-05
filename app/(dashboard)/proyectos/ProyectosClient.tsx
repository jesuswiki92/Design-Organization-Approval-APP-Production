/**
 * ============================================================================
 * COMPONENTE CLIENTE DE PROYECTOS ACTIVOS (TABLERO + LISTA)
 * ============================================================================
 *
 * Este componente ofrece dos vistas para gestionar los proyectos activos:
 *
 * VISTAS DISPONIBLES:
 *   1. TABLERO (Kanban): una columna por cada estado del flujo simplificado
 *   2. LISTA: tabla con filtros y busqueda para operacion rapida
 *
 * COLUMNAS DEL TABLERO (estados simplificados):
 *   - Nuevo: proyecto recien creado
 *   - En Progreso: trabajo de ingenieria en curso
 *   - Revision: en proceso de revision tecnica
 *   - Aprobacion: pendiente de aprobacion
 *   - Entregado: documentacion entregada al cliente
 *
 * FUNCIONALIDADES:
 *   - Cambiar estado de un proyecto desde el tablero o la lista
 *   - Buscar por numero de proyecto, titulo o descripcion
 *   - Filtrar por estado
 *   - Ver detalle del proyecto al hacer click
 *
 * NOTA TECNICA: El estado "cerrado" no se muestra en este tablero
 * porque se filtra en el servidor (page.tsx).
 * ============================================================================
 */

'use client'

// --- IMPORTACIONES ---

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startTransition, useMemo, useState } from 'react'
import {
  ChevronDown,
  Inbox,
  LayoutGrid,
  List,
  Search,
  User,
} from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  PROJECT_STATE_CONFIG,
  PROJECT_WORKFLOW_STATES,
  getAllowedProjectTransitions,
  getProjectOperationalState,
  getProjectStatusMeta,
} from '@/lib/workflow-states'
import type { Proyecto } from '@/types/database'

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

/**
 * Definicion de las columnas del Kanban.
 * Cada columna corresponde a un estado del flujo simplificado de proyectos.
 */
type KanbanColumnDef = {
  id: string
  title: string
  states: readonly string[]
  color: string
  bg: string
  border: string
  dot: string
}

const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    id: 'nuevo',
    title: 'Nuevo',
    states: ['nuevo'],
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  {
    id: 'en_progreso',
    title: 'En Progreso',
    states: ['en_progreso'],
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  {
    id: 'revision',
    title: 'Revision',
    states: ['revision'],
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  {
    id: 'aprobacion',
    title: 'Aprobacion',
    states: ['aprobacion'],
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  {
    id: 'entregado',
    title: 'Entregado',
    states: ['entregado'],
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
]

// --- COMPONENTES AUXILIARES ---

/**
 * Badge visual del estado de un proyecto.
 * Usa los colores definidos en PROJECT_STATE_CONFIG.
 */
function StatusBadge({ estado }: { estado: string }) {
  const cfg = getProjectStatusMeta(estado)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium',
        cfg.color,
        cfg.bg,
        cfg.border,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.shortLabel}
    </span>
  )
}

/**
 * Badge de prioridad del proyecto.
 * Usa clasificacion_cambio como indicador visual.
 */
function PrioridadBadge({
  clasificacion,
}: {
  clasificacion: string | null
}) {
  if (!clasificacion) return null

  const CLASIFICACION_COLORS: Record<string, string> = {
    mayor: 'text-purple-700 bg-purple-50 border-purple-200',
    menor: 'text-blue-700 bg-blue-50 border-blue-200',
    reparacion: 'text-orange-700 bg-orange-50 border-orange-200',
    stc: 'text-pink-700 bg-pink-50 border-pink-200',
    otro: 'text-slate-600 bg-slate-100 border-slate-200',
  }

  const colorClass =
    CLASIFICACION_COLORS[clasificacion] ??
    'text-slate-600 bg-slate-100 border-slate-200'

  return (
    <span
      className={cn(
        'inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        colorClass,
      )}
    >
      {clasificacion}
    </span>
  )
}

/**
 * Selector desplegable para cambiar el estado de un proyecto.
 * Muestra solo las transiciones permitidas desde el estado actual.
 * Llama a la API PATCH y refresca la pagina al cambiar.
 */
function ProjectStateControl({ proyecto }: { proyecto: Proyecto }) {
  const router = useRouter()
  const [selectedState, setSelectedState] = useState<string>(proyecto.estado)
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const allowedTransitions = getAllowedProjectTransitions(proyecto.estado)

  // Si no hay transiciones posibles, solo mostrar el estado actual
  if (allowedTransitions.length === 0) {
    return <StatusBadge estado={proyecto.estado} />
  }

  async function handleChange(nextState: string) {
    if (!nextState || nextState === proyecto.estado) {
      setSelectedState(proyecto.estado)
      return
    }

    setSelectedState(nextState)
    setStatus('saving')
    setMessage(null)

    try {
      const response = await fetch(`/api/proyectos/${proyecto.id}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nextState }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(
          payload?.error || 'No se pudo actualizar el estado del proyecto.',
        )
      }

      setStatus('idle')
      startTransition(() => router.refresh())
    } catch (error) {
      setSelectedState(proyecto.estado)
      setStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'Se produjo un error actualizando el estado.',
      )
    }
  }

  // Construir opciones: estado actual + transiciones permitidas
  const options: Array<{ value: string; label: string }> = [
    {
      value: proyecto.estado,
      label: getProjectStatusMeta(proyecto.estado).label,
    },
    ...allowedTransitions.map((state) => ({
      value: state,
      label: getProjectStatusMeta(state).label,
    })),
  ]

  return (
    <div className="space-y-1">
      <label className="sr-only" htmlFor={`project-state-${proyecto.id}`}>
        Cambiar estado del proyecto
      </label>
      <select
        id={`project-state-${proyecto.id}`}
        value={selectedState}
        disabled={status === 'saving'}
        onChange={(event) => void handleChange(event.target.value)}
        className="h-7 min-w-[160px] rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 outline-none transition-colors hover:border-sky-300 focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-wait disabled:opacity-70"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
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

// --- TARJETA KANBAN ---

/**
 * Tarjeta individual de un proyecto en la vista Kanban.
 * Muestra: numero_proyecto, titulo, tipo_modificacion, owner_id, estado.
 */
function ProyectoKanbanCard({ proyecto }: { proyecto: Proyecto }) {
  const meta = getProjectStatusMeta(proyecto.estado)

  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-3 shadow-[0_10px_24px_rgba(148,163,184,0.12)] transition-all hover:border-sky-300 hover:bg-sky-50/40">
      {/* Cabecera: numero de proyecto + estado */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <Link
          href={`/engineering/projects/${proyecto.id}`}
          className="font-mono text-[11px] tracking-wide text-slate-500 hover:text-sky-700"
        >
          {proyecto.numero_proyecto}
        </Link>
        <StatusBadge estado={proyecto.estado} />
      </div>

      {/* Titulo del proyecto */}
      <Link
        href={`/engineering/projects/${proyecto.id}`}
        className="block"
      >
        <p className="mb-2 line-clamp-2 text-sm font-medium leading-snug text-slate-950 transition-colors hover:text-sky-800">
          {proyecto.titulo}
        </p>
      </Link>

      {/* Tipo de modificacion y clasificacion */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-slate-500">
          {proyecto.tipo_modificacion}
        </span>
        <PrioridadBadge clasificacion={proyecto.clasificacion_cambio} />
      </div>

      {/* Owner y selector de estado */}
      <div className="flex items-center justify-between gap-2">
        {proyecto.owner_id ? (
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <User size={11} />
            <span className="max-w-[80px] truncate">{proyecto.owner_id}</span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400">Sin asignar</span>
        )}
        <ProjectStateControl proyecto={proyecto} />
      </div>
    </div>
  )
}

// --- COLUMNA KANBAN ---

/**
 * Una columna del tablero Kanban. Agrupa proyectos de varios estados
 * operativos bajo una misma fase logica.
 */
function KanbanColumn({
  column,
  proyectos,
}: {
  column: KanbanColumnDef
  proyectos: Proyecto[]
}) {
  // Filtrar proyectos que estan en alguno de los estados de esta columna
  const columnProyectos = proyectos.filter((proyecto) => {
    const opState = getProjectOperationalState(proyecto.estado)
    return opState ? column.states.includes(opState) : false
  })

  return (
    <div className="min-w-[280px] flex-none">
      {/* Cabecera de la columna */}
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', column.dot)} />
          <span className="text-sm font-medium text-slate-900">
            {column.title}
          </span>
        </div>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-xs font-semibold',
            column.color,
            column.bg,
            column.border,
          )}
        >
          {columnProyectos.length}
        </span>
      </div>

      {/* Tarjetas */}
      <div className="flex flex-col gap-2">
        {columnProyectos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
            Sin proyectos
          </div>
        ) : (
          columnProyectos.map((proyecto) => (
            <ProyectoKanbanCard key={proyecto.id} proyecto={proyecto} />
          ))
        )}
      </div>
    </div>
  )
}

// --- VISTA TABLERO (KANBAN) ---

function TableroView({ proyectos }: { proyectos: Proyecto[] }) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-4 pr-2">
        {KANBAN_COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            proyectos={proyectos}
          />
        ))}
      </div>
    </div>
  )
}

// --- VISTA LISTA ---

function ListaView({ proyectos }: { proyectos: Proyecto[] }) {
  return (
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
                'Tipo',
                'Estado',
                'Clasificacion',
                'Owner',
                'Fecha apertura',
                'Fecha prevista',
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
            {proyectos.map((proyecto, idx) => (
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

                {/* Titulo */}
                <td className="max-w-[260px] px-4 py-3">
                  <Link
                    href={`/engineering/projects/${proyecto.id}`}
                    className="block"
                  >
                    <span className="block truncate text-sm font-medium text-slate-950 hover:text-sky-800">
                      {proyecto.titulo}
                    </span>
                    {proyecto.descripcion ? (
                      <span className="block truncate text-[11px] text-slate-500">
                        {proyecto.descripcion}
                      </span>
                    ) : null}
                  </Link>
                </td>

                {/* Tipo de modificacion */}
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                  {proyecto.tipo_modificacion}
                </td>

                {/* Estado con selector de cambio */}
                <td className="min-w-[200px] px-4 py-3">
                  <ProjectStateControl proyecto={proyecto} />
                </td>

                {/* Clasificacion del cambio */}
                <td className="px-4 py-3">
                  <PrioridadBadge
                    clasificacion={proyecto.clasificacion_cambio}
                  />
                </td>

                {/* Owner */}
                <td className="whitespace-nowrap px-4 py-3">
                  {proyecto.owner_id ? (
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <User size={12} />
                      <span className="max-w-[100px] truncate">
                        {proyecto.owner_id}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">-</span>
                  )}
                </td>

                {/* Fecha apertura */}
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                  {proyecto.fecha_apertura ?? '-'}
                </td>

                {/* Fecha prevista */}
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                  {proyecto.fecha_prevista ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- COMPONENTE PRINCIPAL ---

/**
 * Componente principal de Proyectos activos.
 * Ofrece toggle entre vista Tablero (Kanban) y Lista,
 * con barra de busqueda y filtro de estado.
 */
export function ProyectosClient({
  initialProyectos,
}: {
  initialProyectos: Proyecto[]
}) {
  const [view, setView] = useState<BoardView>('board')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Filtrar proyectos por busqueda y estado
  const filtered = useMemo(
    () =>
      initialProyectos.filter((proyecto) => {
        // Filtro de busqueda por texto
        const matchSearch =
          search === '' ||
          proyecto.titulo.toLowerCase().includes(search.toLowerCase()) ||
          proyecto.numero_proyecto
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (proyecto.descripcion ?? '')
            .toLowerCase()
            .includes(search.toLowerCase())

        // Filtro por estado
        const matchStatus =
          statusFilter === 'all' ||
          getProjectOperationalState(proyecto.estado) === statusFilter

        return matchSearch && matchStatus
      }),
    [initialProyectos, search, statusFilter],
  )

  // Metricas de resumen
  const metrics = useMemo(() => {
    const byColumn = KANBAN_COLUMNS.map((col) => ({
      id: col.id,
      title: col.title,
      count: filtered.filter((p) => {
        const opState = getProjectOperationalState(p.estado)
        return opState ? col.states.includes(opState) : false
      }).length,
      dot: col.dot,
      color: col.color,
    }))
    return { total: filtered.length, byColumn }
  }, [filtered])

  // Estados disponibles para el filtro (solo los que tienen proyectos)
  const availableStates = useMemo(
    () =>
      PROJECT_WORKFLOW_STATES.filter((state) =>
        initialProyectos.some(
          (p) => getProjectOperationalState(p.estado) === state,
        ),
      ),
    [initialProyectos],
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
                    key={col.id}
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
                {availableStates.map((state) => {
                  const meta = getProjectStatusMeta(state)
                  return (
                    <option key={state} value={state}>
                      {meta.label}
                    </option>
                  )
                })}
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
              <TabsContent value="board" className="min-h-0 px-5 py-5">
                <TableroView proyectos={filtered} />
              </TabsContent>

              <TabsContent value="list" className="px-5 py-5">
                <ListaView proyectos={filtered} />
              </TabsContent>
            </>
          )}
        </div>
      </section>
    </Tabs>
  )
}
