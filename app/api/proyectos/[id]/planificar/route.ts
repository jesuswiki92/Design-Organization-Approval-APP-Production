import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import {
  PROJECT_EXECUTION_PHASES,
  PROJECT_EXECUTION_STATES,
} from '@/lib/workflow-states'
import {
  ALL_DOC_COLUMNS,
  columnToCode,
} from '@/lib/compliance-templates'

export const runtime = 'nodejs'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

type DeliverableInput = {
  template_code?: string | null
  titulo: string
  subpart_easa?: string | null
  descripcion?: string | null
}

/**
 * POST — Planifica un proyecto: lo mueve de `proyecto_abierto` -> `planificacion`
 * y siembra la tabla `project_deliverables` con los deliverables derivados
 * de la consulta origen (o los que venga en el body).
 *
 * Body opcional:
 *   { deliverables?: Array<{ template_code?, titulo, subpart_easa?, descripcion? }> }
 *
 * Si `body.deliverables` no se proporciona, se leen las columnas booleanas
 * `doc_g12_xx` de la consulta (consultas_entrantes) y se convierten a
 * filas de deliverable usando el catalogo `plantillas_compliance` para
 * resolver titulo/categoria.
 *
 * Respuestas:
 *   200 { proyecto, deliverables }   transicion OK
 *   400 body invalido
 *   404 proyecto no encontrado
 *   409 estado_v2 != proyecto_abierto
 *   500 error interno (logueado como `project.planificar` outcome=failure)
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

    let body: { deliverables?: unknown } = {}
    try {
      body = (await request.json()) as typeof body
    } catch {
      body = {}
    }

    // 1. Cargar proyecto y validar estado_v2
    const { data: proyecto, error: proyectoError } = await supabase
      .from('proyectos')
      .select('id, numero_proyecto, consulta_id, estado_v2, fase_actual')
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!proyecto) return jsonResponse(404, { error: 'Proyecto no encontrado.' })

    const currentState = (proyecto as { estado_v2?: string | null }).estado_v2 ?? null
    if (currentState !== PROJECT_EXECUTION_STATES.PROYECTO_ABIERTO) {
      return jsonResponse(409, {
        error:
          `El proyecto no puede planificarse desde el estado actual "${currentState ?? 'desconocido'}". ` +
          `Solo se admite la transicion desde "${PROJECT_EXECUTION_STATES.PROYECTO_ABIERTO}".`,
        current_state: currentState,
      })
    }

    // 2. Resolver la lista de deliverables a insertar
    let deliverablesInput: DeliverableInput[] = []

    if (Array.isArray(body.deliverables) && body.deliverables.length > 0) {
      const parsed: (DeliverableInput | null)[] = (body.deliverables as unknown[]).map((raw) => {
        if (!raw || typeof raw !== 'object') return null
        const r = raw as Record<string, unknown>
        const titulo = typeof r.titulo === 'string' ? r.titulo.trim() : ''
        if (!titulo) return null
        const entry: DeliverableInput = {
          template_code:
            typeof r.template_code === 'string' && r.template_code.trim()
              ? r.template_code.trim()
              : null,
          titulo,
          subpart_easa:
            typeof r.subpart_easa === 'string' && r.subpart_easa.trim()
              ? r.subpart_easa.trim()
              : null,
          descripcion:
            typeof r.descripcion === 'string' && r.descripcion.trim()
              ? r.descripcion.trim()
              : null,
        }
        return entry
      })
      deliverablesInput = parsed.filter((d): d is DeliverableInput => d !== null)
    } else {
      // Derivar desde la consulta: booleanos doc_g12_xx
      const consultaId = (proyecto as { consulta_id?: string | null }).consulta_id ?? null
      if (!consultaId) {
        return jsonResponse(400, {
          error:
            'El proyecto no tiene consulta asociada y el body no incluye deliverables. ' +
            'Provee `deliverables` en el cuerpo de la peticion.',
        })
      }

      const selectCols = ['id', ...ALL_DOC_COLUMNS].join(', ')
      const { data: consulta, error: consultaError } = await supabase
        .from('consultas_entrantes')
        .select(selectCols)
        .eq('id', consultaId)
        .maybeSingle()

      if (consultaError) return jsonResponse(500, { error: consultaError.message })
      if (!consulta) {
        return jsonResponse(404, {
          error: `Consulta origen ${consultaId} no encontrada.`,
        })
      }

      const consultaRow = consulta as unknown as Record<string, unknown>
      const selectedCodes = ALL_DOC_COLUMNS
        .filter((col) => consultaRow[col] === true)
        .map((col) => columnToCode(col))

      if (selectedCodes.length === 0) {
        return jsonResponse(400, {
          error:
            'La consulta origen no tiene documentos de compliance seleccionados. ' +
            'Selecciona los documentos en la consulta o provee `deliverables` en el body.',
        })
      }

      // Resolver titulos desde plantillas_compliance
      // subpart_easa se agrego en migration 202604200010 — puede seguir siendo null
      // si el mapeo no se ha rellenado para esa plantilla.
      const { data: plantillas, error: plantillasError } = await supabase
        .from('plantillas_compliance')
        .select('code, name, category, sort_order, subpart_easa')
        .in('code', selectedCodes)

      if (plantillasError) return jsonResponse(500, { error: plantillasError.message })

      const plantillasMap = new Map<
        string,
        {
          name: string
          category: string | null
          sort_order: number | null
          subpart_easa: string | null
        }
      >(
        (plantillas ?? []).map((p) => {
          const row = p as {
            code: string
            name: string
            category: string | null
            sort_order: number | null
            subpart_easa: string | null
          }
          return [
            row.code,
            {
              name: row.name,
              category: row.category,
              sort_order: row.sort_order,
              subpart_easa: row.subpart_easa,
            },
          ]
        }),
      )

      deliverablesInput = selectedCodes.map((code) => {
        const meta = plantillasMap.get(code)
        return {
          template_code: code,
          titulo: meta?.name?.trim() || code,
          subpart_easa: meta?.subpart_easa?.trim() || null,
          descripcion: meta?.category ? `Categoria: ${meta.category}` : null,
        }
      })
    }

    if (deliverablesInput.length === 0) {
      return jsonResponse(400, { error: 'No hay deliverables para insertar.' })
    }

    // 3. Insertar deliverables en lote, preservando orden
    const rowsToInsert = deliverablesInput.map((d, idx) => ({
      proyecto_id: id,
      template_code: d.template_code,
      titulo: d.titulo,
      subpart_easa: d.subpart_easa,
      descripcion: d.descripcion,
      estado: 'pendiente' as const,
      version_actual: 1,
      orden: idx,
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('project_deliverables')
      .insert(rowsToInsert)
      .select('*')

    if (insertError) {
      await logServerEvent({
        eventName: 'project.planificar',
        eventCategory: 'project',
        outcome: 'failure',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'proyecto',
        entityId: id,
        metadata: {
          stage: 'insert_deliverables',
          deliverables_count: rowsToInsert.length,
          error_message: insertError.message,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, { error: insertError.message })
    }

    // 4. Transicionar el proyecto a planificacion
    const { data: updated, error: updateError } = await supabase
      .from('proyectos')
      .update({
        estado_v2: PROJECT_EXECUTION_STATES.PLANIFICACION,
        fase_actual: PROJECT_EXECUTION_PHASES.EJECUCION,
        estado_updated_at: new Date().toISOString(),
        estado_updated_by: user.id,
      })
      .eq('id', id)
      .select('id, numero_proyecto, estado_v2, fase_actual, estado_updated_at')
      .single()

    if (updateError) {
      // Inconsistencia: los deliverables se insertaron pero el proyecto no pudo
      // transicionar. Se loguea como severity=error para recuperacion manual.
      await logServerEvent({
        eventName: 'project.planificar.inconsistent',
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
          deliverables_inserted: inserted?.length ?? 0,
          update_error: updateError.message,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
      return jsonResponse(500, {
        error:
          `Deliverables insertados (${inserted?.length ?? 0}) pero la transicion ` +
          `del proyecto fallo: ${updateError.message}. Requiere recuperacion manual.`,
      })
    }

    // 5. Log de exito
    await logServerEvent({
      eventName: 'project.planificar',
      eventCategory: 'project',
      outcome: 'success',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'proyecto',
      entityId: id,
      metadata: {
        deliverables_count: inserted?.length ?? 0,
        from_state: PROJECT_EXECUTION_STATES.PROYECTO_ABIERTO,
        to_state: PROJECT_EXECUTION_STATES.PLANIFICACION,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, {
      proyecto: updated,
      deliverables: inserted ?? [],
    })
  } catch (error) {
    console.error('planificar POST error:', error)

    await logServerEvent({
      eventName: 'project.planificar',
      eventCategory: 'project',
      outcome: 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'proyecto',
      entityId: id,
      metadata: {
        error_message:
          error instanceof Error ? error.message : 'Unknown error',
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
