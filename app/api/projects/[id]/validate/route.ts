import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import { computeSignature } from '@/lib/signatures/hmac'
import {
  PROJECT_EXECUTION_PHASES,
  PROJECT_EXECUTION_STATES,
} from '@/lib/workflow-states'
import type {
  DeliverableSnapshot,
  ValidationDecision,
  ValidationObservation,
  ValidationRole,
} from '@/types/database'

export const runtime = 'nodejs'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

const VALID_ROLES: readonly ValidationRole[] = ['doh', 'dos', 'reviewer']
const VALID_DECISIONS: readonly Extract<ValidationDecision, 'approved' | 'returned'>[] = [
  'approved',
  'returned',
]

function parseObservaciones(raw: unknown): ValidationObservation[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const r = item as Record<string, unknown>
      const text = typeof r.text === 'string' ? r.text.trim() : ''
      if (!text) return null
      const deliverableId =
        typeof r.deliverable_id === 'string' && r.deliverable_id.trim()
          ? r.deliverable_id.trim()
          : null
      const sev = r.severity
      const severity =
        sev === 'info' || sev === 'warn' || sev === 'blocker' ? sev : undefined
      return {
        deliverable_id: deliverableId,
        text,
        severity,
      } as ValidationObservation
    })
    .filter((o): o is ValidationObservation => o !== null)
}

/**
 * POST — Registra la decision de validation (DOH/DOS/reviewer) sobre un
 * project que esta en `in_validation`. Crea una fila en
 * `doa_project_validations`, firma HMAC la decision e inserta una fila en
 * `doa_project_signatures`, y transiciona el project a `validated` (approved)
 * o `returned_to_execution` (returned).
 *
 * Body:
 *   { decision: 'approved'|'returned', role: 'doh'|'dos'|'reviewer',
 *     comments?: string,
 *     observations?: Array<{ deliverable_id?: string; text: string;
 *                             severity?: 'info'|'warn'|'blocker' }> }
 *
 * Respuestas:
 *   200 { validation, signature, project }
 *   400 body invalido
 *   404 project no encontrado
 *   409 execution_status != in_validation
 *   500 secret missing o inconsistencia
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

    let body: Record<string, unknown> = {}
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return jsonResponse(400, { error: 'Body JSON invalido.' })
    }

    const decision = typeof body.decision === 'string' ? body.decision : ''
    const role = typeof body.role === 'string' ? body.role : ''
    const comments =
      typeof body.comments === 'string' && body.comments.trim()
        ? body.comments.trim()
        : null
    const observations = parseObservaciones(body.observations)

    if (!VALID_DECISIONS.includes(decision as (typeof VALID_DECISIONS)[number])) {
      return jsonResponse(400, {
        error: `decision invalida. Admitidas: ${VALID_DECISIONS.join(', ')}.`,
      })
    }
    if (!VALID_ROLES.includes(role as ValidationRole)) {
      return jsonResponse(400, {
        error: `role invalido. Admitidos: ${VALID_ROLES.join(', ')}.`,
      })
    }

    // Validar secret antes de tocar nada
    if (!process.env.DOA_SIGNATURE_HMAC_SECRET) {
      return jsonResponse(500, {
        error:
          'Signature secret not configured. Set DOA_SIGNATURE_HMAC_SECRET in environment.',
      })
    }

    // Cargar project
    const { data: project, error: proyectoError } = await supabase
      .from('doa_projects')
      .select('id, project_number, execution_status, current_phase')
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!project) return jsonResponse(404, { error: 'Project no encontrado.' })

    const currentState = (project as { execution_status?: string | null }).execution_status ?? null
    if (currentState !== PROJECT_EXECUTION_STATES.IN_VALIDATION) {
      return jsonResponse(409, {
        error:
          `El project no esta en validation (status actual: "${currentState ?? 'desconocido'}"). ` +
          `Solo se admite validar desde "${PROJECT_EXECUTION_STATES.IN_VALIDATION}".`,
        current_state: currentState,
      })
    }

    // Snapshot de deliverables
    const { data: delRows, error: delErr } = await supabase
      .from('doa_project_deliverables')
      .select('id, title, status, current_version')
      .eq('project_id', id)
      .order('sort_order', { ascending: true })

    if (delErr) return jsonResponse(500, { error: delErr.message })

    const snapshot: DeliverableSnapshot[] = (delRows ?? []).map((r) => {
      const row = r as {
        id: string
        title: string
        status: DeliverableSnapshot['status']
        current_version: number
      }
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        current_version: row.current_version,
      }
    })

    // 1) Insertar validation
    const { data: validationRow, error: vErr } = await supabase
      .from('doa_project_validations')
      .insert({
        project_id: id,
        validator_user_id: user.id,
        role,
        decision,
        comments,
        observations,
        deliverables_snapshot: snapshot,
      })
      .select('*')
      .single()

    if (vErr || !validationRow) {
      return jsonResponse(500, {
        error: vErr?.message ?? 'No se pudo registrar la validation.',
      })
    }

    const validation = validationRow as {
      id: string
      project_id: string
      validator_user_id: string
      role: ValidationRole
      decision: ValidationDecision
      comments: string | null
      observations: ValidationObservation[]
      deliverables_snapshot: DeliverableSnapshot[] | null
      created_at: string
    }

    // 2) Firmar HMAC
    const signedPayload = {
      project_id: id,
      validation_id: validation.id,
      decision,
      role,
      validator_user_id: user.id,
      comments,
      observations,
      deliverables_snapshot: snapshot,
      timestamp: validation.created_at,
    }

    let signatureComputed
    try {
      signatureComputed = computeSignature(signedPayload)
    } catch (error) {
      await logServerEvent({
        eventName: 'project.validar.signature_inconsistent',
        eventCategory: 'project',
        outcome: 'failure',
        severity: 'error',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'project',
        entityId: id,
        metadata: {
          stage: 'compute_signature',
          validation_id: validation.id,
          error_message: error instanceof Error ? error.message : String(error),
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, {
        error:
          'Validation registrada pero no se pudo firmar. Requiere recuperacion manual.',
        validation_id: validation.id,
      })
    }

    // 3) Insertar firma
    const signerRole = role // doh/dos/reviewer; todos son validos en signer_role via CHECK
    const signatureType =
      decision === 'approved' ? 'validation_approval' : 'validation_return'

    const { data: sigRow, error: sigErr } = await supabase
      .from('doa_project_signatures')
      .insert({
        project_id: id,
        validation_id: validation.id,
        signer_user_id: user.id,
        signer_role: signerRole,
        signature_type: signatureType,
        payload_hash: signatureComputed.payloadHash,
        hmac_signature: signatureComputed.hmacSignature,
        hmac_key_id: signatureComputed.hmacKeyId,
        signed_payload: signedPayload,
      })
      .select('*')
      .single()

    if (sigErr || !sigRow) {
      await logServerEvent({
        eventName: 'project.validar.signature_inconsistent',
        eventCategory: 'project',
        outcome: 'failure',
        severity: 'error',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'project',
        entityId: id,
        metadata: {
          stage: 'insert_signature',
          validation_id: validation.id,
          error_message: sigErr?.message ?? 'insert_signature_failed',
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, {
        error:
          `Validation ${validation.id} registrada pero la firma no se persistio: ${sigErr?.message ?? 'unknown'}. ` +
          `Requiere recuperacion manual (re-firmar o revertir la validation).`,
        validation_id: validation.id,
      })
    }

    // 4) Transicionar project
    const nextState =
      decision === 'approved'
        ? PROJECT_EXECUTION_STATES.VALIDATED
        : PROJECT_EXECUTION_STATES.RETURNED_TO_EXECUTION

    const nowIso = new Date().toISOString()
    const { data: updated, error: updateError } = await supabase
      .from('doa_projects')
      .update({
        execution_status: nextState,
        current_phase: PROJECT_EXECUTION_PHASES.VALIDATION,
        status_updated_at: nowIso,
        status_updated_by: user.id,
      })
      .eq('id', id)
      .select('id, project_number, execution_status, current_phase, status_updated_at')
      .single()

    if (updateError) {
      await logServerEvent({
        eventName: 'project.validar.state_inconsistent',
        eventCategory: 'project',
        outcome: 'failure',
        severity: 'error',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'project',
        entityId: id,
        metadata: {
          validation_id: validation.id,
          signature_id: (sigRow as { id?: string }).id ?? null,
          update_error: updateError.message,
          intended_state: nextState,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, {
        error:
          `Validation y firma persistidas, pero la transicion a "${nextState}" failed: ${updateError.message}. ` +
          `Requiere recuperacion manual.`,
        validation,
        signature: sigRow,
      })
    }

    await logServerEvent({
      eventName: 'project.validation.decided',
      eventCategory: 'project',
      outcome: 'success',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'project',
      entityId: id,
      metadata: {
        decision,
        role,
        validation_id: validation.id,
        signature_id: (sigRow as { id?: string }).id ?? null,
        from_state: PROJECT_EXECUTION_STATES.IN_VALIDATION,
        to_state: nextState,
        deliverables_count: snapshot.length,
        observaciones_count: observations.length,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, {
      validation,
      signature: sigRow,
      project: updated,
    })
  } catch (error) {
    console.error('validar POST error:', error)

    await logServerEvent({
      eventName: 'project.validation.decided',
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
