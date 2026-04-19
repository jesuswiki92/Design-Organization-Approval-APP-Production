import { NextResponse } from 'next/server'

import { ensureConsultaFolder } from '@/lib/quotations/ensure-consulta-folder'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'

/**
 * Webhook entrante disparado por n8n justo despues del INSERT en
 * `consultas_entrantes`. Crea de forma idempotente la carpeta local
 * de simulacion para la nueva consulta (`{numero_entrada}/1. Email/`
 * y `/2. Adjuntos/`), sin depender de que un humano abra la pagina de
 * detalle.
 *
 * Autenticacion: header compartido `x-n8n-secret` === `N8N_WEBHOOK_SECRET`.
 * Si `N8N_WEBHOOK_SECRET` no esta definido en el entorno, se permite la
 * llamada pero se loguea un warning (modo dev).
 *
 * Body esperado: { numero_entrada: string, consulta_id: string }
 */

export const runtime = 'nodejs'

type WebhookBody = {
  numero_entrada?: unknown
  consulta_id?: unknown
}

export async function POST(request: Request) {
  const requestContext = buildRequestContext(request)

  // --- Verificacion de secret compartido ---
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET
  const providedSecret = request.headers.get('x-n8n-secret')

  if (!expectedSecret) {
    console.warn(
      '[doa-consulta-created] N8N_WEBHOOK_SECRET no esta definido — permitiendo la llamada (modo dev).',
    )
  } else if (providedSecret !== expectedSecret) {
    await logServerEvent({
      eventName: 'quotation.folder_create',
      eventCategory: 'quotation',
      outcome: 'failure',
      severity: 'warn',
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      metadata: { reason: 'invalid_secret' },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // --- Parseo del body ---
  let body: WebhookBody
  try {
    body = (await request.json()) as WebhookBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const numeroEntrada =
    typeof body.numero_entrada === 'string' ? body.numero_entrada.trim() : ''
  const consultaId =
    typeof body.consulta_id === 'string' ? body.consulta_id.trim() : null

  if (!numeroEntrada) {
    return NextResponse.json(
      { error: 'numero_entrada es obligatorio.' },
      { status: 400 },
    )
  }

  // --- Crear carpeta local (idempotente) ---
  const result = await ensureConsultaFolder(numeroEntrada)

  if (result.error) {
    await logServerEvent({
      eventName: 'quotation.folder_create',
      eventCategory: 'quotation',
      outcome: 'failure',
      severity: 'error',
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'consulta',
      entityId: consultaId,
      entityCode: numeroEntrada,
      metadata: {
        source: 'n8n_webhook',
        error_message: result.error,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 },
    )
  }

  await logServerEvent({
    eventName: 'quotation.folder_create',
    eventCategory: 'quotation',
    outcome: 'success',
    requestId: requestContext.requestId,
    route: requestContext.route,
    method: request.method,
    entityType: 'consulta',
    entityId: consultaId,
    entityCode: numeroEntrada,
    metadata: {
      source: 'n8n_webhook',
      created: result.created,
    },
    userAgent: requestContext.userAgent,
    ipAddress: requestContext.ipAddress,
    referrer: requestContext.referrer,
  })

  return NextResponse.json(
    { ok: true, created: result.created, numero_entrada: numeroEntrada },
    { status: 200 },
  )
}
