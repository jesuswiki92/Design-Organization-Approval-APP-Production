/**
 * ============================================================================
 * Precedentes reindex helper (Sprint 4 — close the loop)
 * ============================================================================
 *
 * Minimal helper to (re)index a single archived/closed project into a
 * Pinecone-backed "precedentes" vector index so future quotations / projects
 * can retrieve it as a structured precedent.
 *
 * Design decisions:
 *   - This is the "new" precedentes index (separate from the OpenAI-embedded
 *     doa_proyectos_embeddings table used by
 *     app/api/proyectos/[id]/precedentes/route.ts). Both can coexist.
 *   - Uses the Pinecone records API (integrated embedding via the index's
 *     fieldMap) — the app does NOT embed locally. The index must be created
 *     with an embedding model already attached (see Pinecone "Integrated
 *     Embedding" indexes).
 *   - Env vars:
 *       PINECONE_API_KEY           — required to push upserts. If missing,
 *                                    reindex logs a warn and returns
 *                                    { upserted: false }, NOT a fatal error.
 *       PINECONE_INDEX_HOST        — the index host, e.g.
 *                                    https://doa-precedentes-xxxx.svc.region.pinecone.io
 *                                    (found in the Pinecone console for the
 *                                    index — "Connect -> Host").
 *       PINECONE_INDEX_PRECEDENTES — the index name (informational; not used
 *                                    for the HTTP call but kept for logs).
 *       PINECONE_NAMESPACE         — optional, defaults to '__default__'.
 *   - If the index uses a fieldMap text field different from 'text', set
 *     PINECONE_PRECEDENTES_TEXT_FIELD. Defaults to 'text'.
 *
 * Record schema (consistent across calls):
 *   {
 *     _id: <proyecto_id>,
 *     text: <structured summary>,
 *     proyecto_id: <uuid>,
 *     numero_proyecto: string,
 *     titulo: string,
 *     cliente_id: string | null,
 *     estado_v2: string,
 *     outcome: string | null,
 *     lecciones_count: number,
 *     deliverables_count: number,
 *     validaciones_aprobadas: number,
 *     validaciones_devueltas: number,
 *     created_at: string,
 *     tags: string[],
 *   }
 *
 * NOTE: the legacy doa_proyectos_embeddings (OpenAI based) is untouched; this
 * helper is the Sprint 4 channel to Pinecone.
 */

import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

type ReindexOk = { upserted: true; record_id: string }
type ReindexSkipped = { upserted: false; reason: string }
export type ReindexResult = ReindexOk | ReindexSkipped

const DEFAULT_TEXT_FIELD = 'text'
const DEFAULT_NAMESPACE = '__default__'

function composeText(parts: {
  titulo: string
  numero_proyecto: string | null
  cliente_id: string | null
  descripcion: string | null
  outcome: string | null
  deliverables: Array<{ titulo: string; template_code: string | null; subpart_easa: string | null }>
  validaciones_aprobadas: number
  validaciones_devueltas: number
  entregas_confirmadas: number
  lecciones: Array<{ categoria: string; tipo: string; titulo: string; descripcion: string }>
}): string {
  const deliverablesLine = parts.deliverables
    .slice(0, 15)
    .map((d) => {
      const code = d.template_code ? `${d.template_code} ` : ''
      const subp = d.subpart_easa ? ` [${d.subpart_easa}]` : ''
      return `${code}${d.titulo}${subp}`
    })
    .join('; ')

  const leccionesLine = parts.lecciones
    .slice(0, 20)
    .map(
      (l) =>
        `(${l.categoria}/${l.tipo}) ${l.titulo}: ${l.descripcion.slice(0, 200)}`,
    )
    .join(' | ')

  return [
    `Proyecto ${parts.numero_proyecto ?? '(sin numero)'} — ${parts.titulo}.`,
    parts.cliente_id ? `Cliente: ${parts.cliente_id}.` : null,
    parts.descripcion ? `Descripcion: ${parts.descripcion}.` : null,
    parts.outcome ? `Outcome de cierre: ${parts.outcome}.` : null,
    `Validaciones: ${parts.validaciones_aprobadas} aprobadas, ${parts.validaciones_devueltas} devueltas.`,
    `Entregas confirmadas por cliente: ${parts.entregas_confirmadas}.`,
    deliverablesLine ? `Deliverables principales: ${deliverablesLine}.` : null,
    leccionesLine ? `Lecciones clave: ${leccionesLine}.` : null,
  ]
    .filter(Boolean)
    .join(' ')
}

export async function reindexPrecedente(
  proyectoId: string,
): Promise<ReindexResult> {
  const admin = createAdminClient()

  // 1) Load project
  const { data: projectRow, error: projErr } = await admin
    .from('doa_proyectos')
    .select(
      'id, numero_proyecto, titulo, descripcion, client_id, estado_v2, fase_actual, created_at',
    )
    .eq('id', proyectoId)
    .maybeSingle()

  if (projErr || !projectRow) {
    return {
      upserted: false,
      reason: `project_not_found: ${projErr?.message ?? proyectoId}`,
    }
  }

  const p = projectRow as {
    id: string
    numero_proyecto: string | null
    titulo: string
    descripcion: string | null
    client_id: string | null
    estado_v2: string | null
    fase_actual: string | null
    created_at: string
  }

  if (
    p.estado_v2 !== 'cerrado' &&
    p.estado_v2 !== 'archivado_proyecto'
  ) {
    return {
      upserted: false,
      reason: `project_not_closed_or_archived:${p.estado_v2 ?? 'null'}`,
    }
  }

  // 2) Load related context
  const [delRes, valRes, entRes, closureRes, lessonsRes] = await Promise.all([
    admin
      .from('doa_project_deliverables')
      .select('titulo, template_code, subpart_easa, estado')
      .eq('proyecto_id', proyectoId),
    admin
      .from('doa_project_validations')
      .select('decision')
      .eq('proyecto_id', proyectoId),
    admin
      .from('doa_project_deliveries')
      .select('dispatch_status')
      .eq('proyecto_id', proyectoId),
    admin
      .from('doa_project_closures')
      .select('outcome, metrics')
      .eq('proyecto_id', proyectoId)
      .maybeSingle(),
    admin
      .from('doa_project_lessons')
      .select('categoria, tipo, titulo, descripcion, tags')
      .eq('proyecto_id', proyectoId),
  ])

  const deliverables = (delRes.data ?? []) as Array<{
    titulo: string
    template_code: string | null
    subpart_easa: string | null
    estado: string
  }>
  const vals = (valRes.data ?? []) as Array<{ decision: string }>
  const ents = (entRes.data ?? []) as Array<{ dispatch_status: string }>
  const closure = (closureRes.data ?? null) as
    | { outcome: string | null; metrics: Record<string, unknown> | null }
    | null
  const lessons = (lessonsRes.data ?? []) as Array<{
    categoria: string
    tipo: string
    titulo: string
    descripcion: string
    tags: string[] | null
  }>

  const allTags = new Set<string>()
  for (const l of lessons) {
    if (l.tags) for (const t of l.tags) allTags.add(t)
  }

  const validacionesAprobadas = vals.filter((v) => v.decision === 'aprobado').length
  const validacionesDevueltas = vals.filter((v) => v.decision === 'devuelto').length
  const entregasConfirmadas = ents.filter(
    (e) => e.dispatch_status === 'confirmado_cliente',
  ).length

  const text = composeText({
    titulo: p.titulo,
    numero_proyecto: p.numero_proyecto,
    cliente_id: p.client_id,
    descripcion: p.descripcion,
    outcome: closure?.outcome ?? null,
    deliverables,
    validaciones_aprobadas: validacionesAprobadas,
    validaciones_devueltas: validacionesDevueltas,
    entregas_confirmadas: entregasConfirmadas,
    lecciones: lessons,
  })

  // 3) Push to Pinecone (if configured)
  const apiKey = process.env.PINECONE_API_KEY
  const indexHost = process.env.PINECONE_INDEX_HOST
  const textField = process.env.PINECONE_PRECEDENTES_TEXT_FIELD || DEFAULT_TEXT_FIELD
  const namespace = process.env.PINECONE_NAMESPACE || DEFAULT_NAMESPACE

  if (!apiKey || !indexHost) {
    return {
      upserted: false,
      reason: 'pinecone_env_missing:PINECONE_API_KEY_or_PINECONE_INDEX_HOST',
    }
  }

  const record: Record<string, unknown> = {
    _id: p.id,
    [textField]: text,
    proyecto_id: p.id,
    numero_proyecto: p.numero_proyecto ?? '',
    titulo: p.titulo,
    cliente_id: p.client_id ?? '',
    estado_v2: p.estado_v2 ?? '',
    outcome: closure?.outcome ?? '',
    lecciones_count: lessons.length,
    deliverables_count: deliverables.length,
    validaciones_aprobadas: validacionesAprobadas,
    validaciones_devueltas: validacionesDevueltas,
    entregas_confirmadas: entregasConfirmadas,
    created_at: p.created_at,
    tags: Array.from(allTags),
  }

  const url = `${indexHost.replace(/\/$/, '')}/records/namespaces/${encodeURIComponent(namespace)}/upsert`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/x-ndjson',
      'X-Pinecone-API-Version': '2025-01',
    },
    body: JSON.stringify(record) + '\n',
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return {
      upserted: false,
      reason: `pinecone_upsert_failed:${res.status}:${detail.slice(0, 160)}`,
    }
  }

  return { upserted: true, record_id: p.id }
}
