type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type AppEventSource = 'server' | 'client'
export type AppEventOutcome = 'attempt' | 'success' | 'failure' | 'info'
export type AppEventSeverity = 'info' | 'warn' | 'error' | 'critical'

export type AppEventInput = {
  eventName: string
  eventCategory: string
  source?: AppEventSource
  outcome?: AppEventOutcome
  /**
   * First-class severity field (Block 5 / Item A).
   * Prefer this over `metadata.severity`. If both are provided, this wins.
   * Legacy value 'warning' from metadata is mapped to 'warn' for back-compat.
   */
  severity?: AppEventSeverity
  actorUserId?: string | null
  requestId?: string | null
  sessionId?: string | null
  route?: string | null
  method?: string | null
  entityType?: string | null
  entityId?: string | null
  entityCode?: string | null
  metadata?: Record<string, unknown> | null
  userAgent?: string | null
  ipAddress?: string | null
  referrer?: string | null
}

const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|password|token|secret|body|message|html|content|text|email|mail|subject|payload|headers?|cuerpo|remitente|reply)/i

const MAX_STRING_LENGTH = 160
const MAX_ARRAY_ITEMS = 20
const MAX_DEPTH = 4

function sanitizeString(value: string, key: string | null): string {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) {
    return `[redacted:${key}]`
  }

  const trimmed = value.trim()
  if (trimmed.length <= MAX_STRING_LENGTH) {
    return trimmed
  }

  return `${trimmed.slice(0, MAX_STRING_LENGTH)}...`
}

function sanitizeValue(
  value: unknown,
  key: string | null,
  depth: number,
): JsonValue | undefined {
  if (value === undefined) return undefined
  if (value === null) return null

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return typeof value === 'string' ? sanitizeString(value, key) : value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return '[truncated-array]'

    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((entry) => sanitizeValue(entry, key, depth + 1))
      .filter((entry): entry is JsonValue => entry !== undefined)
  }

  if (typeof value === 'object') {
    if (depth >= MAX_DEPTH) return '[truncated-object]'

    const output: Record<string, JsonValue> = {}
    for (const [childKey, childValue] of Object.entries(value)) {
      const sanitized = sanitizeValue(childValue, childKey, depth + 1)
      if (sanitized !== undefined) {
        output[childKey] = sanitized
      }
    }
    return output
  }

  return sanitizeString(String(value), key)
}

function normalizeText(value: string | null | undefined): string | null {
  const text = value?.trim()
  return text ? text : null
}

export function sanitizeMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, JsonValue> {
  if (!metadata) return {}

  const sanitized = sanitizeValue(metadata, null, 0)
  if (!sanitized || Array.isArray(sanitized) || typeof sanitized !== 'object') {
    return {}
  }

  return sanitized as Record<string, JsonValue>
}

export function buildRequestContext(request: Pick<Request, 'headers' | 'url'> | Headers) {
  const headers = request instanceof Headers ? request : request.headers
  const forwardedFor = headers.get('x-forwarded-for')
  const ipAddress = forwardedFor?.split(',')[0]?.trim() || headers.get('x-real-ip')
  const requestId =
    headers.get('x-request-id') ||
    headers.get('x-vercel-id') ||
    crypto.randomUUID()

  let route: string | null = null
  if (!(request instanceof Headers)) {
    try {
      route = new URL(request.url).pathname
    } catch {
      route = null
    }
  }

  return {
    requestId,
    route,
    userAgent: normalizeText(headers.get('user-agent')),
    ipAddress: normalizeText(ipAddress),
    referrer: normalizeText(headers.get('referer')),
  }
}

const VALID_SEVERITIES: readonly AppEventSeverity[] = [
  'info',
  'warn',
  'error',
  'critical',
]

function normalizeLegacySeverity(value: unknown): AppEventSeverity | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (trimmed === 'warning') return 'warn'
  return (VALID_SEVERITIES as readonly string[]).includes(trimmed)
    ? (trimmed as AppEventSeverity)
    : null
}

/**
 * Resolve the effective severity for an event.
 * Priority: first-class `severity` field > `metadata.severity` (back-compat) > 'info'.
 * Exposed as a helper so callers (and tests) can follow the same rule.
 */
export function resolveSeverity(input: AppEventInput): AppEventSeverity {
  if (input.severity) return input.severity
  const legacy = normalizeLegacySeverity(input.metadata?.severity)
  return legacy ?? 'info'
}

export function toEventRow(input: AppEventInput) {
  return {
    event_name: input.eventName.trim(),
    event_category: input.eventCategory.trim(),
    event_source: input.source ?? 'server',
    outcome: input.outcome ?? 'info',
    severity: resolveSeverity(input),
    actor_user_id: normalizeText(input.actorUserId),
    request_id: normalizeText(input.requestId),
    session_id: normalizeText(input.sessionId),
    route: normalizeText(input.route),
    method: normalizeText(input.method),
    entity_type: normalizeText(input.entityType),
    entity_id: normalizeText(input.entityId),
    entity_code: normalizeText(input.entityCode),
    metadata: sanitizeMetadata(input.metadata),
    user_agent: normalizeText(input.userAgent),
    ip_address: normalizeText(input.ipAddress),
    referrer: normalizeText(input.referrer),
  }
}
