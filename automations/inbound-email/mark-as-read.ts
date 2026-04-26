/**
 * ============================================================================
 * mark-as-read — marca un mensaje como leido en Outlook via Graph API
 * ============================================================================
 *
 * Slice 2. Hace PATCH /me/messages/{id} con `{ isRead: true }`. Reutiliza el
 * cliente delegado de getGraphClient() (mismo refresh_token / mismo tenant).
 *
 * Este endpoint es la barrera anti-duplicado: si un email ya esta marcado
 * como leido, `readUnreadEmails()` no lo devuelve en la siguiente pasada.
 */

import { getGraphClient } from './graph-client'

export async function markAsRead(messageId: string): Promise<void> {
  if (!messageId || typeof messageId !== 'string') {
    throw new Error('mark-as-read: messageId vacio o invalido')
  }

  const client = getGraphClient()

  try {
    await client.api(`/me/messages/${messageId}`).patch({ isRead: true })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `mark-as-read: no se pudo marcar como leido messageId=${messageId}: ${detail}`,
    )
  }
}
