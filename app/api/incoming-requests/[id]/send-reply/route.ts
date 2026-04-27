/**
 * ============================================================================
 * POST /api/incoming-requests/[id]/send-reply
 * ============================================================================
 *
 * Recibe el body editado por el usuario (sobre el borrador IA) y lo envía vía
 * Microsoft Graph (/me/sendMail). El cuerpo YA debería traer la URL del
 * formulario inlined (la sustitución ocurre en `/draft-reply` cuando se genera
 * el borrador), pero como red defensiva, si todavía aparece `{{FORM_LINK}}`
 * lo reemplazamos por el `form_url` ya persistido en la fila.
 *
 * Persiste el outbound en `doa_emails_v2` y actualiza
 * `doa_incoming_requests_v2` (status -> awaiting_form, last_client_draft,
 * reply_body, reply_sent_at, client_email_sent_at).
 *
 * Si Graph falla, devolvemos 500 sin tocar la DB.
 * Si Graph va bien pero la persistencia falla, devolvemos 500 con
 * `{ ok: true, sent: {...}, persisted: false, error: '...' }` — el correo ya
 * salió y el usuario debe saber que la DB quedó desincronizada.
 *
 * Sin auth (frame-only). Cuando se reconecte auth, añadir guard.
 * ============================================================================
 */

import { NextResponse } from 'next/server'

import { sendReply } from '@/automations/inbound-email/send-reply'
import { extractSenderEmail } from '@/app/(dashboard)/quotations/incoming-queries'
import { supabaseServer } from '@/lib/supabase/server'
import type { IncomingRequest } from '@/types/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FORM_LINK_TOKEN = '{{FORM_LINK}}'

interface SendReplyRequestBody {
  body?: unknown
}

/**
 * Convierte el cuerpo plano editado a HTML mínimo:
 *   - Si todavía aparece `{{FORM_LINK}}`, lo sustituye por un anchor (defensa
 *     en profundidad: el draft ya debería traer la URL inline).
 *   - Convierte saltos de línea a `<br>` (sin renderizar markdown).
 *   - Si el body no contiene la URL del formulario por ningún lado, la
 *     anexa al final como anchor para garantizar que el cliente reciba el
 *     enlace.
 */
function toHtmlBody(body: string, formUrl: string): string {
  const anchor = `<a href="${formUrl}">${formUrl}</a>`

  let withLink: string
  if (body.includes(FORM_LINK_TOKEN)) {
    withLink = body.split(FORM_LINK_TOKEN).join(anchor)
  } else if (body.includes(formUrl)) {
    // Plain-text URL appears (the draft endpoint inlines it). Wrap it as an
    // anchor for nicer rendering in the client.
    withLink = body.split(formUrl).join(anchor)
  } else {
    // Last-resort safety net: append the URL.
    withLink = `${body}\n\n${anchor}`
  }

  return withLink.replace(/\r\n/g, '\n').replace(/\n/g, '<br>')
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params

  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'Missing id' },
      { status: 400 },
    )
  }

  // 1) Parse body
  let parsed: SendReplyRequestBody
  try {
    parsed = (await request.json()) as SendReplyRequestBody
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const editedBody =
    typeof parsed.body === 'string' ? parsed.body.trim() : ''

  if (!editedBody) {
    return NextResponse.json(
      { ok: false, error: 'Body vacío: no hay nada que enviar' },
      { status: 400 },
    )
  }

  // 2) Fetch incoming row
  const { data: row, error: fetchError } = await supabaseServer
    .from('doa_incoming_requests_v2')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !row) {
    if (fetchError) {
      console.error('send-reply: error fetching incoming request', fetchError)
    }
    return NextResponse.json(
      { ok: false, error: 'Incoming request not found' },
      { status: 404 },
    )
  }

  const incoming = row as unknown as IncomingRequest

  // 3) Defensive: solo enviamos si está en 'new' (sin reenvíos accidentales)
  if (incoming.status !== 'new') {
    return NextResponse.json(
      { ok: false, error: 'Already sent or not in a sendable state' },
      { status: 400 },
    )
  }

  // 4) Read the previously generated form_url. The draft endpoint is
  //    responsible for creating it; if it's missing here, the operator hit
  //    "Mandar al cliente" without ever clicking "Generar respuesta IA".
  const formUrl = incoming.form_url?.trim() ?? ''
  if (!formUrl) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'No form URL found. Generate AI reply first to create the form token.',
      },
      { status: 400 },
    )
  }

  // 5+6+7) Construir HTML body con FORM_LINK / URL plana sustituidos
  const htmlBody = toHtmlBody(editedBody, formUrl)

  // 8) Subject
  const subject = `Re: ${incoming.subject ?? ''}`

  // 9) Resolver destinatario
  const toEmail = extractSenderEmail(incoming.sender)
  if (!toEmail) {
    return NextResponse.json(
      { ok: false, error: 'No se pudo extraer email del remitente' },
      { status: 400 },
    )
  }

  const fromMailbox = process.env.OUTLOOK_MAILBOX?.trim() ?? ''

  // 10) Enviar
  let sentAtIso: string
  try {
    const result = await sendReply({
      fromMailbox,
      toEmail,
      subject,
      body: htmlBody,
    })
    sentAtIso = result.sentAtIso
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error sending email'
    console.error('send-reply: Graph sendMail failed', error)
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    )
  }

  // 11) Persistencia post-envío. Si algo falla aquí, NO rollback del email:
  //     devolvemos 500 con persisted: false para que el usuario sepa que la
  //     DB quedó desincronizada con el envío real.
  try {
    const { error: insertError } = await supabaseServer
      .from('doa_emails_v2')
      .insert({
        incoming_request_id: id,
        direction: 'outbound',
        from_addr: fromMailbox,
        to_addr: toEmail,
        subject,
        body: htmlBody,
        sent_at: sentAtIso,
        message_id: null,
        in_reply_to: null,
      })

    if (insertError) {
      throw new Error(
        `Supabase insert error (doa_emails_v2): ${insertError.message}`,
      )
    }

    const { error: updateError } = await supabaseServer
      .from('doa_incoming_requests_v2')
      .update({
        status: 'awaiting_form',
        client_email_sent_at: sentAtIso,
        last_client_draft: editedBody,
        reply_body: htmlBody,
        reply_sent_at: sentAtIso,
      })
      .eq('id', id)

    if (updateError) {
      throw new Error(
        `Supabase update error (doa_incoming_requests_v2): ${updateError.message}`,
      )
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown DB persistence error'
    console.error('send-reply: persistence failed AFTER successful send', error)
    return NextResponse.json(
      {
        ok: true,
        sent: { toEmail, subject },
        persisted: false,
        error: message,
      },
      { status: 500 },
    )
  }

  // 12) Éxito
  return NextResponse.json({
    ok: true,
    sent: { toEmail, subject },
    formUrl,
    status: 'awaiting_form',
  })
}
