import { sanitizeMetadata, type AppEventOutcome, type AppEventSource } from './shared'

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

type RawAppEventRow = {
  id?: unknown
  created_at?: unknown
  event_name?: unknown
  event_category?: unknown
  event_source?: unknown
  outcome?: unknown
  actor_user_id?: unknown
  request_id?: unknown
  session_id?: unknown
  route?: unknown
  method?: unknown
  entity_type?: unknown
  entity_id?: unknown
  entity_code?: unknown
  metadata?: unknown
  referrer?: unknown
}

export type AppEventLogRow = {
  id: string
  createdAt: string
  eventName: string
  eventCategory: string
  eventSource: AppEventSource
  outcome: AppEventOutcome
  actorUserId: string | null
  requestId: string | null
  sessionId: string | null
  route: string | null
  method: string | null
  entityType: string | null
  entityId: string | null
  entityCode: string | null
  metadata: Record<string, JsonValue>
  referrer: string | null
}

export type LogsAnalysis = {
  sampleSize: number
  sampleWindowHours: number | null
  failuresLast24h: number
  topEvents: Array<{ label: string; count: number }>
  topCategories: Array<{ label: string; count: number }>
  latestEvent: AppEventLogRow | null
  latestFailure: AppEventLogRow | null
  latestOperationalEvent: AppEventLogRow | null
  healthHints: string[]
}

const EMPTY_METADATA: Record<string, JsonValue> = {}
const METADATA_PRIORITY_KEYS = [
  'error_name',
  'status_code',
  'from_state',
  'to_state',
  'timer_action',
  'duration_ms',
  'documents_count',
  'references_count',
  'provider',
  'result_count',
  'source',
]

function toText(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized ? normalized : null
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return null
}

function toSource(value: unknown): AppEventSource {
  return value === 'client' ? 'client' : 'server'
}

function toOutcome(value: unknown): AppEventOutcome {
  switch (value) {
    case 'attempt':
    case 'success':
    case 'failure':
      return value
    default:
      return 'info'
  }
}

function toMetadata(value: unknown): Record<string, JsonValue> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return EMPTY_METADATA
  }

  return sanitizeMetadata(value as Record<string, unknown>) as Record<string, JsonValue>
}

function buildCounter(values: Array<string | null | undefined>, limit = 3) {
  const counts = new Map<string, number>()

  values.forEach((value) => {
    if (!value) return
    counts.set(value, (counts.get(value) ?? 0) + 1)
  })

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }))
}

function isOperationalEvent(event: AppEventLogRow) {
  return event.eventName !== 'app.page_view'
}

export function normalizeAppEventRows(rows: unknown[]): AppEventLogRow[] {
  return rows.reduce<AppEventLogRow[]>((accumulator, row) => {
    const value = (row ?? {}) as RawAppEventRow
    const id = toText(value.id)
    const createdAt = toText(value.created_at)
    const eventName = toText(value.event_name)
    const eventCategory = toText(value.event_category)

    if (!id || !createdAt || !eventName || !eventCategory) {
      return accumulator
    }

    accumulator.push({
      id,
      createdAt,
      eventName,
      eventCategory,
      eventSource: toSource(value.event_source),
      outcome: toOutcome(value.outcome),
      actorUserId: toText(value.actor_user_id),
      requestId: toText(value.request_id),
      sessionId: toText(value.session_id),
      route: toText(value.route),
      method: toText(value.method),
      entityType: toText(value.entity_type),
      entityId: toText(value.entity_id),
      entityCode: toText(value.entity_code),
      metadata: toMetadata(value.metadata),
      referrer: toText(value.referrer),
    })

    return accumulator
  }, [])
}

export function buildLogsAnalysis(
  events: AppEventLogRow[],
  now = new Date(),
): LogsAnalysis {
  const nowMs = now.getTime()
  const last24hBoundaryMs = nowMs - 24 * 60 * 60 * 1000
  const eventsLast24h = events.filter((event) => {
    const eventTime = new Date(event.createdAt).getTime()
    return Number.isFinite(eventTime) && eventTime >= last24hBoundaryMs
  })
  const failuresLast24h = eventsLast24h.filter((event) => event.outcome === 'failure')
  const latestFailure =
    failuresLast24h[0] ?? events.find((event) => event.outcome === 'failure') ?? null
  const latestOperationalEvent = events.find(isOperationalEvent) ?? null
  const oldestVisibleEvent = events[events.length - 1] ?? null

  let sampleWindowHours: number | null = null
  if (oldestVisibleEvent) {
    const oldestMs = new Date(oldestVisibleEvent.createdAt).getTime()
    if (Number.isFinite(oldestMs)) {
      sampleWindowHours = Math.max(1, Math.ceil((nowMs - oldestMs) / (60 * 60 * 1000)))
    }
  }

  const healthHints: string[] = []

  if (events.length === 0) {
    healthHints.push(
      'No hay eventos en la muestra actual. Revisa si la tabla esta vacia o si la instrumentacion aun no ha generado actividad.',
    )
  } else if (failuresLast24h.length === 0) {
    healthHints.push(
      'No se detectan outcomes de failure en las ultimas 24 horas dentro de la muestra cargada.',
    )
  } else {
    const mainFailure = buildCounter(failuresLast24h.map((event) => event.eventName), 1)[0]
    const failureDetail = mainFailure
      ? ` El foco principal esta en ${mainFailure.label} (${mainFailure.count}).`
      : ''
    healthHints.push(
      `${failuresLast24h.length} eventos con failure en las ultimas 24 horas.${failureDetail}`,
    )
  }

  const topEvent = buildCounter(events.map((event) => event.eventName), 1)[0]
  if (topEvent?.label === 'app.page_view') {
    healthHints.push(
      'La mayor parte de la muestra es navegacion. Las mutaciones operativas son menos frecuentes que las vistas de ruta.',
    )
  }

  if (events[0]) {
    const latestMs = new Date(events[0].createdAt).getTime()
    if (Number.isFinite(latestMs) && nowMs - latestMs > 6 * 60 * 60 * 1000) {
      healthHints.push(
        'La ultima actividad visible tiene mas de 6 horas. Confirma si el entorno esta inactivo o si hay huecos de instrumentacion.',
      )
    }
  }

  if (!latestOperationalEvent && events.length > 0) {
    healthHints.push(
      'La muestra actual no incluye acciones operativas aparte de navegacion. Puede ser una ventana con trafico pasivo.',
    )
  }

  return {
    sampleSize: events.length,
    sampleWindowHours,
    failuresLast24h: failuresLast24h.length,
    topEvents: buildCounter(events.map((event) => event.eventName)),
    topCategories: buildCounter(events.map((event) => event.eventCategory)),
    latestEvent: events[0] ?? null,
    latestFailure,
    latestOperationalEvent,
    healthHints: healthHints.slice(0, 3),
  }
}

export function shortIdentifier(value: string | null, start = 6, end = 4) {
  if (!value) return null
  if (value.length <= start + end + 3) return value
  return `${value.slice(0, start)}...${value.slice(-end)}`
}

export function describeEventEntity(event: AppEventLogRow) {
  if (event.entityCode) {
    return event.entityCode
  }

  if (event.entityType && event.entityId) {
    return `${event.entityType}:${shortIdentifier(event.entityId, 4, 4)}`
  }

  return event.entityType ?? 'Sin entidad'
}

export function summarizeEventMetadata(metadata: Record<string, JsonValue>) {
  return Object.entries(metadata)
    .filter(([, value]) => {
      if (value === null) return true
      if (Array.isArray(value)) return false
      if (typeof value === 'object') return false
      if (typeof value === 'string' && value.includes('[redacted:')) return false
      return true
    })
    .sort(([leftKey], [rightKey]) => {
      const leftPriority = METADATA_PRIORITY_KEYS.indexOf(leftKey)
      const rightPriority = METADATA_PRIORITY_KEYS.indexOf(rightKey)
      const normalizedLeft = leftPriority === -1 ? Number.MAX_SAFE_INTEGER : leftPriority
      const normalizedRight = rightPriority === -1 ? Number.MAX_SAFE_INTEGER : rightPriority

      return normalizedLeft - normalizedRight || leftKey.localeCompare(rightKey)
    })
    .slice(0, 3)
    .map(([key, value]) => ({
      label: key.replaceAll('_', ' '),
      value: value === null ? 'null' : String(value),
    }))
}
