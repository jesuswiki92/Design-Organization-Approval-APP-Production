/**
 * ============================================================================
 * POST /api/projects/[id]/close  — Sprint 4 (close-the-loop)
 * ============================================================================
 *
 * Cierra un project que esta en `client_confirmation`. Computa un snapshot
 * de metricas, firma HMAC la decision de closure, registra la closure row,
 * inserta lecciones (si se pasan) y transiciona a `closed`.
 *
 * Body JSON:
 *   {
 *     outcome: 'successful'|'successful_with_reservations'|'problematic'|'aborted',
 *     closure_notes?: string,
 *     lecciones?: Array<LessonInput>
 *   }
 *
 * Respuestas:
 *   200 { closure, signature, lessons, project }
 *   400 body invalido
 *   404 project no encontrado
 *   409 execution_status != client_confirmation
 *   500 secret missing o inconsistencia
 */

import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import { computeSignature } from '@/lib/signatures/hmac'
import {
  CLOSURE_OUTCOMES,
  PROJECT_EXECUTION_PHASES,
  PROJECT_EXECUTION_STATES,
} from '@/lib/workflow-states'
import type {
  ClosureMetricsSnapshot,
  ClosureOutcome,
  LessonCategory,
  LessonInput,
  LessonType,
} from '@/types/database'

export const runtime = 'nodejs'

const VALID_OUTCOMES: readonly ClosureOutcome[] = [
  CLOSURE_OUTCOMES.SUCCESSFUL,
  CLOSURE_OUTCOMES.SUCCESSFUL_WITH_RESERVATIONS,
  CLOSURE_OUTCOMES.PROBLEMATIC,
  CLOSURE_OUTCOMES.ABORTED,
]

const VALID_LESSON_CATEGORIAS: readonly LessonCategory[] = [
  'technical',
  'process',
  'client',
  'quality',
  'planning',
  'tools',
  'regulatory',
  'other',
]

const VALID_LESSON_TIPOS: readonly LessonType[] = [
  'positive',
  'negative',
  'improvement',
  'risk',
]

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

function parseLessons(raw: unknown): LessonInput[] {
  if (!Array.isArray(raw)) return []
  const out: LessonInput[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const category = typeof r.category === 'string' ? r.category : ''
    const type = typeof r.type === 'string' ? r.type : ''
    const title = typeof r.title === 'string' ? r.title.trim() : ''
    const description = typeof r.description === 'string' ? r.description.trim() : ''
    if (!VALID_LESSON_CATEGORIAS.includes(category as LessonCategory)) continue
    if (!VALID_LESSON_TIPOS.includes(type as LessonType)) continue
    if (!title || !description) continue
    const impact =
      typeof r.impact === 'string' && r.impact.trim() ? r.impact.trim() : null
    const recommendation =
      typeof r.recommendation === 'string' && r.recommendation.trim()
        ? r.recommendation.trim()
        : null
    const tags = Array.isArray(r.tags)
      ? (r.tags as unknown[])
          .map((t) => (typeof t === 'string' ? t.trim() : ''))
          .filter((t) => t.length > 0)
      : null
    out.push({
      category: category as LessonCategory,
      type: type as LessonType,
      title,
      description,
      impact,
      recommendation,
      tags: tags && tags.length > 0 ? tags : null,
    })
  }
  return out
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

    const outcome = typeof body.outcome === 'string' ? body.outcome : ''
    const notasCierre =
      typeof body.closure_notes === 'string' && body.closure_notes.trim()
        ? body.closure_notes.trim()
        : null
    const lecciones = parseLessons(body.lecciones)

    if (!VALID_OUTCOMES.includes(outcome as ClosureOutcome)) {
      return jsonResponse(400, {
        error: `outcome invalido. Admitidos: ${VALID_OUTCOMES.join(', ')}.`,
      })
    }

    if (!process.env.DOA_SIGNATURE_HMAC_SECRET) {
      return jsonResponse(500, {
        error:
          'Signature secret not configured. Set DOA_SIGNATURE_HMAC_SECRET in environment.',
      })
    }

    // Cargar project
    const { data: project, error: proyectoError } = await supabase
      .from('doa_projects')
      .select('id, project_number, execution_status, current_phase, created_at, title')
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!project) return jsonResponse(404, { error: 'Project no encontrado.' })

    const p = project as {
      id: string
      project_number: string | null
      execution_status: string | null
      current_phase: string | null
      created_at: string
      title: string
    }

    if (p.execution_status !== PROJECT_EXECUTION_STATES.CLIENT_CONFIRMATION) {
      return jsonResponse(409, {
        error:
          `El project no esta en "client_confirmation" (status actual: "${p.execution_status ?? 'desconocido'}"). ` +
          `Solo se admite close desde "${PROJECT_EXECUTION_STATES.CLIENT_CONFIRMATION}".`,
        current_state: p.execution_status,
      })
    }

    // Computar snapshot de metricas
    const [delRes, valRes, entRes] = await Promise.all([
      supabase
        .from('doa_project_deliverables')
        .select('status')
        .eq('project_id', id),
      supabase
        .from('doa_project_validations')
        .select('decision')
        .eq('project_id', id),
      supabase
        .from('doa_project_deliveries')
        .select('dispatch_status, dispatched_at, client_confirmed_at, created_at')
        .eq('project_id', id),
    ])

    if (delRes.error) return jsonResponse(500, { error: delRes.error.message })
    if (valRes.error) return jsonResponse(500, { error: valRes.error.message })
    if (entRes.error) return jsonResponse(500, { error: entRes.error.message })

    const delivs = (delRes.data ?? []) as { status: string }[]
    const vals = (valRes.data ?? []) as { decision: string }[]
    const ents = (entRes.data ?? []) as {
      dispatch_status: string
      dispatched_at: string | null
      client_confirmed_at: string | null
      created_at: string
    }[]

    // Client confirmation days: from most-recent dispatched -> client_confirmed
    let clientConfirmationDays: number | null = null
    const confirmedWithBoth = ents.find(
      (e) => e.dispatched_at && e.client_confirmed_at,
    )
    if (confirmedWithBoth) {
      const a = new Date(confirmedWithBoth.dispatched_at!).getTime()
      const b = new Date(confirmedWithBoth.client_confirmed_at!).getTime()
      if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
        clientConfirmationDays = Math.round(((b - a) / 86_400_000) * 100) / 100
      }
    }

    const diasTotal = Math.round(
      ((new Date().getTime() - new Date(p.created_at).getTime()) / 86_400_000) *
        100,
    ) / 100

    const metrics: ClosureMetricsSnapshot = {
      planned_hours: null,
      actual_hours: null,
      deliverables_total: delivs.length,
      deliverables_completado: delivs.filter((d) => d.status === 'completed').length,
      deliverables_not_applicable: delivs.filter((d) => d.status === 'not_applicable').length,
      deliverables_bloqueado: delivs.filter((d) => d.status === 'blocked').length,
      validations_count: vals.length,
      validations_approved: vals.filter((v) => v.decision === 'approved').length,
      returns_count: vals.filter((v) => v.decision === 'returned').length,
      deliveries_count: ents.length,
      deliveries_sent: ents.filter((e) =>
        ['sent', 'client_confirmed'].includes(e.dispatch_status),
      ).length,
      deliveries_confirmed: ents.filter(
        (e) => e.dispatch_status === 'client_confirmed',
      ).length,
      total_days: diasTotal,
      client_confirmation_days: clientConfirmationDays,
    }

    const nowIso = new Date().toISOString()

    // Payload firmado
    const signedPayload = {
      project_id: id,
      closure_outcome: outcome,
      metrics,
      closer_user_id: user.id,
      timestamp: nowIso,
    }

    let signatureComputed
    try {
      signatureComputed = computeSignature(signedPayload)
    } catch (error) {
      return jsonResponse(500, {
        error:
          'No se pudo computar la firma HMAC de closure: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      })
    }

    let admin: ReturnType<typeof createAdminClient>
    try {
      admin = createAdminClient()
    } catch (e) {
      return jsonResponse(500, {
        error:
          'Admin client no disponible. Configura SUPABASE_SERVICE_ROLE_KEY. ' +
          (e instanceof Error ? e.message : ''),
      })
    }

    // 1) Insert signature
    const { data: sigRow, error: sigErr } = await admin
      .from('doa_project_signatures' as never)
      .insert({
        project_id: id,
        validation_id: null,
        signer_user_id: user.id,
        signer_role: 'doh', // TODO(sprint-4+): enforce real signer_role via role table.
        signature_type: 'closure',
        payload_hash: signatureComputed.payloadHash,
        hmac_signature: signatureComputed.hmacSignature,
        hmac_key_id: signatureComputed.hmacKeyId,
        signed_payload: signedPayload,
      } as never)
      .select('*')
      .single()

    if (sigErr || !sigRow) {
      await logServerEvent({
        eventName: 'project.closure.recorded',
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
          error_message: sigErr?.message ?? 'insert_signature_failed',
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, {
        error: `No se pudo persistir la firma de closure: ${sigErr?.message ?? 'unknown'}.`,
      })
    }

    const signatureId = (sigRow as { id: string }).id

    // 2) Insert closure row
    const { data: closureRow, error: closureErr } = await admin
      .from('doa_project_closures' as never)
      .insert({
        project_id: id,
        closer_user_id: user.id,
        signature_id: signatureId,
        metrics,
        outcome,
        closure_notes: notasCierre,
      } as never)
      .select('*')
      .single()

    if (closureErr || !closureRow) {
      await logServerEvent({
        eventName: 'project.closure.recorded',
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
          stage: 'insert_closure',
          signature_id: signatureId,
          error_message: closureErr?.message ?? 'insert_closure_failed',
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, {
        error:
          `Firma de closure persistida (${signatureId}) pero no se pudo crear la closure row: ${closureErr?.message ?? 'unknown'}. ` +
          `Requiere recuperacion manual.`,
      })
    }

    const closureId = (closureRow as { id: string }).id

    // 3) Insert lessons (batch)
    let insertedLessons: unknown[] = []
    if (lecciones.length > 0) {
      const rows = lecciones.map((l) => ({
        project_id: id,
        closure_id: closureId,
        author_user_id: user.id,
        category: l.category,
        type: l.type,
        title: l.title,
        description: l.description,
        impact: l.impact ?? null,
        recommendation: l.recommendation ?? null,
        tags: l.tags ?? null,
      }))
      const { data: lessonRows, error: lessonErr } = await admin
        .from('doa_project_lessons' as never)
        .insert(rows as never)
        .select('*')
      if (lessonErr) {
        // Non-fatal: log and continue.
        await logServerEvent({
          eventName: 'project.closure.lessons_insert_failed',
          eventCategory: 'project',
          outcome: 'failure',
          severity: 'warn',
          actorUserId: user.id,
          requestId: requestContext.requestId,
          route: requestContext.route,
          method: request.method,
          entityType: 'project',
          entityId: id,
          metadata: {
            closure_id: closureId,
            error_message: lessonErr.message,
          },
          userAgent: requestContext.userAgent,
          ipAddress: requestContext.ipAddress,
          referrer: requestContext.referrer,
        })
      } else {
        insertedLessons = lessonRows ?? []
      }
    }

    // 4) Transicionar project -> closed
    const { data: updatedProyecto, error: updateError } = await admin
      .from('doa_projects' as never)
      .update({
        execution_status: PROJECT_EXECUTION_STATES.CLOSED,
        current_phase: PROJECT_EXECUTION_PHASES.CLOSURE,
        status_updated_at: nowIso,
        status_updated_by: user.id,
      } as never)
      .eq('id', id)
      .select('id, project_number, execution_status, current_phase, status_updated_at')
      .single()

    if (updateError) {
      await logServerEvent({
        eventName: 'project.closure.recorded',
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
          stage: 'transition_state',
          closure_id: closureId,
          signature_id: signatureId,
          intended_state: PROJECT_EXECUTION_STATES.CLOSED,
          error_message: updateError.message,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, {
        error:
          `Closure y firma persistidas (${closureId}), pero la transicion a "closed" failed: ${updateError.message}. Requiere recuperacion manual.`,
        closure: closureRow,
        signature: sigRow,
      })
    }

    await logServerEvent({
      eventName: 'project.closure.recorded',
      eventCategory: 'project',
      outcome: 'success',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'project',
      entityId: id,
      metadata: {
        closure_id: closureId,
        signature_id: signatureId,
        outcome,
        lessons_count: insertedLessons.length,
        from_state: PROJECT_EXECUTION_STATES.CLIENT_CONFIRMATION,
        to_state: PROJECT_EXECUTION_STATES.CLOSED,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, {
      closure: closureRow,
      signature: sigRow,
      lessons: insertedLessons,
      project: updatedProyecto,
    })
  } catch (error) {
    console.error('close POST error:', error)
    await logServerEvent({
      eventName: 'project.closure.recorded',
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
