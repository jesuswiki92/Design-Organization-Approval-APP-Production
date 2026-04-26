/**
 * ============================================================================
 * save-as-incoming — persiste un email entrante en doa_incoming_requests_v2
 * ============================================================================
 *
 * Slice 2. Inserta una sola fila con los campos minimos: subject, sender,
 * original_body, classification y outlook_conversation_id. El resto de
 * columnas (entry_number, form_url, ai_reply, etc.) se rellenan en pasos
 * posteriores del flujo. `status` queda con su default 'new' y no se pasa.
 *
 * No hace lookup de cliente por dominio en este slice — `client_id = null`.
 */

import { supabaseServer } from '@/lib/supabase/server'

const SUBJECT_MAX = 1000
const SENDER_MAX = 500

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return value.slice(0, max)
}

export interface SaveAsIncomingInput {
  subject: string
  sender: string
  originalBody: string
  classification: string
  outlookConversationId: string | null
}

export async function saveAsIncoming(
  input: SaveAsIncomingInput,
): Promise<{ id: string }> {
  const payload = {
    subject: truncate(input.subject ?? '', SUBJECT_MAX),
    sender: truncate(input.sender ?? '', SENDER_MAX),
    original_body: input.originalBody ?? '',
    classification: input.classification,
    outlook_conversation_id: input.outlookConversationId,
    client_id: null as string | null,
  }

  const { data, error } = await supabaseServer
    .from('doa_incoming_requests_v2')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`)
  }

  if (!data?.id) {
    throw new Error('Supabase insert error: no id returned')
  }

  return { id: data.id as string }
}
