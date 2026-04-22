/**
 * ============================================================================
 * POST /api/projects/[id]/transition — cambio de status "simple" desde UI
 * ============================================================================
 *
 * Endpoint generico que aplica transiciones de la maquina v2 cuando NO
 * requieren input (form). Pensado para el dropdown de status en las
 * cards del Tablero y en el detalle de project.
 *
 * Body JSON:
 *   { target_state: ProjectExecutionState }
 *
 * Respuestas:
 *   200 + { project } → transicion inline aplicada + webhook n8n disparado.
 *   409 + { requires_input: true, redirect_url, reason } → la transicion
 *       requiere form (p.ej. planificar / validar / prepare-delivery /
 *       send-delivery / confirmar-delivery / close). El client redirige al
 *       detalle del project con la tab apropiada.
 *   400 target_state invalido o no permitido por el DAG.
 *   500 errores de infraestructura.
 *
 * Webhook n8n:
 *   Fire-and-forget a `N8N_PROJECT_STATE_WEBHOOK_URL` con HMAC
 *   (`DOA_N8N_WEBHOOK_SECRET`). Si el webhook falla, se loguea con
 *   severity=warn pero la transicion ya aplicada NO se revierte.
 *
 * Patron observable:
 *   Emite `project.state.transicion` con `from_state`, `to_state` y `mode`
 *   (`inline` | `requires_input`).
 * ============================================================================
 */

import { NextRequest } from 'next/server'
import { createHmac } from 'node:crypto'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import { resolveN8nSharedSecret } from '@/lib/security/n8n-outbound'
import {
  PROJECT_EXECUTION_STATES,
  PROJECT_EXECUTION_STATE_TO_PHASE,
  PROJECT_EXECUTION_TRANSITIONS,
  isProjectExecutionStateCode,
  type ProjectExecutionState,
} from '@/lib/workflow-states'

export const runtime = 'nodejs'
const N8N_TIMEOUT_MS = 8_000

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

/**
 * Table de routing: dado un par (from, to), indica si la transicion es
 * inline (un simple UPDATE + webhook) o requiere input via form en
 * el detalle. Para los 'requires_input' devolvemos la tab de destino.
 */
type RouteDecision =
  | { mode: 'inline' }
  | { mode: 'requires_input'; tab: 'deliverables' | 'validation' | 'delivery' | 'closure'; reason: string }

function decideRoute(
  from: ProjectExecutionState,
  to: ProjectExecutionState,
): RouteDecision {
  // Transiciones inline (no requieren form):
  //   - internal_review → in_execution (rework, equivalente a un update directo)
  //   - returned_to_execution → in_execution (retomar, ya implementado inline en /resume)
  //   - closed → project_archived (archive)
  //
  // El resto de transiciones del DAG disparan forms que viven en tabs
  // del detalle. Devolvemos requires_input con redirect.
  const inlinePairs: Array<[ProjectExecutionState, ProjectExecutionState]> = [
    [PROJECT_EXECUTION_STATES.INTERNAL_REVIEW, PROJECT_EXECUTION_STATES.IN_EXECUTION],
    [PROJECT_EXECUTION_STATES.RETURNED_TO_EXECUTION, PROJECT_EXECUTION_STATES.IN_EXECUTION],
    [PROJECT_EXECUTION_STATES.CLOSED, PROJECT_EXECUTION_STATES.PROJECT_ARCHIVED],
  ]
  const isInline = inlinePairs.some(([f, t]) => f === from && t === to)
  if (isInline) return { mode: 'inline' }

  // Routing a tabs del detalle.
  if (from === PROJECT_EXECUTION_STATES.PROJECT_OPENED && to === PROJECT_EXECUTION_STATES.PLANNING) {
    return { mode: 'requires_input', tab: 'deliverables', reason: 'planificar_requires_form' }
  }
  if (from === PROJECT_EXECUTION_STATES.PLANNING && to === PROJECT_EXECUTION_STATES.IN_EXECUTION) {
    return { mode: 'requires_input', tab: 'deliverables', reason: 'start_execution_requires_form' }
  }
  if (from === PROJECT_EXECUTION_STATES.IN_EXECUTION && to === PROJECT_EXECUTION_STATES.INTERNAL_REVIEW) {
    return { mode: 'requires_input', tab: 'deliverables', reason: 'review_requires_form' }
  }
  if (from === PROJECT_EXECUTION_STATES.INTERNAL_REVIEW && to === PROJECT_EXECUTION_STATES.READY_FOR_VALIDATION) {
    return { mode: 'requires_input', tab: 'deliverables', reason: 'ready_for_validation_requires_form' }
  }
  if (from === PROJECT_EXECUTION_STATES.READY_FOR_VALIDATION && to === PROJECT_EXECUTION_STATES.IN_VALIDATION) {
    return { mode: 'requires_input', tab: 'validation', reason: 'send_to_validation_requires_form' }
  }
  if (from === PROJECT_EXECUTION_STATES.IN_VALIDATION) {
    // validar → validated | returned_to_execution — ambos via form DOH/DOS
    return { mode: 'requires_input', tab: 'validation', reason: 'validation_decision_requires_form' }
  }
  if (from === PROJECT_EXECUTION_STATES.VALIDATED && to === PROJECT_EXECUTION_STATES.PREPARING_DELIVERY) {
    return { mode: 'requires_input', tab: 'delivery', reason: 'prepare_delivery_requires_form' }
  }
  if (from === PROJECT_EXECUTION_STATES.PREPARING_DELIVERY && to === PROJECT_EXECUTION_STATES.DELIVERED) {
    return { mode: 'requires_input', tab: 'delivery', reason: 'send_delivery_requires_form' }
  }
  if (from === PROJECT_EXECUTION_STATES.DELIVERED && to === PROJECT_EXECUTION_STATES.CLIENT_CONFIRMATION) {
    return { mode: 'requires_input', tab: 'delivery', reason: 'client_confirmation_requires_form' }
  }
  if (from === PROJECT_EXECUTION_STATES.CLIENT_CONFIRMATION && to === PROJECT_EXECUTION_STATES.CLOSED) {
    return { mode: 'requires_input', tab: 'closure', reason: 'closure_requires_form' }
  }

  // Fallback conservador.
  return { mode: 'requires_input', tab: 'deliverables', reason: 'unknown_transition_fallback' }
}

/**
 * Dispara el webhook de n8n fire-and-forget. NO bloquea la response al
 * client ni revierte la transicion si falla. Loguea warn en caso de error.
 */
async function fireProjectStateWebhook(params: {
  proyectoId: string
  fromState: string | null
  toState: string
  userId: string
  requestContext: ReturnType<typeof buildRequestContext>
  method: string
}) {
  const { proyectoId, fromState, toState, userId, requestContext, method } = params
  const webhookUrl = process.env.N8N_PROJECT_STATE_WEBHOOK_URL
  if (!webhookUrl) {
    if (process.env.NODE_ENV === 'production') {
      await logServerEvent({
        eventName: 'project.state.transicion.webhook_skipped',
        eventCategory: 'project',
        outcome: 'failure',
        severity: 'warn',
        actorUserId: userId,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method,
        entityType: 'project',
        entityId: proyectoId,
        metadata: {
          reason: 'N8N_PROJECT_STATE_WEBHOOK_URL_not_set_in_production',
          from_state: fromState,
          to_state: toState,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
    } else {
      console.warn(
        'transicion: N8N_PROJECT_STATE_WEBHOOK_URL no definida (modo dev), omito webhook.',
      )
    }
    return
  }

  const body = {
    project_id: proyectoId,
    from_state: fromState,
    to_state: toState,
    user_id: userId,
    timestamp: new Date().toISOString(),
  }
  const bodyStr = JSON.stringify(body)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  // Canonical name is DOA_N8N_INBOUND_SECRET; DOA_N8N_WEBHOOK_SECRET kept
  // as a legacy fallback. See lib/security/n8n-outbound.ts.
  const secret = resolveN8nSharedSecret()
  if (secret) {
    headers['x-doa-signature'] = createHmac('sha256', secret).update(bodyStr).digest('hex')
  } else if (process.env.NODE_ENV === 'production') {
    await logServerEvent({
      eventName: 'project.state.transicion.webhook_skipped',
      eventCategory: 'project',
      outcome: 'failure',
      severity: 'warn',
      actorUserId: userId,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method,
      entityType: 'project',
      entityId: proyectoId,
      metadata: {
        reason: 'n8n_shared_secret_missing_in_production',
        from_state: fromState,
        to_state: toState,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })
    return
  } else {
    console.warn(
      'transicion: DOA_N8N_INBOUND_SECRET/DOA_N8N_WEBHOOK_SECRET no definido (modo dev), llamada sin firma.',
    )
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: bodyStr,
      signal: controller.signal,
    })
    if (!res.ok) {
      await logServerEvent({
        eventName: 'project.state.transicion.webhook_failed',
        eventCategory: 'project',
        outcome: 'failure',
        severity: 'warn',
        actorUserId: userId,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method,
        entityType: 'project',
        entityId: proyectoId,
        metadata: {
          upstream_status: res.status,
          from_state: fromState,
          to_state: toState,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
    }
  } catch (err) {
    await logServerEvent({
      eventName: 'project.state.transicion.webhook_failed',
      eventCategory: 'project',
      outcome: 'failure',
      severity: 'warn',
      actorUserId: userId,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method,
      entityType: 'project',
      entityId: proyectoId,
      metadata: {
        error_message: err instanceof Error ? err.message : 'unknown_webhook_error',
        from_state: fromState,
        to_state: toState,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })
  } finally {
    clearTimeout(timer)
  }
}

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

    let body: Record<string, unknown> = {}
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return jsonResponse(400, { error: 'Body JSON invalido.' })
    }

    const targetStateRaw =
      typeof body.target_state === 'string' ? body.target_state.trim() : ''
    if (!targetStateRaw) {
      return jsonResponse(400, { error: 'target_state requerido.' })
    }
    if (!isProjectExecutionStateCode(targetStateRaw)) {
      return jsonResponse(400, {
        error: `target_state "${targetStateRaw}" no es un status valido de la maquina v2.`,
      })
    }
    const targetState = targetStateRaw as ProjectExecutionState

    const { data: project, error: proyectoError } = await supabase
      .from('doa_projects')
      .select('id, project_number, execution_status')
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!project) return jsonResponse(404, { error: 'Project no encontrado.' })

    const p = project as { id: string; project_number: string | null; execution_status: string | null }
    const currentStateRaw = p.execution_status
    if (!currentStateRaw || !isProjectExecutionStateCode(currentStateRaw)) {
      return jsonResponse(409, {
        error: `El project no tiene execution_status valido (actual: "${currentStateRaw ?? 'null'}").`,
        current_state: currentStateRaw,
      })
    }
    const currentState = currentStateRaw as ProjectExecutionState

    if (currentState === targetState) {
      return jsonResponse(409, {
        error: 'El project ya esta en ese status.',
        current_state: currentState,
      })
    }

    const allowed = PROJECT_EXECUTION_TRANSITIONS[currentState] ?? []
    if (!allowed.includes(targetState)) {
      return jsonResponse(400, {
        error:
          `Transicion no permitida por el DAG: "${currentState}" → "${targetState}". ` +
          `Permitidas: [${allowed.join(', ') || '(ninguna)'}].`,
        current_state: currentState,
        allowed_targets: allowed,
      })
    }

    const decision = decideRoute(currentState, targetState)

    if (decision.mode === 'requires_input') {
      const redirectUrl = `/engineering/projects/${id}?tab=${decision.tab}`
      await logServerEvent({
        eventName: 'project.state.transicion',
        eventCategory: 'project',
        outcome: 'success',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'project',
        entityId: id,
        entityCode: p.project_number,
        metadata: {
          mode: 'requires_input',
          from_state: currentState,
          to_state: targetState,
          reason: decision.reason,
          redirect_url: redirectUrl,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(409, {
        requires_input: true,
        redirect_url: redirectUrl,
        reason: decision.reason,
        from_state: currentState,
        to_state: targetState,
      })
    }

    // Inline path: UPDATE + webhook fire-and-forget.
    const nowIso = new Date().toISOString()
    const { data: updated, error: updateError } = await supabase
      .from('doa_projects')
      .update({
        execution_status: targetState,
        current_phase: PROJECT_EXECUTION_STATE_TO_PHASE[targetState],
        status_updated_at: nowIso,
        status_updated_by: user.id,
      })
      .eq('id', id)
      .select('id, project_number, execution_status, current_phase, status_updated_at')
      .single()

    if (updateError) return jsonResponse(500, { error: updateError.message })

    // Fire-and-forget webhook (no await => no bloquea response).
    void fireProjectStateWebhook({
      proyectoId: id,
      fromState: currentState,
      toState: targetState,
      userId: user.id,
      requestContext,
      method: request.method,
    })

    await logServerEvent({
      eventName: 'project.state.transicion',
      eventCategory: 'project',
      outcome: 'success',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'project',
      entityId: id,
      entityCode: p.project_number,
      metadata: {
        mode: 'inline',
        from_state: currentState,
        to_state: targetState,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, { project: updated })
  } catch (error) {
    console.error('transicion POST error:', error)
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Error inesperado.',
    })
  }
}
