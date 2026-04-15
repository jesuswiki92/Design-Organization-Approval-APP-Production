import { NextRequest } from 'next/server'
import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

import { requireUserApi } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'

export const runtime = 'nodejs'

const SIMULATION_BASE_PATH =
  process.env.DOA_SIMULATION_BASE_PATH ??
  'C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/02. Datos DOA/00. APP sinulation'

function jsonResponse(status: number, data: Record<string, unknown>) {
  return Response.json(data, { status })
}

/**
 * POST — Crea la carpeta de simulacion para una consulta entrante.
 *
 * Estructura creada:
 *   {SIMULATION_BASE_PATH}/{numero_entrada}/
 *     emails/
 *     adjuntos/
 *
 * Body: { numero_entrada: string }
 *
 * Devuelve 200 tanto si la carpeta se crea por primera vez como si ya existia.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { user } = auth
  const requestContext = buildRequestContext(request)
  const { id } = await context.params

  try {
    const body = (await request.json()) as { numero_entrada?: unknown }
    const numeroEntrada =
      typeof body.numero_entrada === 'string' ? body.numero_entrada.trim() : ''

    if (!id) return jsonResponse(400, { error: 'Consulta no valida.' })
    if (!numeroEntrada) {
      return jsonResponse(400, { error: 'numero_entrada es obligatorio.' })
    }

    const baseFolderPath = path.join(SIMULATION_BASE_PATH, numeroEntrada)
    const emailsPath = path.join(baseFolderPath, 'emails')
    const adjuntosPath = path.join(baseFolderPath, 'adjuntos')

    const alreadyExists = existsSync(baseFolderPath)

    await Promise.all([
      mkdir(emailsPath, { recursive: true }),
      mkdir(adjuntosPath, { recursive: true }),
    ])

    await logServerEvent({
      eventName: 'quotation.folder_create',
      eventCategory: 'quotation',
      outcome: 'success',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'consulta',
      entityId: id,
      metadata: {
        numero_entrada: numeroEntrada,
        already_existed: alreadyExists,
        folder_path: baseFolderPath,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, {
      ok: true,
      created: !alreadyExists,
      folder: baseFolderPath,
    })
  } catch (error) {
    console.error('folder POST error:', error)

    await logServerEvent({
      eventName: 'quotation.folder_create',
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
