/**
 * ============================================================================
 * Precedentes reindex helper (Sprint 4 — close the loop) — Fase 6 rewrite
 * ============================================================================
 *
 * Migrado de Pinecone HTTP -> pgvector local en `ams-postgres-app`.
 *
 * (Re)indexa un unico proyecto archivado/cerrado en la tabla
 * `proyectos_embeddings` (vector(3072)) para que futuras consultas /
 * proyectos puedan recuperarlo como precedente via el RPC
 * `match_proyectos_precedentes`.
 *
 * Decisiones:
 *   - Reutilizamos la tabla existente con `chunk_idx = 0` para resumenes
 *     Sprint-4. Se distingue de chunks legacy (backfill-precedentes.mjs) via
 *     `metadata->>'kind' = 'sprint4_summary'`.
 *   - La dimension del embedding se mantiene en 3072 (text-embedding-3-large
 *     via LiteLLM alias `embedding-cloud-3-large`) — coincide con la columna
 *     vector(3072) existente, asi evitamos un re-embedding masivo.
 *   - Idempotencia: ON CONFLICT (project_number, chunk_idx) DO UPDATE (emulado
 *     por supabase-js `upsert({ onConflict: 'project_number,chunk_idx' })`).
 *   - Ya no hay fail-soft por env var faltante: si LiteLLM no responde, el
 *     reindex falla y la UI mostrara el error — LiteLLM tiene su propio
 *     fallback cloud para el alias de embeddings.
 *
 * Record schema en metadata (jsonb):
 *   {
 *     kind: 'sprint4_summary',
 *     estado_v2, outcome,
 *     lecciones_count, deliverables_count,
 *     validaciones_aprobadas, validaciones_devueltas, entregas_confirmadas,
 *     cliente_id, created_at, tags[]
 *   }
 */

import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { getLiteLLM, MODEL_EMBEDDING_CLOUD } from '@/lib/llm/litellm-client'
import type { ProyectoEmbeddingInsert } from '@/types/database'

type ReindexOk = { upserted: true; record_id: string }
type ReindexSkipped = { upserted: false; reason: string }
export type ReindexResult = ReindexOk | ReindexSkipped

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
    .from('proyectos')
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
      .from('project_deliverables')
      .select('titulo, template_code, subpart_easa, estado')
      .eq('proyecto_id', proyectoId),
    admin
      .from('project_validations')
      .select('decision')
      .eq('proyecto_id', proyectoId),
    admin
      .from('project_deliveries')
      .select('dispatch_status')
      .eq('proyecto_id', proyectoId),
    admin
      .from('project_closures')
      .select('outcome, metrics')
      .eq('proyecto_id', proyectoId)
      .maybeSingle(),
    admin
      .from('project_lessons')
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

  // 3) Embed via LiteLLM (3072 dim, text-embedding-3-large).
  let embedding: number[]
  try {
    const llm = getLiteLLM()
    const resp = await llm.embeddings.create({
      model: MODEL_EMBEDDING_CLOUD,
      input: text,
    })
    const vec = resp.data?.[0]?.embedding
    if (!Array.isArray(vec) || vec.length === 0) {
      return {
        upserted: false,
        reason: 'embed_empty_vector',
      }
    }
    embedding = vec as number[]
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      upserted: false,
      reason: `embed_failed:${msg.slice(0, 200)}`,
    }
  }

  // 4) Upsert en proyectos_embeddings (pgvector). Reusamos chunk_idx=0
  //    para el resumen Sprint-4; metadata.kind distingue de chunks legacy.
  // NOTA: cast a `any` en `.from()` porque la tabla `proyectos_embeddings`
  //       no está en los tipos generados (`types/database.ts`). La tabla se
  //       crea via migracion (202604081200_create_proyectos_embeddings.sql)
  //       pero los tipos no se han regenerado aun. El runtime valida el schema
  //       a traves de Postgres, así que el cast es seguro.
  const projectNumber = p.numero_proyecto ?? p.id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyAdmin = admin as any
  const { error: upsertErr } = await anyAdmin
    .from('proyectos_embeddings')
    .upsert(
      {
        project_number: projectNumber,
        project_title: p.titulo,
        chunk_idx: 0,
        chunk_text: text,
        embedding, // supabase-js serializa number[] -> vector
        metadata: {
          kind: 'sprint4_summary',
          proyecto_id: p.id,
          estado_v2: p.estado_v2,
          outcome: closure?.outcome ?? null,
          lecciones_count: lessons.length,
          deliverables_count: deliverables.length,
          validaciones_aprobadas: validacionesAprobadas,
          validaciones_devueltas: validacionesDevueltas,
          entregas_confirmadas: entregasConfirmadas,
          cliente_id: p.client_id,
          created_at: p.created_at,
          tags: Array.from(allTags),
        },
      },
      { onConflict: 'project_number,chunk_idx' },
    )

  if (upsertErr) {
    return {
      upserted: false,
      reason: `pgvector_upsert_failed:${(upsertErr as { message?: string }).message?.slice(0, 200) ?? 'unknown'}`,
    }
  }

  return { upserted: true, record_id: p.id }
}
