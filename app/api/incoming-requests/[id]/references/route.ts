import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'

export const runtime = 'nodejs'

function jsonResponse(status: number, data: Record<string, unknown>) {
  return Response.json(data, { status })
}

/**
 * POST — Añade un project historical como referencia para esta request.
 * Body: { project_id: string }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUserApi()
    if (auth instanceof Response) return auth
    const { user, supabase } = auth
    const requestContext = buildRequestContext(request)

    const { id } = await context.params
    const body = (await request.json()) as { project_id?: unknown }
    const proyectoId =
      typeof body.project_id === 'string' ? body.project_id.trim() : ''

    if (!id) return jsonResponse(400, { error: 'Request no válida.' })
    if (!proyectoId) return jsonResponse(400, { error: 'project_id es obligatorio.' })

    // Leer las referencias actuales
    const { data: current, error: readError } = await supabase
      .from('doa_incoming_requests')
      .select('proyectos_referencia')
      .eq('id', id)
      .single()

    if (readError || !current) {
      return jsonResponse(404, { error: 'Request no encontrada.' })
    }

    const refs: string[] = Array.isArray(current.proyectos_referencia)
      ? current.proyectos_referencia
      : []

    if (refs.includes(proyectoId)) {
      await logServerEvent({
        eventName: 'quotation.reference_add',
        eventCategory: 'quotation',
        outcome: 'info',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'request',
        entityId: id,
        metadata: {
          project_reference_id: proyectoId,
          reference_count: refs.length,
          action: 'already_exists',
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(200, { ok: true, action: 'already_exists', proyectos_referencia: refs })
    }

    const updatedRefs = [...refs, proyectoId]

    const { error: updateError } = await supabase
      .from('doa_incoming_requests')
      .update({ proyectos_referencia: updatedRefs })
      .eq('id', id)

    if (updateError) {
      await logServerEvent({
        eventName: 'quotation.reference_add',
        eventCategory: 'quotation',
        outcome: 'failure',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'request',
        entityId: id,
        metadata: {
          project_reference_id: proyectoId,
          reference_count: refs.length,
          error_message: updateError.message,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, { error: `Error al guardar referencia: ${updateError.message}` })
    }

    await logServerEvent({
      eventName: 'quotation.reference_add',
      eventCategory: 'quotation',
      outcome: 'success',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'request',
      entityId: id,
      metadata: {
        project_reference_id: proyectoId,
        reference_count: updatedRefs.length,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, { ok: true, action: 'added', proyectos_referencia: updatedRefs })
  } catch (error) {
    console.error('referencias POST error:', error)
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Error inesperado.',
    })
  }
}

/**
 * DELETE — Quita un project historical de las referencias de esta request.
 * Body: { project_id: string }
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUserApi()
    if (auth instanceof Response) return auth
    const { user, supabase } = auth
    const requestContext = buildRequestContext(request)

    const { id } = await context.params
    const body = (await request.json()) as { project_id?: unknown }
    const proyectoId =
      typeof body.project_id === 'string' ? body.project_id.trim() : ''

    if (!id) return jsonResponse(400, { error: 'Request no válida.' })
    if (!proyectoId) return jsonResponse(400, { error: 'project_id es obligatorio.' })

    const { data: current, error: readError } = await supabase
      .from('doa_incoming_requests')
      .select('proyectos_referencia')
      .eq('id', id)
      .single()

    if (readError || !current) {
      return jsonResponse(404, { error: 'Request no encontrada.' })
    }

    const refs: string[] = Array.isArray(current.proyectos_referencia)
      ? current.proyectos_referencia
      : []

    const updatedRefs = refs.filter((r) => r !== proyectoId)

    const { error: updateError } = await supabase
      .from('doa_incoming_requests')
      .update({ proyectos_referencia: updatedRefs })
      .eq('id', id)

    if (updateError) {
      await logServerEvent({
        eventName: 'quotation.reference_remove',
        eventCategory: 'quotation',
        outcome: 'failure',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'request',
        entityId: id,
        metadata: {
          project_reference_id: proyectoId,
          reference_count: refs.length,
          error_message: updateError.message,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, { error: `Error al quitar referencia: ${updateError.message}` })
    }

    await logServerEvent({
      eventName: 'quotation.reference_remove',
      eventCategory: 'quotation',
      outcome: 'success',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'request',
      entityId: id,
      metadata: {
        project_reference_id: proyectoId,
        reference_count: updatedRefs.length,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, { ok: true, action: 'removed', proyectos_referencia: updatedRefs })
  } catch (error) {
    console.error('referencias DELETE error:', error)
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Error inesperado.',
    })
  }
}
