/**
 * ============================================================================
 * read-unread — listar emails no leídos del buzón Outlook
 * ============================================================================
 *
 * Slice 1 (read-only). Solo LEE los mensajes con `isRead eq false` del Inbox
 * del buzón configurado en `OUTLOOK_MAILBOX`. No marca como leídos, no
 * responde, no toca Supabase. Devuelve un array tipado.
 *
 * Endpoint Graph: /users/{mailbox}/mailFolders/Inbox/messages
 * Filtro:        isRead eq false
 * Orden:         receivedDateTime asc (procesar primero los más antiguos)
 * Selección:     campos mínimos para identificación + cuerpo del mensaje
 */

import { getGraphClient } from './graph-client'

export interface UnreadEmailRecipient {
  emailAddress: {
    name?: string
    address?: string
  }
}

export interface UnreadEmailBody {
  contentType: 'html' | 'text' | string
  content: string
}

export interface UnreadEmail {
  id: string
  internetMessageId: string
  subject: string | null
  from: UnreadEmailRecipient | null
  toRecipients: UnreadEmailRecipient[]
  receivedDateTime: string
  conversationId: string
  bodyPreview: string
  body: UnreadEmailBody
}

interface GraphMessagesResponse {
  value: UnreadEmail[]
}

export interface ReadUnreadEmailsOptions {
  limit?: number
}

const DEFAULT_LIMIT = 50

const SELECT_FIELDS = [
  'id',
  'internetMessageId',
  'subject',
  'from',
  'toRecipients',
  'receivedDateTime',
  'conversationId',
  'bodyPreview',
  'body',
].join(',')

export async function readUnreadEmails(
  opts: ReadUnreadEmailsOptions = {},
): Promise<UnreadEmail[]> {
  const limit = opts.limit ?? DEFAULT_LIMIT
  const mailbox = process.env.OUTLOOK_MAILBOX?.trim()
  if (!mailbox) {
    throw new Error(
      'Falta la variable de entorno OUTLOOK_MAILBOX. Añádela en .env.local (ver .env.local.example).',
    )
  }

  const client = getGraphClient()

  const response = (await client
    .api(`/users/${mailbox}/mailFolders/Inbox/messages`)
    .filter('isRead eq false')
    .orderby('receivedDateTime asc')
    .select(SELECT_FIELDS)
    .top(limit)
    .get()) as GraphMessagesResponse

  return response.value ?? []
}
