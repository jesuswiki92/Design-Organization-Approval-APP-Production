import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { user } = auth
  const requestContext = buildRequestContext(request)

  const { id } = await context.params
  const body = await request.json()
  const items: Array<{ category?: unknown }> = Array.isArray(body?.items) ? body.items : []
  const engineeringItems = items.filter((item) => item?.category === 'engineering').length
  const deliverableItems = items.filter((item) => item?.category === 'deliverables').length

  const webhookUrl = process.env.DOA_QUOTATION_SAVE_WEBHOOK_URL
  if (!webhookUrl) {
    await logServerEvent({
      eventName: 'quotation.save',
      eventCategory: 'quotation',
      outcome: 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'request',
      entityId: id,
      metadata: { reason: 'missing_webhook_url' },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return Response.json(
      { error: 'Webhook URL not configured' },
      { status: 500 }
    )
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incoming_request_id: id,
        ...body,
      }),
    })
    const data = await res.json().catch(() => ({ ok: true }))

    await logServerEvent({
      eventName: 'quotation.save',
      eventCategory: 'quotation',
      outcome: res.ok ? 'success' : 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'request',
      entityId: id,
      entityCode:
        typeof data === 'object' && data !== null && 'quotation_number' in data
          ? String(data.quotation_number ?? '')
          : null,
      metadata: {
        item_count: items.length,
        engineering_item_count: engineeringItems,
        deliverable_item_count: deliverableItems,
        subtotal: typeof body?.subtotal === 'number' ? body.subtotal : null,
        tax_amount: typeof body?.tax_amount === 'number' ? body.tax_amount : null,
        total: typeof body?.total === 'number' ? body.total : null,
        upstream_status: res.status,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return Response.json(data)
  } catch (err) {
    console.error('Error calling quotation webhook:', err)
    await logServerEvent({
      eventName: 'quotation.save',
      eventCategory: 'quotation',
      outcome: 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'request',
      entityId: id,
      metadata: {
        item_count: items.length,
        engineering_item_count: engineeringItems,
        deliverable_item_count: deliverableItems,
        error_name: err instanceof Error ? err.name : 'UnknownError',
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })
    return Response.json({ error: 'Webhook error' }, { status: 502 })
  }
}
