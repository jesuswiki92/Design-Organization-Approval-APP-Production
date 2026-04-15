import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'

export const runtime = 'nodejs'

type IncomingQueryPayload = {
  codigo?: string | null
  asunto?: string | null
  remitente?: string | null
  urlFormulario?: string | null
  clasificacion?: string | null
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
    // Si hay URL de formulario, reemplazar el marcador por un enlace clicable
    const linkHtml = `<a href="${escapeHtml(formUrl)}" style="color:#0284c7;font-weight:600;text-decoration:underline;">Acceder al formulario del proyecto</a>`

    if (html.includes(escapeHtml(FORM_LINK_MARKER))) {
      html = html.replace(escapeHtml(FORM_LINK_MARKER), linkHtml)
    } else if (html.includes(escapeHtml(FORM_INTAKE_PLACEHOLDER))) {
      html = html.replace(escapeHtml(FORM_INTAKE_PLACEHOLDER), linkHtml)
    }
  } else {
    // Sin URL de formulario: eliminar los marcadores si quedaron en el texto
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
      return jsonResponse(400, 'Consulta no válida.')
    }

    const query = body.query ?? {}
    const to = required(query.remitente, 'to')
    const subject = required(query.asunto, 'subject')
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
        entityType: 'consulta',
        entityId: id,
        entityCode: query.codigo ?? null,
        metadata: { reason: 'missing_webhook_url' },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(
        500,
        'DOA_SEND_CLIENT_WEBHOOK_URL no está configurada. Añádela en el entorno antes de enviar correos al cliente.',
      )
    }

    const persistedUrl =
      typeof query.urlFormulario === 'string' ? query.urlFormulario.trim() : ''
    const formUrl =
      persistedUrl ||
      (await (async () => {
        const consultaResult = await supabase
          .from('doa_consultas_entrantes')
          .select('url_formulario')
          .eq('id', id)
          .maybeSingle()

        if (consultaResult.error) {
          throw consultaResult.error
        }

        return consultaResult.data?.url_formulario?.trim() ?? ''
      })())

    // Si no hay formUrl, se envia el correo sin enlace al formulario
    const now = new Date().toISOString()
    const finalMessage = toHtmlEmail(message, formUrl || null)
    // formUrl normalizado: string si existe, null si no
    const resolvedFormUrl = formUrl || null

    const webhookPayload = {
      event: 'doa.consulta.reviewed_send_client',
      sentAt: now,
      source: 'doa-ops-hub',
      id,
      consultaId: id,
      codigo: query.codigo ?? null,
      asunto: query.asunto ?? null,
      subject,
      remitente: query.remitente ?? null,
      email: query.remitente ?? null,
      to,
      clasificacion: query.clasificacion ?? null,
      formToken: null,
      formUrl: resolvedFormUrl,
      formVariant: null,
      body: finalMessage,
      mensaje: finalMessage,
      message: finalMessage,
      clientMessage: finalMessage,
      respuestaIa: query.respuestaIa ?? null,
      aiDraft: query.respuestaIa ?? null,
      cuerpoOriginal: query.cuerpoOriginal ?? null,
      originalBody: query.cuerpoOriginal ?? null,
      consulta: {
        id,
        codigo: query.codigo ?? null,
        asunto: query.asunto ?? null,
        remitente: query.remitente ?? null,
        clasificacion: query.clasificacion ?? null,
        formToken: null,
        formUrl: resolvedFormUrl,
        formVariant: null,
      },
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
        entityType: 'consulta',
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
          error: `El webhook devolvió ${webhookResponse.status}.`,
          details: rawText.slice(0, 500),
        },
        { status: 502 },
      )
    }

    // Guardar la respuesta enviada en Supabase para mostrarla en el hilo de emails
    const { error: replyError } = await supabase
      .from('doa_consultas_entrantes')
      .update({ reply_body: message, reply_sent_at: now })
      .eq('id', id)

    if (replyError) {
      console.error('Error guardando reply_body en Supabase:', replyError)
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
      entityType: 'consulta',
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
      message: 'Mensaje enviado correctamente al webhook del cliente.',
      // Aviso cuando se envia sin formulario (para informar al usuario)
      warning: resolvedFormUrl
        ? null
        : 'El correo se envió sin enlace al formulario porque la consulta no tiene url_formulario.',
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
