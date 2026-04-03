import { NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'

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

function toHtmlEmail(message: string, formUrl: string) {
  const linkHtml = `<a href="${escapeHtml(formUrl)}" style="color:#0284c7;font-weight:600;text-decoration:underline;">Acceder al formulario del proyecto</a>`

  let html = escapeHtml(message)

  if (html.includes(escapeHtml(FORM_LINK_MARKER))) {
    html = html.replace(escapeHtml(FORM_LINK_MARKER), linkHtml)
  } else if (html.includes(escapeHtml(FORM_INTAKE_PLACEHOLDER))) {
    html = html.replace(escapeHtml(FORM_INTAKE_PLACEHOLDER), linkHtml)
  }

  html = html.replace(/\n/g, '<br>')

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;">${html}</div>`
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
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
      return jsonResponse(
        500,
        'DOA_SEND_CLIENT_WEBHOOK_URL no está configurada. Añádela en el entorno antes de enviar correos al cliente.',
      )
    }

    const supabase = await createClient()
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

    if (!formUrl) {
      return jsonResponse(
        409,
        'La consulta todavía no tiene url_formulario. Genera primero la URL en n8n y vuelve a intentarlo.',
      )
    }

    const now = new Date().toISOString()
    const finalMessage = toHtmlEmail(message, formUrl)
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
      formUrl,
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
        formUrl,
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
      return Response.json(
        {
          error: `El webhook devolvió ${webhookResponse.status}.`,
          details: rawText.slice(0, 500),
        },
        { status: 502 },
      )
    }

    let responsePayload: unknown = null
    try {
      responsePayload = rawText ? JSON.parse(rawText) : null
    } catch {
      responsePayload = rawText || null
    }

    return Response.json({
      ok: true,
      message: 'Mensaje enviado correctamente al webhook del cliente.',
      formLink: {
        id: null,
        token: null,
        url: formUrl,
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
