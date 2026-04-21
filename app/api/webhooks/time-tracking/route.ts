import { NextResponse } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'

/**
 * Proxy autenticado al webhook de n8n que registra started_at/ended_at de sesiones
 * del conteo de horas por project.
 * La URL del webhook vive en `DOA_CONTEO_HORAS_WEBHOOK_URL` (server-only).
 * El client llama a `/api/webhooks/time-tracking` — la URL real nunca sale al bundle.
 */

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { user } = auth
  const requestContext = buildRequestContext(request)

  const url = process.env.DOA_CONTEO_HORAS_WEBHOOK_URL
  if (!url) {
    await logServerEvent({
      eventName: 'time_tracking.timer',
      eventCategory: 'time_tracking',
      outcome: 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      metadata: { reason: 'missing_webhook_url' },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 },
    )
  }

  let body: unknown
  let parsedBody: Record<string, unknown> = {}
  try {
    body = await request.json()
    parsedBody =
      body && typeof body === 'object'
        ? body as Record<string, unknown>
        : {}
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await upstream.text()

    await logServerEvent({
      eventName: 'time_tracking.timer',
      eventCategory: 'time_tracking',
      outcome: upstream.ok ? 'success' : 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'project',
      entityId:
        typeof parsedBody.project_id === 'string' ? parsedBody.project_id : null,
      entityCode:
        typeof parsedBody.project_number === 'string'
          ? parsedBody.project_number
          : null,
      metadata: {
        action: typeof parsedBody.type === 'string' ? parsedBody.type : null,
        upstream_status: upstream.status,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('Content-Type') ?? 'application/json',
      },
    })
  } catch (err) {
    console.error('Error proxying conteo-horas webhook:', err)
    await logServerEvent({
      eventName: 'time_tracking.timer',
      eventCategory: 'time_tracking',
      outcome: 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'project',
      entityId:
        typeof parsedBody.project_id === 'string' ? parsedBody.project_id : null,
      entityCode:
        typeof parsedBody.project_number === 'string'
          ? parsedBody.project_number
          : null,
      metadata: {
        action: typeof parsedBody.type === 'string' ? parsedBody.type : null,
        error_name: err instanceof Error ? err.name : 'UnknownError',
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })
    return NextResponse.json(
      { error: 'Upstream webhook failed' },
      { status: 502 },
    )
  }
}
