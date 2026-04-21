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
  title: string
  subpart_easa?: string | null
  description?: string | null
}

/**
 * POST — Planifica un project: lo mueve de `project_opened` -> `planning`
 * y siembra la table `doa_project_deliverables` con los deliverables derivados
 * de la request origen (o los que venga en el body).
 *
 * Body opcional:
 *   { deliverables?: Array<{ template_code?, title, subpart_easa?, description? }> }
 *
 * Si `body.deliverables` no se proporciona, se leen las columnas booleanas
 * `doc_g12_xx` de la request (doa_incoming_requests) y se convierten a
 * filas de deliverable usando el catalogo `doa_compliance_templates` para
 * resolver title/category.
 *
 * Respuestas:
 *   200 { project, deliverables }   transicion OK
 *   400 body invalido
 *   404 project no encontrado
 *   409 execution_status != project_opened
 *   500 error internal (logueado como `project.planificar` outcome=failure)
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

    let body: { deliverables?: unknown } = {}
    try {
      body = (await request.json()) as typeof body
    } catch {
      body = {}
    }

    // 1. Cargar project y validar execution_status
    const { data: project, error: proyectoError } = await supabase
      .from('doa_projects')
      .select('id, project_number, incoming_request_id, execution_status, current_phase')
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!project) return jsonResponse(404, { error: 'Project no encontrado.' })

    const currentState = (project as { execution_status?: string | null }).execution_status ?? null
    if (currentState !== PROJECT_EXECUTION_STATES.PROJECT_OPENED) {
      return jsonResponse(409, {
        error:
          `El project no puede planificarse desde el status actual "${currentState ?? 'desconocido'}". ` +
          `Solo se admite la transicion desde "${PROJECT_EXECUTION_STATES.PROJECT_OPENED}".`,
        current_state: currentState,
      })
    }

    // 2. Resolver la lista de deliverables a insertar
    let deliverablesInput: DeliverableInput[] = []

    if (Array.isArray(body.deliverables) && body.deliverables.length > 0) {
      const parsed: (DeliverableInput | null)[] = (body.deliverables as unknown[]).map((raw) => {
        if (!raw || typeof raw !== 'object') return null
        const r = raw as Record<string, unknown>
        const title = typeof r.title === 'string' ? r.title.trim() : ''
        if (!title) return null
        const entry: DeliverableInput = {
          template_code:
            typeof r.template_code === 'string' && r.template_code.trim()
              ? r.template_code.trim()
              : null,
          title,
          subpart_easa:
            typeof r.subpart_easa === 'string' && r.subpart_easa.trim()
              ? r.subpart_easa.trim()
              : null,
          description:
            typeof r.description === 'string' && r.description.trim()
              ? r.description.trim()
              : null,
        }
        return entry
      })
      deliverablesInput = parsed.filter((d): d is DeliverableInput => d !== null)
    } else {
      // Derivar desde la request: booleanos doc_g12_xx
      const consultaId = (project as { incoming_request_id?: string | null }).incoming_request_id ?? null
      if (!consultaId) {
        return jsonResponse(400, {
          error:
            'El project no tiene request asociada y el body no incluye deliverables. ' +
            'Provee `deliverables` en el body de la peticion.',
        })
      }

      const selectCols = ['id', ...ALL_DOC_COLUMNS].join(', ')
      const { data: request, error: consultaError } = await supabase
        .from('doa_incoming_requests')
        .select(selectCols)
        .eq('id', consultaId)
        .maybeSingle()

      if (consultaError) return jsonResponse(500, { error: consultaError.message })
      if (!request) {
        return jsonResponse(404, {
          error: `Request origen ${consultaId} no encontrada.`,
        })
      }

      const consultaRow = request as unknown as Record<string, unknown>
      const selectedCodes = ALL_DOC_COLUMNS
        .filter((col) => consultaRow[col] === true)
        .map((col) => columnToCode(col))

      if (selectedCodes.length === 0) {
        return jsonResponse(400, {
          error:
            'La request origen no tiene documents de compliance seleccionados. ' +
            'Selecciona los documents en la request o provee `deliverables` en el body.',
        })
      }

      // Resolver titulos desde doa_compliance_templates
      // subpart_easa se agrego en migration 202604200010 — puede seguir siendo null
      // si el mapeo no se ha rellenado para esa template.
      const { data: templates, error: plantillasError } = await supabase
        .from('doa_compliance_templates')
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
        (templates ?? []).map((p) => {
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
          title: meta?.name?.trim() || code,
          subpart_easa: meta?.subpart_easa?.trim() || null,
          description: meta?.category ? `Categoria: ${meta.category}` : null,
        }
      })
    }

    if (deliverablesInput.length === 0) {
      return jsonResponse(400, { error: 'No hay deliverables para insertar.' })
    }

    // 3. Insertar deliverables en lote, preservando sort_order
    const rowsToInsert = deliverablesInput.map((d, idx) => ({
      project_id: id,
      template_code: d.template_code,
      title: d.title,
      subpart_easa: d.subpart_easa,
      description: d.description,
      status: 'pending' as const,
      current_version: 1,
      sort_order: idx,
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('doa_project_deliverables')
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
        entityType: 'project',
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

    // 4. Transicionar el project a planning
    const { data: updated, error: updateError } = await supabase
      .from('doa_projects')
      .update({
        execution_status: PROJECT_EXECUTION_STATES.PLANNING,
        current_phase: PROJECT_EXECUTION_PHASES.EXECUTION,
        status_updated_at: new Date().toISOString(),
        status_updated_by: user.id,
      })
      .eq('id', id)
      .select('id, project_number, execution_status, current_phase, status_updated_at')
      .single()

    if (updateError) {
      // Inconsistencia: los deliverables se insertaron pero el project no pudo
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
        entityType: 'project',
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
          `del project failed: ${updateError.message}. Requiere recuperacion manual.`,
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
      entityType: 'project',
      entityId: id,
      metadata: {
        deliverables_count: inserted?.length ?? 0,
        from_state: PROJECT_EXECUTION_STATES.PROJECT_OPENED,
        to_state: PROJECT_EXECUTION_STATES.PLANNING,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, {
      project: updated,
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
      entityType: 'project',
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
