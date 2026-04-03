alter table if exists public.doa_proyectos_historico
  add column if not exists anio integer null,
  add column if not exists ruta_origen text null,
  add column if not exists nombre_carpeta_origen text null;

create index if not exists doa_proyectos_historico_anio_idx
  on public.doa_proyectos_historico(anio);

with origin_data(numero_proyecto, nombre_carpeta_origen) as (
  values
    ($$177001$$, $$177001 Banner towing hook installation in Cessna 177RG$$),
    ($$20882$$, $$20882 Pedestal tablet installation in Cessna 208B$$),
    ($$20885$$, $$20885 Antenna and Radome installation in C208B$$),
    ($$208_090$$, $$208_090 Installation removal in C208B$$),
    ($$208_091$$, $$208_091 SATCOM ANTENNA REPAIR$$),
    ($$208_092$$, $$208_092 Antenna removal in Cessna 208$$),
    ($$208_093$$, $$208_093 Antenna mechanical provisions installation in Cessna 208$$),
    ($$208_094$$, $$208_094 Several antennas installation in Cessna 208$$),
    ($$320388$$, $$320388 Livery change in A320$$),
    ($$320_405$$, $$320_405 Livery external decals in A320$$),
    ($$320_407$$, $$320_407 Livery modification in A319 & A320$$),
    ($$330237$$, $$330237 Cargo in cabin configuration$$),
    ($$330_240$$, $$330_240 Defibrillator installation in A330$$),
    ($$330_243$$, $$330_243 Defibrillator Installation$$),
    ($$340035$$, $$340035 Cargo in cabin configuration$$),
    ($$34034$$, $$34034 Cargo in cabin configuration$$),
    ($$77729$$, $$77729 Cargo in cabin configuration$$),
    ($$A3030$$, $$A3030 LH & RH elevator skin repairs in A300-600$$),
    ($$A350_004$$, $$A350_004 Defibrilator Installation$$),
    ($$B30_056$$, $$B30_056 Hensoldt installation in Beechcraft King Air B200$$),
    ($$B30_057$$, $$B30_057 Single Laptop Desktop installation in B200$$),
    ($$B30_058$$, $$B30_058 RACK INSTALLATION$$),
    ($$GEX_135$$, $$GEX_135 USB outlets installation$$),
    ($$L60_028$$, $$L60_028 Iridium antenna installation in LJ60$$)
)
update public.doa_proyectos_historico p
set anio = 2021,
    nombre_carpeta_origen = o.nombre_carpeta_origen,
    ruta_origen = $$C:\Users\Jesús Andrés\Desktop\Aplicaciones - Desarrollo\Design Organization Approval - APP Production\02. Datos DOA\05. Proyectos\00. Proyectos Base\2021\$$ || o.nombre_carpeta_origen,
    updated_at = timezone('utc'::text, now())
from origin_data o
where p.numero_proyecto = o.numero_proyecto;

alter table if exists public.doa_proyectos_historico
  alter column anio set not null,
  alter column ruta_origen set not null,
  alter column nombre_carpeta_origen set not null;
