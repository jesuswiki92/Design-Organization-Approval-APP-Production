import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import {
  computeNextSequence,
  deriveModelPrefix,
  formatProjectNumber,
} from '@/lib/project-builder'
import {
  CreateProjectFolderError,
  createProjectFolder,
} from '@/lib/quotations/call-n8n-folder'
import { INCOMING_REQUEST_STATUSES, PROJECT_STATES } from '@/lib/workflow-states'

export const runtime = 'nodejs'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

/**
 * POST — Abre un project a partir de una request entrante.
 *
 * Pasos:
 *  1. Autenticar y cargar la request.
 *  2. Calcular (o validar) el project_number.
 *  3. Insertar la fila en `doa_projects`.
 *  4. Pedir al workflow n8n `AMS - Crear Carpeta Drive Proyecto` que cree la
 *     carpeta + subfolders EASA en Google Drive y escriba
 *     `drive_folder_id` + `drive_folder_url` en la propia fila. Si falla, se
 *     registra pero NO se revierte el project — la carpeta puede crearse
 *     manualmente a posteriori.
 *  5. Archivar la request (status namespace `INCOMING_REQUEST_STATUSES`).
 *
 * Body (opcional): { project_number?: string, title?: string }.
 * Respuestas:
 *  - 201 con `{ id, project_number, folder_url }` cuando se crea.
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

    // 3. Insertar fila en doa_projects. La carpeta Drive se pide a n8n DESPUES
    //    del insert, y los campos drive_folder_* quedan null hasta entonces.
    //    Si el insert falla por unique_violation, no dejamos ni fila ni
    //    carpeta: la llamada a n8n solo ocurre con un project_id real.
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

    // 4. Pedir a n8n que cree la carpeta en Drive. Si falla, se loguea pero el
    //    project se mantiene abierto (backfill via admin script o reintento).
    let folderUrl: string | null = null
    let folderId: string | null = null
    try {
      const result = await createProjectFolder({
        projectId: inserted.id,
        projectNumber: numeroProyecto,
        incomingRequestId: id,
        clientName: sender,
        subject: (incomingRequest.subject as string | null) ?? null,
      })
      folderUrl = result.folderUrl
      folderId = result.folderId
    } catch (folderError) {
      const code =
        folderError instanceof CreateProjectFolderError
          ? folderError.code
          : 'unknown'
      const message =
        folderError instanceof Error
          ? folderError.message
          : 'Unknown folder webhook error'
      await logServerEvent({
        eventName: 'project.drive_folder.failed',
        eventCategory: 'project',
        outcome: 'failure',
        severity: 'warn',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: httpRequest.method,
        entityType: 'project',
        entityId: inserted.id,
        metadata: {
          project_id: inserted.id,
          project_number: numeroProyecto,
          folder_error_code: code,
          folder_error_message: message,
          upstream_status:
            folderError instanceof CreateProjectFolderError
              ? folderError.status
              : undefined,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
    }

    // 5. Archivar la request (namespace INCOMING_REQUEST_STATUSES). Corrige el
    //    bug anterior donde se escribia QUOTATION_BOARD_STATES.PROJECT_OPENED
    //    en doa_incoming_requests.status — ese codigo pertenece al namespace
    //    quotation_board, no a request. Al terminar el flujo de quotation, la
    //    request entrante se considera cerrada y pasa a `archived`, que SI es
    //    un codigo valido de INCOMING_REQUEST_STATUSES y saca la tarjeta del
    //    tablero.
    const { error: consultaUpdateError } = await supabase
      .from('doa_incoming_requests')
      .update({ status: INCOMING_REQUEST_STATUSES.ARCHIVED })
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
          stage: 'archive_request',
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
        drive_folder_id: folderId,
        drive_folder_url: folderUrl,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(201, {
      id: inserted.id,
      project_number: numeroProyecto,
      drive_folder_url: folderUrl,
      drive_folder_id: folderId,
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
