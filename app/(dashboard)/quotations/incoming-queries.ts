import type {
  Cliente,
  ClienteContacto,
  ClienteWithContactos,
  ConsultaEntrante,
  WorkflowStateConfigRow,
} from '@/types/database'
import { CONSULTA_ESTADOS } from '@/lib/workflow-states'
import {
  resolveWorkflowStateRows,
  WORKFLOW_STATE_SCOPES,
} from '@/lib/workflow-state-config'

export type IncomingQueryStatus =
  | 'nuevo'
  | 'esperando_formulario'
  | 'formulario_recibido'

export type IncomingQuery = {
  id: string
  codigo: string
  asunto: string
  remitente: string
  resumen: string
  cuerpoOriginal: string
  clasificacion: string | null
  respuestaIa: string | null
  recibidoEn: string
  estado: IncomingQueryStatus
  estadoBackend: string
  clientIdentity: IncomingClientIdentity
}

export type IncomingClientIdentity =
  | {
      kind: 'known'
      companyName: string
      contactName: string
      email: string
      displayLabel: string
    }
  | {
      kind: 'unknown'
      displayLabel: 'cliente desconocido'
      senderEmail: string | null
    }

type KnownClientRecord = Extract<IncomingClientIdentity, { kind: 'known' }>

export const INCOMING_QUERY_STATE_ORDER: IncomingQueryStatus[] = [
  CONSULTA_ESTADOS.NUEVO,
  CONSULTA_ESTADOS.ESPERANDO_FORMULARIO,
  CONSULTA_ESTADOS.FORMULARIO_RECIBIDO,
] as IncomingQueryStatus[]

export function normalizeIncomingStatus(
  value: string | null | undefined,
): IncomingQueryStatus {
  const normalized = value?.trim().toLowerCase()

  if (!normalized || normalized === 'new_entry' || normalized === 'pendiente' || normalized === 'pending') {
    return CONSULTA_ESTADOS.NUEVO as IncomingQueryStatus
  }

  if (normalized === 'esperando_formulario' || normalized === 'espera_formulario_cliente' || normalized === 'awaiting_client_form' || normalized === 'waiting_customer_form') {
    return CONSULTA_ESTADOS.ESPERANDO_FORMULARIO as IncomingQueryStatus
  }

  if (normalized === 'formulario_recibido') {
    return CONSULTA_ESTADOS.FORMULARIO_RECIBIDO as IncomingQueryStatus
  }

  return CONSULTA_ESTADOS.NUEVO as IncomingQueryStatus
}

export function getIncomingQueryLaneId(state: IncomingQueryStatus) {
  return state
}

export function getIncomingQueryStateOptions(
  rows: WorkflowStateConfigRow[] = [],
) {
  return resolveWorkflowStateRows(
    WORKFLOW_STATE_SCOPES.INCOMING_QUERIES,
    rows,
  ).map((row) => ({
    value: row.state_code as IncomingQueryStatus,
    label: row.label,
    shortLabel: row.short_label,
    description: row.description ?? '',
  }))
}

export function isIncomingQueryPending(q: IncomingQuery) {
  return q.estado === CONSULTA_ESTADOS.NUEVO || !q.estado
}

function normalizeEmailCandidate(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? ''
  return normalized.length > 0 ? normalized : null
}

function extractSenderEmail(remitente: string | null | undefined) {
  const raw = remitente?.trim() ?? ''
  if (!raw) return null

  const angleMatch = raw.match(/<\s*([^>]+?)\s*>/)
  if (angleMatch?.[1]) {
    return normalizeEmailCandidate(angleMatch[1])
  }

  const inlineMatch = raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)
  if (inlineMatch?.[0]) {
    return normalizeEmailCandidate(inlineMatch[0])
  }

  return normalizeEmailCandidate(raw)
}

function buildContactName(contact: ClienteContacto) {
  const fullName = [contact.nombre?.trim(), contact.apellidos?.trim()]
    .filter(Boolean)
    .join(' ')

  return fullName || contact.email.trim()
}

function compareContactPriority(left: ClienteContacto, right: ClienteContacto) {
  if (left.activo !== right.activo) {
    return left.activo ? -1 : 1
  }

  if (left.es_principal !== right.es_principal) {
    return left.es_principal ? -1 : 1
  }

  const createdDelta =
    new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  if (!Number.isNaN(createdDelta) && createdDelta !== 0) {
    return createdDelta
  }

  return left.id.localeCompare(right.id)
}

function sortClientContacts(contacts: ClienteContacto[]) {
  return [...contacts].sort(compareContactPriority)
}

export function buildClientsWithContacts(
  clients: Cliente[],
  contacts: ClienteContacto[],
): ClienteWithContactos[] {
  const contactsByClientId = contacts.reduce<Record<string, ClienteContacto[]>>(
    (acc, contact) => {
      if (!acc[contact.cliente_id]) {
        acc[contact.cliente_id] = []
      }

      acc[contact.cliente_id].push(contact)
      return acc
    },
    {},
  )

  return clients.map((client) => ({
    ...client,
    contactos: sortClientContacts(contactsByClientId[client.id] ?? []),
  }))
}

export function buildIncomingClientLookup(
  clients: Cliente[],
  contacts: ClienteContacto[],
) {
  const clientById = new Map(clients.map((client) => [client.id, client]))
  const contactBuckets = new Map<string, ClienteContacto[]>()

  for (const contact of contacts) {
    const normalizedEmail = normalizeEmailCandidate(contact.email)
    if (!normalizedEmail) continue

    const existing = contactBuckets.get(normalizedEmail)
    if (existing) {
      existing.push(contact)
    } else {
      contactBuckets.set(normalizedEmail, [contact])
    }
  }

  const lookup = new Map<string, KnownClientRecord>()

  for (const [normalizedEmail, bucket] of contactBuckets) {
    const bestContact = [...bucket].sort(compareContactPriority)[0]
    const client = clientById.get(bestContact.cliente_id)
    if (!client) continue

    const companyName = client.nombre.trim()
    const contactName = buildContactName(bestContact)
    const email = bestContact.email.trim()

    lookup.set(normalizedEmail, {
      kind: 'known',
      companyName,
      contactName,
      email,
      displayLabel: `${companyName} · ${contactName}`,
    })
  }

  return lookup
}

export function resolveIncomingClientRecord(
  remitente: string | null | undefined,
  clients: Cliente[],
  contacts: ClienteContacto[],
): ClienteWithContactos | null {
  const senderEmail = extractSenderEmail(remitente)
  if (!senderEmail) {
    return null
  }

  const matchingContacts = contacts.filter(
    (contact) => normalizeEmailCandidate(contact.email) === senderEmail,
  )

  if (matchingContacts.length === 0) {
    return null
  }

  const clientById = new Map(clients.map((client) => [client.id, client]))
  const bestContact = sortClientContacts(matchingContacts)[0]
  const matchedClient = clientById.get(bestContact.cliente_id)

  if (!matchedClient) {
    return null
  }

  const clientsWithContacts = buildClientsWithContacts(clients, contacts)
  return clientsWithContacts.find((client) => client.id === matchedClient.id) ?? null
}

export function resolveIncomingClientIdentity(
  remitente: string | null | undefined,
  lookup: Map<string, KnownClientRecord>,
): IncomingClientIdentity {
  const senderEmail = extractSenderEmail(remitente)
  if (!senderEmail) {
    return {
      kind: 'unknown',
      displayLabel: 'cliente desconocido',
      senderEmail: null,
    }
  }

  const knownClient = lookup.get(senderEmail)
  if (knownClient) {
    return knownClient
  }

  return {
    kind: 'unknown',
    displayLabel: 'cliente desconocido',
    senderEmail,
  }
}

function buildIncomingCode(query: ConsultaEntrante) {
  const incomingNumber = query.numero_entrada?.trim()
  if (incomingNumber) {
    return incomingNumber.toUpperCase()
  }

  return `QRY-${query.id.slice(0, 8).toUpperCase()}`
}

function buildSummary(body: string | null, subject: string | null) {
  const base = (body ?? '').trim()

  if (base.length > 0) {
    return base.length > 180 ? `${base.slice(0, 177)}...` : base
  }

  const fallback = (subject ?? '').trim()
  return fallback.length > 0 ? fallback : 'Consulta sin contenido disponible'
}

function formatReceivedAt(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible'
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function toIncomingQuery(
  query: ConsultaEntrante,
  clientLookup: Map<string, KnownClientRecord> = new Map(),
): IncomingQuery {
  const rawStatus = query.estado?.trim() || CONSULTA_ESTADOS.NUEVO

  return {
    id: query.id,
    codigo: buildIncomingCode(query),
    asunto: query.asunto?.trim() || 'Sin asunto',
    remitente: query.remitente?.trim() || 'Remitente no disponible',
    resumen: buildSummary(query.cuerpo_original, query.asunto),
    cuerpoOriginal: query.cuerpo_original?.trim() || 'Sin cuerpo original disponible',
    clasificacion: query.clasificacion?.trim() || null,
    respuestaIa: query.respuesta_ia?.trim() || null,
    recibidoEn: formatReceivedAt(query.created_at),
    estado: normalizeIncomingStatus(rawStatus),
    estadoBackend: rawStatus,
    clientIdentity: resolveIncomingClientIdentity(query.remitente, clientLookup),
  }
}
