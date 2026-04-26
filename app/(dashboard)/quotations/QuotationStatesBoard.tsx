/**
 * ============================================================================
 * TABLERO DE ESTADOS DE QUOTATIONS (COMPONENTE PRINCIPAL)
 * ============================================================================
 *
 * Este es el componente mas complejo de la seccion de Quotations. Funciona
 * como un "centro de control" que ofrece multiples vistas y tools:
 *
 * VISTAS DISPONIBLES:
 *   1. TABLERO (Board): columnas type Kanban con tarjetas de quotations
 *   2. LISTA: table con filas para cada status y su tarjeta primary
 *   3. CONFIGURACION: editor para personalizar statuses (nombres, colores, sort_order)
 *
 * QUE PERMITE AL USUARIO:
 *   - Ver todas las quotations organizadas por status
 *   - Cambiar el status de una request entrante (selector desplegable)
 *   - Archive requests (moverlas a status "archived")
 *   - Borrar requests (eliminarlas del tablero)
 *   - Crear nuevas columnas personalizadas
 *   - Personalizar nombres, colores y sort_order de los statuses
 *   - Guardar la configuracion de statuses en Supabase
 *
 * COMPONENTES INTERNOS:
 *   - IncomingQueryStateControl: selector para cambiar el status de una request
 *   - IncomingQueryDeleteControl: boton para borrar una request
 *   - IncomingQueryArchiveControl: boton para archive una request
 *   - IncomingClientIdentityBlock: muestra si el client es conocido o desconocido
 *   - BoardCard: tarjeta individual en la vista de tablero
 *   - BoardLane: columna completa del tablero (con sus tarjetas)
 *   - ListRow: fila de la vista lista
 *   - ScopeEditor: editor de configuracion de statuses
 *   - QuotationStatesBoard: componente primary que orquesta todo
 *
 * NOTA TECNICA: Las columnas personalizadas se guardan en localStorage
 * del navegador. La configuracion de statuses se guarda en Supabase.
 * ============================================================================
 */

'use client'

// --- IMPORTACIONES ---

// Navegacion entre paginas
import Link from 'next/link'
import { useRouter } from 'next/navigation'
// Hooks de React para manejar statuses, efectos y optimizaciones
import {
  startTransition,   // Marca actualizaciones como no urgentes
  useEffect,         // Ejecutar codigo al montar/cambiar el componente
  useMemo,           // Memorizar calculos costosos
  useRef,            // Referencia a elementos del DOM
  useState,          // Manejar statuses del componente
  type FormEvent,    // Tipo para eventos de form
} from 'react'
// Iconos decorativos para botones y acciones
import {
  Archive,           // Archive
  LayoutGrid,        // Vista tablero
  List,              // Vista lista
  Plus,              // Anadir / ver detalle
  RotateCcw,         // Restaurar configuracion
  Save,              // Guardar
  Settings2,         // Configuracion
  Trash2,            // Borrar
} from 'lucide-react'
import { toast } from 'sonner'

// Componentes visuales reutilizables (shadcn/ui)
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
// Funciones para manejar la configuracion de statuses del workflow
import {
  getWorkflowStateColorOptions,         // Opciones de colores disponibles
  resolveWorkflowStateRows,             // Resolver filas con valores por defecto
  WORKFLOW_STATE_SCOPES,                // Constantes de scopes del workflow
} from '@/lib/workflow-state-config'
// Utilidad para combinar clases CSS
import { cn } from '@/lib/utils'
// Tipos de data
import type {
  WorkflowStateConfigRow,   // Fila de configuracion de status
  WorkflowStateScope,       // Scope: "quotation_board" o "incoming_queries"
} from '@/types/database'
// Constantes de statuses de requests (ej: ARCHIVED)
import { INCOMING_REQUEST_STATUSES } from '@/lib/workflow-states'
// Selector de status reutilizable (webhook n8n)
import { QuotationStateSelector } from './QuotationStateSelector'
// Funciones y tipos para requests entrantes
import {
  type IncomingQuery,
} from './incoming-queries'
// Tipos y funciones para los data del tablero
import type { QuotationLane } from './quotation-board-data'
import {
  canDeleteQuotationLane,               // Verifica si una columna se puede borrar
  defaultQuotationLanes,                // Genera columnas por defecto
  loadStoredCustomQuotationLanes,       // Carga columnas personalizadas del navegador
  makeCustomQuotationLane,              // Crea una new columna personalizada
  stripQuotationLaneAccent,             // Limpia data de color para guardar
  type QuotationCard,                   // Tipo de tarjeta
  QUOTATION_BOARD_STORAGE_KEY,          // Clave de localStorage
} from './quotation-board-data'

// --- TIPOS INTERNOS ---

/** Vista activa: "board" (tablero) o "list" (lista) */
type BoardView = 'board' | 'list'

/** Status de guardado de la configuracion para cada scope */
type ScopeSaveState = {
  status: 'idle' | 'saving' | 'success' | 'error'
  message: string | null
}


const quotationPillBaseClass =
  'inline-flex items-center rounded-full border border-[color:var(--line-strong)] bg-[color:var(--paper-2)] px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink)] shadow-[0_1px_0_rgba(255,255,255,0.65)_inset]'

const quotationPillEmphasisClass =
  'inline-flex h-11 items-center rounded-full border border-[color:var(--line-strong)] bg-[color:var(--paper-2)] px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink)] shadow-[0_1px_0_rgba(255,255,255,0.65)_inset] transition-colors hover:border-[color:var(--umber)] hover:bg-[color:var(--paper)] hover:text-[color:var(--umber)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--umber)]/25'

/** Opciones de vista disponibles con sus iconos */
const VIEW_OPTIONS: Array<{
  value: BoardView
  label: string
  icon: typeof LayoutGrid
}> = [
  { value: 'board', label: 'Tablero', icon: LayoutGrid },
  { value: 'list', label: 'Lista', icon: List },
]

/** Textos descriptivos para cada scope de configuracion de statuses */
const SCOPE_COPY: Record<
  WorkflowStateScope,
  { title: string; description: string; helper: string }
> = {
  quotation_board: {
    title: 'Board de quotations',
    description: 'Configura columnas, color, etiquetas cortas y sort_order visual del tablero.',
    helper: 'Estos statuses controlan el board y la vista lista de Quotations.',
  },
  incoming_queries: {
    title: 'Consultas entrantes',
    description: 'Configura cómo se muestran los statuses del flujo previo a quotation.',
    helper: 'Los códigos técnicos siguen fijos en Supabase; aquí solo cambias presentación.',
  },
  project_board: {
    title: 'Board de projects',
    description: 'Configura columnas, color, etiquetas cortas y sort_order visual del tablero de projects.',
    helper: 'Estos statuses controlan el board y la vista lista de Projects.',
  },
}

/** Opciones de colores disponibles para configurar statuses */
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

/** Extrae solo los campos necesarios de una fila de configuracion de status */
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
 * Boton para borrar una request entrante del tablero.
 * Pide confirmacion al user_label antes de eliminar.
 * Llama a la API DELETE y refresca la page.
 */
function IncomingQueryDeleteControl({
  card,
  compact = false,
}: {
  card: QuotationCard
  compact?: boolean
}) {
  const [status, setStatus] = useState<'idle' | 'deleting' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  if (card.kind !== 'incoming_query') {
    return null
  }

  async function handleDelete() {
    if (card.kind !== 'incoming_query') return
    const confirmed = window.confirm(
      `¿Seguro que quieres borrar la request "${card.title}"? Esta acción ELIMINARÁ la fila completa de la base de datos junto con sus correos, tokens y respuestas de formulario asociadas.`,
    )
    if (!confirmed) return

    setStatus('deleting')
    setMessage(null)
    try {
      const res = await fetch(`/api/incoming-requests/${card.id}`, {
        method: 'DELETE',
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
      }
      if (!res.ok || json.ok !== true) {
        const errorMessage = json.error ?? `HTTP ${res.status}`
        setStatus('error')
        setMessage(errorMessage)
        toast.error(`No se pudo borrar: ${errorMessage}`)
        return
      }
      setStatus('idle')
      toast.success('Request eliminada')
      router.refresh()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setStatus('error')
      setMessage(errorMessage)
      toast.error(`Error al borrar: ${errorMessage}`)
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={status === 'deleting'}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--err)] transition-colors hover:bg-[color:var(--paper-3)] disabled:cursor-wait disabled:opacity-70',
          compact ? 'h-9 px-3' : 'h-10 px-3',
        )}
        aria-label={`Borrar request ${card.title}`}
        title="Borrar card"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {status === 'deleting' ? (
        <p className="text-[11px] text-[color:var(--ink-3)]">Borrando request...</p>
      ) : null}
      {message ? <p className="text-[11px] text-[color:var(--err)]">{message}</p> : null}
    </div>
  )
}

/**
 * Boton para archive una request entrante.
 * Archive significa cambiar su status a "archived" en la base de data.
 * La request desaparece del tablero pero sigue guardada en Supabase.
 */
function IncomingQueryArchiveControl({
  card,
  compact = false,
}: {
  card: QuotationCard
  compact?: boolean
}) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  if (card.kind !== 'incoming_query' || card.stateCode === INCOMING_REQUEST_STATUSES.ARCHIVED) {
    return null
  }

  async function handleArchive() {
    const confirmed = window.confirm(
      `¿Archive la request "${card.title}"? Desaparecerá de Quotations pero seguirá guardada en Supabase.`,
    )
    if (!confirmed) return

    setStatus('idle')
    setMessage(null)
    toast.info('Acción desconectada')
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void handleArchive()}
        disabled={status === 'saving'}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)] disabled:cursor-wait disabled:opacity-70',
          compact ? 'h-9 px-3' : 'h-10 px-3',
        )}
        aria-label={`Archive request ${card.title}`}
        title="Archive card"
      >
        <Archive className="h-3.5 w-3.5" />
        {!compact ? 'Archive' : null}
      </button>
      {status === 'saving' ? (
        <p className="text-[11px] text-[color:var(--ink-3)]">Archivando request...</p>
      ) : null}
      {message ? <p className="text-[11px] text-[color:var(--err)]">{message}</p> : null}
    </div>
  )
}

/**
 * Bloque que muestra la identidad del client en la tarjeta.
 * Si el client es conocido: muestra empresa, name y email en verde.
 * Si el client es desconocido: muestra una etiqueta de alerta en amarillo.
 */
function IncomingClientIdentityBlock({ card }: { card: QuotationCard }) {
  if (card.kind !== 'incoming_query' || !card.clientIdentity) {
    return null
  }

  if (card.clientIdentity.kind === 'known') {
    return (
      <div className="mt-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2)] px-3 py-2.5">
        <p className={cn(quotationPillBaseClass, 'border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[color:var(--ok)]')}>
          Client conocido
        </p>
        <p className="mt-1 text-sm font-semibold text-[color:var(--ink)]">
          {card.clientIdentity.companyName}
        </p>
        <p className="mt-0.5 text-sm text-[color:var(--ink-2)]">
          {card.clientIdentity.contactName}
        </p>
        <p className="text-xs text-[color:var(--ink-3)]">{card.clientIdentity.email}</p>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2)] px-3 py-2.5">
      <p className={cn(quotationPillBaseClass, 'w-fit max-w-full text-[color:var(--umber)]')}>
        {card.clientIdentity.displayLabel}
      </p>
    </div>
  )
}

/**
 * Tarjeta individual de una quotation en la vista de tablero (Board).
 * Muestra: codigo, title, nota, identidad del client, date de delivery,
 * selector de status, enlace al detalle y boton de borrar.
 */
function BoardCard({
  card,
}: {
  card: QuotationCard
}) {
  return (
    <article className="doa-kanban-card">
      <div className="space-y-1">
        <p className="doa-kanban-card-code">{card.code}</p>
        <h4 className="doa-kanban-card-title">{card.title}</h4>
      </div>

      {card.note ? (
        <p className="mt-2 line-clamp-1 font-serif text-[13px] italic text-[color:var(--ink-3)]">{card.note}</p>
      ) : null}

      <IncomingClientIdentityBlock card={card} />

      {card.due ? (
        <p className="mt-2 text-right font-mono text-[11px] text-[color:var(--ink-4)]">{card.due}</p>
      ) : null}

      <div className="mt-3 space-y-2 doa-kanban-card-foot">
        <QuotationStateSelector
          consultaId={card.id}
          consultaCodigo={card.code}
          currentEstado={card.stateCode ?? 'request_received'}
        />
        <div className="flex items-center justify-between gap-2">
          <Link
            href={card.href ?? `/quotations/${card.id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--line)] bg-[color:var(--paper)] text-[color:var(--ink-3)] transition-colors hover:border-[color:var(--umber)] hover:text-[color:var(--umber)]"
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
 * Muestra la cabecera con name del status, color, contador de tarjetas,
 * y debajo todas las tarjetas que pertenecen a ese status.
 * Si la columna es personalizada, muestra boton para borrarla.
 */
function BoardLane({
  lane,
  onDeleteLane,
}: {
  lane: QuotationLane
  onDeleteLane: (laneId: string) => void
}) {
  return (
    <section
      className="doa-kanban-column flex h-full w-[300px] flex-none flex-col"
      title={lane.description}
    >
      <div className="doa-kanban-lane-head">
        <span className={cn('doa-kanban-dot', lane.accent.dot)} />
        <h3 className="doa-kanban-lane-title">{lane.title}</h3>
        <span className="doa-kanban-lane-count">{lane.cards.length}</span>
        {canDeleteQuotationLane(lane) ? (
          <button
            type="button"
            onClick={() => onDeleteLane(lane.id)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--line)] bg-[color:var(--paper)] text-[color:var(--ink-3)] transition-colors hover:border-[color:var(--err)] hover:text-[color:var(--err)]"
            aria-label={`Delete state ${lane.title}`}
            title="Delete custom state"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex-1 space-y-3">
        {lane.cards.map((card) => (
          <BoardCard key={card.id} card={card} />
        ))}

        {lane.cards.length === 0 ? (
          <div className="doa-kanban-empty">
            <p>Sin quotations todavía</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

/**
 * Fila de la vista Lista.
 * Muestra una fila por cada status/columna del tablero, con la tarjeta
 * primary (la primera) y sus controles de status, archive y borrar.
 */
function ListRow({
  lane,
  onDeleteLane,
}: {
  lane: QuotationLane
  onDeleteLane: (laneId: string) => void
}) {
  const leadCard = lane.cards[0]

  return (
    <tr className="border-b border-[color:var(--line)] bg-[color:var(--paper-2)] transition-colors hover:bg-[color:var(--paper)]">
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', lane.accent.dot)} />
          <div>
            <p className="font-mono text-[11px] text-[color:var(--ink-3)]">{leadCard?.code ?? 'STATE'}</p>
            <p className="text-sm font-semibold text-[color:var(--ink)]">{lane.title}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-top text-sm text-[color:var(--ink-2)]">{lane.cards.length}</td>
      <td className="px-4 py-3 align-top text-sm">
        <div className="space-y-1">
          <p className="font-medium text-[color:var(--ink)]">
            {leadCard?.title ?? 'Sin quotations reales todavía'}
          </p>
          <p className="text-[color:var(--ink-3)]">
            {leadCard?.note ?? 'Esta fila se activará cuando entren ejemplos reales.'}
          </p>
        </div>
      </td>
      <td className="px-4 py-3 align-top text-sm text-[color:var(--ink-2)]">
        <div className="space-y-1">
          <p>{leadCard?.owner ?? '-'}</p>
          {leadCard?.kind === 'incoming_query' && leadCard.clientIdentity ? (
            leadCard.clientIdentity.kind === 'known' ? (
              <div className="text-xs leading-5 text-[color:var(--ink-3)]">
                <p className="font-semibold text-[color:var(--ink)]">
                  {leadCard.clientIdentity.companyName}
                </p>
                <p>
                  {leadCard.clientIdentity.contactName} · {leadCard.clientIdentity.email}
                </p>
              </div>
            ) : (
              <p className="doa-label-mono text-[color:var(--umber)]">
                {leadCard.clientIdentity.displayLabel}
              </p>
            )
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-sm text-[color:var(--ink-2)]">{leadCard?.due ?? '-'}</td>
      <td className="px-4 py-3 align-top">
        <span className="doa-kanban-chip">
          {leadCard?.tag ?? 'Empty'}
        </span>
        {leadCard?.statusLabel ? (
          <p className="mt-2 font-mono text-[11px] text-[color:var(--ink-3)]">{leadCard.statusLabel}</p>
        ) : null}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap items-center gap-2">
          {leadCard ? (
            <Link
              href={leadCard.href ?? `/quotations/${leadCard.id}`}
              className="inline-flex h-9 items-center rounded-full border border-[color:var(--line)] bg-[color:var(--paper)] px-3 doa-label-mono text-[color:var(--umber)] transition-colors hover:bg-[color:var(--paper-3)]"
            >
              Más detalle
            </Link>
          ) : null}
          {leadCard ? (
            <QuotationStateSelector
              consultaId={leadCard.id}
              consultaCodigo={leadCard.code}
              currentEstado={leadCard.stateCode ?? 'request_received'}
            />
          ) : null}
          {leadCard ? <IncomingQueryArchiveControl card={leadCard} compact /> : null}
          {leadCard ? <IncomingQueryDeleteControl card={leadCard} compact /> : null}
          {canDeleteQuotationLane(lane) ? (
            <button
              type="button"
              onClick={() => onDeleteLane(lane.id)}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--paper)] px-3 doa-label-mono text-[color:var(--err)] transition-colors hover:bg-[color:var(--paper-3)]"
              aria-label={`Delete state ${lane.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          ) : (
            <span className="doa-label-mono text-[color:var(--ink-4)]">
              Locked
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}

/**
 * Editor de configuracion de statuses para un scope especifico.
 * Permite modificar: name visible, etiqueta corta, color, description
 * y sort_order visual de cada status. Los cambios se guardan en Supabase
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
    <section className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper-2)] p-5 shadow-[0_12px_28px_-18px_rgba(74,60,36,0.15)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--line)] pb-4">
        <div className="space-y-1">
          <h3 className="font-[family-name:var(--font-heading)] text-lg text-[color:var(--ink)]">{SCOPE_COPY[scope].title}</h3>
          <p className="text-sm text-[color:var(--ink-2)]">{SCOPE_COPY[scope].description}</p>
          <p className="text-xs text-[color:var(--ink-3)]">{SCOPE_COPY[scope].helper}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl border-[color:var(--line)] bg-[color:var(--paper)] px-4 text-[color:var(--ink-2)] hover:bg-[color:var(--paper-3)]"
            onClick={() => onReset(scope)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Restaurar
          </Button>
          <Button
            type="button"
            className="h-10 rounded-xl bg-[color:var(--ink)] px-4 text-[color:var(--paper)] hover:bg-[color:var(--ink-2)]"
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
            className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(quotationPillBaseClass, 'text-[color:var(--ink)]')}>
                  {row.state_code}
                </span>
                <span className={cn(quotationPillBaseClass, 'border-emerald-300 bg-emerald-50 text-[color:var(--ok)]')}>
                  ID technical fijo
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-[color:var(--ink-3)]">
                <span>Orden visual</span>
                <input
                  type="number"
                  value={row.sort_order}
                  onChange={(event) =>
                    onChangeRow(scope, row.state_code, {
                      sort_order: Number(event.target.value),
                    })
                  }
                  className="h-10 w-24 rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2)] px-3 text-sm text-[color:var(--ink)] outline-none transition-colors focus:border-[color:var(--umber)] focus:ring-2 focus:ring-[color:var(--umber)]/20"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="doa-label-mono">Name visible</span>
                  <input
                    value={row.label}
                    onChange={(event) =>
                      onChangeRow(scope, row.state_code, { label: event.target.value })
                    }
                    className="h-11 w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2)] px-4 text-sm text-[color:var(--ink)] outline-none transition-colors placeholder:text-[color:var(--ink-4)] focus:border-[color:var(--umber)] focus:ring-2 focus:ring-[color:var(--umber)]/20"
                    placeholder="Name visible del status"
                  />
                </label>

                <label className="space-y-2">
                  <span className="doa-label-mono">Etiqueta corta</span>
                  <input
                    value={row.short_label ?? ''}
                    onChange={(event) =>
                      onChangeRow(scope, row.state_code, {
                        short_label: event.target.value,
                      })
                    }
                    className="h-11 w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2)] px-4 text-sm text-[color:var(--ink)] outline-none transition-colors placeholder:text-[color:var(--ink-4)] focus:border-[color:var(--umber)] focus:ring-2 focus:ring-[color:var(--umber)]/20"
                    placeholder="Versión corta del status"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <label className="space-y-2">
                  <span className="doa-label-mono">Color</span>
                  <select
                    value={row.color_token}
                    onChange={(event) =>
                      onChangeRow(scope, row.state_code, {
                        color_token: event.target.value as WorkflowStateConfigRow['color_token'],
                      })
                    }
                    className="h-11 w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2)] px-4 text-sm text-[color:var(--ink)] outline-none transition-colors focus:border-[color:var(--umber)] focus:ring-2 focus:ring-[color:var(--umber)]/20"
                  >
                    {COLOR_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-2">
                  <span className="doa-label-mono">Vista previa</span>
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
              <span className="doa-label-mono">Description</span>
              <Textarea
                value={row.description ?? ''}
                onChange={(event) =>
                  onChangeRow(scope, row.state_code, {
                    description: event.target.value,
                  })
                }
                className="min-h-[96px] rounded-xl border-[color:var(--line)] bg-[color:var(--paper-2)] px-4 py-3 text-sm leading-6 text-[color:var(--ink)]"
                placeholder="Explica el significado operativo del status"
              />
            </label>
          </article>
        ))}
      </div>

      {saveState.message ? (
        <div
          className={cn(
            'mt-4 rounded-xl border px-4 py-3 text-sm',
            saveState.status === 'error'
              ? 'border-[color:var(--line)] bg-[color:var(--paper)] text-[color:var(--err)]'
              : 'border-[color:var(--line)] bg-[color:var(--paper)] text-[color:var(--ok)]',
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
 * la configuracion de statuses, la creacion de columnas personalizadas,
 * y la conexion con la API para guardar cambios.
 *
 * ESTADOS INTERNOS:
 *   - stateConfigRows: configuracion actual de statuses (del servidor)
 *   - draftConfigRows: copia de trabajo para editar en el panel de configuracion
 *   - customLanes: columnas personalizadas creadas por el user_label (localStorage)
 *   - view: vista activa ("board" o "list")
 *   - composerOpen: si el form para crear nuevas columnas esta open
 *   - settingsOpen: si el panel de configuracion de statuses esta open
 *   - saveState: status de guardado para cada scope (idle/saving/success/error)
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

  // Configuracion actual de statuses (fuente de verdad para el tablero)
  const [stateConfigRows] = useState<WorkflowStateConfigRow[]>([
    ...initialEditableRows.quotation_board,
    ...initialEditableRows.incoming_queries,
    ...initialEditableRows.project_board,
  ])
  // Copia de trabajo para el editor de configuracion (se modifica sin guardar)
  const [draftConfigRows, setDraftConfigRows] = useState(initialEditableRows)
  // Columnas personalizadas creadas por el user_label (se guardan en localStorage)
  const [customLanes, setCustomLanes] = useState<QuotationLane[]>([])
  // Vista activa: "board" (tablero type kanban) o "list" (table)
  const [view, setView] = useState<BoardView>('board')
  // Si el form para crear nuevas columnas esta open
  const [composerOpen, setComposerOpen] = useState(false)
  // Si el panel de configuracion de statuses esta open
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Titulo de la new columna que se esta creando
  const [draftTitle, setDraftTitle] = useState('')
  // Status de guardado para cada scope de configuracion
  const [saveState, setSaveState] = useState<Record<WorkflowStateScope, ScopeSaveState>>({
    quotation_board: { status: 'idle', message: null },
    incoming_queries: { status: 'idle', message: null },
    project_board: { status: 'idle', message: null },
  })
  // Referencia para saber si el componente ya se monto (evitar guardar en el primer render)
  const hasMountedRef = useRef(false)
  // Referencia al campo de text de new columna (para darle foco automatico)
  const inputRef = useRef<HTMLInputElement>(null)

  // --- EFECTOS (codigo que se ejecuta al montar o cambiar data) ---

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

  // Cuando se abre el form de new columna: dar foco al campo de text
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
  // Metricas: total de tarjetas y total de columnas
  const metrics = useMemo(() => {
    const cards = lanes.reduce((total, lane) => total + lane.cards.length, 0)
    return { cards, lanes: lanes.length }
  }, [lanes])

  // --- FUNCIONES DE ACCION ---

  /** Crear una new columna personalizada a partir del title introducido */
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
    setSaveState((current) => ({
      ...current,
      [scope]: { status: 'saving', message: null },
    }))

    toast.info('Acción desconectada')
    setSaveState((current) => ({
      ...current,
      [scope]: {
        status: 'idle',
        message: null,
      },
    }))
  }

  return (
    <Tabs
      value={view}
      onValueChange={(nextValue) => setView(nextValue as BoardView)}
      className="w-full gap-4"
    >
      <section className="overflow-hidden bg-transparent">
        <div className="border-b border-[color:var(--line)] px-0 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className={cn(quotationPillBaseClass, 'gap-2 px-3 py-1 text-[color:var(--umber)]')}>
                <LayoutGrid className="h-3.5 w-3.5" />
                Quotations workspace
              </div>
              <div className="space-y-1">
                <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[color:var(--ink)] tracking-tight">
                  Board navigation for quotations
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-[color:var(--ink-2)]">
                  El board sigue usando códigos técnicos estables y ahora separa esa
                  identidad de los nombres visibles, colores y sort_order que puedes ajustar
                  desde la propia app.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="rounded-2xl border border-[color:var(--line-strong)] bg-[color:var(--paper-2)] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]">
                <p className="doa-label-mono">Columns</p>
                <p className="mt-1 text-2xl font-[family-name:var(--font-heading)] text-[color:var(--ink)]">
                  {metrics.lanes}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--line-strong)] bg-[color:var(--paper-2)] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]">
                <p className="doa-label-mono">Cards</p>
                <p className="mt-1 text-2xl font-[family-name:var(--font-heading)] text-[color:var(--ink)]">
                  {metrics.cards}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className={quotationPillEmphasisClass}
                onClick={() => setSettingsOpen((current) => !current)}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                {settingsOpen ? 'Close configuración' : 'Configurar statuses'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className={quotationPillEmphasisClass}
                onClick={() => setComposerOpen((current) => !current)}
              >
                <Plus className="mr-2 h-4 w-4" />
                {composerOpen ? 'Close editor local' : 'New status local'}
              </Button>
            </div>
          </div>

          <TabsList
            variant="default"
            className="mt-5 flex w-full flex-wrap gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] p-1.5"
          >
            {VIEW_OPTIONS.map((option) => {
              const Icon = option.icon

              return (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-[color:var(--ink-3)] transition-all data-active:bg-[color:var(--paper-2)] data-active:text-[color:var(--ink)] data-active:shadow-sm"
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        {settingsOpen ? (
          <div className="border-b border-[color:var(--line)] bg-transparent px-0 py-5">
            <div className="mb-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper-2)] px-4 py-4 text-sm text-[color:var(--ink-2)]">
              <p className="font-semibold text-[color:var(--ink)]">
                Editor pro de statuses
              </p>
              <p className="mt-1 leading-6">
                Puedes cambiar name visible, etiqueta corta, color y sort_order desde la app.
                El código technical del status queda blocked para no romper filtros,
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
            className="grid gap-3 border-b border-[color:var(--line)] bg-transparent px-0 py-4 md:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={handleAddLane}
          >
            <div className="space-y-2">
              <label className="doa-label-mono">
                State name
              </label>
              <input
                ref={inputRef}
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="e.g. Pending signature"
                className="h-11 w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2)] px-4 text-sm text-[color:var(--ink)] outline-none transition-colors placeholder:text-[color:var(--ink-4)] focus:border-[color:var(--umber)] focus:ring-2 focus:ring-[color:var(--umber)]/20"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-[color:var(--line)] bg-[color:var(--paper)] px-4 text-[color:var(--ink-2)] hover:bg-[color:var(--paper-3)]"
                onClick={() => setComposerOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-11 rounded-xl bg-[color:var(--ink)] px-4 text-[color:var(--paper)] hover:bg-[color:var(--ink-2)]"
              >
                Create state
              </Button>
            </div>
          </form>
        ) : null}

        <TabsContent value="board" className="min-h-0">
          <div className="px-0 py-5">
            <div className="mb-4 rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-3 text-sm text-[color:var(--ink-3)]">
              Scroll horizontal habilitado. Usa la barra o el trackpad para recorrer las columnas.
            </div>

            <div className="overflow-x-auto pb-4">
              <div className="flex min-w-max gap-3 pr-2">
                {lanes.map((lane) => (
                  <BoardLane
                    key={lane.id}
                    lane={lane}
                    onDeleteLane={handleDeleteLane}
                  />
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="list" className="px-0 py-5">
          <div className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper-2)] shadow-[0_18px_42px_-24px_rgba(74,60,36,0.18)]">
            <div className="border-b border-[color:var(--line)] bg-[color:var(--paper)] px-5 py-4">
              <h3 className="font-[family-name:var(--font-heading)] text-lg text-[color:var(--ink)]">Quotation list</h3>
              <p className="mt-1 text-sm leading-6 text-[color:var(--ink-2)]">
                Compact operational scan grouped by the same states as the board.
              </p>
            </div>

            <div className="overflow-auto">
              <table className="min-w-[960px] w-full border-separate border-spacing-0 text-left">
                <thead className="sticky top-0 z-10 bg-[color:var(--paper-2)]">
                  <tr className="border-b border-[color:var(--line)] bg-[color:var(--paper)]">
                    {['State', 'Cards', 'Lead quotation', 'Owner', 'Due', 'Tag', 'Actions'].map((label) => (
                      <th
                        key={label}
                        className="whitespace-nowrap border-b border-[color:var(--line)] px-4 py-3 doa-label-mono"
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
