alter table if exists public.doa_proyectos_historico
  add column if not exists aeronave text,
  add column if not exists msn text;

create index if not exists doa_proyectos_historico_aeronave_idx
  on public.doa_proyectos_historico (aeronave);

create index if not exists doa_proyectos_historico_msn_idx
  on public.doa_proyectos_historico (msn);

update public.doa_proyectos_historico
set aeronave = 'Cessna 208B',
    msn = '933'
where numero_proyecto = '208_090';

update public.doa_proyectos_historico
set aeronave = 'Caravan 208',
    msn = '1238'
where numero_proyecto = '208_091';

update public.doa_proyectos_historico
set aeronave = 'Airbus A300 B4-622R',
    msn = 'Any'
where numero_proyecto = 'A3030';
