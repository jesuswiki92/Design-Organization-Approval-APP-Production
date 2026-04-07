import { NextRequest } from 'next/server'

/**
 * Proxy al webhook de n8n para guardar documentos compliance.
 * Recibe { docs: { doc_g12_01: true, doc_g12_17: false, ... } }
 * y lo envia al webhook que actualiza las 44 columnas booleanas en Supabase.
 *
 * n8n workflow: "DOA - Guardar Documentos Compliance" (FUmlV5uBEnacTVs2)
 */

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const body = await request.json()

  const webhookUrl = process.env.NEXT_PUBLIC_DOA_COMPLIANCE_DOCS_WEBHOOK_URL
  if (!webhookUrl) {
    return Response.json({ error: 'Webhook no configurado.' }, { status: 500 })
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consulta_id: id,
        docs: body.docs ?? {},
        fecha_hora: new Date().toISOString(),
      }),
    })

    if (!res.ok) {
      console.error('Webhook n8n error:', res.status)
      return Response.json({ error: `Webhook error ${res.status}` }, { status: 502 })
    }

    const data = await res.json().catch(() => ({ ok: true }))
    return Response.json(data)
  } catch (err) {
    console.error('Error webhook compliance:', err)
    return Response.json({ error: 'Error de conexion con n8n' }, { status: 502 })
  }
}
