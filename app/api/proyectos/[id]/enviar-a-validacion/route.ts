import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import {
  DELIVERABLE_VALIDATION_READY_STATES,
  PROJECT_EXECUTION_PHASES,
  PROJECT_EXECUTION_STATES,
} from '@/lib/workflow-states'

export const runtime = 'nodejs'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

/**
 * POST — Envia un proyecto a validacion.
 *
 * Reglas:
 *   - Estado inicial admitido: en_ejecucion | revision_interna | listo_para_validacion.
 *   - Si ya esta en_validacion: 409.
 *   - Todos los deliverables deben estar en `completado` o `no_aplica`.
 *   - Si viene desde en_ejecucion/revision_interna, pasa primero por
 *     listo_para_validacion y luego en_validacion (una sola UPDATE, fijando
 *     directamente en_validacion; el stepper deriva fase).
 *
 * Respuestas:
 *   200 { proyecto }  OK
 *   401 unauthorized
 *   404 proyecto no encontrado
 *   409 estado_v2 incompatible
 *   422 deliverables bloqueantes
 *   500 error interno
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
      .from('doa_proyectos')
      .select('id, numero_proyecto, estado_v2, fase_actual')
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!proyecto) return jsonResponse(404, { error: 'Proyecto no encontrado.' })

    const currentState = (proyecto as { estado_v2?: string | null }).estado_v2 ?? null

    if (currentState === PROJECT_EXECUTION_STATES.EN_VALIDACION) {
      return jsonResponse(409, {
        error: 'El proyecto ya esta en validacion.',
        current_state: currentState,
      })
    }

    const admitted: string[] = [
      PROJECT_EXECUTION_STATES.EN_EJECUCION,
      PROJECT_EXECUTION_STATES.REVISION_INTERNA,
      PROJECT_EXECUTION_STATES.LISTO_PARA_VALIDACION,
    ]
    if (!currentState || !admitted.includes(currentState)) {
      return jsonResponse(409, {
        error:
          `No se puede enviar a validacion desde el estado "${currentState ?? 'desconocido'}". ` +
          `Estados admitidos: ${admitted.join(', ')}.`,
        current_state: currentState,
      })
    }

    // Comprobar deliverables: todos deben estar completados o no_aplica.
    const { data: deliverables, error: delErr } = await supabase
      .from('doa_project_deliverables')
      .select('id, titulo, estado')
      .eq('proyecto_id', id)

    if (delErr) return jsonResponse(500, { error: delErr.message })

    const rows = (deliverables ?? []) as Array<{ id: string; titulo: string; estado: string }>
    if (rows.length === 0) {
      return jsonResponse(422, {
        error:
          'El proyecto no tiene deliverables registrados. Planifica primero antes de validar.',
      })
    }

    const blockers = rows.filter(
      (r) => !DELIVERABLE_VALIDATION_READY_STATES.includes(r.estado),
    )
    if (blockers.length > 0) {
      return jsonResponse(422, {
        error: 'Hay deliverables que no estan listos para validacion.',
        blockers: blockers.map((b) => ({ id: b.id, titulo: b.titulo, estado: b.estado })),
      })
    }

    const nowIso = new Date().toISOString()

    const { data: updated, error: updateError } = await supabase
      .from('doa_proyectos')
      .update({
        estado_v2: PROJECT_EXECUTION_STATES.EN_VALIDACION,
        fase_actual: PROJECT_EXECUTION_PHASES.VALIDACION,
        estado_updated_at: nowIso,
        estado_updated_by: user.id,
      })
      .eq('id', id)
      .select('id, numero_proyecto, estado_v2, fase_actual, estado_updated_at')
      .single()

    if (updateError) return jsonResponse(500, { error: updateError.message })

    await logServerEvent({
      eventName: 'project.validation.submitted',
      eventCategory: 'project',
      outcome: 'success',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'proyecto',
      entityId: id,
      metadata: {
        from_state: currentState,
        to_state: PROJECT_EXECUTION_STATES.EN_VALIDACION,
        deliverables_total: rows.length,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, { proyecto: updated })
  } catch (error) {
    console.error('enviar-a-validacion POST error:', error)

    await logServerEvent({
      eventName: 'project.validation.submitted',
      eventCategory: 'project',
      outcome: 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'proyecto',
      entityId: id,
      metadata: {
        error_message: error instanceof Error ? error.message : 'Unknown error',
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Error inesperado.',
    })
  }
}
