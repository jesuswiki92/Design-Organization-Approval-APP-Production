import type { ConsultaEntrante } from '@/types/database'
import { CONSULTA_ESTADOS } from '@/lib/workflow-states'

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
}

function normalizeIncomingStatus(value: string | null | undefined): IncomingQueryStatus {
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

export function isIncomingQueryPending(q: IncomingQuery) {
  return q.estado === CONSULTA_ESTADOS.NUEVO || !q.estado
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
