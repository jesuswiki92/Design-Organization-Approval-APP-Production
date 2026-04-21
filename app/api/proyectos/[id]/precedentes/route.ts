import { requireUserApi } from '@/lib/auth/require-user';
import { embedText } from '@/lib/rag/embed';
import { NextResponse } from 'next/server';

type Precedente = {
  project_number: string;
  project_title: string | null;
  score: number;
  classification: string | null;
  cert_basis: string | null;
  family: string | null;
  doc_pack: string[] | null;
  source_path: string | null;
  snippet: string | null;
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserApi();
  if (auth instanceof Response) return auth;
  const { supabase } = auth;
  const { id } = await params;

  // 1) Fetch project metadata
  const { data: project, error: projErr } = await supabase
    .from('doa_proyectos')
    .select('numero_proyecto, titulo, descripcion, aeronave, modelo, tcds_code')
    .eq('id', id)
    .maybeSingle();

  if (projErr) {
    return NextResponse.json({ error: 'DB error fetching project' }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // 2) Build query text
  const queryParts = [
    project.titulo,
    project.descripcion,
    project.aeronave,
    project.modelo,
    project.tcds_code,
  ].filter(Boolean);
  const queryText = queryParts.join(' ').trim();
  if (!queryText) {
    return NextResponse.json({ results: [] });
  }

  // 3) Embed query
  let embedding: number[];
  try {
    embedding = await embedText(queryText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { error: 'Embeddings not configured: OPENAI_API_KEY missing' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'Embedding failed', detail: msg }, { status: 502 });
  }

  // 4) RPC vector search
  const { data: hits, error: rpcErr } = await supabase.rpc('match_proyectos_precedentes', {
    query_embedding: embedding,
    match_count: 12,
    exclude_project: project.numero_proyecto,
  });

  if (rpcErr) {
    // The RPC may not exist yet (migration not applied). Surface that clearly.
    const msg = rpcErr.message || '';
    if (msg.toLowerCase().includes('match_proyectos_precedentes') || msg.toLowerCase().includes('not found')) {
      return NextResponse.json(
        { error: 'Precedentes index not initialized. Apply migration and run backfill.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'Vector search failed', detail: msg }, { status: 500 });
  }

  // 5) Group hits by project_number, take top 3 by best chunk score
  type Hit = {
    project_number: string;
    project_title: string | null;
    chunk_idx: number;
    chunk_text: string;
    similarity: number;
    metadata: Record<string, unknown> | null;
  };
  const grouped = new Map<string, Hit>();
  for (const h of (hits ?? []) as Hit[]) {
    const cur = grouped.get(h.project_number);
    if (!cur || h.similarity > cur.similarity) {
      grouped.set(h.project_number, h);
    }
  }
  const top3: Precedente[] = Array.from(grouped.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)
    .map((h) => {
      const meta = (h.metadata ?? {}) as Record<string, unknown>;
      return {
        project_number: h.project_number,
        project_title: h.project_title,
        score: h.similarity,
        classification: typeof meta.classification === 'string' ? meta.classification : null,
        cert_basis: typeof meta.cert_basis === 'string' ? meta.cert_basis : null,
        family: typeof meta.family === 'string' ? meta.family : null,
        doc_pack: Array.isArray(meta.doc_pack) ? (meta.doc_pack as string[]) : null,
        source_path: typeof meta.source_path === 'string' ? meta.source_path : null,
        snippet: h.chunk_text?.slice(0, 240) ?? null,
      };
    });

  return NextResponse.json({ results: top3, indexed_count: (hits?.length ?? 0) > 0 ? null : 0 });
}
