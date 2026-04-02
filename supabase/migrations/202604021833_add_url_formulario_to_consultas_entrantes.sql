alter table if exists public.doa_consultas_entrantes
  add column if not exists url_formulario text;
