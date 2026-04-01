// ✅ doa_consultas_entrantes RECONECTADA
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CONSULTA_ESTADOS } from '@/lib/workflow-states'
import { isMissingSchemaError } from '@/lib/supabase/errors'

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

    const message =
      typeof body.message === 'string' ? body.message.trim() : ''

    if (!id) {
      return jsonResponse(400, 'Consulta no válida.')
    }

    if (!message) {
      return jsonResponse(400, 'El mensaje al cliente es obligatorio.')
    }

    const webhookUrl = process.env.DOA_SEND_CLIENT_WEBHOOK_URL?.trim()
    if (!webhookUrl) {
      return jsonResponse(
        500,
        'DOA_SEND_CLIENT_WEBHOOK_URL no está configurada. Añádela en el entorno antes de enviar correos al cliente.',
      )
    }

    const query = body.query ?? {}

    const webhookPayload = {
      event: 'doa.consulta.reviewed_send_client',
      sentAt: new Date().toISOString(),
      source: 'doa-ops-hub',
      id,
      consultaId: id,
      codigo: query.codigo ?? null,
      asunto: query.asunto ?? null,
      subject: query.asunto ?? null,
      remitente: query.remitente ?? null,
      email: query.remitente ?? null,
      to: query.remitente ?? null,
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

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const now = new Date().toISOString()
    const stateUpdate = await supabase
      .from('doa_consultas_entrantes')
      .update({ estado: CONSULTA_ESTADOS.ESPERANDO_FORMULARIO })
      .eq('id', id)

    if (stateUpdate.error) {
      if (isMissingSchemaError(stateUpdate.error)) {
        return jsonResponse(
          409,
          'La tabla public.doa_consultas_entrantes no coincide con el esquema esperado. Aplica la migracion de Supabase pendiente y reintenta el envio.',
        )
      }

      return jsonResponse(
        500,
        `No se pudo actualizar el estado de la consulta: ${stateUpdate.error.message}`,
      )
    }

    const metadataUpdate = await supabase
      .from('doa_consultas_entrantes')
      .update({
        correo_cliente_enviado_at: now,
        correo_cliente_enviado_by: user?.id ?? null,
        ultimo_borrador_cliente: message,
      })
      .eq('id', id)

    const statePersisted = true
    let warning: string | null = null

    if (metadataUpdate.error) {
      if (isMissingSchemaError(metadataUpdate.error)) {
        warning =
          'La consulta avanzó de estado, pero faltan columnas de persistencia en public.doa_consultas_entrantes. Aplica la migración de Supabase pendiente para guardar los metadatos del envío.'
      } else {
        warning = `La consulta avanzó de estado, pero no se pudieron guardar los metadatos del envío: ${metadataUpdate.error.message}`
      }
    }

    return Response.json({
      ok: true,
      message: statePersisted
        ? 'Mensaje enviado correctamente al cliente. La consulta avanzó al siguiente estado del workflow.'
        : 'Mensaje enviado correctamente al cliente.',
      statePersisted,
      warning,
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
