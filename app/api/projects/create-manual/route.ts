import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { crearProyectoManualCompleto } from '@/lib/projects/create-manual'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const NEW_PROJECTS_ROOT =
  process.env.DOA_PROJECTS_NEW_ROOT ??
  'C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/02. Data DOA/05. Projects/01. Projects Nuevos/02. Projects nuevos'

const PLANTILLAS_ROOT =
  process.env.DOA_PLANTILLAS_ROOT ??
  'C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/02. Data DOA/01. Plantillas'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

/**
 * POST — Crea un project manualmente (sin request origen).
 *
 * Body esperado:
 *   {
 *     title: string,
 *     description?: string,
 *     client_id?: string,
 *     client_name?: string,
 *     manufacturer?: string,
 *     model?: string,
 *     msn?: string,
 *     tcds_code?: string,
 *     tcds_code_short?: string,
 *     owner?: string,
 *     checker?: string,
 *     approval?: string,
 *     estimated_delivery_date?: string,   // ISO date
 *     priority?: 'high' | 'medium' | 'low',
 *     plantilla_codes: string[],
 *   }
 *
 * Respuestas:
 *   200 { ok: true, project: { id, project_number }, folder_path, docs_creados }
 *   400 body invalido
 *   500 error internal
 */
export async function POST(request: NextRequest) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { user } = auth

  // RLS de doa_projects / doa_project_deliverables solo permite INSERT al
  // service_role; el client ligado al user_label del cookie no puede escribir.
  // Usamos el admin client aqui despues de que requireUserApi ha validated la
  // sesion via cookie.
  const supabase = createAdminClient()

  try {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return jsonResponse(400, { ok: false, error: 'Body JSON invalido.' })
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      return jsonResponse(400, { ok: false, error: 'El title es obligatorio.' })
    }

    const plantillaCodesRaw = Array.isArray(body.plantilla_codes)
      ? (body.plantilla_codes as unknown[])
      : []
    const plantillaCodes = plantillaCodesRaw.filter(
      (c): c is string => typeof c === 'string' && c.trim().length > 0,
    )

    const pickString = (key: string): string | null => {
      const v = body[key]
      if (typeof v !== 'string') return null
      const t = v.trim()
      return t || null
    }

    const prioridadRaw = pickString('priority')
    const priority: 'high' | 'medium' | 'low' | null =
      prioridadRaw === 'high' || prioridadRaw === 'medium' || prioridadRaw === 'low'
        ? prioridadRaw
        : null

    const result = await crearProyectoManualCompleto({
      supabase,
      createdByUserId: user.id,
      newProjectsRoot: NEW_PROJECTS_ROOT,
      plantillasRoot: PLANTILLAS_ROOT,
      input: {
        title,
        description: pickString('description'),
        client_id: pickString('client_id'),
        client_name: pickString('client_name'),
        manufacturer: pickString('manufacturer'),
        model: pickString('model'),
        msn: pickString('msn'),
        tcds_code: pickString('tcds_code'),
        tcds_code_short: pickString('tcds_code_short'),
        owner: pickString('owner'),
        checker: pickString('checker'),
        approval: pickString('approval'),
        estimated_delivery_date: pickString('estimated_delivery_date'),
        priority,
        plantilla_codes: plantillaCodes,
      },
    })

    return jsonResponse(201, {
      ok: true,
      project: { id: result.id, project_number: result.project_number },
      folder_path: result.folder_path,
      docs_creados: result.docs_creados,
    })
  } catch (error) {
    console.error('crear-manual POST error:', error)
    return jsonResponse(500, {
      ok: false,
      error: error instanceof Error ? error.message : 'Error inesperado.',
    })
  }
}
