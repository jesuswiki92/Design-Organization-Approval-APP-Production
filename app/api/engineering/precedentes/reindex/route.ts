/**
 * POST /api/engineering/precedentes/reindex — Sprint 4
 *
 * Body: { proyecto_id?: string }
 *   - If proyecto_id is provided, reindex only that project.
 *   - Otherwise, reindex ALL projects in `cerrado | archivado_proyecto`
 *     (bounded to a safe limit; intended for manual refresh).
 *
 * Returns: { upserted: boolean, records: Array<{ proyecto_id, upserted, reason? }> }
 *
 * Fails-soft when Pinecone env vars are missing: logs a warn event, returns
 * upserted:false, still 200.
 */

import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { logServerEvent } from '@/lib/observability/server'
import { buildRequestContext } from '@/lib/observability/shared'
import { reindexPrecedente } from '@/lib/rag/precedentes'

export const runtime = 'nodejs'

const REINDEX_ALL_LIMIT = 200

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

export async function POST(request: NextRequest) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { user } = auth
  const requestContext = buildRequestContext(request)

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  } catch {
    body = {}
  }

  const proyectoId =
    typeof body.proyecto_id === 'string' && body.proyecto_id.trim()
      ? body.proyecto_id.trim()
      : null

  // Resolve target list
  let targets: string[] = []
  if (proyectoId) {
    targets = [proyectoId]
  } else {
    try {
      const admin = createAdminClient()
      const { data, error } = await admin
        .from('proyectos')
        .select('id')
        .in('estado_v2', ['cerrado', 'archivado_proyecto'])
        .order('estado_updated_at', { ascending: false })
        .limit(REINDEX_ALL_LIMIT)
      if (error) {
        return jsonResponse(500, { error: error.message })
      }
      targets = ((data ?? []) as Array<{ id: string }>).map((r) => r.id)
    } catch (e) {
      return jsonResponse(500, {
        error:
          'Admin client no disponible para reindex masivo: ' +
          (e instanceof Error ? e.message : 'unknown'),
      })
    }
  }

  const records: Array<{
    proyecto_id: string
    upserted: boolean
    reason?: string
  }> = []

  let anyUpserted = false
  for (const id of targets) {
    try {
      const r = await reindexPrecedente(id)
      if (r.upserted) {
        anyUpserted = true
        records.push({ proyecto_id: id, upserted: true })
      } else {
        records.push({ proyecto_id: id, upserted: false, reason: r.reason })
      }
    } catch (e) {
      records.push({
        proyecto_id: id,
        upserted: false,
        reason:
          'exception:' + (e instanceof Error ? e.message : 'unknown'),
      })
    }
  }

  await logServerEvent({
    eventName: anyUpserted
      ? 'precedentes.reindex.done'
      : 'precedentes.reindex.failed',
    eventCategory: 'precedentes',
    outcome: anyUpserted ? 'success' : 'failure',
    severity: anyUpserted ? 'info' : 'warn',
    actorUserId: user.id,
    requestId: requestContext.requestId,
    route: requestContext.route,
    method: request.method,
    entityType: proyectoId ? 'proyecto' : null,
    entityId: proyectoId ?? null,
    metadata: {
      targets_count: targets.length,
      upserted_count: records.filter((r) => r.upserted).length,
      skipped_count: records.filter((r) => !r.upserted).length,
    },
    userAgent: requestContext.userAgent,
    ipAddress: requestContext.ipAddress,
    referrer: requestContext.referrer,
  })

  return jsonResponse(200, {
    upserted: anyUpserted,
    records,
  })
}
