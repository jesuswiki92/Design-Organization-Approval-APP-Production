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
const VALID_DECISIONS: readonly Extract<ValidationDecision, 'aprobado' | 'devuelto'>[] = [
  'aprobado',
  'devuelto',
]

function parseObservaciones(raw: unknown): ValidationObservation[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const r = item as Record<string, unknown>
      const texto = typeof r.texto === 'string' ? r.texto.trim() : ''
      if (!texto) return null
      const deliverableId =
        typeof r.deliverable_id === 'string' && r.deliverable_id.trim()
          ? r.deliverable_id.trim()
          : null
      const sev = r.severidad
      const severidad =
        sev === 'info' || sev === 'warn' || sev === 'blocker' ? sev : undefined
      return {
        deliverable_id: deliverableId,
        texto,
        severidad,
      } as ValidationObservation
    })
    .filter((o): o is ValidationObservation => o !== null)
}

/**
 * POST — Registra la decision de validacion (DOH/DOS/reviewer) sobre un
 * proyecto que esta en `en_validacion`. Crea una fila en
 * `doa_project_validations`, firma HMAC la decision e inserta una fila en
 * `doa_project_signatures`, y transiciona el proyecto a `validado` (aprobado)
 * o `devuelto_a_ejecucion` (devuelto).
 *
 * Body:
 *   { decision: 'aprobado'|'devuelto', role: 'doh'|'dos'|'reviewer',
 *     comentarios?: string,
 *     observaciones?: Array<{ deliverable_id?: string; texto: string;
 *                             severidad?: 'info'|'warn'|'blocker' }> }
 *
 * Respuestas:
 *   200 { validation, signature, proyecto }
 *   400 body invalido
 *   404 proyecto no encontrado
 *   409 estado_v2 != en_validacion
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
    if (!id) return jsonResponse(400, { error: 'proyecto_id requerido.' })

    let body: Record<string, unknown> = {}
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return jsonResponse(400, { error: 'Body JSON invalido.' })
    }

    const decision = typeof body.decision === 'string' ? body.decision : ''
    const role = typeof body.role === 'string' ? body.role : ''
    const comentarios =
      typeof body.comentarios === 'string' && body.comentarios.trim()
        ? body.comentarios.trim()
        : null
    const observaciones = parseObservaciones(body.observaciones)

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

    // Cargar proyecto
    const { data: proyecto, error: proyectoError } = await supabase
      .from('doa_proyectos')
      .select('id, numero_proyecto, estado_v2, fase_actual')
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!proyecto) return jsonResponse(404, { error: 'Proyecto no encontrado.' })

    const currentState = (proyecto as { estado_v2?: string | null }).estado_v2 ?? null
    if (currentState !== PROJECT_EXECUTION_STATES.EN_VALIDACION) {
      return jsonResponse(409, {
        error:
          `El proyecto no esta en validacion (estado actual: "${currentState ?? 'desconocido'}"). ` +
          `Solo se admite validar desde "${PROJECT_EXECUTION_STATES.EN_VALIDACION}".`,
        current_state: currentState,
      })
    }

    // Snapshot de deliverables
    const { data: delRows, error: delErr } = await supabase
      .from('doa_project_deliverables')
      .select('id, titulo, estado, version_actual')
      .eq('proyecto_id', id)
      .order('orden', { ascending: true })

    if (delErr) return jsonResponse(500, { error: delErr.message })

    const snapshot: DeliverableSnapshot[] = (delRows ?? []).map((r) => {
      const row = r as {
        id: string
        titulo: string
        estado: DeliverableSnapshot['estado']
        version_actual: number
      }
      return {
        id: row.id,
        titulo: row.titulo,
        estado: row.estado,
        version_actual: row.version_actual,
      }
    })

    // 1) Insertar validacion
    const { data: validationRow, error: vErr } = await supabase
      .from('doa_project_validations')
      .insert({
        proyecto_id: id,
        validator_user_id: user.id,
        role,
        decision,
        comentarios,
        observaciones,
        deliverables_snapshot: snapshot,
      })
      .select('*')
      .single()

    if (vErr || !validationRow) {
      return jsonResponse(500, {
        error: vErr?.message ?? 'No se pudo registrar la validacion.',
      })
    }

    const validation = validationRow as {
      id: string
      proyecto_id: string
      validator_user_id: string
      role: ValidationRole
      decision: ValidationDecision
      comentarios: string | null
      observaciones: ValidationObservation[]
      deliverables_snapshot: DeliverableSnapshot[] | null
      created_at: string
    }

    // 2) Firmar HMAC
    const signedPayload = {
      proyecto_id: id,
      validation_id: validation.id,
      decision,
      role,
      validator_user_id: user.id,
      comentarios,
      observaciones,
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
        entityType: 'proyecto',
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
          'Validacion registrada pero no se pudo firmar. Requiere recuperacion manual.',
        validation_id: validation.id,
      })
    }

    // 3) Insertar firma
    const signerRole = role // doh/dos/reviewer; todos son validos en signer_role via CHECK
    const signatureType =
      decision === 'aprobado' ? 'validation_approval' : 'validation_return'

    const { data: sigRow, error: sigErr } = await supabase
      .from('doa_project_signatures')
      .insert({
        proyecto_id: id,
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
        entityType: 'proyecto',
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
          `Validacion ${validation.id} registrada pero la firma no se persistio: ${sigErr?.message ?? 'unknown'}. ` +
          `Requiere recuperacion manual (re-firmar o revertir la validacion).`,
        validation_id: validation.id,
      })
    }

    // 4) Transicionar proyecto
    const nextState =
      decision === 'aprobado'
        ? PROJECT_EXECUTION_STATES.VALIDADO
        : PROJECT_EXECUTION_STATES.DEVUELTO_A_EJECUCION

    const nowIso = new Date().toISOString()
    const { data: updated, error: updateError } = await supabase
      .from('doa_proyectos')
      .update({
        estado_v2: nextState,
        fase_actual: PROJECT_EXECUTION_PHASES.VALIDACION,
        estado_updated_at: nowIso,
        estado_updated_by: user.id,
      })
      .eq('id', id)
      .select('id, numero_proyecto, estado_v2, fase_actual, estado_updated_at')
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
        entityType: 'proyecto',
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
          `Validacion y firma persistidas, pero la transicion a "${nextState}" fallo: ${updateError.message}. ` +
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
      entityType: 'proyecto',
      entityId: id,
      metadata: {
        decision,
        role,
        validation_id: validation.id,
        signature_id: (sigRow as { id?: string }).id ?? null,
        from_state: PROJECT_EXECUTION_STATES.EN_VALIDACION,
        to_state: nextState,
        deliverables_count: snapshot.length,
        observaciones_count: observaciones.length,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, {
      validation,
      signature: sigRow,
      proyecto: updated,
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
