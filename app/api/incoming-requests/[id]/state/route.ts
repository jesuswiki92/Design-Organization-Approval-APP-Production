import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import { isMissingSchemaError } from '@/lib/supabase/errors'
import { isIncomingQueryStateCode, isQuotationBoardStateCode } from '@/lib/workflow-state-config'

export const runtime = 'nodejs'

function jsonResponse(status: number, error: string) {
  return Response.json({ error }, { status })
}

// TODO(RLS): authz no garantiza ownership — depende de RLS [audit Fase pre-prod]
// doa_incoming_requests no tiene columna owner_user_id; hasta que exista una
// table de roles, registramos un evento severity=warn cuando un non-admin muta
// el status (abajo) para dejar trazabilidad.
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUserApi()
    if (auth instanceof Response) return auth
    const { user, supabase } = auth
    const requestContext = buildRequestContext(request)

    const { id } = await context.params
    const body = (await request.json()) as { status?: unknown }
    const status = typeof body.status === 'string' ? body.status.trim() : ''

    if (!id) {
      return jsonResponse(400, 'Request no válida.')
    }

    if (!status || (!isIncomingQueryStateCode(status) && !isQuotationBoardStateCode(status))) {
      return jsonResponse(400, 'El status solicitado no es válido.')
    }

    const isAdmin =
      (user.user_metadata as { role?: unknown } | null)?.role === 'admin'
    if (!isAdmin) {
      await logServerEvent({
        eventName: 'request.state_change.non_admin',
        eventCategory: 'security',
        outcome: 'info',
        severity: 'warn',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'request',
        entityId: id,
        metadata: { reason: 'rls_pending', intended_state: status },
      })
    }

    const current = await supabase
      .from('doa_incoming_requests')
      .select('status, codigo')
      .eq('id', id)
      .maybeSingle()

    const update = await supabase
      .from('doa_incoming_requests')
      .update({ status })
      .eq('id', id)
      .select('id, status')
      .single()

    if (update.error) {
      await logServerEvent({
        eventName: 'quotation.state_change',
        eventCategory: 'quotation',
        outcome: 'failure',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'request',
        entityId: id,
        entityCode: current.data?.codigo ?? null,
        metadata: {
          previous_state: current.data?.status ?? null,
          next_state: status,
          error_message: update.error.message,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })

      if (isMissingSchemaError(update.error)) {
        return jsonResponse(
          409,
          'La table public.doa_incoming_requests no coincide con el esquema esperado. Aplica la migración pending antes de cambiar statuses.',
        )
      }

      return jsonResponse(
        500,
        `No se pudo actualizar el status de la request: ${update.error.message}`,
      )
    }

    await logServerEvent({
      eventName: 'quotation.state_change',
      eventCategory: 'quotation',
      outcome: 'success',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'request',
      entityId: update.data.id,
      entityCode: current.data?.codigo ?? null,
      metadata: {
        previous_state: current.data?.status ?? null,
        next_state: update.data.status,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return Response.json({
      ok: true,
      id: update.data.id,
      status: update.data.status,
    })
  } catch (error) {
    console.error('request state PATCH error:', error)

    return jsonResponse(
      500,
      error instanceof Error ? error.message : 'Unexpected server error.',
    )
  }
}
