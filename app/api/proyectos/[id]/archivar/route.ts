/**
 * POST /api/proyectos/[id]/archivar — Sprint 4
 *
 * Archiva un proyecto que esta en `cerrado`. Transiciona a
 * `archivado_proyecto`, dispara reindex de precedentes (fail-soft) y refresca
 * la materialized view de metricas (fail-soft).
 */

import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import { reindexPrecedente } from '@/lib/rag/precedentes'
import {
  PROJECT_EXECUTION_PHASES,
  PROJECT_EXECUTION_STATES,
} from '@/lib/workflow-states'

export const runtime = 'nodejs'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

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

    const { data: proyecto, error: proyectoError } = await supabase
      .from('doa_proyectos')
      .select('id, numero_proyecto, estado_v2')
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!proyecto) return jsonResponse(404, { error: 'Proyecto no encontrado.' })

    const p = proyecto as { id: string; numero_proyecto: string | null; estado_v2: string | null }
    if (p.estado_v2 !== PROJECT_EXECUTION_STATES.CERRADO) {
      return jsonResponse(409, {
        error:
          `El proyecto no esta en "cerrado" (estado actual: "${p.estado_v2 ?? 'desconocido'}").`,
        current_state: p.estado_v2,
      })
    }

    let admin: ReturnType<typeof createAdminClient>
    try {
      admin = createAdminClient()
    } catch (e) {
      return jsonResponse(500, {
        error:
          'Admin client no disponible. Configura SUPABASE_SERVICE_ROLE_KEY. ' +
          (e instanceof Error ? e.message : ''),
      })
    }

    const nowIso = new Date().toISOString()
    const { data: updated, error: updateError } = await admin
      .from('doa_proyectos' as never)
      .update({
        estado_v2: PROJECT_EXECUTION_STATES.ARCHIVADO_PROYECTO,
        fase_actual: PROJECT_EXECUTION_PHASES.CIERRE,
        estado_updated_at: nowIso,
        estado_updated_by: user.id,
      } as never)
      .eq('id', id)
      .select('id, numero_proyecto, estado_v2, fase_actual, estado_updated_at')
      .single()

    if (updateError) {
      return jsonResponse(500, {
        error: `No se pudo transicionar a "archivado_proyecto": ${updateError.message}.`,
      })
    }

    // Reindex precedentes (fail-soft).
    let reindexUpserted = false
    let reindexReason: string | null = null
    try {
      const r = await reindexPrecedente(id)
      reindexUpserted = r.upserted
      if (!r.upserted) reindexReason = r.reason
    } catch (e) {
      reindexReason = 'exception:' + (e instanceof Error ? e.message : 'unknown')
    }

    if (!reindexUpserted) {
      await logServerEvent({
        eventName: 'project.archivar.reindex_failed',
        eventCategory: 'project',
        outcome: 'failure',
        severity: 'warn',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'proyecto',
        entityId: id,
        metadata: {
          reason: reindexReason,
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
    }

    // Refresh MV (fail-soft).
    let mvRefreshed = false
    let mvError: string | null = null
    try {
      const { error: rpcErr } = await admin.rpc('refresh_doa_project_metrics_mv')
      if (rpcErr) {
        // Fallback: try raw SQL via a generic exec helper if available; else skip.
        mvError = rpcErr.message
      } else {
        mvRefreshed = true
      }
    } catch (e) {
      mvError = e instanceof Error ? e.message : 'unknown'
    }

    if (!mvRefreshed) {
      await logServerEvent({
        eventName: 'project.archivar.mv_refresh_failed',
        eventCategory: 'project',
        outcome: 'failure',
        severity: 'warn',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'proyecto',
        entityId: id,
        metadata: {
          error_message: mvError,
          // TODO(sprint-4+): create rpc refresh_doa_project_metrics_mv() SECURITY DEFINER
          //   that runs REFRESH MATERIALIZED VIEW CONCURRENTLY doa_project_metrics_mv;
          //   otherwise this will always log warn until the MV exists and the RPC is created.
        },
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        referrer: requestContext.referrer,
      })
    }

    await logServerEvent({
      eventName: 'project.archivar.done',
      eventCategory: 'project',
      outcome: 'success',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'proyecto',
      entityId: id,
      metadata: {
        from_state: PROJECT_EXECUTION_STATES.CERRADO,
        to_state: PROJECT_EXECUTION_STATES.ARCHIVADO_PROYECTO,
        reindex_upserted: reindexUpserted,
        mv_refreshed: mvRefreshed,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, {
      proyecto: updated,
      reindex: { upserted: reindexUpserted, reason: reindexReason },
      mv_refreshed: mvRefreshed,
    })
  } catch (error) {
    console.error('archivar POST error:', error)
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Error inesperado.',
    })
  }
}
