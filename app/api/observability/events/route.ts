import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext, type AppEventInput } from '@/lib/observability/shared'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { user } = auth

  let body: Partial<AppEventInput> & { keepalive?: boolean }

  try {
    body = (await request.json()) as Partial<AppEventInput> & { keepalive?: boolean }
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.eventName || !body.eventCategory) {
    return Response.json(
      { error: 'eventName and eventCategory are required.' },
      { status: 400 },
    )
  }

  const actorUserId: string | null = user?.id ?? null

  const requestContext = buildRequestContext(request)

  await logServerEvent({
    eventName: body.eventName,
    eventCategory: body.eventCategory,
    source: 'client',
    outcome: body.outcome,
    actorUserId,
    requestId: body.requestId ?? requestContext.requestId,
    sessionId:
      body.sessionId ?? request.headers.get('x-correlation-id') ?? null,
    route: body.route ?? requestContext.route,
    method: body.method ?? 'CLIENT',
    entityType: body.entityType,
    entityId: body.entityId,
    entityCode: body.entityCode,
    metadata: body.metadata,
    userAgent: requestContext.userAgent,
    ipAddress: requestContext.ipAddress,
    referrer: requestContext.referrer,
  })

  return Response.json({ ok: true }, { status: 202 })
}
