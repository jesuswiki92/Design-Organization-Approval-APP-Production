import { NextRequest } from 'next/server'
import { mkdir } from 'fs/promises'
import path from 'path'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import {
  PROJECT_FOLDER_STRUCTURE,
  buildProjectFolderPath,
  computeNextSequence,
  deriveModelPrefix,
  formatProjectNumber,
} from '@/lib/project-builder'
import { PROJECT_STATES, QUOTATION_BOARD_STATES } from '@/lib/workflow-states'

export const runtime = 'nodejs'

const SIMULATION_BASE_PATH =
  process.env.DOA_SIMULATION_BASE_PATH ??
  'C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/02. Data DOA/00. APP sinulation'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

/**
 * POST — Abre un project a partir de una request entrante.
 *
 * Pasos:
 *  1. Autenticar y cargar la request.
 *  2. Calcular (o validar) el project_number.
 *  3. Crear la folder del project con las 6 subcarpetas estandar.
 *  4. Insertar la fila en `doa_projects`.
 *
 * Body (opcional): { project_number?: string, title?: string }.
 * Respuestas:
 *  - 201 con `{ id, project_number, folder_path }` cuando se crea.
 *  - 409 si el `project_number` ya existe.
 */
export async function POST(
  httpRequest: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { user, supabase } = auth
  const requestContext = buildRequestContext(httpRequest)
  const { id } = await context.params

  try {
    if (!id) return jsonResponse(400, { error: 'Request ID requerido.' })

    let body: { project_number?: unknown; title?: unknown } = {}
    try {
      body = (await httpRequest.json()) as typeof body
    } catch {
      body = {}
    }

    const providedNumero =
      typeof body.project_number === 'string' && body.project_number.trim().length > 0
        ? body.project_number.trim()
        : null
    const providedTitulo =
      typeof body.title === 'string' && body.title.trim().length > 0
        ? body.title.trim()
        : null

    // 1. Cargar request (mismos campos que project-preview)
    const { data: incomingRequest, error: requestError } = await supabase
      .from('doa_incoming_requests')
      .select(
        'id, subject, resumen, sender, aircraft_manufacturer, aircraft_model, aircraft_msn, tcds_number, modification_summary, entry_number',
      )
      .eq('id', id)
      .maybeSingle()

    if (requestError) return jsonResponse(500, { error: requestError.message })
    if (!incomingRequest) return jsonResponse(404, { error: 'Request not found.' })

    const manufacturer = (incomingRequest.aircraft_manufacturer as string | null) ?? null
    const model = (incomingRequest.aircraft_model as string | null) ?? null
    const msn = (incomingRequest.aircraft_msn as string | null) ?? null
    const tcdsNumber = (incomingRequest.tcds_number as string | null) ?? null
    const sender = (incomingRequest.sender as string | null) ?? null

    // Resolver tcds_code_short si aplica
    let tcdsCodeShort: string | null = null
    if (tcdsNumber) {
      const { data: aircraft } = await supabase
        .from('doa_aircraft')
        .select('tcds_code_short')
        .eq('tcds_code', tcdsNumber)
        .maybeSingle()
      tcdsCodeShort = (aircraft?.tcds_code_short as string | null) ?? null
    }

    // 2. Calcular project_number si no vino en el body
    let numeroProyecto: string
    if (providedNumero) {
      numeroProyecto = providedNumero
    } else {
      const prefix = deriveModelPrefix(manufacturer, model)
      const { next } = await computeNextSequence(supabase, prefix)
      numeroProyecto = formatProjectNumber(prefix, next)
    }

    const aeronaveLabel = [manufacturer, model].filter(Boolean).join(' ').trim() || null
    const title =
      providedTitulo ||
      (incomingRequest.modification_summary as string | null)?.slice(0, 120) ||
      (incomingRequest.subject as string | null) ||
      'Project sin title'

    // 3. Insertar fila en doa_projects PRIMERO (antes de crear carpetas).
    //    Asi, si el INSERT falla por unique_violation u other motivo,
    //    no dejamos carpetas huerfanas en disco que generen duplicados
    //    en siguientes reintentos.
    const folderPath = buildProjectFolderPath(SIMULATION_BASE_PATH, numeroProyecto)
    const { data: inserted, error: insertError } = await supabase
      .from('doa_projects')
      .insert({
        project_number: numeroProyecto,
        incoming_request_id: id,
        status: PROJECT_STATES.NEW,
        aircraft: aeronaveLabel,
        model: model,
        msn,
        tcds_code: tcdsNumber,
        tcds_code_short: tcdsCodeShort,
        client_name: sender,
        project_path: folderPath,
        title,
      })
      .select('id, project_number')
      .single()

    if (insertError) {
      // 23505 = unique_violation en Postgres
      if ((insertError as { code?: string }).code === '23505') {
        await logServerEvent({
          eventName: 'quotation.abrir_proyecto',
          eventCategory: 'quotation',
          outcome: 'failure',
          actorUserId: user.id,
          requestId: requestContext.requestId,
          route: requestContext.route,
          method: httpRequest.method,
          entityType: 'request',
          entityId: id,
          metadata: {
            error_code: '23505',
            project_number: numeroProyecto,
          },
          userAgent: requestContext.userAgent,
          ipAddress: requestContext.ipAddress,
          referrer: requestContext.referrer,
        })
        return jsonResponse(409, {
          error: `El numero de project ${numeroProyecto} ya existe.`,
          project_number: numeroProyecto,
        })
      }
      return jsonResponse(500, { error: insertError.message })
    }

    // 4. Crear carpetas fisicas. Si falla, intentar rollback del INSERT.
    try {
      await mkdir(folderPath, { recursive: true })
      await Promise.all(
        PROJECT_FOLDER_STRUCTURE.map((sub) =>
          mkdir(path.join(folderPath, sub), { recursive: true }),
        ),
      )
    } catch (mkdirError) {
      const mkdirMessage =
        mkdirError instanceof Error ? mkdirError.message : 'Unknown mkdir error'
      const { error: rollbackError } = await supabase
        .from('doa_projects')
        .delete()
        .eq('id', inserted.id)

      if (rollbackError) {
        // Rollback failed: queda inconsistencia entre BD y disco. Log con severity=error.
        await logServerEvent({
          eventName: 'project.open.inconsistent',
          eventCategory: 'quotation',
          outcome: 'failure',
          severity: 'error',
          actorUserId: user.id,
          requestId: requestContext.requestId,
          route: requestContext.route,
          method: httpRequest.method,
          entityType: 'project',
          entityId: inserted.id,
          metadata: {
            project_number: numeroProyecto,
            folder_path: folderPath,
            mkdir_error: mkdirMessage,
            rollback_error: rollbackError.message,
          },
          userAgent: requestContext.userAgent,
          ipAddress: requestContext.ipAddress,
          referrer: requestContext.referrer,
        })
        return jsonResponse(500, {
          error:
            `Inconsistencia al abrir project ${numeroProyecto}: fila creada pero carpetas fallaron y el rollback no pudo eliminar la fila. Requiere limpieza manual (project_id=${inserted.id}).`,
        })
      }

      return jsonResponse(500, {
        error: `No se pudieron crear las carpetas del project: ${mkdirMessage}`,
      })
    }

    // 5. Close la request marcandola como 'project_opened' para que
    //    desaparezca del tablero de cotizaciones. Si falla, solo se loguea:
    //    el project ya existe y la folder tambien, no debemos romper la request.
    const { error: consultaUpdateError } = await supabase
      .from('doa_incoming_requests')
      .update({ status: QUOTATION_BOARD_STATES.PROJECT_OPENED })
      .eq('id', id)

    if (consultaUpdateError) {
      await logServerEvent({
        eventName: 'quotation.abrir_proyecto',
        eventCategory: 'quotation',
        outcome: 'failure',
        severity: 'warn',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: httpRequest.method,
        entityType: 'request',
        entityId: id,
        metadata: {
          stage: 'close_consulta',
          project_id: inserted.id,
          project_number: numeroProyecto,
          consulta_update_error: consultaUpdateError.message,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
    }

    await logServerEvent({
      eventName: 'quotation.abrir_proyecto',
      eventCategory: 'quotation',
      outcome: 'success',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: httpRequest.method,
      entityType: 'request',
      entityId: id,
      metadata: {
        project_id: inserted.id,
        project_number: numeroProyecto,
        folder_path: folderPath,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(201, {
      id: inserted.id,
      project_number: numeroProyecto,
      folder_path: folderPath,
    })
  } catch (error) {
    console.error('abrir-project POST error:', error)

    await logServerEvent({
      eventName: 'quotation.abrir_proyecto',
      eventCategory: 'quotation',
      outcome: 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: httpRequest.method,
      entityType: 'request',
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
