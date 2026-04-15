/**
 * ============================================================================
 * POST /api/proyectos/[id]/cerrar  — Sprint 4 (close-the-loop)
 * ============================================================================
 *
 * Cierra un proyecto que esta en `confirmacion_cliente`. Computa un snapshot
 * de metricas, firma HMAC la decision de cierre, registra la closure row,
 * inserta lecciones (si se pasan) y transiciona a `cerrado`.
 *
 * Body JSON:
 *   {
 *     outcome: 'exitoso'|'exitoso_con_reservas'|'problematico'|'abortado',
 *     notas_cierre?: string,
 *     lecciones?: Array<LessonInput>
 *   }
 *
 * Respuestas:
 *   200 { closure, signature, lessons, proyecto }
 *   400 body invalido
 *   404 proyecto no encontrado
 *   409 estado_v2 != confirmacion_cliente
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
  LessonCategoria,
  LessonInput,
  LessonTipo,
} from '@/types/database'

export const runtime = 'nodejs'

const VALID_OUTCOMES: readonly ClosureOutcome[] = [
  CLOSURE_OUTCOMES.EXITOSO,
  CLOSURE_OUTCOMES.EXITOSO_CON_RESERVAS,
  CLOSURE_OUTCOMES.PROBLEMATICO,
  CLOSURE_OUTCOMES.ABORTADO,
]

const VALID_LESSON_CATEGORIAS: readonly LessonCategoria[] = [
  'tecnica',
  'proceso',
  'cliente',
  'calidad',
  'planificacion',
  'herramientas',
  'regulatoria',
  'otro',
]

const VALID_LESSON_TIPOS: readonly LessonTipo[] = [
  'positiva',
  'negativa',
  'mejora',
  'riesgo',
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
    const categoria = typeof r.categoria === 'string' ? r.categoria : ''
    const tipo = typeof r.tipo === 'string' ? r.tipo : ''
    const titulo = typeof r.titulo === 'string' ? r.titulo.trim() : ''
    const descripcion = typeof r.descripcion === 'string' ? r.descripcion.trim() : ''
    if (!VALID_LESSON_CATEGORIAS.includes(categoria as LessonCategoria)) continue
    if (!VALID_LESSON_TIPOS.includes(tipo as LessonTipo)) continue
    if (!titulo || !descripcion) continue
    const impacto =
      typeof r.impacto === 'string' && r.impacto.trim() ? r.impacto.trim() : null
    const recomendacion =
      typeof r.recomendacion === 'string' && r.recomendacion.trim()
        ? r.recomendacion.trim()
        : null
    const tags = Array.isArray(r.tags)
      ? (r.tags as unknown[])
          .map((t) => (typeof t === 'string' ? t.trim() : ''))
          .filter((t) => t.length > 0)
      : null
    out.push({
      categoria: categoria as LessonCategoria,
      tipo: tipo as LessonTipo,
      titulo,
      descripcion,
      impacto,
      recomendacion,
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
    if (!id) return jsonResponse(400, { error: 'proyecto_id requerido.' })

    let body: Record<string, unknown> = {}
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return jsonResponse(400, { error: 'Body JSON invalido.' })
    }

    const outcome = typeof body.outcome === 'string' ? body.outcome : ''
    const notasCierre =
      typeof body.notas_cierre === 'string' && body.notas_cierre.trim()
        ? body.notas_cierre.trim()
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

    // Cargar proyecto
    const { data: proyecto, error: proyectoError } = await supabase
      .from('doa_proyectos')
      .select('id, numero_proyecto, estado_v2, fase_actual, created_at, titulo')
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!proyecto) return jsonResponse(404, { error: 'Proyecto no encontrado.' })

    const p = proyecto as {
      id: string
      numero_proyecto: string | null
      estado_v2: string | null
      fase_actual: string | null
      created_at: string
      titulo: string
    }

    if (p.estado_v2 !== PROJECT_EXECUTION_STATES.CONFIRMACION_CLIENTE) {
      return jsonResponse(409, {
        error:
          `El proyecto no esta en "confirmacion_cliente" (estado actual: "${p.estado_v2 ?? 'desconocido'}"). ` +
          `Solo se admite cerrar desde "${PROJECT_EXECUTION_STATES.CONFIRMACION_CLIENTE}".`,
        current_state: p.estado_v2,
      })
    }

    // Computar snapshot de metricas
    const [delRes, valRes, entRes] = await Promise.all([
      supabase
        .from('doa_project_deliverables')
        .select('estado')
        .eq('proyecto_id', id),
      supabase
        .from('doa_project_validations')
        .select('decision')
        .eq('proyecto_id', id),
      supabase
        .from('doa_project_deliveries')
        .select('dispatch_status, dispatched_at, client_confirmed_at, created_at')
        .eq('proyecto_id', id),
    ])

    if (delRes.error) return jsonResponse(500, { error: delRes.error.message })
    if (valRes.error) return jsonResponse(500, { error: valRes.error.message })
    if (entRes.error) return jsonResponse(500, { error: entRes.error.message })

    const delivs = (delRes.data ?? []) as { estado: string }[]
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
      horas_plan: null,
      horas_real: null,
      deliverables_total: delivs.length,
      deliverables_completado: delivs.filter((d) => d.estado === 'completado').length,
      deliverables_no_aplica: delivs.filter((d) => d.estado === 'no_aplica').length,
      deliverables_bloqueado: delivs.filter((d) => d.estado === 'bloqueado').length,
      validaciones_count: vals.length,
      validaciones_aprobadas: vals.filter((v) => v.decision === 'aprobado').length,
      devoluciones_count: vals.filter((v) => v.decision === 'devuelto').length,
      entregas_count: ents.length,
      entregas_enviadas: ents.filter((e) =>
        ['enviado', 'confirmado_cliente'].includes(e.dispatch_status),
      ).length,
      entregas_confirmadas: ents.filter(
        (e) => e.dispatch_status === 'confirmado_cliente',
      ).length,
      dias_total: diasTotal,
      client_confirmation_days: clientConfirmationDays,
    }

    const nowIso = new Date().toISOString()

    // Payload firmado
    const signedPayload = {
      proyecto_id: id,
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
          'No se pudo computar la firma HMAC de cierre: ' +
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
        proyecto_id: id,
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
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'proyecto',
        entityId: id,
        metadata: {
          severity: 'error',
          stage: 'insert_signature',
          error_message: sigErr?.message ?? 'insert_signature_failed',
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, {
        error: `No se pudo persistir la firma de cierre: ${sigErr?.message ?? 'unknown'}.`,
      })
    }

    const signatureId = (sigRow as { id: string }).id

    // 2) Insert closure row
    const { data: closureRow, error: closureErr } = await admin
      .from('doa_project_closures' as never)
      .insert({
        proyecto_id: id,
        closer_user_id: user.id,
        signature_id: signatureId,
        metrics,
        outcome,
        notas_cierre: notasCierre,
      } as never)
      .select('*')
      .single()

    if (closureErr || !closureRow) {
      await logServerEvent({
        eventName: 'project.closure.recorded',
        eventCategory: 'project',
        outcome: 'failure',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'proyecto',
        entityId: id,
        metadata: {
          severity: 'error',
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
          `Firma de cierre persistida (${signatureId}) pero no se pudo crear la closure row: ${closureErr?.message ?? 'unknown'}. ` +
          `Requiere recuperacion manual.`,
      })
    }

    const closureId = (closureRow as { id: string }).id

    // 3) Insert lessons (batch)
    let insertedLessons: unknown[] = []
    if (lecciones.length > 0) {
      const rows = lecciones.map((l) => ({
        proyecto_id: id,
        closure_id: closureId,
        author_user_id: user.id,
        categoria: l.categoria,
        tipo: l.tipo,
        titulo: l.titulo,
        descripcion: l.descripcion,
        impacto: l.impacto ?? null,
        recomendacion: l.recomendacion ?? null,
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
          actorUserId: user.id,
          requestId: requestContext.requestId,
          route: requestContext.route,
          method: request.method,
          entityType: 'proyecto',
          entityId: id,
          metadata: {
            severity: 'warn',
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

    // 4) Transicionar proyecto -> cerrado
    const { data: updatedProyecto, error: updateError } = await admin
      .from('doa_proyectos' as never)
      .update({
        estado_v2: PROJECT_EXECUTION_STATES.CERRADO,
        fase_actual: PROJECT_EXECUTION_PHASES.CIERRE,
        estado_updated_at: nowIso,
        estado_updated_by: user.id,
      } as never)
      .eq('id', id)
      .select('id, numero_proyecto, estado_v2, fase_actual, estado_updated_at')
      .single()

    if (updateError) {
      await logServerEvent({
        eventName: 'project.closure.recorded',
        eventCategory: 'project',
        outcome: 'failure',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'proyecto',
        entityId: id,
        metadata: {
          severity: 'error',
          stage: 'transition_state',
          closure_id: closureId,
          signature_id: signatureId,
          intended_state: PROJECT_EXECUTION_STATES.CERRADO,
          error_message: updateError.message,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, {
        error:
          `Closure y firma persistidas (${closureId}), pero la transicion a "cerrado" fallo: ${updateError.message}. Requiere recuperacion manual.`,
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
      entityType: 'proyecto',
      entityId: id,
      metadata: {
        closure_id: closureId,
        signature_id: signatureId,
        outcome,
        lessons_count: insertedLessons.length,
        from_state: PROJECT_EXECUTION_STATES.CONFIRMACION_CLIENTE,
        to_state: PROJECT_EXECUTION_STATES.CERRADO,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, {
      closure: closureRow,
      signature: sigRow,
      lessons: insertedLessons,
      proyecto: updatedProyecto,
    })
  } catch (error) {
    console.error('cerrar POST error:', error)
    await logServerEvent({
      eventName: 'project.closure.recorded',
      eventCategory: 'project',
      outcome: 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'proyecto',
      entityId: id,
      metadata: {
        severity: 'error',
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
