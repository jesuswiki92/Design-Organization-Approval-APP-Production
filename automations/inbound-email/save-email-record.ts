/**
 * ============================================================================
 * save-email-record — persiste el email entrante en doa_emails_v2
 * ============================================================================
 *
 * Slice 2 (extension). Tras crear la fila en `doa_incoming_requests_v2`, este
 * paso replica el email original en `doa_emails_v2` con `direction: 'inbound'`
 * para que la sección "Comunicaciones" del detalle pueda mostrarlo. No hace
 * lookup de hilos: `in_reply_to` queda en `null` (siempre primer mensaje del
 * hilo en este punto del flujo).
 */

import { supabaseServer } from '@/lib/supabase/server'

export interface SaveInboundEmailInput {
  incomingRequestId: string
  fromAddr: string
  toAddr: string | null
  subject: string
  body: string
  sentAt: string
  messageId: string | null
}

export async function saveInboundEmail(
  input: SaveInboundEmailInput,
): Promise<{ id: string }> {
  const payload = {
    incoming_request_id: input.incomingRequestId,
    direction: 'inbound' as const,
    from_addr: input.fromAddr,
    to_addr: input.toAddr,
    subject: input.subject,
    body: input.body,
    sent_at: input.sentAt,
    message_id: input.messageId,
    in_reply_to: null as string | null,
  }

  const { data, error } = await supabaseServer
    .from('doa_emails_v2')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    throw new Error(`Supabase insert error (doa_emails_v2): ${error.message}`)
  }

  if (!data?.id) {
    throw new Error('Supabase insert error (doa_emails_v2): no id returned')
  }

  return { id: data.id as string }
}
