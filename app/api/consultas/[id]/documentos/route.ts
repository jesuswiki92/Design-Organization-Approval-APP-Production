import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'

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
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { user } = auth
  const requestContext = buildRequestContext(request)

  const { id } = await context.params
  const body = await request.json()
  const docs =
    body && typeof body === 'object' && 'docs' in body && body.docs && typeof body.docs === 'object'
      ? body.docs as Record<string, boolean>
      : {}
  const selectedCount = Object.values(docs).filter(Boolean).length

  const webhookUrl = process.env.DOA_COMPLIANCE_DOCS_WEBHOOK_URL
  if (!webhookUrl) {
    await logServerEvent({
      eventName: 'quotation.compliance_docs_save',
      eventCategory: 'quotation',
      outcome: 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'consulta',
      entityId: id,
      metadata: {
        reason: 'missing_webhook_url',
        selected_count: selectedCount,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return Response.json({ error: 'Webhook no configurado.' }, { status: 500 })
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consulta_id: id,
        docs,
        fecha_hora: new Date().toISOString(),
      }),
    })

    if (!res.ok) {
      console.error('Webhook n8n error:', res.status)
      await logServerEvent({
        eventName: 'quotation.compliance_docs_save',
        eventCategory: 'quotation',
        outcome: 'failure',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'consulta',
        entityId: id,
        metadata: {
          selected_count: selectedCount,
          total_fields: Object.keys(docs).length,
          upstream_status: res.status,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return Response.json({ error: `Webhook error ${res.status}` }, { status: 502 })
    }

    const data = await res.json().catch(() => ({ ok: true }))
    await logServerEvent({
      eventName: 'quotation.compliance_docs_save',
      eventCategory: 'quotation',
      outcome: 'success',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'consulta',
      entityId: id,
      metadata: {
        selected_count: selectedCount,
        total_fields: Object.keys(docs).length,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })
    return Response.json(data)
  } catch (err) {
    console.error('Error webhook compliance:', err)
    await logServerEvent({
      eventName: 'quotation.compliance_docs_save',
      eventCategory: 'quotation',
      outcome: 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'consulta',
      entityId: id,
      metadata: {
        selected_count: selectedCount,
        total_fields: Object.keys(docs).length,
        error_name: err instanceof Error ? err.name : 'UnknownError',
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })
    return Response.json({ error: 'Error de conexion con n8n' }, { status: 502 })
  }
}
