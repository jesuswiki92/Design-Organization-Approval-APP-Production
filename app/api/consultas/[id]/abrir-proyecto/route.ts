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
  'C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/02. Datos DOA/00. APP sinulation'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

/**
 * POST — Abre un proyecto a partir de una consulta entrante.
 *
 * Pasos:
 *  1. Autenticar y cargar la consulta.
 *  2. Calcular (o validar) el numero_proyecto.
 *  3. Crear la carpeta del proyecto con las 6 subcarpetas estandar.
 *  4. Insertar la fila en `doa_proyectos`.
 *
 * Body (opcional): { numero_proyecto?: string, titulo?: string }.
 * Respuestas:
 *  - 201 con `{ id, numero_proyecto, folder_path }` cuando se crea.
 *  - 409 si el `numero_proyecto` ya existe.
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
    if (!id) return jsonResponse(400, { error: 'Consulta ID requerido.' })

    let body: { numero_proyecto?: unknown; titulo?: unknown } = {}
    try {
      body = (await request.json()) as typeof body
    } catch {
      body = {}
    }

    const providedNumero =
      typeof body.numero_proyecto === 'string' && body.numero_proyecto.trim().length > 0
        ? body.numero_proyecto.trim()
        : null
    const providedTitulo =
      typeof body.titulo === 'string' && body.titulo.trim().length > 0
        ? body.titulo.trim()
        : null

    // 1. Cargar consulta (mismos campos que project-preview)
    const { data: consulta, error: consultaError } = await supabase
      .from('doa_consultas_entrantes')
      .select(
        'id, asunto, resumen, remitente, aircraft_manufacturer, aircraft_model, aircraft_msn, tcds_number, modification_summary, numero_entrada',
      )
      .eq('id', id)
      .maybeSingle()

    if (consultaError) return jsonResponse(500, { error: consultaError.message })
    if (!consulta) return jsonResponse(404, { error: 'Consulta no encontrada.' })

    const manufacturer = (consulta.aircraft_manufacturer as string | null) ?? null
    const model = (consulta.aircraft_model as string | null) ?? null
    const msn = (consulta.aircraft_msn as string | null) ?? null
    const tcdsNumber = (consulta.tcds_number as string | null) ?? null
    const remitente = (consulta.remitente as string | null) ?? null

    // Resolver tcds_code_short si aplica
    let tcdsCodeShort: string | null = null
    if (tcdsNumber) {
      const { data: aeronave } = await supabase
        .from('doa_aeronaves')
        .select('tcds_code_short')
        .eq('tcds_code', tcdsNumber)
        .maybeSingle()
      tcdsCodeShort = (aeronave?.tcds_code_short as string | null) ?? null
    }

    // 2. Calcular numero_proyecto si no vino en el body
    let numeroProyecto: string
    if (providedNumero) {
      numeroProyecto = providedNumero
    } else {
      const prefix = deriveModelPrefix(manufacturer, model)
      const { next } = await computeNextSequence(supabase, prefix)
      numeroProyecto = formatProjectNumber(prefix, next)
    }

    const aeronaveLabel = [manufacturer, model].filter(Boolean).join(' ').trim() || null
    const titulo =
      providedTitulo ||
      (consulta.modification_summary as string | null)?.slice(0, 120) ||
      (consulta.asunto as string | null) ||
      'Proyecto sin titulo'

    // 3. Insertar fila en doa_proyectos PRIMERO (antes de crear carpetas).
    //    Asi, si el INSERT falla por unique_violation u otro motivo,
    //    no dejamos carpetas huerfanas en disco que generen duplicados
    //    en siguientes reintentos.
    const folderPath = buildProjectFolderPath(SIMULATION_BASE_PATH, numeroProyecto)
    const { data: inserted, error: insertError } = await supabase
      .from('doa_proyectos')
      .insert({
        numero_proyecto: numeroProyecto,
        consulta_id: id,
        estado: PROJECT_STATES.NUEVO,
        aeronave: aeronaveLabel,
        modelo: model,
        msn,
        tcds_code: tcdsNumber,
        tcds_code_short: tcdsCodeShort,
        cliente_nombre: remitente,
        ruta_proyecto: folderPath,
        titulo,
      })
      .select('id, numero_proyecto')
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
          method: request.method,
          entityType: 'consulta',
          entityId: id,
          metadata: {
            error_code: '23505',
            numero_proyecto: numeroProyecto,
          },
          userAgent: requestContext.userAgent,
          ipAddress: requestContext.ipAddress,
          referrer: requestContext.referrer,
        })
        return jsonResponse(409, {
          error: `El numero de proyecto ${numeroProyecto} ya existe.`,
          numero_proyecto: numeroProyecto,
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
        .from('doa_proyectos')
        .delete()
        .eq('id', inserted.id)

      if (rollbackError) {
        // Rollback fallo: queda inconsistencia entre BD y disco. Log con severity=error.
        await logServerEvent({
          eventName: 'project.open.inconsistent',
          eventCategory: 'quotation',
          outcome: 'failure',
          actorUserId: user.id,
          requestId: requestContext.requestId,
          route: requestContext.route,
          method: request.method,
          entityType: 'proyecto',
          entityId: inserted.id,
          metadata: {
            severity: 'error',
            numero_proyecto: numeroProyecto,
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
            `Inconsistencia al abrir proyecto ${numeroProyecto}: fila creada pero carpetas fallaron y el rollback no pudo eliminar la fila. Requiere limpieza manual (proyecto_id=${inserted.id}).`,
        })
      }

      return jsonResponse(500, {
        error: `No se pudieron crear las carpetas del proyecto: ${mkdirMessage}`,
      })
    }

    // 5. Cerrar la consulta marcandola como 'proyecto_abierto' para que
    //    desaparezca del tablero de cotizaciones. Si falla, solo se loguea:
    //    el proyecto ya existe y la carpeta tambien, no debemos romper la request.
    const { error: consultaUpdateError } = await supabase
      .from('doa_consultas_entrantes')
      .update({ estado: QUOTATION_BOARD_STATES.PROYECTO_ABIERTO })
      .eq('id', id)

    if (consultaUpdateError) {
      await logServerEvent({
        eventName: 'quotation.abrir_proyecto',
        eventCategory: 'quotation',
        outcome: 'failure',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'consulta',
        entityId: id,
        metadata: {
          severity: 'warning',
          stage: 'close_consulta',
          proyecto_id: inserted.id,
          numero_proyecto: numeroProyecto,
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
      method: request.method,
      entityType: 'consulta',
      entityId: id,
      metadata: {
        proyecto_id: inserted.id,
        numero_proyecto: numeroProyecto,
        folder_path: folderPath,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(201, {
      id: inserted.id,
      numero_proyecto: numeroProyecto,
      folder_path: folderPath,
    })
  } catch (error) {
    console.error('abrir-proyecto POST error:', error)

    await logServerEvent({
      eventName: 'quotation.abrir_proyecto',
      eventCategory: 'quotation',
      outcome: 'failure',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'consulta',
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
