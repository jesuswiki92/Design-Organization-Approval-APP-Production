import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'

export const runtime = 'nodejs'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

/**
 * GET — Lista los deliverables de un proyecto ordenados por `orden` y luego
 * por fecha de creacion.
 *
 * Respuestas:
 *   200 { deliverables: [...] }
 *   404 proyecto no encontrado
 *   500 error interno
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { supabase } = auth
  const { id } = await context.params

  if (!id) return jsonResponse(400, { error: 'proyecto_id requerido.' })

  // Verificar que el proyecto existe (evita confundir "sin deliverables" con "no existe")
  const { data: proyecto, error: proyectoError } = await supabase
    .from('doa_proyectos')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
  if (!proyecto) return jsonResponse(404, { error: 'Proyecto no encontrado.' })

  const { data: deliverables, error } = await supabase
    .from('doa_project_deliverables')
    .select('*')
    .eq('proyecto_id', id)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return jsonResponse(500, { error: error.message })

  return jsonResponse(200, { deliverables: deliverables ?? [] })
}

/**
 * POST — Alta manual de un deliverable suelto en un proyecto ya planificado.
 * Sprint 1: solo admite los campos minimos. Uso pensado para recuperacion
 * puntual si el ingeniero se dio cuenta de que falta un documento.
 *
 * Body: { titulo, template_code?, subpart_easa?, descripcion? }
 *
 * Respuestas:
 *   201 { deliverable }
 *   400 body invalido
 *   404 proyecto no encontrado
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

    let body: Record<string, unknown> = {}
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return jsonResponse(400, { error: 'Body JSON invalido.' })
    }

    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : ''
    if (!titulo) return jsonResponse(400, { error: '`titulo` es obligatorio.' })

    const templateCode =
      typeof body.template_code === 'string' && body.template_code.trim()
        ? body.template_code.trim()
        : null
    const subpartEasa =
      typeof body.subpart_easa === 'string' && body.subpart_easa.trim()
        ? body.subpart_easa.trim()
        : null
    const descripcion =
      typeof body.descripcion === 'string' && body.descripcion.trim()
        ? body.descripcion.trim()
        : null

    // Verificar proyecto
    const { data: proyecto, error: proyectoError } = await supabase
      .from('doa_proyectos')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!proyecto) return jsonResponse(404, { error: 'Proyecto no encontrado.' })

    // Calcular siguiente `orden`
    const { data: maxRow, error: maxError } = await supabase
      .from('doa_project_deliverables')
      .select('orden')
      .eq('proyecto_id', id)
      .order('orden', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (maxError) return jsonResponse(500, { error: maxError.message })

    const nextOrden = ((maxRow as { orden?: number } | null)?.orden ?? -1) + 1

    const { data: inserted, error: insertError } = await supabase
      .from('doa_project_deliverables')
      .insert({
        proyecto_id: id,
        template_code: templateCode,
        subpart_easa: subpartEasa,
        titulo,
        descripcion,
        estado: 'pendiente',
        version_actual: 1,
        orden: nextOrden,
      })
      .select('*')
      .single()

    if (insertError) return jsonResponse(500, { error: insertError.message })

    await logServerEvent({
      eventName: 'project.deliverable.add',
      eventCategory: 'project',
      outcome: 'success',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'proyecto',
      entityId: id,
      metadata: {
        deliverable_id: (inserted as { id?: string } | null)?.id ?? null,
        template_code: templateCode,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(201, { deliverable: inserted })
  } catch (error) {
    console.error('deliverables POST error:', error)
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Error inesperado.',
    })
  }
}
