create table if not exists public.doa_proyectos_historico_documentos (
  id uuid primary key default gen_random_uuid(),
  proyecto_historico_id uuid not null references public.doa_proyectos_historico(id) on delete cascade,
  familia_documento text not null,
  titulo text not null,
  codigo_documento text null,
  edicion text null,
  carpeta_documental text null,
  ruta_relativa_pdf text null,
  ruta_relativa_editable text null,
  es_obsoleto boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint doa_proyectos_historico_documentos_titulo_check
    check (btrim(titulo) <> ''),
  constraint doa_proyectos_historico_documentos_familia_check
    check (btrim(familia_documento) <> ''),
  constraint doa_proyectos_historico_documentos_ruta_check
    check (ruta_relativa_pdf is not null or ruta_relativa_editable is not null),
  constraint doa_proyectos_historico_documentos_unique
    unique (proyecto_historico_id, titulo, es_obsoleto)
);

create index if not exists doa_proyectos_historico_documentos_proyecto_idx
  on public.doa_proyectos_historico_documentos(proyecto_historico_id);

create index if not exists doa_proyectos_historico_documentos_familia_idx
  on public.doa_proyectos_historico_documentos(familia_documento);
