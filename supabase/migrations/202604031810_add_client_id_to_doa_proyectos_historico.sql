alter table if exists public.doa_proyectos_historico
  add column if not exists client_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'doa_proyectos_historico_client_id_fkey'
  ) then
    alter table public.doa_proyectos_historico
      add constraint doa_proyectos_historico_client_id_fkey
      foreign key (client_id)
      references public.doa_clientes_datos_generales(id)
      on delete set null;
  end if;
end
$$;

create index if not exists doa_proyectos_historico_client_id_idx
  on public.doa_proyectos_historico(client_id);

with mapping(numero_proyecto, client_id, cliente_nombre) as (
  values
    ('177001', 'dd5fa451-311c-475a-8c3c-c7cb2ccd3fae'::uuid, 'AeroLynx Regional Services S.A.'),
    ('20882', 'dd5fa451-311c-475a-8c3c-c7cb2ccd3fae'::uuid, 'AeroLynx Regional Services S.A.'),
    ('20885', 'dd5fa451-311c-475a-8c3c-c7cb2ccd3fae'::uuid, 'AeroLynx Regional Services S.A.'),
    ('208_090', 'dd5fa451-311c-475a-8c3c-c7cb2ccd3fae'::uuid, 'AeroLynx Regional Services S.A.'),
    ('208_091', 'dd5fa451-311c-475a-8c3c-c7cb2ccd3fae'::uuid, 'AeroLynx Regional Services S.A.'),
    ('208_092', 'dd5fa451-311c-475a-8c3c-c7cb2ccd3fae'::uuid, 'AeroLynx Regional Services S.A.'),
    ('208_093', 'dd5fa451-311c-475a-8c3c-c7cb2ccd3fae'::uuid, 'AeroLynx Regional Services S.A.'),
    ('208_094', 'dd5fa451-311c-475a-8c3c-c7cb2ccd3fae'::uuid, 'AeroLynx Regional Services S.A.'),
    ('320388', '11111111-0006-0006-0006-000000000006'::uuid, 'Volotea S.A.'),
    ('320_405', '11111111-0006-0006-0006-000000000006'::uuid, 'Volotea S.A.'),
    ('320_407', '11111111-0006-0006-0006-000000000006'::uuid, 'Volotea S.A.'),
    ('330237', '11111111-0005-0005-0005-000000000005'::uuid, 'TAP Air Portugal S.A.'),
    ('330_240', '11111111-0005-0005-0005-000000000005'::uuid, 'TAP Air Portugal S.A.'),
    ('330_243', '11111111-0005-0005-0005-000000000005'::uuid, 'TAP Air Portugal S.A.'),
    ('340035', '11111111-0005-0005-0005-000000000005'::uuid, 'TAP Air Portugal S.A.'),
    ('34034', '11111111-0005-0005-0005-000000000005'::uuid, 'TAP Air Portugal S.A.'),
    ('77729', '11111111-0005-0005-0005-000000000005'::uuid, 'TAP Air Portugal S.A.'),
    ('A3030', '11111111-0005-0005-0005-000000000005'::uuid, 'TAP Air Portugal S.A.'),
    ('A350_004', '11111111-0005-0005-0005-000000000005'::uuid, 'TAP Air Portugal S.A.'),
    ('B30_056', '11111111-0010-0010-0010-000000000010'::uuid, 'Swiftair S.A.'),
    ('B30_057', '11111111-0010-0010-0010-000000000010'::uuid, 'Swiftair S.A.'),
    ('B30_058', '11111111-0010-0010-0010-000000000010'::uuid, 'Swiftair S.A.'),
    ('GEX_135', '11111111-0010-0010-0010-000000000010'::uuid, 'Swiftair S.A.'),
    ('L60_028', '11111111-0010-0010-0010-000000000010'::uuid, 'Swiftair S.A.')
)
update public.doa_proyectos_historico p
set client_id = m.client_id,
    cliente_nombre = m.cliente_nombre,
    updated_at = timezone('utc'::text, now())
from mapping m
where p.numero_proyecto = m.numero_proyecto;
