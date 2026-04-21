import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'

export const runtime = 'nodejs'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

/**
 * GET — Lista los deliverables de un project ordenados por `sort_order` y luego
 * por date de creacion.
 *
 * Respuestas:
 *   200 { deliverables: [...] }
 *   404 project no encontrado
 *   500 error internal
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { supabase } = auth
  const { id } = await context.params

  if (!id) return jsonResponse(400, { error: 'project_id requerido.' })

  // Verificar que el project existe (evita confundir "sin deliverables" con "no existe")
  const { data: project, error: proyectoError } = await supabase
    .from('doa_projects')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
  if (!project) return jsonResponse(404, { error: 'Project no encontrado.' })

  const { data: deliverables, error } = await supabase
    .from('doa_project_deliverables')
    .select('*')
    .eq('project_id', id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return jsonResponse(500, { error: error.message })

  return jsonResponse(200, { deliverables: deliverables ?? [] })
}

/**
 * POST — Alta manual de un deliverable suelto en un project ya planificado.
 * Sprint 1: solo admite los campos minimos. Uso pensado para recuperacion
 * puntual si el ingeniero se dio cuenta de que falta un document.
 *
 * Body: { title, template_code?, subpart_easa?, description? }
 *
 * Respuestas:
 *   201 { deliverable }
 *   400 body invalido
 *   404 project no encontrado
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

    let body: Record<string, unknown> = {}
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return jsonResponse(400, { error: 'Body JSON invalido.' })
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) return jsonResponse(400, { error: '`title` es obligatorio.' })

    const templateCode =
      typeof body.template_code === 'string' && body.template_code.trim()
        ? body.template_code.trim()
        : null
    const subpartEasa =
      typeof body.subpart_easa === 'string' && body.subpart_easa.trim()
        ? body.subpart_easa.trim()
        : null
    const description =
      typeof body.description === 'string' && body.description.trim()
        ? body.description.trim()
        : null

    // Verificar project
    const { data: project, error: proyectoError } = await supabase
      .from('doa_projects')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!project) return jsonResponse(404, { error: 'Project no encontrado.' })

    // Calcular siguiente `sort_order`
    const { data: maxRow, error: maxError } = await supabase
      .from('doa_project_deliverables')
      .select('sort_order')
      .eq('project_id', id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (maxError) return jsonResponse(500, { error: maxError.message })

    const nextOrden = ((maxRow as { sort_order?: number } | null)?.sort_order ?? -1) + 1

    const { data: inserted, error: insertError } = await supabase
      .from('doa_project_deliverables')
      .insert({
        project_id: id,
        template_code: templateCode,
        subpart_easa: subpartEasa,
        title,
        description,
        status: 'pending',
        current_version: 1,
        sort_order: nextOrden,
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
      entityType: 'project',
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
