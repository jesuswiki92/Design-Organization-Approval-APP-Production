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
 * POST — Transiciona un project de `returned_to_execution` a `in_execution`
 * una vez el equipo ha atendido las observations de una validation devuelta.
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
      .select('id, project_number, execution_status')
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!project) return jsonResponse(404, { error: 'Project no encontrado.' })

    const currentState = (project as { execution_status?: string | null }).execution_status ?? null
    if (currentState !== PROJECT_EXECUTION_STATES.RETURNED_TO_EXECUTION) {
      return jsonResponse(409, {
        error:
          `No se puede retomar execution desde "${currentState ?? 'desconocido'}". ` +
          `Solo admitido desde "${PROJECT_EXECUTION_STATES.RETURNED_TO_EXECUTION}".`,
        current_state: currentState,
      })
    }

    const { data: updated, error: updateError } = await supabase
      .from('doa_projects')
      .update({
        execution_status: PROJECT_EXECUTION_STATES.IN_EXECUTION,
        current_phase: PROJECT_EXECUTION_PHASES.EXECUTION,
        status_updated_at: new Date().toISOString(),
        status_updated_by: user.id,
      })
      .eq('id', id)
      .select('id, project_number, execution_status, current_phase, status_updated_at')
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
      entityType: 'project',
      entityId: id,
      metadata: {
        from_state: PROJECT_EXECUTION_STATES.RETURNED_TO_EXECUTION,
        to_state: PROJECT_EXECUTION_STATES.IN_EXECUTION,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, { project: updated })
  } catch (error) {
    console.error('retomar POST error:', error)
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Error inesperado.',
    })
  }
}
