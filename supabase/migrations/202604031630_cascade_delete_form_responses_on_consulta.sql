do $$
begin
  if exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'doa_respuestas_formularios'
      and con.conname = 'doa_respuestas_formularios_consulta_id_fkey'
  ) then
    alter table public.doa_respuestas_formularios
      drop constraint doa_respuestas_formularios_consulta_id_fkey;
  end if;
end
$$;

alter table public.doa_respuestas_formularios
  add constraint doa_respuestas_formularios_consulta_id_fkey
  foreign key (consulta_id)
  references public.doa_consultas_entrantes(id)
  on delete cascade;
