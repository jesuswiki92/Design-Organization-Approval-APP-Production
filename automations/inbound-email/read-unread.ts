/**
 * ============================================================================
 * read-unread — listar emails no leídos del buzón Outlook
 * ============================================================================
 *
 * Slice 1 (read-only). Solo LEE los mensajes con `isRead eq false` del Inbox
 * del usuario delegado (el dueño del refresh_token). No marca como leídos, no
 * responde, no toca Supabase. Devuelve un array tipado.
 *
 * Endpoint Graph: /me/mailFolders/Inbox/messages
 *   - En flujo delegado el endpoint es `/me/...`, NO `/users/{mailbox}/...`.
 *     El usuario propietario del access_token (resuelto por MSAL a partir del
 *     refresh_token) determina el buzón.
 *   - `OUTLOOK_MAILBOX` se mantiene como variable informativa: validamos que
 *     esté seteada para confirmar que alguien configuró la automatización,
 *     pero no la usamos en la URL de Graph.
 *
 * Filtro:    isRead eq false
 * Orden:     receivedDateTime asc (procesar primero los más antiguos)
 * Selección: campos mínimos para identificación + cuerpo del mensaje
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
  hasAttachments: boolean
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
  'hasAttachments',
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

  // `mailbox` se valida arriba pero no se usa en la URL: en flujo delegado
  // el endpoint es `/me`, vinculado al refresh_token que MSAL canjea.
  void mailbox

  const client = getGraphClient()

  const response = (await client
    .api('/me/mailFolders/Inbox/messages')
    .filter('isRead eq false')
    .orderby('receivedDateTime asc')
    .select(SELECT_FIELDS)
    .top(limit)
    .get()) as GraphMessagesResponse

  return response.value ?? []
}
