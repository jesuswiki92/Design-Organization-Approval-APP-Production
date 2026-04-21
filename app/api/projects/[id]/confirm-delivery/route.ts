/**
 * ============================================================================
 * POST (y GET) /api/projects/[id]/confirm-delivery  — Sprint 3
 * ============================================================================
 *
 * Endpoint PUBLICO (sin auth) que el client visita/llama desde el enlace del
 * email. Toma un token de la query string, marca la delivery como confirmada
 * por el client y transita el project a `client_confirmation` (si el
 * status lo permite).
 *
 * Devuelve HTML minimo (modo oscuro compatible) para que el client lo vea
 * al hacer click.
 *
 * NOTA: aunque el flujo canonico es POST, exponemos tambien GET porque los
 * clients de email abren enlaces con GET. Ambos metodos ejecutan la misma
 * logica.
 */

import { NextRequest } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import {
  PROJECT_EXECUTION_PHASES,
  PROJECT_EXECUTION_STATES,
} from '@/lib/workflow-states'
import type { ProjectDelivery } from '@/types/database'

export const runtime = 'nodejs'

const COMPANY_NAME = process.env.DOA_COMPANY_NAME ?? 'DOA Operations'

function htmlResponse(status: number, title: string, bodyHtml: string) {
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — ${COMPANY_NAME}</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
    }
    .card {
      max-width: 480px;
      width: calc(100% - 32px);
      padding: 32px;
      border-radius: 16px;
      background: #1e293b;
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
      border: 1px solid #334155;
    }
    h1 { margin: 0 0 8px; font-size: 20px; color: #f8fafc; }
    .company { font-size: 12px; color: #94a3b8; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 16px; }
    p { margin: 8px 0; line-height: 1.5; color: #cbd5e1; font-size: 14px; }
    .ref { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; font-size: 12px; color: #94a3b8; margin-top: 16px; }
    .ok { color: #34d399; }
    .warn { color: #fbbf24; }
    .err { color: #f87171; }
    @medium (prefers-color-scheme: light) {
      body { background: #f8fafc; color: #0f172a; }
      .card { background: #ffffff; border-color: #e2e8f0; }
      h1 { color: #0f172a; }
      .company { color: #64748b; }
      p { color: #334155; }
      .ref { color: #64748b; }
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="company">${COMPANY_NAME}</div>
    ${bodyHtml}
  </main>
</body>
</html>`
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

async function handle(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestContext = buildRequestContext(request)
  const { id } = await context.params

  const token = new URL(request.url).searchParams.get('token')?.trim() ?? ''

  if (!id || !token) {
    return htmlResponse(
      404,
      'Enlace no valido',
      `<h1 class="err">Enlace no valido</h1>
       <p>El enlace de confirmacion no contiene los parametros necesarios.</p>`,
    )
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (e) {
    console.error('confirmar-delivery: admin client unavailable:', e)
    return htmlResponse(
      500,
      'Error',
      `<h1 class="err">Error internal</h1>
       <p>No se pudo procesar la confirmacion. Contacta con ${COMPANY_NAME}.</p>`,
    )
  }

  const { data: dRow, error: dErr } = await admin
    .from('doa_project_deliveries')
    .select('*')
    .eq('project_id', id)
    .eq('client_confirmation_token', token)
    .maybeSingle()

  if (dErr) {
    console.error('confirmar-delivery lookup error:', dErr)
    return htmlResponse(
      500,
      'Error',
      `<h1 class="err">Error internal</h1>
       <p>No se pudo consultar la delivery.</p>`,
    )
  }

  if (!dRow) {
    return htmlResponse(
      404,
      'Enlace no encontrado',
      `<h1 class="err">Enlace no encontrado</h1>
       <p>El token de confirmacion no es valido o ha expirado.</p>`,
    )
  }

  const delivery = dRow as ProjectDelivery

  // Ya confirmada -> thank you idempotente
  if (delivery.dispatch_status === 'client_confirmed' || delivery.client_confirmed_at) {
    return htmlResponse(
      200,
      'Confirmado',
      `<h1 class="ok">Ya confirmado. Gracias.</h1>
       <p>La recepcion del Statement of Compliance ya quedo registrada previamente.</p>
       <div class="ref">Referencia: ${delivery.id}</div>`,
    )
  }

  const nowIso = new Date().toISOString()

  // Marcar delivery como confirmada
  const { error: updDelErr } = await admin
    .from('doa_project_deliveries' as never)
    .update({
      dispatch_status: 'client_confirmed',
      client_confirmed_at: nowIso,
    } as never)
    .eq('id', delivery.id)

  if (updDelErr) {
    console.error('confirmar-delivery update error:', updDelErr)
    return htmlResponse(
      500,
      'Error',
      `<h1 class="err">Error internal</h1>
       <p>No se pudo registrar la confirmacion. Intentalo de new en unos minutos.</p>`,
    )
  }

  // Obtener project para leer project_number y el status actual
  const { data: project } = await admin
    .from('doa_projects')
    .select('id, project_number, title, execution_status')
    .eq('id', id)
    .maybeSingle()

  const proyectoRow = project as {
    id: string
    project_number: string | null
    title: string | null
    execution_status: string | null
  } | null

  // Transitar project solo si esta en delivered
  if (proyectoRow && proyectoRow.execution_status === PROJECT_EXECUTION_STATES.DELIVERED) {
    const { error: proyectoUpdateErr } = await admin
      .from('doa_projects' as never)
      .update({
        execution_status: PROJECT_EXECUTION_STATES.CLIENT_CONFIRMATION,
        current_phase: PROJECT_EXECUTION_PHASES.DELIVERY,
        status_updated_at: nowIso,
      } as never)
      .eq('id', id)

    if (proyectoUpdateErr) {
      console.error('confirmar-delivery: project transition failed:', proyectoUpdateErr)
      await logServerEvent({
        eventName: 'project.delivery.confirmed',
        eventCategory: 'project',
        outcome: 'failure',
        severity: 'error',
        actorUserId: null,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'project',
        entityId: id,
        metadata: {
          stage: 'transition_state',
          delivery_id: delivery.id,
          intended_state: PROJECT_EXECUTION_STATES.CLIENT_CONFIRMATION,
          error_message: proyectoUpdateErr.message,
          source: 'client_link',
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
    }
  }

  await logServerEvent({
    eventName: 'project.delivery.confirmed',
    eventCategory: 'project',
    outcome: 'success',
    actorUserId: null,
    requestId: requestContext.requestId,
    route: requestContext.route,
    method: request.method,
    entityType: 'project',
    entityId: id,
    metadata: {
      delivery_id: delivery.id,
      source: 'client_link',
      confirmed_at: nowIso,
    },
    userAgent: requestContext.userAgent,
    ipAddress: requestContext.ipAddress,
    referrer: requestContext.referrer,
  })

  const projectRef =
    proyectoRow?.project_number ?? proyectoRow?.title ?? delivery.project_id

  return htmlResponse(
    200,
    'Recepcion confirmada',
    `<h1 class="ok">Gracias por confirmar la recepcion</h1>
     <p>Hemos registrado que recibiste el Statement of Compliance.</p>
     <p>Tu confirmacion queda archivada como parte de la evidencia no repudiable del project.</p>
     <div class="ref">Project: ${projectRef}<br/>Delivery: ${delivery.id}</div>`,
  )
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return handle(request, context)
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return handle(request, context)
}
