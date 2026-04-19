import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import {
  PROJECT_EXECUTION_PHASES,
  PROJECT_EXECUTION_STATES,
} from '@/lib/workflow-states'

export const runtime = 'nodejs'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

/**
 * POST — Transiciona un proyecto de `devuelto_a_ejecucion` a `en_ejecucion`
 * una vez el equipo ha atendido las observaciones de una validacion devuelta.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { user, supabase } = auth
  const requestContext = buildRequestContext(request)
  const { id } = await context.params

  try {
    if (!id) return jsonResponse(400, { error: 'proyecto_id requerido.' })

    const { data: proyecto, error: proyectoError } = await supabase
      .from('proyectos')
      .select('id, numero_proyecto, estado_v2')
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!proyecto) return jsonResponse(404, { error: 'Proyecto no encontrado.' })

    const currentState = (proyecto as { estado_v2?: string | null }).estado_v2 ?? null
    if (currentState !== PROJECT_EXECUTION_STATES.DEVUELTO_A_EJECUCION) {
      return jsonResponse(409, {
        error:
          `No se puede retomar ejecucion desde "${currentState ?? 'desconocido'}". ` +
          `Solo admitido desde "${PROJECT_EXECUTION_STATES.DEVUELTO_A_EJECUCION}".`,
        current_state: currentState,
      })
    }

    const { data: updated, error: updateError } = await supabase
      .from('proyectos')
      .update({
        estado_v2: PROJECT_EXECUTION_STATES.EN_EJECUCION,
        fase_actual: PROJECT_EXECUTION_PHASES.EJECUCION,
        estado_updated_at: new Date().toISOString(),
        estado_updated_by: user.id,
      })
      .eq('id', id)
      .select('id, numero_proyecto, estado_v2, fase_actual, estado_updated_at')
      .single()

    if (updateError) return jsonResponse(500, { error: updateError.message })

    await logServerEvent({
      eventName: 'project.validation.resumed',
      eventCategory: 'project',
      outcome: 'success',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'proyecto',
      entityId: id,
      metadata: {
        from_state: PROJECT_EXECUTION_STATES.DEVUELTO_A_EJECUCION,
        to_state: PROJECT_EXECUTION_STATES.EN_EJECUCION,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, { proyecto: updated })
  } catch (error) {
    console.error('retomar POST error:', error)
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Error inesperado.',
    })
  }
}
