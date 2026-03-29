import type { ConsultaEntrante } from '@/types/database'

export type IncomingQueryStatus =
  | 'nuevo'
  | 'en_revision'
  | 'espera_formulario_cliente'
  | 'convertida_a_quotation'
  | 'descartado'

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
}

const PENDING_INCOMING_STATES = new Set(['nuevo', 'new_entry', 'pendiente', 'pending'])

function normalizeIncomingStatus(value: string | null | undefined): IncomingQueryStatus {
  const normalized = value?.trim().toLowerCase()

  if (!normalized || PENDING_INCOMING_STATES.has(normalized)) {
    return 'nuevo'
  }

  if (normalized === 'en_revision' || normalized === 'reviewed') {
    return 'en_revision'
  }

  if (
    normalized === 'espera_formulario_cliente' ||
    normalized === 'formulario_enviado' ||
    normalized === 'awaiting_client_form'
  ) {
    return 'espera_formulario_cliente'
  }

  if (normalized === 'convertida_a_quotation' || normalized === 'converted_to_quotation') {
    return 'convertida_a_quotation'
  }

  if (normalized === 'descartado' || normalized === 'discarded') {
    return 'descartado'
  }

  return 'nuevo'
}

export function isIncomingQueryPending(query: IncomingQuery) {
  return query.estado === 'nuevo'
}

function buildIncomingCode(query: ConsultaEntrante) {
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

export function toIncomingQuery(query: ConsultaEntrante): IncomingQuery {
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
    estado: normalizeIncomingStatus(query.estado),
  }
}
