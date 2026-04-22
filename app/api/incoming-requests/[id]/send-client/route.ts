import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'

export const runtime = 'nodejs'

type IncomingQueryPayload = {
  codigo?: string | null
  subject?: string | null
  sender?: string | null
  urlFormulario?: string | null
  classification?: string | null
  cuerpoOriginal?: string | null
  respuestaIa?: string | null
}

const FORM_INTAKE_PLACEHOLDER = '(Form intake here)'
const FORM_LINK_MARKER = '[Acceder al formulario del proyecto]'

function jsonResponse(status: number, error: string) {
  return Response.json({ error }, { status })
}

function required(value: unknown, label: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) {
    throw new Error(`Missing required field: ${label}`)
  }
  return text
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function toHtmlEmail(message: string, formUrl: string | null) {
  let html = escapeHtml(message)

  if (formUrl) {
    // Si hay URL de form, reemplazar el marcador por un enlace clicable
    const linkHtml = `<a href="${escapeHtml(formUrl)}" style="color:#0284c7;font-weight:600;text-decoration:underline;">Acceder al formulario del proyecto</a>`

    if (html.includes(escapeHtml(FORM_LINK_MARKER))) {
      html = html.replace(escapeHtml(FORM_LINK_MARKER), linkHtml)
    } else if (html.includes(escapeHtml(FORM_INTAKE_PLACEHOLDER))) {
      html = html.replace(escapeHtml(FORM_INTAKE_PLACEHOLDER), linkHtml)
    }
  } else {
    // Sin URL de form: eliminar los marcadores si quedaron en el text
    html = html.replace(escapeHtml(FORM_LINK_MARKER), '')
    html = html.replace(escapeHtml(FORM_INTAKE_PLACEHOLDER), '')
  }

  html = html.replace(/\n/g, '<br>')

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;">${html}</div>`
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUserApi()
    if (auth instanceof Response) return auth
    const { user, supabase } = auth
    const requestContext = buildRequestContext(request)

    const { id } = await context.params
    const body = (await request.json()) as {
      message?: unknown
      query?: IncomingQueryPayload | null
    }

    if (!id) {
      return jsonResponse(400, 'Invalid request.')
    }

    const query = body.query ?? {}
    const to = required(query.sender, 'to')
    const subject = required(query.subject, 'subject')
    const message = required(body.message, 'body')

    const webhookUrl = process.env.DOA_SEND_CLIENT_WEBHOOK_URL?.trim()
    if (!webhookUrl) {
      await logServerEvent({
        eventName: 'communication.send_client',
        eventCategory: 'communication',
        outcome: 'failure',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'request',
        entityId: id,
        entityCode: query.codigo ?? null,
        metadata: { reason: 'missing_webhook_url' },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(
        500,
        'DOA_SEND_CLIENT_WEBHOOK_URL is not configured. Set it in the environment before sending client emails.',
      )
    }

    const persistedUrl =
      typeof query.urlFormulario === 'string' ? query.urlFormulario.trim() : ''
    const formUrl =
      persistedUrl ||
      (await (async () => {
        const consultaResult = await supabase
          .from('doa_incoming_requests')
          .select('form_url')
          .eq('id', id)
          .maybeSingle()

        if (consultaResult.error) {
          throw consultaResult.error
        }

        return consultaResult.data?.form_url?.trim() ?? ''
      })())

    // Si no hay formUrl, se envia el email sin enlace al form
    const now = new Date().toISOString()
    const finalMessage = toHtmlEmail(message, formUrl || null)
    // formUrl normalizado: string si existe, null si no
    const resolvedFormUrl = formUrl || null

    const webhookPayload = {
      event: 'doa.request.reviewed_send_client',
      sentAt: now,
      source: 'doa-ops-hub',
      id,
      consultaId: id,
      codigo: query.codigo ?? null,
      subject,
      sender: query.sender ?? null,
      email: query.sender ?? null,
      to,
      classification: query.classification ?? null,
      formToken: null,
      formUrl: resolvedFormUrl,
      formVariant: null,
      // Rendered message under multiple keys for forward compat.
      // n8n workflow I59H3jFoXXPkRCGc reads the rendered HTML from root `body`
      // ($json.body.body in n8n means POST-body field named `body`).
      mensaje: finalMessage,
      message: finalMessage,
      clientMessage: finalMessage,
      respuestaIa: query.respuestaIa ?? null,
      aiDraft: query.respuestaIa ?? null,
      cuerpoOriginal: query.cuerpoOriginal ?? null,
      originalBody: query.cuerpoOriginal ?? null,
      request: {
        id,
        codigo: query.codigo ?? null,
        subject: query.subject ?? null,
        sender: query.sender ?? null,
        classification: query.classification ?? null,
        formToken: null,
        formUrl: resolvedFormUrl,
        formVariant: null,
      },
      // Flat ES contract that n8n workflow "AMS - Enviar Correo al Cliente"
      // (id I59H3jFoXXPkRCGc) actually reads. The workflow references
      // $json.body.consulta.* and $json.body.body — in n8n webhook nodes,
      // $json.body is the parsed POST body, so these expressions map to
      // root-level POST keys `consulta` and `body`. Do NOT re-wrap under
      // another `body` key — that would nest one level too deep and break
      // the Outlook toRecipients / bodyContent bindings.
      consulta: {
        id,
        codigo: query.codigo ?? null,
        remitente: to,
        asunto: subject,
        clasificacion: query.classification ?? null,
        cuerpo_original: query.cuerpoOriginal ?? null,
      },
      body: finalMessage,
    }

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
      cache: 'no-store',
    })

    const rawText = await webhookResponse.text()

    if (!webhookResponse.ok) {
      await logServerEvent({
        eventName: 'communication.send_client',
        eventCategory: 'communication',
        outcome: 'failure',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'request',
        entityId: id,
        entityCode: query.codigo ?? null,
        metadata: {
          has_form_url: Boolean(resolvedFormUrl),
          message_length: message.length,
          upstream_status: webhookResponse.status,
          has_ai_draft: Boolean(query.respuestaIa),
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return Response.json(
        {
          error: `Webhook returned ${webhookResponse.status}.`,
          details: rawText.slice(0, 500),
        },
        { status: 502 },
      )
    }

    // Persist the sent response in Supabase so it shows up in the email thread.
    const { error: replyError } = await supabase
      .from('doa_incoming_requests')
      .update({ reply_body: message, reply_sent_at: now })
      .eq('id', id)

    if (replyError) {
      console.error('Error persisting reply_body in Supabase:', replyError)
    }

    let responsePayload: unknown = null
    try {
      responsePayload = rawText ? JSON.parse(rawText) : null
    } catch {
      responsePayload = rawText || null
    }

    await logServerEvent({
      eventName: 'communication.send_client',
      eventCategory: 'communication',
      outcome: 'success',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'request',
      entityId: id,
      entityCode: query.codigo ?? null,
      metadata: {
        has_form_url: Boolean(resolvedFormUrl),
        message_length: message.length,
        has_ai_draft: Boolean(query.respuestaIa),
        reply_body_persisted: !replyError,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return Response.json({
      ok: true,
      message: 'Message sent to client webhook successfully.',
      // Notice shown when the email was sent without a form link.
      warning: resolvedFormUrl
        ? null
        : 'Email was sent without a form link because the request has no form_url.',
      formLink: {
        id: null,
        token: null,
        url: resolvedFormUrl,
        variant: null,
      },
      webhookPayload,
      webhookResponse: responsePayload,
    })
  } catch (error) {
    console.error('send-client POST error:', error)
    return jsonResponse(
      500,
      error instanceof Error ? error.message : 'Unexpected server error.',
    )
  }
}
