alter table if exists public.doa_consultas_entrantes
  add column if not exists estado text not null default 'nuevo',
  add column if not exists correo_cliente_enviado_at timestamptz,
  add column if not exists correo_cliente_enviado_by uuid,
  add column if not exists ultimo_borrador_cliente text;

create index if not exists doa_consultas_entrantes_estado_idx
  on public.doa_consultas_entrantes (estado);
