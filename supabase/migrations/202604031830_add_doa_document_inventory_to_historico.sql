create table if not exists public.doa_proyectos_historico_documentos (
  id uuid primary key default gen_random_uuid(),
  proyecto_historico_id uuid not null references public.doa_proyectos_historico(id) on delete cascade,
  orden_documental integer null,
  familia_documental text not null,
  carpeta_origen text not null,
  ruta_origen text not null,
  archivo_referencia text null,
  total_archivos integer not null default 0,
  formatos_disponibles text[] not null default '{}',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint doa_proyectos_historico_documentos_familia_check
    check (length(trim(familia_documental)) > 0),
  constraint doa_proyectos_historico_documentos_carpeta_check
    check (length(trim(carpeta_origen)) > 0),
  constraint doa_proyectos_historico_documentos_ruta_check
    check (length(trim(ruta_origen)) > 0),
  constraint doa_proyectos_historico_documentos_total_archivos_check
    check (total_archivos >= 0)
);

create unique index if not exists doa_proyectos_historico_documentos_project_folder_uidx
  on public.doa_proyectos_historico_documentos (proyecto_historico_id, carpeta_origen);

create index if not exists doa_proyectos_historico_documentos_project_idx
  on public.doa_proyectos_historico_documentos (proyecto_historico_id);

create index if not exists doa_proyectos_historico_documentos_order_idx
  on public.doa_proyectos_historico_documentos (orden_documental, familia_documental);

create or replace function public.doa_proyectos_historico_documentos_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists doa_proyectos_historico_documentos_set_updated_at
  on public.doa_proyectos_historico_documentos;

create trigger doa_proyectos_historico_documentos_set_updated_at
before update on public.doa_proyectos_historico_documentos
for each row
execute function public.doa_proyectos_historico_documentos_set_updated_at();
