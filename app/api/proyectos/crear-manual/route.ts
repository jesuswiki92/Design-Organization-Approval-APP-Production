import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { crearProyectoManualCompleto } from '@/lib/proyectos/crear-manual'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const NEW_PROJECTS_ROOT =
  process.env.DOA_PROJECTS_NEW_ROOT ??
  'C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/02. Datos DOA/05. Proyectos/01. Proyectos Nuevos/02. Proyectos nuevos'

const PLANTILLAS_ROOT =
  process.env.DOA_PLANTILLAS_ROOT ??
  'C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/02. Datos DOA/01. Plantillas'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

/**
 * POST — Crea un proyecto manualmente (sin consulta origen).
 *
 * Body esperado:
 *   {
 *     titulo: string,
 *     descripcion?: string,
 *     cliente_id?: string,
 *     cliente_nombre?: string,
 *     fabricante?: string,
 *     modelo?: string,
 *     msn?: string,
 *     tcds_code?: string,
 *     tcds_code_short?: string,
 *     owner?: string,
 *     checker?: string,
 *     approval?: string,
 *     fecha_entrega_estimada?: string,   // ISO date
 *     prioridad?: 'alta' | 'media' | 'baja',
 *     plantilla_codes: string[],
 *   }
 *
 * Respuestas:
 *   200 { ok: true, project: { id, numero_proyecto }, folder_path, docs_creados }
 *   400 body invalido
 *   500 error interno
 */
export async function POST(request: NextRequest) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { user } = auth

  // RLS de proyectos / project_deliverables solo permite INSERT al
  // service_role; el cliente ligado al usuario del cookie no puede escribir.
  // Usamos el admin client aqui despues de que requireUserApi ha validado la
  // sesion via cookie.
  const supabase = createAdminClient()

  try {
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return jsonResponse(400, { ok: false, error: 'Body JSON invalido.' })
    }

    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : ''
    if (!titulo) {
      return jsonResponse(400, { ok: false, error: 'El titulo es obligatorio.' })
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

    const prioridadRaw = pickString('prioridad')
    const prioridad: 'alta' | 'media' | 'baja' | null =
      prioridadRaw === 'alta' || prioridadRaw === 'media' || prioridadRaw === 'baja'
        ? prioridadRaw
        : null

    const result = await crearProyectoManualCompleto({
      supabase,
      createdByUserId: user.id,
      newProjectsRoot: NEW_PROJECTS_ROOT,
      plantillasRoot: PLANTILLAS_ROOT,
      input: {
        titulo,
        descripcion: pickString('descripcion'),
        cliente_id: pickString('cliente_id'),
        cliente_nombre: pickString('cliente_nombre'),
        fabricante: pickString('fabricante'),
        modelo: pickString('modelo'),
        msn: pickString('msn'),
        tcds_code: pickString('tcds_code'),
        tcds_code_short: pickString('tcds_code_short'),
        owner: pickString('owner'),
        checker: pickString('checker'),
        approval: pickString('approval'),
        fecha_entrega_estimada: pickString('fecha_entrega_estimada'),
        prioridad,
        plantilla_codes: plantillaCodes,
      },
    })

    return jsonResponse(201, {
      ok: true,
      project: { id: result.id, numero_proyecto: result.numero_proyecto },
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
