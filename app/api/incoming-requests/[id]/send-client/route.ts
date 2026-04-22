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
    } else {
      // Defensive fallback: the LLM disobeyed the MANDATORY placeholder rule,
      // or the user deleted the marker without clicking "remove form". We still
      // have a valid form URL, so append it as a short block so the link
      // always reaches the client — regression insurance for BUG-02.
      html = `${html}\n\n${linkHtml}`
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

    // Resolve the form URL with a 3-step fallback chain:
    //   1) persistedUrl — URL sent by the composer (query.urlFormulario from page.tsx)
    //   2) doa_incoming_requests.form_url — denormalized column written by n8n
    //   3) doa_form_tokens — build `${NEXT_PUBLIC_APP_URL}/f/${token}` from the latest
    //      unused, unexpired token for this request. Mirrors page.tsx fallback.
    // Without (3) an empty form_url column silently strips the marker from the email.
    const persistedUrl =
      typeof query.urlFormulario === 'string' ? query.urlFormulario.trim() : ''

    async function resolveFormUrlFromDb(): Promise<string> {
      const consultaResult = await supabase
        .from('doa_incoming_requests')
        .select('form_url')
        .eq('id', id)
        .maybeSingle()

      if (consultaResult.error) {
        throw consultaResult.error
      }

      const persisted = consultaResult.data?.form_url?.trim() ?? ''
      if (persisted) return persisted

      // Fallback: look up the active public-form token and build the URL.
      const nowIso = new Date().toISOString()
      const { data: tokenRow, error: tokenError } = await supabase
        .from('doa_form_tokens')
        .select('token')
        .eq('incoming_request_id', id)
        .is('used_at', null)
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (tokenError) {
        console.error('[send-client] error loading doa_form_tokens fallback:', tokenError)
        return ''
      }

      if (!tokenRow?.token) return ''

      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
      if (!appUrl) {
        console.error(
          '[send-client] NEXT_PUBLIC_APP_URL is not configured; cannot build form URL from token fallback',
        )
        return ''
      }

      return `${appUrl.replace(/\/$/, '')}/f/${tokenRow.token}`
    }

    const formUrl = persistedUrl || (await resolveFormUrlFromDb())

    // Defensive warning: composer submitted a message that still contains the
    // marker but we could not resolve a form URL. The email will be sent with
    // the marker stripped — log so regressions are visible.
    if (!formUrl && message.includes(FORM_LINK_MARKER)) {
      console.warn(
        `[send-client] incoming_request_id=${id} message contains FORM_LINK_MARKER but no form URL could be resolved (persistedUrl empty, form_url column empty, no active token). Marker will be stripped from email body.`,
      )
    }

    // Si no hay formUrl, se envia el email sin enlace al form
    const now = new Date().toISOString()
    const finalMessage = toHtmlEmail(message, formUrl || null)
    // formUrl normalizado: string si existe, null si no
    const resolvedFormUrl = formUrl || null

    // Defensive warning: we have a form URL but the marker was missing from the
    // composer's message. toHtmlEmail cannot substitute it and the link will be
    // absent from the email — log so we can catch LLM prompts that drop the
    // placeholder or users who accidentally delete it.
    if (resolvedFormUrl && !message.includes(FORM_LINK_MARKER) && !message.includes(FORM_INTAKE_PLACEHOLDER)) {
      console.warn(
        `[send-client] incoming_request_id=${id} form URL resolved but FORM_LINK_MARKER not present in message body; email will be sent without the link.`,
      )
    }

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
