/**
 * ============================================================================
 * fetch-attachments — descarga adjuntos de un mensaje Outlook via Graph API
 * ============================================================================
 *
 * Slice 3 (archivado en disco). Llama a `/me/messages/{id}/attachments` y
 * devuelve solo los adjuntos de tipo `#microsoft.graph.fileAttachment` (los
 * únicos que traen `contentBytes` en base64). Se descartan itemAttachment y
 * referenceAttachment porque no tienen los bytes inline.
 *
 * El endpoint `.select(...)` fuerza el campo `contentBytes` (Graph lo trae por
 * defecto en fileAttachment, pero el .select garantiza shape consistente).
 */

import { getGraphClient } from './graph-client'

export interface InboundAttachment {
  id: string
  name: string
  contentType: string
  size: number
  contentBytes: string // base64
}

interface GraphAttachmentResponse {
  value: Array<{
    '@odata.type'?: string
    id: string
    name?: string | null
    contentType?: string | null
    size?: number | null
    contentBytes?: string | null
  }>
}

const FILE_ATTACHMENT_TYPE = '#microsoft.graph.fileAttachment'

export async function fetchAttachments(
  messageId: string,
): Promise<InboundAttachment[]> {
  if (!messageId || typeof messageId !== 'string') {
    throw new Error('fetch-attachments: messageId vacio o invalido')
  }

  const client = getGraphClient()

  let response: GraphAttachmentResponse
  try {
    response = (await client
      .api('/me/messages/' + messageId + '/attachments')
      .select('id,name,contentType,size,contentBytes')
      .get()) as GraphAttachmentResponse
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `fetch-attachments: fallo al descargar adjuntos de messageId=${messageId}: ${detail}`,
    )
  }

  const items = response?.value ?? []

  return items
    .filter((it) => it['@odata.type'] === FILE_ATTACHMENT_TYPE)
    .map((it) => ({
      id: it.id,
      name: it.name ?? 'attachment',
      contentType: it.contentType ?? 'application/octet-stream',
      size: typeof it.size === 'number' ? it.size : 0,
      contentBytes: it.contentBytes ?? '',
    }))
}
