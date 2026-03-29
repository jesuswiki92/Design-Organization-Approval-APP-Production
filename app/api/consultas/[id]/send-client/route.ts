import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const WEBHOOK_URL = "https://sswebhook.testn8n.com/webhook/doa-send-client-email"

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

function isMissingSchemaError(message: string) {
  return (
    message.includes("Could not find the table") ||
    message.includes("column") ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  )
}

function buildConsultasEntrantesSchemaError(message: string) {
  if (message.includes("estado")) {
    return "La tabla public.doa_consultas_entrantes aun no tiene la columna `estado`. Aplica la migracion de Supabase pendiente y reintenta el envio."
  }

  return "La tabla public.doa_consultas_entrantes no coincide con el esquema esperado. Aplica la migracion de Supabase pendiente y reintenta el envio."
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
      typeof body.message === "string" ? body.message.trim() : ""

    if (!id) {
      return jsonResponse(400, "Consulta no válida.")
    }

    if (!message) {
      return jsonResponse(400, "El mensaje al cliente es obligatorio.")
    }

    const query = body.query ?? {}

    const webhookPayload = {
      event: "doa.consulta.reviewed_send_client",
      sentAt: new Date().toISOString(),
      source: "doa-ops-hub",
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

    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookPayload),
      cache: "no-store",
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
      .from("doa_consultas_entrantes")
      .update({ estado: "espera_formulario_cliente" })
      .eq("id", id)

    if (stateUpdate.error) {
      if (isMissingSchemaError(stateUpdate.error.message)) {
        return jsonResponse(409, buildConsultasEntrantesSchemaError(stateUpdate.error.message))
      }

      return jsonResponse(
        500,
        `No se pudo actualizar el estado de la consulta: ${stateUpdate.error.message}`,
      )
    }

    const metadataUpdate = await supabase
      .from("doa_consultas_entrantes")
      .update({
        correo_cliente_enviado_at: now,
        correo_cliente_enviado_by: user?.id ?? null,
        ultimo_borrador_cliente: message,
      })
      .eq("id", id)

    const statePersisted = true
    let warning: string | null = null

    if (metadataUpdate.error) {
      if (isMissingSchemaError(metadataUpdate.error.message)) {
        warning =
          "La consulta paso a espera_formulario_cliente, pero faltan columnas de persistencia en public.doa_consultas_entrantes. Aplica la migracion de Supabase pendiente para guardar los metadatos del envio."
      } else {
        warning = `La consulta paso a espera_formulario_cliente, pero no se pudieron guardar los metadatos del envio: ${metadataUpdate.error.message}`
      }
    }

    return Response.json({
      ok: true,
      message: statePersisted
        ? "Mensaje enviado correctamente al cliente. La consulta paso a Espera formulario cliente."
        : "Mensaje enviado correctamente al cliente.",
      statePersisted,
      warning,
      webhookPayload,
      webhookResponse: responsePayload,
    })
  } catch (error) {
    return jsonResponse(
      500,
      error instanceof Error ? error.message : "Unexpected server error.",
    )
  }
}
