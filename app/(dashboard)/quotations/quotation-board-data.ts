import {
  QUOTATION_BOARD_STATES,
  type QuotationBoardState,
} from '@/lib/workflow-states'
import {
  getResolvedIncomingQueryStatusMeta,
  getResolvedQuotationBoardStatusMeta,
  resolveWorkflowStateRows,
  WORKFLOW_STATE_SCOPES,
} from '@/lib/workflow-state-config'
import type { WorkflowStateConfigRow } from '@/types/database'
import {
  type IncomingClientIdentity,
  type IncomingQuery,
  type IncomingQueryStatus,
} from './incoming-queries'

function isArchivedIncomingState(state: string | null | undefined) {
  return state?.trim().toLowerCase() === 'archivado'
}

/**
 * Mapea el estado guardado en la consulta entrante a la columna del tablero.
 *
 * Si el estado ya es un codigo de columna del tablero (ej: 'definir_alcance'),
 * se devuelve tal cual. Si es un estado legacy de consulta entrante (ej: 'nuevo'),
 * se convierte a su columna equivalente.
 */
function mapIncomingStateToQuotationLane(state: string): QuotationBoardState {
  // Si ya es un estado del tablero, usarlo directamente
  if (Object.values(QUOTATION_BOARD_STATES).includes(state as QuotationBoardState)) {
    return state as QuotationBoardState
  }

  // Mapeo de estados legacy de consultas entrantes
  switch (state) {
    case 'esperando_formulario':
      return 'formulario_enviado'
    case 'formulario_recibido':
      return 'formulario_recibido'
    case 'nuevo':
    default:
      return 'entrada_recibida'
  }
}

export type QuotationCard = {
  id: string
  code: string
  title: string
  note: string
  owner: string
  due: string
  tag: string
  customer: string
  aircraft: string
  amount: string
  requestDate: string
  channel: string
  priority: string
  nextStep: string
  href?: string
  kind?: 'incoming_query'
  statusLabel?: string
  statusMetaLabel?: string
  stateCode?: string
  clientIdentity?: IncomingClientIdentity
}

export type QuotationLaneAccent = {
  bg: string
  border: string
  dot: string
  text: string
  chip: string
}

export type QuotationLane = {
  id: string
  state: QuotationBoardState | IncomingQueryStatus | string
  title: string
  description: string
  isCustom: boolean
  accent: QuotationLaneAccent
  cards: QuotationCard[]
}

type StoredQuotationLane = Omit<QuotationLane, 'accent'>

export const QUOTATION_BOARD_STORAGE_KEY = 'doa-quotations-board-custom-lanes-v4'

const ACCENTS: QuotationLaneAccent[] = [
  {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
    text: 'text-sky-700',
    chip: 'border-sky-200 bg-white/90 text-sky-700',
  },
  {
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    dot: 'bg-cyan-500',
    text: 'text-cyan-700',
    chip: 'border-cyan-200 bg-white/90 text-cyan-700',
  },
  {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    chip: 'border-emerald-200 bg-white/90 text-emerald-700',
  },
  {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    chip: 'border-amber-200 bg-white/90 text-amber-700',
  },
  {
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
    text: 'text-violet-700',
    chip: 'border-violet-200 bg-white/90 text-violet-700',
  },
  {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
    text: 'text-indigo-700',
    chip: 'border-indigo-200 bg-white/90 text-indigo-700',
  },
  {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
    text: 'text-slate-700',
    chip: 'border-slate-200 bg-white/90 text-slate-700',
  },
]

const EMPTY_QUOTATION_CARDS: Record<QuotationBoardState, QuotationCard[]> = {
  entrada_recibida: [],
  formulario_enviado: [],
  formulario_recibido: [],
  definir_alcance: [],
  esperando_respuesta_cliente: [],
  alcance_definido: [],
  oferta_en_revision: [],
  oferta_enviada: [],
  oferta_aceptada: [],
  oferta_rechazada: [],
  revision_final: [],
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function toIncomingQuotationCard(
  query: IncomingQuery,
  rows: WorkflowStateConfigRow[],
): QuotationCard {
  const statusMeta = getResolvedIncomingQueryStatusMeta(query.estado, rows)

  return {
    id: query.id,
    code: query.codigo,
    title: query.asunto,
    note: query.resumen,
    owner: query.remitente,
    due: query.recibidoEn,
    tag: statusMeta.shortLabel,
    customer: query.remitente,
    aircraft: 'Consulta entrante',
    amount: 'Sin importe',
    requestDate: query.recibidoEn,
    channel: query.clasificacion ?? 'Email',
    priority: statusMeta.label,
    nextStep: 'Abrir detalle',
    href: `/quotations/incoming/${query.id}`,
    kind: 'incoming_query',
    statusLabel: query.estadoBackend,
    statusMetaLabel: statusMeta.label,
    stateCode: query.estadoBackend,
    clientIdentity: query.clientIdentity,
  }
}

function makeQuotationLaneFromState(
  state: QuotationBoardState,
  rows: WorkflowStateConfigRow[],
): QuotationLane {
  const meta = getResolvedQuotationBoardStatusMeta(state, rows)
  return {
    id: state,
    state,
    title: meta.label,
    description: meta.description,
    isCustom: false,
    accent: meta.accent,
    cards: EMPTY_QUOTATION_CARDS[state],
  }
}

export function makeCustomQuotationLane(title: string, index: number): QuotationLane {
  const accent = ACCENTS[index % ACCENTS.length]
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return {
    id: slug ? createId(slug) : createId('quotation-state'),
    state: title,
    title,
    description: 'Estado creado manualmente desde la UI local',
    isCustom: true,
    accent,
    cards: [],
  }
}

export function defaultQuotationLanes(
  rows: WorkflowStateConfigRow[] = [],
  incomingQueries: IncomingQuery[] = [],
) {
  const quotationRows = resolveWorkflowStateRows(WORKFLOW_STATE_SCOPES.QUOTATION_BOARD, rows)

  // Convertir consultas entrantes a tarjetas y mapearlas a columnas del tablero
  const incomingCards = incomingQueries
    .filter((query) => !isArchivedIncomingState(query.estado))
    .map((query) => toIncomingQuotationCard(query, rows))
  const cardsByLane = new Map<string, QuotationCard[]>()

  for (const card of incomingCards) {
    const laneId = card.stateCode
      ? mapIncomingStateToQuotationLane(card.stateCode)
      : 'entrada_recibida'

    const existing = cardsByLane.get(laneId)
    if (existing) {
      existing.push(card)
    } else {
      cardsByLane.set(laneId, [card])
    }
  }

  // Solo columnas del tablero de cotizaciones (pipeline unificado de 4 estados)
  return quotationRows.map((row) => {
    const lane = makeQuotationLaneFromState(row.state_code as QuotationBoardState, rows)
    const mappedCards = cardsByLane.get(row.state_code) ?? []
    return {
      ...lane,
      cards: [...lane.cards, ...mappedCards],
    }
  })
}

function normalizeStoredLane(value: unknown, index: number): QuotationLane | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Partial<StoredQuotationLane>
  if (typeof candidate.title !== 'string' || typeof candidate.id !== 'string') return null

  const cards = Array.isArray(candidate.cards)
    ? candidate.cards
        .filter((card): card is QuotationCard => {
          return (
            !!card &&
            typeof card === 'object' &&
            typeof (card as { id?: unknown }).id === 'string' &&
            typeof (card as { code?: unknown }).code === 'string' &&
            typeof (card as { title?: unknown }).title === 'string' &&
            typeof (card as { note?: unknown }).note === 'string' &&
            typeof (card as { owner?: unknown }).owner === 'string' &&
            typeof (card as { due?: unknown }).due === 'string' &&
            typeof (card as { tag?: unknown }).tag === 'string' &&
            typeof (card as { customer?: unknown }).customer === 'string' &&
            typeof (card as { aircraft?: unknown }).aircraft === 'string' &&
            typeof (card as { amount?: unknown }).amount === 'string' &&
            typeof (card as { requestDate?: unknown }).requestDate === 'string' &&
            typeof (card as { channel?: unknown }).channel === 'string' &&
            typeof (card as { priority?: unknown }).priority === 'string' &&
            typeof (card as { nextStep?: unknown }).nextStep === 'string'
          )
        })
    : []

  return {
    id: candidate.id,
    title: candidate.title,
    description:
      typeof candidate.description === 'string'
        ? candidate.description
        : 'Estado creado manualmente desde la UI local',
    state: typeof candidate.state === 'string' ? candidate.state : candidate.title,
    isCustom:
      typeof candidate.isCustom === 'boolean'
        ? candidate.isCustom
        : !Object.values(QUOTATION_BOARD_STATES).includes(
            (typeof candidate.state === 'string' ? candidate.state : candidate.title) as QuotationBoardState,
          ),
    cards,
    accent: ACCENTS[index % ACCENTS.length],
  }
}

export function loadStoredCustomQuotationLanes() {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(QUOTATION_BOARD_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return []

    const lanes = parsed
      .map((lane, index) => normalizeStoredLane(lane, index))
      .filter((lane): lane is QuotationLane => lane !== null && lane.isCustom)

    return lanes
  } catch {
    return []
  }
}

export function stripQuotationLaneAccent(lane: QuotationLane): StoredQuotationLane {
  return {
    id: lane.id,
    title: lane.title,
    description: lane.description,
    state: lane.state,
    isCustom: lane.isCustom,
    cards: lane.cards,
  }
}

export function canDeleteQuotationLane(lane: QuotationLane) {
  return lane.isCustom
}

export function findQuotationCardById(lanes: QuotationLane[], cardId: string) {
  for (const lane of lanes) {
    const card = lane.cards.find((currentCard) => currentCard.id === cardId)
    if (card) {
      return { lane, card }
    }
  }

  return null
}
