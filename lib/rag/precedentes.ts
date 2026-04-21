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
 *     doa_project_embeddings table used by
 *     app/api/projects/[id]/precedentes/route.ts). Both can coexist.
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
 *     _id: <project_id>,
 *     text: <structured summary>,
 *     project_id: <uuid>,
 *     project_number: string,
 *     title: string,
 *     client_id: string | null,
 *     execution_status: string,
 *     outcome: string | null,
 *     lessons_count: number,
 *     deliverables_count: number,
 *     validations_approved: number,
 *     validations_returned: number,
 *     created_at: string,
 *     tags: string[],
 *   }
 *
 * NOTE: the legacy doa_project_embeddings (OpenAI based) is untouched; this
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
  title: string
  project_number: string | null
  client_id: string | null
  description: string | null
  outcome: string | null
  deliverables: Array<{ title: string; template_code: string | null; subpart_easa: string | null }>
  validations_approved: number
  validations_returned: number
  deliveries_confirmed: number
  lecciones: Array<{ category: string; type: string; title: string; description: string }>
}): string {
  const deliverablesLine = parts.deliverables
    .slice(0, 15)
    .map((d) => {
      const code = d.template_code ? `${d.template_code} ` : ''
      const subp = d.subpart_easa ? ` [${d.subpart_easa}]` : ''
      return `${code}${d.title}${subp}`
    })
    .join('; ')

  const leccionesLine = parts.lecciones
    .slice(0, 20)
    .map(
      (l) =>
        `(${l.category}/${l.type}) ${l.title}: ${l.description.slice(0, 200)}`,
    )
    .join(' | ')

  return [
    `Project ${parts.project_number ?? '(sin numero)'} — ${parts.title}.`,
    parts.client_id ? `Client: ${parts.client_id}.` : null,
    parts.description ? `Description: ${parts.description}.` : null,
    parts.outcome ? `Outcome de closure: ${parts.outcome}.` : null,
    `Validaciones: ${parts.validations_approved} aprobadas, ${parts.validations_returned} devueltas.`,
    `Entregas confirmadas por client: ${parts.deliveries_confirmed}.`,
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
    .from('doa_projects')
    .select(
      'id, project_number, title, description, client_id, execution_status, current_phase, created_at',
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
    project_number: string | null
    title: string
    description: string | null
    client_id: string | null
    execution_status: string | null
    current_phase: string | null
    created_at: string
  }

  if (
    p.execution_status !== 'closed' &&
    p.execution_status !== 'project_archived'
  ) {
    return {
      upserted: false,
      reason: `project_not_closed_or_archived:${p.execution_status ?? 'null'}`,
    }
  }

  // 2) Load related context
  const [delRes, valRes, entRes, closureRes, lessonsRes] = await Promise.all([
    admin
      .from('doa_project_deliverables')
      .select('title, template_code, subpart_easa, status')
      .eq('project_id', proyectoId),
    admin
      .from('doa_project_validations')
      .select('decision')
      .eq('project_id', proyectoId),
    admin
      .from('doa_project_deliveries')
      .select('dispatch_status')
      .eq('project_id', proyectoId),
    admin
      .from('doa_project_closures')
      .select('outcome, metrics')
      .eq('project_id', proyectoId)
      .maybeSingle(),
    admin
      .from('doa_project_lessons')
      .select('category, type, title, description, tags')
      .eq('project_id', proyectoId),
  ])

  const deliverables = (delRes.data ?? []) as Array<{
    title: string
    template_code: string | null
    subpart_easa: string | null
    status: string
  }>
  const vals = (valRes.data ?? []) as Array<{ decision: string }>
  const ents = (entRes.data ?? []) as Array<{ dispatch_status: string }>
  const closure = (closureRes.data ?? null) as
    | { outcome: string | null; metrics: Record<string, unknown> | null }
    | null
  const lessons = (lessonsRes.data ?? []) as Array<{
    category: string
    type: string
    title: string
    description: string
    tags: string[] | null
  }>

  const allTags = new Set<string>()
  for (const l of lessons) {
    if (l.tags) for (const t of l.tags) allTags.add(t)
  }

  const validacionesAprobadas = vals.filter((v) => v.decision === 'approved').length
  const validacionesDevueltas = vals.filter((v) => v.decision === 'returned').length
  const entregasConfirmadas = ents.filter(
    (e) => e.dispatch_status === 'client_confirmed',
  ).length

  const text = composeText({
    title: p.title,
    project_number: p.project_number,
    client_id: p.client_id,
    description: p.description,
    outcome: closure?.outcome ?? null,
    deliverables,
    validations_approved: validacionesAprobadas,
    validations_returned: validacionesDevueltas,
    deliveries_confirmed: entregasConfirmadas,
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
    project_id: p.id,
    project_number: p.project_number ?? '',
    title: p.title,
    client_id: p.client_id ?? '',
    execution_status: p.execution_status ?? '',
    outcome: closure?.outcome ?? '',
    lessons_count: lessons.length,
    deliverables_count: deliverables.length,
    validations_approved: validacionesAprobadas,
    validations_returned: validacionesDevueltas,
    deliveries_confirmed: entregasConfirmadas,
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
