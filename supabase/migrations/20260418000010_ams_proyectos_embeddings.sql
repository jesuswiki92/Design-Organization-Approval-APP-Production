-- ============================================================================
-- Migration: Create ams_proyectos_embeddings + match_proyectos_precedentes RPC
-- Date: 2026-04-18
-- Part of: AMS migration (Phase D)
-- Description: Vector index of past PROJECT_SUMMARY.md files used to surface
--              similar precedent projects inside the project detail page.
--              Renamed from doa_* -> ams_*. Uses HNSW + halfvec(3072) so the
--              pgvector 2000-dim HNSW cap is bypassed by the halfvec cast.
-- ============================================================================

BEGIN;

create extension if not exists vector;

create table if not exists public.ams_proyectos_embeddings (
  id bigserial primary key,
  project_number text not null,
  project_title text,
  chunk_idx int not null,
  chunk_text text not null,
  embedding vector(3072) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_number, chunk_idx)
);

create index if not exists ams_proyectos_embeddings_project_number_idx
  on public.ams_proyectos_embeddings (project_number);

-- HNSW index via halfvec(3072) cast — bypasses pgvector's 2000-dim HNSW cap
-- on full-precision vectors. Same approach used elsewhere in Phase B.
create index if not exists idx_ams_proyectos_embeddings_embedding
  on public.ams_proyectos_embeddings
  using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

create or replace function public.match_proyectos_precedentes(
  query_embedding vector(3072),
  match_count int default 10,
  exclude_project text default null
) returns table (
  project_number text,
  project_title text,
  chunk_idx int,
  chunk_text text,
  similarity float,
  metadata jsonb
)
language sql stable
as $$
  select
    e.project_number,
    e.project_title,
    e.chunk_idx,
    e.chunk_text,
    1 - ((e.embedding::halfvec(3072)) <=> (query_embedding::halfvec(3072))) as similarity,
    e.metadata
  from public.ams_proyectos_embeddings e
  where exclude_project is null or e.project_number <> exclude_project
  order by (e.embedding::halfvec(3072)) <=> (query_embedding::halfvec(3072))
  limit match_count;
$$;

-- RLS: allow authenticated reads, block anon by default
alter table public.ams_proyectos_embeddings enable row level security;

drop policy if exists "authenticated_read_proyectos_embeddings" on public.ams_proyectos_embeddings;
create policy "authenticated_read_proyectos_embeddings"
  on public.ams_proyectos_embeddings
  for select
  to authenticated
  using (true);

COMMIT;
