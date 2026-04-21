create table if not exists public.doa_proyectos_historico (
  id uuid primary key default gen_random_uuid(),
  numero_proyecto text not null unique,
  titulo text not null,
  descripcion text null,
  cliente_nombre text null,
  estado text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint doa_proyectos_historico_numero_proyecto_check check (length(trim(numero_proyecto)) > 0),
  constraint doa_proyectos_historico_titulo_check check (length(trim(titulo)) > 0)
);

create index if not exists doa_proyectos_historico_cliente_nombre_idx
  on public.doa_proyectos_historico(cliente_nombre);

create index if not exists doa_proyectos_historico_created_at_idx
  on public.doa_proyectos_historico(created_at desc);
