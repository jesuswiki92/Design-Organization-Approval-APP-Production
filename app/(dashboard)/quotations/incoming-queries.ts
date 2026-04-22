import type {
  Client,
  ClientContact,
  ClientWithContacts,
  IncomingRequest,
  WorkflowStateConfigRow,
} from '@/types/database'
import { INCOMING_REQUEST_STATUSES } from '@/lib/workflow-states'
import {
  resolveWorkflowStateRows,
  WORKFLOW_STATE_SCOPES,
} from '@/lib/workflow-state-config'

export type IncomingQueryStatus =
  | 'new'
  | 'awaiting_form'
  | 'form_received'
  | 'archived'

export type IncomingQuery = {
  id: string
  codigo: string
  subject: string
  sender: string
  urlFormulario: string | null
  resumen: string
  cuerpoOriginal: string
  classification: string | null
  respuestaIa: string | null
  recibidoEn: string
  status: IncomingQueryStatus
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
      displayLabel: 'client desconocido'
      senderEmail: string | null
    }

type KnownClientRecord = Extract<IncomingClientIdentity, { kind: 'known' }>

export const INCOMING_QUERY_STATE_ORDER: IncomingQueryStatus[] = [
  INCOMING_REQUEST_STATUSES.NEW,
  INCOMING_REQUEST_STATUSES.AWAITING_FORM,
  INCOMING_REQUEST_STATUSES.FORM_RECEIVED,
] as IncomingQueryStatus[]

export function normalizeIncomingStatus(
  value: string | null | undefined,
): IncomingQueryStatus {
  const normalized = value?.trim().toLowerCase()

  if (!normalized || normalized === 'new' || normalized === 'nuevo' || normalized === 'new_entry' || normalized === 'pending') {
    return INCOMING_REQUEST_STATUSES.NEW as IncomingQueryStatus
  }

  if (normalized === 'awaiting_form' || normalized === 'espera_formulario_cliente' || normalized === 'awaiting_client_form' || normalized === 'waiting_customer_form') {
    return INCOMING_REQUEST_STATUSES.AWAITING_FORM as IncomingQueryStatus
  }

  if (normalized === 'form_received' || normalized === 'formulario_recibido') {
    return INCOMING_REQUEST_STATUSES.FORM_RECEIVED as IncomingQueryStatus
  }

  if (normalized === INCOMING_REQUEST_STATUSES.ARCHIVED || normalized === 'archived') {
    return INCOMING_REQUEST_STATUSES.ARCHIVED as IncomingQueryStatus
  }

  return INCOMING_REQUEST_STATUSES.NEW as IncomingQueryStatus
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
  )
    .map((row) => ({
    value: row.state_code as IncomingQueryStatus,
    label: row.label,
    shortLabel: row.short_label,
    description: row.description ?? '',
    }))
}

export type QuotationBoardStateOption = {
  value: string
  label: string
  shortLabel: string
  description: string
}

export function getQuotationBoardStateOptions(
  rows: WorkflowStateConfigRow[] = [],
): QuotationBoardStateOption[] {
  return resolveWorkflowStateRows(
    WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    rows,
  ).map((row) => ({
    value: row.state_code,
    label: row.label,
    shortLabel: row.short_label,
    description: row.description ?? '',
  }))
}

export function isIncomingQueryPending(q: IncomingQuery) {
  return q.status === INCOMING_REQUEST_STATUSES.NEW || !q.status
}

function normalizeEmailCandidate(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? ''
  return normalized.length > 0 ? normalized : null
}

function extractSenderEmail(sender: string | null | undefined) {
  const raw = sender?.trim() ?? ''
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

function buildContactName(contact: ClientContact) {
  const fullName = [contact.name?.trim(), contact.last_name?.trim()]
    .filter(Boolean)
    .join(' ')

  return fullName || contact.email.trim()
}

function compareContactPriority(left: ClientContact, right: ClientContact) {
  if (left.is_active !== right.is_active) {
    return left.is_active ? -1 : 1
  }

  if (left.is_primary !== right.is_primary) {
    return left.is_primary ? -1 : 1
  }

  const createdDelta =
    new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  if (!Number.isNaN(createdDelta) && createdDelta !== 0) {
    return createdDelta
  }

  return left.id.localeCompare(right.id)
}

function sortClientContacts(contacts: ClientContact[]) {
  return [...contacts].sort(compareContactPriority)
}

export function buildClientsWithContacts(
  clients: Client[],
  contacts: ClientContact[],
): ClientWithContacts[] {
  const contactsByClientId = contacts.reduce<Record<string, ClientContact[]>>(
    (acc, contact) => {
      if (!acc[contact.client_id]) {
        acc[contact.client_id] = []
      }

      acc[contact.client_id].push(contact)
      return acc
    },
    {},
  )

  return clients.map((client) => ({
    ...client,
    contacts: sortClientContacts(contactsByClientId[client.id] ?? []),
  }))
}

export function buildIncomingClientLookup(
  clients: Client[],
  contacts: ClientContact[],
) {
  const clientById = new Map(clients.map((client) => [client.id, client]))
  const contactBuckets = new Map<string, ClientContact[]>()

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
    const client = clientById.get(bestContact.client_id)
    if (!client) continue

    const companyName = client.name.trim()
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
  sender: string | null | undefined,
  clients: Client[],
  contacts: ClientContact[],
): ClientWithContacts | null {
  const senderEmail = extractSenderEmail(sender)
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
  const matchedClient = clientById.get(bestContact.client_id)

  if (!matchedClient) {
    return null
  }

  const clientsWithContacts = buildClientsWithContacts(clients, contacts)
  return clientsWithContacts.find((client) => client.id === matchedClient.id) ?? null
}

export function resolveIncomingClientIdentity(
  sender: string | null | undefined,
  lookup: Map<string, KnownClientRecord>,
): IncomingClientIdentity {
  const senderEmail = extractSenderEmail(sender)
  if (!senderEmail) {
    return {
      kind: 'unknown',
      displayLabel: 'client desconocido',
      senderEmail: null,
    }
  }

  const knownClient = lookup.get(senderEmail)
  if (knownClient) {
    return knownClient
  }

  return {
    kind: 'unknown',
    displayLabel: 'client desconocido',
    senderEmail,
  }
}

function buildIncomingCode(query: IncomingRequest) {
  const incomingNumber = query.entry_number?.trim()
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
  return fallback.length > 0 ? fallback : 'Request sin contenido disponible'
}

function formatReceivedAt(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Date no disponible'
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function toIncomingQuery(
  query: IncomingRequest,
  clientLookup: Map<string, KnownClientRecord> = new Map(),
): IncomingQuery {
  const rawStatus = query.status?.trim() || INCOMING_REQUEST_STATUSES.NEW

  return {
    id: query.id,
    codigo: buildIncomingCode(query),
    subject: query.subject?.trim() || 'Sin subject',
    sender: query.sender?.trim() || 'Sender no disponible',
    urlFormulario: query.form_url?.trim() || null,
    resumen: buildSummary(query.original_body, query.subject),
    cuerpoOriginal: query.original_body?.trim() || 'Sin body original disponible',
    classification: query.classification?.trim() || null,
    respuestaIa: query.ai_reply?.trim() || null,
    recibidoEn: formatReceivedAt(query.created_at),
    status: normalizeIncomingStatus(rawStatus),
    estadoBackend: rawStatus,
    clientIdentity: resolveIncomingClientIdentity(query.sender, clientLookup),
  }
}
