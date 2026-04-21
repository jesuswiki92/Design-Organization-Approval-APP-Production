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
 * POST — Envia un project a validation.
 *
 * Reglas:
 *   - Status inicial admitido: in_execution | internal_review | ready_for_validation.
 *   - Si ya esta in_validation: 409.
 *   - Todos los deliverables deben estar en `completed` o `not_applicable`.
 *   - Si viene desde in_execution/internal_review, pasa primero por
 *     ready_for_validation y luego in_validation (una sola UPDATE, fijando
 *     directamente in_validation; el stepper deriva fase).
 *
 * Respuestas:
 *   200 { project }  OK
 *   401 unauthorized
 *   404 project no encontrado
 *   409 execution_status incompatible
 *   422 deliverables bloqueantes
 *   500 error internal
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
    if (!id) return jsonResponse(400, { error: 'project_id requerido.' })

    const { data: project, error: proyectoError } = await supabase
      .from('doa_projects')
      .select('id, project_number, execution_status, current_phase')
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!project) return jsonResponse(404, { error: 'Project no encontrado.' })

    const currentState = (project as { execution_status?: string | null }).execution_status ?? null

    if (currentState === PROJECT_EXECUTION_STATES.IN_VALIDATION) {
      return jsonResponse(409, {
        error: 'El project ya esta en validation.',
        current_state: currentState,
      })
    }

    const admitted: string[] = [
      PROJECT_EXECUTION_STATES.IN_EXECUTION,
      PROJECT_EXECUTION_STATES.INTERNAL_REVIEW,
      PROJECT_EXECUTION_STATES.READY_FOR_VALIDATION,
    ]
    if (!currentState || !admitted.includes(currentState)) {
      return jsonResponse(409, {
        error:
          `No se puede send a validation desde el status "${currentState ?? 'desconocido'}". ` +
          `Statuses admitidos: ${admitted.join(', ')}.`,
        current_state: currentState,
      })
    }

    // Comprobar deliverables: todos deben estar completados o not_applicable.
    const { data: deliverables, error: delErr } = await supabase
      .from('doa_project_deliverables')
      .select('id, title, status')
      .eq('project_id', id)

    if (delErr) return jsonResponse(500, { error: delErr.message })

    const rows = (deliverables ?? []) as Array<{ id: string; title: string; status: string }>
    if (rows.length === 0) {
      return jsonResponse(422, {
        error:
          'El project no tiene deliverables registrados. Planifica primero antes de validar.',
      })
    }

    const blockers = rows.filter(
      (r) => !DELIVERABLE_VALIDATION_READY_STATES.includes(r.status),
    )
    if (blockers.length > 0) {
      return jsonResponse(422, {
        error: 'Hay deliverables que no estan listos para validation.',
        blockers: blockers.map((b) => ({ id: b.id, title: b.title, status: b.status })),
      })
    }

    const nowIso = new Date().toISOString()

    const { data: updated, error: updateError } = await supabase
      .from('doa_projects')
      .update({
        execution_status: PROJECT_EXECUTION_STATES.IN_VALIDATION,
        current_phase: PROJECT_EXECUTION_PHASES.VALIDATION,
        status_updated_at: nowIso,
        status_updated_by: user.id,
      })
      .eq('id', id)
      .select('id, project_number, execution_status, current_phase, status_updated_at')
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
      entityType: 'project',
      entityId: id,
      metadata: {
        from_state: currentState,
        to_state: PROJECT_EXECUTION_STATES.IN_VALIDATION,
        deliverables_total: rows.length,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, { project: updated })
  } catch (error) {
    console.error('send-a-validation POST error:', error)

    await logServerEvent({
      eventName: 'project.validation.submitted',
      eventCategory: 'project',
      outcome: 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'project',
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
