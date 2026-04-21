-- Limpieza de tablas legacy no usadas por la app actual
-- Nota: se usa CASCADE para evitar bloqueos por FKs o dependencias residuales.

drop table if exists public.doa_new_project_members cascade;
drop table if exists public.doa_new_documents cascade;
drop table if exists public.doa_new_tasks cascade;
drop table if exists public.doa_new_vector_documents cascade;
drop table if exists public.doa_new_projects cascade;
drop table if exists public.doa_new_clients cascade;
drop table if exists public.doa_new_aircraft cascade;
drop table if exists public.doa_new_profiles cascade;
