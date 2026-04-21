/**
 * POST /api/projects/[id]/archive — Sprint 4
 *
 * Archiva un project que esta en `closed`. Transiciona a
 * `project_archived`, dispara reindex de precedentes (fail-soft) y refresca
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
    if (!id) return jsonResponse(400, { error: 'project_id requerido.' })

    const { data: project, error: proyectoError } = await supabase
      .from('doa_projects')
      .select('id, project_number, execution_status')
      .eq('id', id)
      .maybeSingle()

    if (proyectoError) return jsonResponse(500, { error: proyectoError.message })
    if (!project) return jsonResponse(404, { error: 'Project no encontrado.' })

    const p = project as { id: string; project_number: string | null; execution_status: string | null }
    if (p.execution_status !== PROJECT_EXECUTION_STATES.CLOSED) {
      return jsonResponse(409, {
        error:
          `El project no esta en "closed" (status actual: "${p.execution_status ?? 'desconocido'}").`,
        current_state: p.execution_status,
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
      .from('doa_projects' as never)
      .update({
        execution_status: PROJECT_EXECUTION_STATES.PROJECT_ARCHIVED,
        current_phase: PROJECT_EXECUTION_PHASES.CLOSURE,
        status_updated_at: nowIso,
        status_updated_by: user.id,
      } as never)
      .eq('id', id)
      .select('id, project_number, execution_status, current_phase, status_updated_at')
      .single()

    if (updateError) {
      return jsonResponse(500, {
        error: `No se pudo transicionar a "project_archived": ${updateError.message}.`,
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
        eventName: 'project.archive.reindex_failed',
        eventCategory: 'project',
        outcome: 'failure',
        severity: 'warn',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'project',
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
        eventName: 'project.archive.mv_refresh_failed',
        eventCategory: 'project',
        outcome: 'failure',
        severity: 'warn',
        actorUserId: user.id,
        requestId: requestContext.requestId,
        route: requestContext.route,
        method: request.method,
        entityType: 'project',
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
      eventName: 'project.archive.done',
      eventCategory: 'project',
      outcome: 'success',
      actorUserId: user.id,
      requestId: requestContext.requestId,
      route: requestContext.route,
      method: request.method,
      entityType: 'project',
      entityId: id,
      metadata: {
        from_state: PROJECT_EXECUTION_STATES.CLOSED,
        to_state: PROJECT_EXECUTION_STATES.PROJECT_ARCHIVED,
        reindex_upserted: reindexUpserted,
        mv_refreshed: mvRefreshed,
      },
      userAgent: requestContext.userAgent,
      ipAddress: requestContext.ipAddress,
      referrer: requestContext.referrer,
    })

    return jsonResponse(200, {
      project: updated,
      reindex: { upserted: reindexUpserted, reason: reindexReason },
      mv_refreshed: mvRefreshed,
    })
  } catch (error) {
    console.error('archive POST error:', error)
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Error inesperado.',
    })
  }
}
