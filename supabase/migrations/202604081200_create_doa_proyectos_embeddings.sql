-- ============================================================================
-- Migration: Create doa_proyectos_embeddings + match_proyectos_precedentes RPC
-- Date: 2026-04-08
-- Part of: precedentes-panel
-- Description: Vector index of past PROJECT_SUMMARY.md files used to surface
--              similar precedent projects inside the project detail page.
--              Apply manually via Supabase SQL editor.
-- ============================================================================

create extension if not exists vector;

create table if not exists public.doa_proyectos_embeddings (
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

create index if not exists doa_proyectos_embeddings_project_number_idx
  on public.doa_proyectos_embeddings (project_number);

-- Note: pgvector ivfflat/hnsw indexes cap at 2000 dims; we use sequential scan
-- for the 3072-dim embeddings (text-embedding-3-large). Dataset is small
-- (~260 chunks across 26 projects), so seq-scan is fine — same approach as
-- doa_tcds_embeddings.

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
    1 - (e.embedding <=> query_embedding) as similarity,
    e.metadata
  from public.doa_proyectos_embeddings e
  where exclude_project is null or e.project_number <> exclude_project
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- RLS: allow authenticated reads, block anon by default
alter table public.doa_proyectos_embeddings enable row level security;

drop policy if exists "authenticated_read_proyectos_embeddings" on public.doa_proyectos_embeddings;
create policy "authenticated_read_proyectos_embeddings"
  on public.doa_proyectos_embeddings
  for select
  to authenticated
  using (true);
