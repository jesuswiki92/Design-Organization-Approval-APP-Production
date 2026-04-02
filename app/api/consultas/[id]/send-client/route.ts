import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

type IncomingQueryPayload = {
  codigo?: string | null
  asunto?: string | null
  remitente?: string | null
  clasificacion?: string | null
  cuerpoOriginal?: string | null
  respuestaIa?: string | null
}

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

    const now = new Date().toISOString()
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
      body: message,
      mensaje: message,
      message,
      clientMessage: message,
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
