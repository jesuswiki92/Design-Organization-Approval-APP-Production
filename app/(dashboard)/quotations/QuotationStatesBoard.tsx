/**
 * ============================================================================
 * TABLERO DE ESTADOS DE QUOTATIONS (COMPONENTE PRINCIPAL)
 * ============================================================================
 *
 * Este es el componente mas complejo de la seccion de Quotations. Funciona
 * como un "centro de control" que ofrece multiples vistas y herramientas:
 *
 * VISTAS DISPONIBLES:
 *   1. TABLERO (Board): columnas tipo Kanban con tarjetas de quotations
 *   2. LISTA: tabla con filas para cada estado y su tarjeta principal
 *   3. CONFIGURACION: editor para personalizar estados (nombres, colores, orden)
 *
 * QUE PERMITE AL USUARIO:
 *   - Ver todas las quotations organizadas por estado
 *   - Cambiar el estado de una consulta entrante (selector desplegable)
 *   - Archivar consultas (moverlas a estado "archivado")
 *   - Borrar consultas (eliminarlas del tablero)
 *   - Crear nuevas columnas personalizadas
 *   - Personalizar nombres, colores y orden de los estados
 *   - Guardar la configuracion de estados en Supabase
 *
 * COMPONENTES INTERNOS:
 *   - IncomingQueryDeleteControl: boton para borrar una consulta
 *   - IncomingQueryArchiveControl: boton para archivar una consulta
 *   - IncomingClientIdentityBlock: muestra si el cliente es conocido o desconocido
 *   - BoardCard: tarjeta individual en la vista de tablero
 *   - BoardLane: columna completa del tablero (con sus tarjetas)
 *   - ListRow: fila de la vista lista
 *   - ScopeEditor: editor de configuracion de estados
 *   - QuotationStatesBoard: componente principal que orquesta todo
 *
 * NOTA TECNICA: Las columnas personalizadas se guardan en localStorage
 * del navegador. La configuracion de estados se guarda en Supabase.
 * ============================================================================
 */

'use client'

// --- IMPORTACIONES ---

// Navegacion entre paginas
import Link from 'next/link'
// Hook para refrescar datos de la pagina
import { useRouter } from 'next/navigation'
// Hooks de React para manejar estados, efectos y optimizaciones
import {
  startTransition,   // Marca actualizaciones como no urgentes
  useEffect,         // Ejecutar codigo al montar/cambiar el componente
  useMemo,           // Memorizar calculos costosos
  useRef,            // Referencia a elementos del DOM
  useState,          // Manejar estados del componente
  type FormEvent,    // Tipo para eventos de formulario
} from 'react'
// Iconos decorativos para botones y acciones
import {
  Archive,           // Archivar
  LayoutGrid,        // Vista tablero
  List,              // Vista lista
  Plus,              // Anadir / ver detalle
  RotateCcw,         // Restaurar configuracion
  Save,              // Guardar
  Settings2,         // Configuracion
  Trash2,            // Borrar
} from 'lucide-react'

// Componentes visuales reutilizables (shadcn/ui)
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
// Funciones para manejar la configuracion de estados del workflow
import {
  getWorkflowStateColorOptions,         // Opciones de colores disponibles
  replaceWorkflowStateRowsForScope,     // Reemplazar filas de un scope
  resolveWorkflowStateRows,             // Resolver filas con valores por defecto
  WORKFLOW_STATE_SCOPES,                // Constantes de scopes del workflow
} from '@/lib/workflow-state-config'
// Utilidad para combinar clases CSS
import { cn } from '@/lib/utils'
// Tipos de datos
import type {
  WorkflowStateConfigRow,   // Fila de configuracion de estado
  WorkflowStateScope,       // Scope: "quotation_board" o "incoming_queries"
} from '@/types/database'
// Constantes de estados de consultas (ej: ARCHIVADO)
import { CONSULTA_ESTADOS } from '@/lib/workflow-states'
// Selector de estado reutilizable (webhook n8n)
import { QuotationStateSelector } from './QuotationStateSelector'
// Funciones y tipos para consultas entrantes
import {
  getQuotationBoardStateOptions,
  type IncomingQuery,
  type QuotationBoardStateOption,
} from './incoming-queries'
// Tipos y funciones para los datos del tablero
import type { QuotationLane } from './quotation-board-data'
import {
  canDeleteQuotationLane,               // Verifica si una columna se puede borrar
  defaultQuotationLanes,                // Genera columnas por defecto
  loadStoredCustomQuotationLanes,       // Carga columnas personalizadas del navegador
  makeCustomQuotationLane,              // Crea una nueva columna personalizada
  stripQuotationLaneAccent,             // Limpia datos de color para guardar
  type QuotationCard,                   // Tipo de tarjeta
  QUOTATION_BOARD_STORAGE_KEY,          // Clave de localStorage
} from './quotation-board-data'

// --- TIPOS INTERNOS ---

/** Vista activa: "board" (tablero) o "list" (lista) */
type BoardView = 'board' | 'list'

/** Estado de guardado de la configuracion para cada scope */
type ScopeSaveState = {
  status: 'idle' | 'saving' | 'success' | 'error'
  message: string | null
}

/** Opcion de estado para el selector del pipeline de cotizaciones */
type BoardStateOption = QuotationBoardStateOption

/** Opciones de vista disponibles con sus iconos */
const VIEW_OPTIONS: Array<{
  value: BoardView
  label: string
  icon: typeof LayoutGrid
}> = [
  { value: 'board', label: 'Tablero', icon: LayoutGrid },
  { value: 'list', label: 'Lista', icon: List },
]

/** Textos descriptivos para cada scope de configuracion de estados */
const SCOPE_COPY: Record<
  WorkflowStateScope,
  { title: string; description: string; helper: string }
> = {
  quotation_board: {
    title: 'Board de quotations',
    description: 'Configura columnas, color, etiquetas cortas y orden visual del tablero.',
    helper: 'Estos estados controlan el board y la vista lista de Quotations.',
  },
  incoming_queries: {
    title: 'Consultas entrantes',
    description: 'Configura cómo se muestran los estados del flujo previo a quotation.',
    helper: 'Los códigos técnicos siguen fijos en Supabase; aquí solo cambias presentación.',
  },
  project_board: {
    title: 'Board de proyectos',
    description: 'Configura columnas, color, etiquetas cortas y orden visual del tablero de proyectos.',
    helper: 'Estos estados controlan el board y la vista lista de Proyectos.',
  },
}

/** Opciones de colores disponibles para configurar estados */
const COLOR_OPTIONS = getWorkflowStateColorOptions()

/**
 * Organiza las filas de configuracion por scope (quotation_board / incoming_queries).
 * Resuelve valores por defecto para las filas que faltan.
 */
function normalizeEditableRows(
  rows: WorkflowStateConfigRow[],
): Record<WorkflowStateScope, WorkflowStateConfigRow[]> {
  return {
    quotation_board: resolveWorkflowStateRows(
      WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
      rows,
    ).map(stripResolvedStateMeta),
    incoming_queries: resolveWorkflowStateRows(
      WORKFLOW_STATE_SCOPES.INCOMING_QUERIES,
      rows,
    ).map(stripResolvedStateMeta),
    project_board: resolveWorkflowStateRows(
      WORKFLOW_STATE_SCOPES.PROJECT_BOARD,
      rows,
    ).map(stripResolvedStateMeta),
  }
}

/** Extrae solo los campos necesarios de una fila de configuracion de estado */
function stripResolvedStateMeta(row: WorkflowStateConfigRow) {
  const {
    id,
    scope,
    state_code,
    label,
    short_label,
    description,
    color_token,
    sort_order,
    is_system,
    is_active,
    created_at,
    updated_at,
  } = row

  return {
    id,
    scope,
    state_code,
    label,
    short_label,
    description,
    color_token,
    sort_order,
    is_system,
    is_active,
    created_at,
    updated_at,
  }
}

/**
 * Boton para borrar una consulta entrante del tablero.
 * Pide confirmacion al usuario antes de eliminar.
 * Llama a la API DELETE y refresca la pagina.
 */
function IncomingQueryDeleteControl({
  card,
  compact = false,
}: {
  card: QuotationCard
  compact?: boolean
}) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'deleting' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  if (card.kind !== 'incoming_query') {
    return null
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `¿Seguro que quieres borrar la consulta "${card.title}"? Esta acción eliminará la card del tablero.`,
    )
    if (!confirmed) return

    setStatus('deleting')
    setMessage(null)

    try {
      const response = await fetch(`/api/consultas/${card.id}`, {
        method: 'DELETE',
      })

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo borrar la consulta.')
      }

      setStatus('idle')
      startTransition(() => router.refresh())
    } catch (error) {
      setStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'Se produjo un error borrando la consulta.',
      )
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={status === 'deleting'}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold uppercase tracking-[0.16em] text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-wait disabled:opacity-70',
          compact ? 'h-9 px-3' : 'h-10 px-3',
        )}
        aria-label={`Borrar consulta ${card.title}`}
        title="Borrar card"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {status === 'deleting' ? (
        <p className="text-[11px] text-slate-500">Borrando consulta...</p>
      ) : null}
      {message ? <p className="text-[11px] text-rose-600">{message}</p> : null}
    </div>
  )
}

/**
 * Boton para archivar una consulta entrante.
 * Archivar significa cambiar su estado a "archivado" en la base de datos.
 * La consulta desaparece del tablero pero sigue guardada en Supabase.
 */
function IncomingQueryArchiveControl({
  card,
  compact = false,
}: {
  card: QuotationCard
  compact?: boolean
}) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  if (card.kind !== 'incoming_query' || card.stateCode === CONSULTA_ESTADOS.ARCHIVADO) {
    return null
  }

  async function handleArchive() {
    const confirmed = window.confirm(
      `¿Archivar la consulta "${card.title}"? Desaparecerá de Quotations pero seguirá guardada en Supabase.`,
    )
    if (!confirmed) return

    setStatus('saving')
    setMessage(null)

    try {
      const response = await fetch(`/api/consultas/${card.id}/state`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ estado: CONSULTA_ESTADOS.ARCHIVADO }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(payload?.error || 'No se pudo archivar la consulta.')
      }

      setStatus('idle')
      startTransition(() => router.refresh())
    } catch (error) {
      setStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'Se produjo un error archivando la consulta.',
      )
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void handleArchive()}
        disabled={status === 'saving'}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70',
          compact ? 'h-9 px-3' : 'h-10 px-3',
        )}
        aria-label={`Archivar consulta ${card.title}`}
        title="Archivar card"
      >
        <Archive className="h-3.5 w-3.5" />
        {!compact ? 'Archivar' : null}
      </button>
      {status === 'saving' ? (
        <p className="text-[11px] text-slate-500">Archivando consulta...</p>
      ) : null}
      {message ? <p className="text-[11px] text-rose-600">{message}</p> : null}
    </div>
  )
}

/**
 * Bloque que muestra la identidad del cliente en la tarjeta.
 * Si el cliente es conocido: muestra empresa, nombre y email en verde.
 * Si el cliente es desconocido: muestra una etiqueta de alerta en amarillo.
 */
function IncomingClientIdentityBlock({ card }: { card: QuotationCard }) {
  if (card.kind !== 'incoming_query' || !card.clientIdentity) {
    return null
  }

  if (card.clientIdentity.kind === 'known') {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
          Cliente conocido
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-950">
          {card.clientIdentity.companyName}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          {card.clientIdentity.contactName}
        </p>
        <p className="text-sm text-slate-500">{card.clientIdentity.email}</p>
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
        {card.clientIdentity.displayLabel}
      </p>
    </div>
  )
}

/**
 * Tarjeta individual de una quotation en la vista de tablero (Board).
 * Muestra: codigo, titulo, nota, identidad del cliente, fecha de entrega,
 * selector de estado, enlace al detalle y boton de borrar.
 */
function BoardCard({
  card,
  stateOptions,
}: {
  card: QuotationCard
  stateOptions: BoardStateOption[]
}) {
  return (
    <article className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition-transform hover:-translate-y-0.5 hover:border-sky-300">
      <div className="space-y-1">
        <p className="font-mono text-[10px] tracking-[0.2em] text-slate-500">{card.code}</p>
        <h4 className="text-sm font-semibold leading-5 text-slate-950">{card.title}</h4>
      </div>

      {card.note ? (
        <p className="mt-2 text-xs italic text-slate-400 line-clamp-1">{card.note}</p>
      ) : null}

      <IncomingClientIdentityBlock card={card} />

      {card.due ? (
        <p className="mt-2 text-right text-[11px] text-slate-400">{card.due}</p>
      ) : null}

      <div className="mt-3 space-y-2">
        <QuotationStateSelector
          consultaId={card.id}
          consultaCodigo={card.code}
          currentEstado={card.stateCode ?? 'entrada_recibida'}
        />
        <div className="flex items-center justify-between gap-2">
          <Link
            href={card.href ?? `/quotations/${card.id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
            title="Ver detalle"
          >
            <Plus className="h-4 w-4" />
          </Link>
          <IncomingQueryDeleteControl card={card} compact />
        </div>
      </div>
    </article>
  )
}

/**
 * Columna completa del tablero (vista Board).
 * Muestra la cabecera con nombre del estado, color, contador de tarjetas,
 * y debajo todas las tarjetas que pertenecen a ese estado.
 * Si la columna es personalizada, muestra boton para borrarla.
 */
function BoardLane({
  lane,
  stateOptions,
  onDeleteLane,
}: {
  lane: QuotationLane
  stateOptions: BoardStateOption[]
  onDeleteLane: (laneId: string) => void
}) {
  return (
    <section
      className={cn(
        'flex h-full w-[320px] flex-none flex-col rounded-[30px] border bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_18px_42px_rgba(148,163,184,0.14)]',
        lane.accent.border,
      )}
    >
      <div className={cn('rounded-[22px] border px-4 py-4', lane.accent.bg, lane.accent.border)} title={lane.description}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full', lane.accent.dot)} />
              <h3 className={cn('text-sm font-semibold', lane.accent.text)}>{lane.title}</h3>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
                lane.accent.chip,
              )}
            >
              {lane.cards.length}
            </span>
            {canDeleteQuotationLane(lane) ? (
              <button
                type="button"
                onClick={() => onDeleteLane(lane.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                aria-label={`Delete state ${lane.title}`}
                title="Delete custom state"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-3">
        {lane.cards.map((card) => (
          <BoardCard key={card.id} card={card} stateOptions={stateOptions} />
        ))}

        {lane.cards.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/80 px-4 py-5 text-center">
            <p className="text-sm font-medium text-slate-900">Sin quotations reales todavía</p>
            <p className="mt-1 text-sm text-slate-500">
              Esta columna queda preparada para recibir casos reales.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

/**
 * Fila de la vista Lista.
 * Muestra una fila por cada estado/columna del tablero, con la tarjeta
 * principal (la primera) y sus controles de estado, archivar y borrar.
 */
function ListRow({
  lane,
  stateOptions,
  onDeleteLane,
}: {
  lane: QuotationLane
  stateOptions: BoardStateOption[]
  onDeleteLane: (laneId: string) => void
}) {
  const leadCard = lane.cards[0]

  return (
    <tr className="border-b border-slate-200/70 bg-white transition-colors hover:bg-sky-50/50">
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', lane.accent.dot)} />
          <div>
            <p className="font-mono text-[11px] text-slate-500">{leadCard?.code ?? 'STATE'}</p>
            <p className="text-sm font-semibold text-slate-950">{lane.title}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-top text-sm text-slate-600">{lane.cards.length}</td>
      <td className="px-4 py-3 align-top text-sm text-slate-600">
        <div className="space-y-1">
          <p className="font-medium text-slate-900">
            {leadCard?.title ?? 'Sin quotations reales todavía'}
          </p>
          <p className="text-slate-500">
            {leadCard?.note ?? 'Esta fila se activará cuando entren ejemplos reales.'}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 align-top text-sm text-slate-600">
        <div className="space-y-1">
          <p>{leadCard?.owner ?? '-'}</p>
          {leadCard?.kind === 'incoming_query' && leadCard.clientIdentity ? (
            leadCard.clientIdentity.kind === 'known' ? (
              <div className="text-xs leading-5 text-slate-500">
                <p className="font-semibold text-slate-900">
                  {leadCard.clientIdentity.companyName}
                </p>
                <p>
                  {leadCard.clientIdentity.contactName} · {leadCard.clientIdentity.email}
                </p>
              </div>
            ) : (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
                {leadCard.clientIdentity.displayLabel}
              </p>
            )
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-sm text-slate-600">{leadCard?.due ?? '-'}</td>
      <td className="px-4 py-3 align-top">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {leadCard?.tag ?? 'Empty'}
        </span>
        {leadCard?.statusLabel ? (
          <p className="mt-2 font-mono text-[11px] text-slate-500">{leadCard.statusLabel}</p>
        ) : null}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap items-center gap-2">
          {leadCard ? (
            <Link
              href={leadCard.href ?? `/quotations/${leadCard.id}`}
              className="inline-flex h-9 items-center rounded-full border border-sky-200 bg-sky-50 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 transition-colors hover:bg-sky-100"
            >
              Más detalle
            </Link>
          ) : null}
          {leadCard ? (
            <QuotationStateSelector
              consultaId={leadCard.id}
              consultaCodigo={leadCard.code}
              currentEstado={leadCard.stateCode ?? 'entrada_recibida'}
            />
          ) : null}
          {leadCard ? <IncomingQueryArchiveControl card={leadCard} compact /> : null}
          {leadCard ? <IncomingQueryDeleteControl card={leadCard} compact /> : null}
          {canDeleteQuotationLane(lane) ? (
            <button
              type="button"
              onClick={() => onDeleteLane(lane.id)}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-rose-700 transition-colors hover:bg-rose-100"
              aria-label={`Delete state ${lane.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          ) : (
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
              Locked
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}

/**
 * Editor de configuracion de estados para un scope especifico.
 * Permite modificar: nombre visible, etiqueta corta, color, descripcion
 * y orden visual de cada estado. Los cambios se guardan en Supabase
 * al pulsar "Guardar" o se revierten con "Restaurar".
 */
function ScopeEditor({
  scope,
  rows,
  saveState,
  onChangeRow,
  onReset,
  onSave,
}: {
  scope: WorkflowStateScope
  rows: WorkflowStateConfigRow[]
  saveState: ScopeSaveState
  onChangeRow: (
    scope: WorkflowStateScope,
    stateCode: string,
    patch: Partial<WorkflowStateConfigRow>,
  ) => void
  onReset: (scope: WorkflowStateScope) => void
  onSave: (scope: WorkflowStateScope) => void
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_28px_rgba(148,163,184,0.12)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-950">{SCOPE_COPY[scope].title}</h3>
          <p className="text-sm text-slate-600">{SCOPE_COPY[scope].description}</p>
          <p className="text-xs text-slate-500">{SCOPE_COPY[scope].helper}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-[16px] border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-50"
            onClick={() => onReset(scope)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Restaurar
          </Button>
          <Button
            type="button"
            className="h-10 rounded-[16px] bg-sky-600 px-4 text-white hover:bg-sky-500"
            onClick={() => onSave(scope)}
            disabled={saveState.status === 'saving'}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveState.status === 'saving' ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <article
            key={`${scope}-${row.state_code}`}
            className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-mono text-[11px] text-slate-500">
                  {row.state_code}
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  ID técnico fijo
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Orden visual</span>
                <input
                  type="number"
                  value={row.sort_order}
                  onChange={(event) =>
                    onChangeRow(scope, row.state_code, {
                      sort_order: Number(event.target.value),
                    })
                  }
                  className="h-10 w-24 rounded-[14px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Nombre visible
                  </span>
                  <input
                    value={row.label}
                    onChange={(event) =>
                      onChangeRow(scope, row.state_code, { label: event.target.value })
                    }
                    className="h-11 w-full rounded-[16px] border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    placeholder="Nombre visible del estado"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Etiqueta corta
                  </span>
                  <input
                    value={row.short_label ?? ''}
                    onChange={(event) =>
                      onChangeRow(scope, row.state_code, {
                        short_label: event.target.value,
                      })
                    }
                    className="h-11 w-full rounded-[16px] border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    placeholder="Versión corta del estado"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Color
                  </span>
                  <select
                    value={row.color_token}
                    onChange={(event) =>
                      onChangeRow(scope, row.state_code, {
                        color_token: event.target.value as WorkflowStateConfigRow['color_token'],
                      })
                    }
                    className="h-11 w-full rounded-[16px] border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition-colors focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  >
                    {COLOR_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Vista previa
                  </span>
                  <div
                    className={cn(
                      'inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold',
                      COLOR_OPTIONS.find((option) => option.value === row.color_token)?.editorChip,
                    )}
                  >
                    {row.label}
                  </div>
                </div>
              </div>
            </div>

            <label className="mt-4 block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Descripción
              </span>
              <Textarea
                value={row.description ?? ''}
                onChange={(event) =>
                  onChangeRow(scope, row.state_code, {
                    description: event.target.value,
                  })
                }
                className="min-h-[96px] rounded-[18px] border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800"
                placeholder="Explica el significado operativo del estado"
              />
            </label>
          </article>
        ))}
      </div>

      {saveState.message ? (
        <div
          className={cn(
            'mt-4 rounded-[20px] border px-4 py-3 text-sm',
            saveState.status === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900',
          )}
        >
          {saveState.message}
        </div>
      ) : null}
    </section>
  )
}

/**
 * ============================================================================
 * COMPONENTE PRINCIPAL: TABLERO DE ESTADOS DE QUOTATIONS
 * ============================================================================
 *
 * Este es el componente que orquesta todo: las vistas (tablero/lista),
 * la configuracion de estados, la creacion de columnas personalizadas,
 * y la conexion con la API para guardar cambios.
 *
 * ESTADOS INTERNOS:
 *   - stateConfigRows: configuracion actual de estados (del servidor)
 *   - draftConfigRows: copia de trabajo para editar en el panel de configuracion
 *   - customLanes: columnas personalizadas creadas por el usuario (localStorage)
 *   - view: vista activa ("board" o "list")
 *   - composerOpen: si el formulario para crear nuevas columnas esta abierto
 *   - settingsOpen: si el panel de configuracion de estados esta abierto
 *   - saveState: estado de guardado para cada scope (idle/saving/success/error)
 * ============================================================================
 */
export function QuotationStatesBoard({
  initialIncomingQueries,
  initialStateConfigRows,
}: {
  initialIncomingQueries: IncomingQuery[]
  initialStateConfigRows: WorkflowStateConfigRow[]
}) {
  // Organizar las filas de configuracion por scope al iniciar
  const initialEditableRows = useMemo(
    () => normalizeEditableRows(initialStateConfigRows),
    [initialStateConfigRows],
  )

  // --- ESTADOS DEL COMPONENTE ---

  // Configuracion actual de estados (fuente de verdad para el tablero)
  const [stateConfigRows, setStateConfigRows] = useState<WorkflowStateConfigRow[]>([
    ...initialEditableRows.quotation_board,
    ...initialEditableRows.incoming_queries,
    ...initialEditableRows.project_board,
  ])
  // Copia de trabajo para el editor de configuracion (se modifica sin guardar)
  const [draftConfigRows, setDraftConfigRows] = useState(initialEditableRows)
  // Columnas personalizadas creadas por el usuario (se guardan en localStorage)
  const [customLanes, setCustomLanes] = useState<QuotationLane[]>([])
  // Vista activa: "board" (tablero tipo kanban) o "list" (tabla)
  const [view, setView] = useState<BoardView>('board')
  // Si el formulario para crear nuevas columnas esta abierto
  const [composerOpen, setComposerOpen] = useState(false)
  // Si el panel de configuracion de estados esta abierto
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Titulo de la nueva columna que se esta creando
  const [draftTitle, setDraftTitle] = useState('')
  // Estado de guardado para cada scope de configuracion
  const [saveState, setSaveState] = useState<Record<WorkflowStateScope, ScopeSaveState>>({
    quotation_board: { status: 'idle', message: null },
    incoming_queries: { status: 'idle', message: null },
    project_board: { status: 'idle', message: null },
  })
  // Referencia para saber si el componente ya se monto (evitar guardar en el primer render)
  const hasMountedRef = useRef(false)
  // Referencia al campo de texto de nueva columna (para darle foco automatico)
  const inputRef = useRef<HTMLInputElement>(null)

  // --- EFECTOS (codigo que se ejecuta al montar o cambiar datos) ---

  // Al montar el componente: cargar columnas personalizadas del localStorage
  useEffect(() => {
    setCustomLanes(loadStoredCustomQuotationLanes())
    hasMountedRef.current = true
  }, [])

  // Cada vez que cambian las columnas personalizadas: guardarlas en localStorage
  useEffect(() => {
    if (!hasMountedRef.current) return

    try {
      window.localStorage.setItem(
        QUOTATION_BOARD_STORAGE_KEY,
        JSON.stringify(customLanes.map(stripQuotationLaneAccent)),
      )
    } catch {
      // Best-effort local persistence for custom visual lanes.
    }
  }, [customLanes])

  // Cuando se abre el formulario de nueva columna: dar foco al campo de texto
  useEffect(() => {
    if (composerOpen) {
      inputRef.current?.focus()
    }
  }, [composerOpen])

  // --- DATOS CALCULADOS ---

  // Todas las columnas del tablero: las por defecto + las personalizadas
  const lanes = useMemo(
    () => [...defaultQuotationLanes(stateConfigRows, initialIncomingQueries), ...customLanes],
    [customLanes, initialIncomingQueries, stateConfigRows],
  )
  // Opciones del selector de estado para consultas entrantes
  const incomingStateOptions = useMemo(
    () => getQuotationBoardStateOptions(stateConfigRows),
    [stateConfigRows],
  )
  // Metricas: total de tarjetas y total de columnas
  const metrics = useMemo(() => {
    const cards = lanes.reduce((total, lane) => total + lane.cards.length, 0)
    return { cards, lanes: lanes.length }
  }, [lanes])

  // --- FUNCIONES DE ACCION ---

  /** Crear una nueva columna personalizada a partir del titulo introducido */
  function handleAddLane(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const title = draftTitle.trim()
    if (!title) return

    const nextLane = makeCustomQuotationLane(title, lanes.length)
    startTransition(() => {
      setCustomLanes((current) => [...current, nextLane])
      setView('board')
    })
    setDraftTitle('')
    setComposerOpen(false)
  }

  /** Borrar una columna personalizada (pide confirmacion antes) */
  function handleDeleteLane(laneId: string) {
    const lane = customLanes.find((currentLane) => currentLane.id === laneId)
    if (!lane || !canDeleteQuotationLane(lane)) return

    const confirmed = window.confirm(
      `Delete the custom state "${lane.title}"? This will remove it from both Board and List views.`,
    )
    if (!confirmed) return

    startTransition(() => {
      setCustomLanes((current) => current.filter((currentLane) => currentLane.id !== laneId))
    })
  }

  /** Modificar un campo de una fila del editor de configuracion (sin guardar todavia) */
  function handleChangeDraftRow(
    scope: WorkflowStateScope,
    stateCode: string,
    patch: Partial<WorkflowStateConfigRow>,
  ) {
    setDraftConfigRows((current) => ({
      ...current,
      [scope]: current[scope].map((row) =>
        row.state_code === stateCode
          ? {
              ...row,
              ...patch,
            }
          : row,
      ),
    }))

    setSaveState((current) => ({
      ...current,
      [scope]: { status: 'idle', message: null },
    }))
  }

  /** Restaurar la configuracion de un scope a los valores guardados (deshacer cambios) */
  function handleResetScope(scope: WorkflowStateScope) {
    const nextRows = resolveWorkflowStateRows(scope, stateConfigRows).map(stripResolvedStateMeta)
    setDraftConfigRows((current) => ({
      ...current,
      [scope]: nextRows,
    }))
    setSaveState((current) => ({
      ...current,
      [scope]: { status: 'idle', message: null },
    }))
  }

  /** Guardar la configuracion de un scope en Supabase via API */
  async function handleSaveScope(scope: WorkflowStateScope) {
    const rows = draftConfigRows[scope]

    setSaveState((current) => ({
      ...current,
      [scope]: { status: 'saving', message: null },
    }))

    try {
      const response = await fetch('/api/workflow/state-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scope,
          states: rows.map((row) => ({
            stateCode: row.state_code,
            label: row.label,
            shortLabel: row.short_label,
            description: row.description,
            colorToken: row.color_token,
            sortOrder: row.sort_order,
          })),
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; rows?: WorkflowStateConfigRow[] }
        | null

      if (!response.ok || !payload?.rows) {
        throw new Error(
          payload?.error || 'No se pudo guardar la configuración de estados.',
        )
      }

      const savedRows = (payload.rows ?? []).map(stripResolvedStateMeta)

      setStateConfigRows((current) =>
        replaceWorkflowStateRowsForScope(current, scope, savedRows),
      )
      setDraftConfigRows((current) => ({
        ...current,
        [scope]: savedRows,
      }))
      setSaveState((current) => ({
        ...current,
        [scope]: {
          status: 'success',
          message: 'Configuración guardada correctamente en Supabase.',
        },
      }))
    } catch (error) {
      setSaveState((current) => ({
        ...current,
        [scope]: {
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Se produjo un error inesperado al guardar los estados.',
        },
      }))
    }
  }

  return (
    <Tabs
      value={view}
      onValueChange={(nextValue) => setView(nextValue as BoardView)}
      className="w-full gap-4"
    >
      <section className="overflow-hidden rounded-[34px] border border-sky-100 bg-[radial-gradient(circle_at_top_left,#eff8ff_0%,#ffffff_45%,#f8fafc_100%)] shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
        <div className="border-b border-sky-100 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                <LayoutGrid className="h-3.5 w-3.5" />
                Quotations workspace
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  Board navigation for quotations
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  El board sigue usando códigos técnicos estables y ahora separa esa
                  identidad de los nombres visibles, colores y orden que puedes ajustar
                  desde la propia app.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="rounded-[22px] border border-sky-200 bg-white/90 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Columns
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{metrics.lanes}</p>
              </div>
              <div className="rounded-[22px] border border-sky-200 bg-white/90 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Cards
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{metrics.cards}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-[18px] border-sky-200 bg-white px-4 text-sky-800 shadow-sm hover:bg-sky-50"
                onClick={() => setSettingsOpen((current) => !current)}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                {settingsOpen ? 'Cerrar configuración' : 'Configurar estados'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-[18px] border-sky-200 bg-white px-4 text-sky-800 shadow-sm hover:bg-sky-50"
                onClick={() => setComposerOpen((current) => !current)}
              >
                <Plus className="mr-2 h-4 w-4" />
                {composerOpen ? 'Cerrar editor local' : 'Nuevo estado local'}
              </Button>
            </div>
          </div>

          <TabsList
            variant="default"
            className="mt-5 flex w-full flex-wrap gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-2"
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
        </div>

        {settingsOpen ? (
          <div className="border-b border-sky-100 bg-white/85 px-5 py-5">
            <div className="mb-4 rounded-[24px] border border-sky-200 bg-sky-50/70 px-4 py-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">
                Editor pro de estados
              </p>
              <p className="mt-1 leading-6">
                Puedes cambiar nombre visible, etiqueta corta, color y orden desde la app.
                El código técnico del estado queda bloqueado para no romper filtros,
                transiciones ni integraciones con Supabase.
              </p>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <ScopeEditor
                scope={WORKFLOW_STATE_SCOPES.QUOTATION_BOARD}
                rows={draftConfigRows.quotation_board}
                saveState={saveState.quotation_board}
                onChangeRow={handleChangeDraftRow}
                onReset={handleResetScope}
                onSave={handleSaveScope}
              />
              <ScopeEditor
                scope={WORKFLOW_STATE_SCOPES.INCOMING_QUERIES}
                rows={draftConfigRows.incoming_queries}
                saveState={saveState.incoming_queries}
                onChangeRow={handleChangeDraftRow}
                onReset={handleResetScope}
                onSave={handleSaveScope}
              />
            </div>
          </div>
        ) : null}

        {composerOpen ? (
          <form
            className="grid gap-3 border-b border-sky-100 bg-white/80 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={handleAddLane}
          >
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                State name
              </label>
              <input
                ref={inputRef}
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="e.g. Pending signature"
                className="h-11 w-full rounded-[16px] border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-[16px] border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-50"
                onClick={() => setComposerOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-11 rounded-[16px] bg-sky-600 px-4 text-white hover:bg-sky-500"
              >
                Create state
              </Button>
            </div>
          </form>
        ) : null}

        <TabsContent value="board" className="min-h-0">
          <div className="px-5 py-5">
            <div className="mb-4 rounded-[28px] border border-sky-100 bg-white/85 px-4 py-3 text-sm text-slate-600 shadow-sm">
              Horizontal overflow is enabled on the board track. Use the scrollbar or trackpad to browse columns.
            </div>

            <div className="overflow-x-auto pb-4">
              <div className="flex min-w-max gap-4 pr-2">
                {lanes.map((lane) => (
                  <BoardLane
                    key={lane.id}
                    lane={lane}
                    stateOptions={incomingStateOptions}
                    onDeleteLane={handleDeleteLane}
                  />
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="list" className="px-5 py-5">
          <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_42px_rgba(148,163,184,0.12)]">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-950">Quotation list</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Compact operational scan grouped by the same states as the board.
              </p>
            </div>

            <div className="overflow-auto">
              <table className="min-w-[960px] w-full border-separate border-spacing-0 text-left">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {['State', 'Cards', 'Lead quotation', 'Owner', 'Due', 'Tag', 'Actions'].map((label) => (
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
                  {lanes.map((lane) => (
                    <ListRow
                      key={lane.id}
                      lane={lane}
                      stateOptions={incomingStateOptions}
                      onDeleteLane={handleDeleteLane}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </section>
    </Tabs>
  )
}
