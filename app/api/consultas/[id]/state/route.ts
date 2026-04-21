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
// doa_consultas_entrantes no tiene columna owner_user_id; hasta que exista una
// tabla de roles, registramos un evento severity=warn cuando un non-admin muta
// el estado (abajo) para dejar trazabilidad.
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
    const body = (await request.json()) as { estado?: unknown }
    const estado = typeof body.estado === 'string' ? body.estado.trim() : ''

    if (!id) {
      return jsonResponse(400, 'Consulta no válida.')
    }

    if (!estado || (!isIncomingQueryStateCode(estado) && !isQuotationBoardStateCode(estado))) {
      return jsonResponse(400, 'El estado solicitado no es válido.')
    }

    const isAdmin =
      (user.user_metadata as { role?: unknown } | null)?.role === 'admin'
    if (!isAdmin) {
      await logServerEvent({
        eventName: 'consulta.state_change.non_admin',
        eventCategory: 'security',
        outcome: 'info',
        severity: 'warn',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'consulta',
        entityId: id,
        metadata: { reason: 'rls_pending', intended_state: estado },
      })
    }

    const current = await supabase
      .from('doa_consultas_entrantes')
      .select('estado, codigo')
      .eq('id', id)
      .maybeSingle()

    const update = await supabase
      .from('doa_consultas_entrantes')
      .update({ estado })
      .eq('id', id)
      .select('id, estado')
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
        entityType: 'consulta',
        entityId: id,
        entityCode: current.data?.codigo ?? null,
        metadata: {
          previous_state: current.data?.estado ?? null,
          next_state: estado,
          error_message: update.error.message,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })

      if (isMissingSchemaError(update.error)) {
        return jsonResponse(
          409,
          'La tabla public.doa_consultas_entrantes no coincide con el esquema esperado. Aplica la migración pendiente antes de cambiar estados.',
        )
      }

      return jsonResponse(
        500,
        `No se pudo actualizar el estado de la consulta: ${update.error.message}`,
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
      entityType: 'consulta',
      entityId: update.data.id,
      entityCode: current.data?.codigo ?? null,
      metadata: {
        previous_state: current.data?.estado ?? null,
        next_state: update.data.estado,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return Response.json({
      ok: true,
      id: update.data.id,
      estado: update.data.estado,
    })
  } catch (error) {
    console.error('consulta state PATCH error:', error)

    return jsonResponse(
      500,
      error instanceof Error ? error.message : 'Unexpected server error.',
    )
  }
}
