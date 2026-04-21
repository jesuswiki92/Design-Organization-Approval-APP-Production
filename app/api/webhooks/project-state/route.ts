import { NextResponse } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'

/**
 * Proxy autenticado al webhook de n8n que actualiza el estado de un proyecto.
 * La URL del webhook vive en `DOA_PROJECT_STATE_WEBHOOK_URL` (server-only).
 * El cliente llama a `/api/webhooks/project-state` — la URL real nunca sale al bundle.
 */

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { user, supabase } = auth
  const requestContext = buildRequestContext(request)

  const url = process.env.DOA_PROJECT_STATE_WEBHOOK_URL
  if (!url) {
    await logServerEvent({
      eventName: 'project.state_change',
      eventCategory: 'project',
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

  const projectId =
    typeof parsedBody.proyecto_id === 'string' ? parsedBody.proyecto_id : null
  const nextState =
    typeof parsedBody.estado === 'string' ? parsedBody.estado : null

  let previousState: string | null = null
  let projectNumber: string | null = null

  if (projectId) {
    const current = await supabase
      .from('doa_proyectos')
      .select('estado, numero_proyecto')
      .eq('id', projectId)
      .maybeSingle()

    previousState = current.data?.estado ?? null
    projectNumber = current.data?.numero_proyecto ?? null
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await upstream.text()

    await logServerEvent({
      eventName: 'project.state_change',
      eventCategory: 'project',
      outcome: upstream.ok ? 'success' : 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'project',
      entityId: projectId,
      entityCode: projectNumber,
      metadata: {
        previous_state: previousState,
        next_state: nextState,
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
    console.error('Error proxying project-state webhook:', err)
    await logServerEvent({
      eventName: 'project.state_change',
      eventCategory: 'project',
      outcome: 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'project',
      entityId: projectId,
      entityCode: projectNumber,
      metadata: {
        previous_state: previousState,
        next_state: nextState,
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
