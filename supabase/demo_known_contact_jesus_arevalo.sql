-- Demo seed manual for known-contact enrichment in incoming queries.
-- Scope:
--   - doa_clientes_datos_generales
--   - doa_clientes_contactos
--   - doa_aeronaves_modelos
--   - doa_proyectos_generales
--   - doa_consultas_entrantes
--
-- Notes:
--   - Designed to be safe to re-run.
--   - Uses only columns that are already referenced by the app code/types.
--   - Aircraft registrations are documented in project descriptions because the
--     live schema for doa_aeronaves_registro is not represented in the repo types.

begin;

-- 1. Demo client
insert into public.doa_clientes_datos_generales (
  id,
  nombre,
  cif_vat,
  pais,
  ciudad,
  direccion,
  telefono,
  web,
  activo,
  notas,
  dominio_email,
  tipo_cliente
)
select
  '8d7d795f-52df-4f60-8fd8-dc1a63814220',
  'AeroLynx Regional Services S.A.',
  'B-90817654',
  'Espana',
  'Valencia',
  'Avenida del Puerto 214, 46024 Valencia',
  '+34 960 245 880',
  'https://www.aerolynxregional.example',
  true,
  'Cliente demo para pruebas de enriquecimiento comercial en Consultas entrantes.',
  'aerolynxregional.com',
  'aerolinea'
where not exists (
  select 1
  from public.doa_clientes_datos_generales
  where nombre = 'AeroLynx Regional Services S.A.'
     or dominio_email = 'aerolynxregional.com'
);

-- 2. Known contact: Jesus Arevalo
insert into public.doa_clientes_contactos (
  id,
  cliente_id,
  nombre,
  apellidos,
  email,
  telefono,
  cargo,
  es_principal,
  activo
)
select
  '3c7deeb2-9097-4d58-95d2-7d7a53b8d89f',
  '8d7d795f-52df-4f60-8fd8-dc1a63814220',
  'Jesus',
  'Arevalo Torres',
  'jesus.arevalotorres@gmail.com',
  '+34 661 245 221',
  'Fleet Technical Manager',
  true,
  true
where not exists (
  select 1
  from public.doa_clientes_contactos
  where email = 'jesus.arevalotorres@gmail.com'
);

-- 3. Aircraft model used by the historical projects
insert into public.doa_aeronaves_modelos (
  id,
  fabricante,
  familia,
  modelo,
  activo
)
select
  '94b54f67-a6d5-4efc-9f89-654d14bb55d4',
  'Pilatus',
  'PC-12',
  'PC-12/47E',
  true
where not exists (
  select 1
  from public.doa_aeronaves_modelos
  where fabricante = 'Pilatus'
    and familia = 'PC-12'
    and modelo = 'PC-12/47E'
);

-- 4. Historical project A
insert into public.doa_proyectos_generales (
  id,
  numero_proyecto,
  titulo,
  descripcion,
  cliente_id,
  modelo_id,
  tipo_modificacion,
  clasificacion_cambio,
  base_certificacion,
  estado,
  fecha_apertura,
  fecha_cierre,
  fecha_prevista,
  horas_estimadas,
  horas_reales,
  presupuesto_euros,
  num_aeronaves_afectadas,
  resumen_ejecutivo
)
select
  '66dfb576-319f-42c4-85c6-b8baf42cdfa8',
  'PC12_208',
  'Installation of Iridium antenna on PC-12 fleet',
  'Historical demo project for AeroLynx Regional Services. Fleet reference aircraft: EC-NLX.',
  '8d7d795f-52df-4f60-8fd8-dc1a63814220',
  '94b54f67-a6d5-4efc-9f89-654d14bb55d4',
  'Avionics modification',
  'menor',
  'CS-23',
  'op_12_closed',
  '2025-01-15',
  '2025-03-02',
  '2025-02-28',
  52,
  49,
  12450,
  1,
  'Closed historical project used to demonstrate known-contact enrichment from incoming queries.'
where not exists (
  select 1
  from public.doa_proyectos_generales
  where numero_proyecto = 'PC12_208'
);

-- 5. Historical project B
insert into public.doa_proyectos_generales (
  id,
  numero_proyecto,
  titulo,
  descripcion,
  cliente_id,
  modelo_id,
  tipo_modificacion,
  clasificacion_cambio,
  base_certificacion,
  estado,
  fecha_apertura,
  fecha_cierre,
  fecha_prevista,
  horas_estimadas,
  horas_reales,
  presupuesto_euros,
  num_aeronaves_afectadas,
  resumen_ejecutivo
)
select
  '1f9c6275-b6ca-4c64-8c3f-bf0ed1ea64e7',
  'PC12_214',
  'ELT remote switch relocation on PC-12',
  'Historical demo project for AeroLynx Regional Services. Fleet reference aircraft: EC-MJT.',
  '8d7d795f-52df-4f60-8fd8-dc1a63814220',
  '94b54f67-a6d5-4efc-9f89-654d14bb55d4',
  'Cabin safety update',
  'menor',
  'CS-23',
  'op_12_closed',
  '2025-05-10',
  '2025-06-27',
  '2025-06-25',
  38,
  36,
  9150,
  1,
  'Second historical project to support commercial recognition of the same contact and operator.'
where not exists (
  select 1
  from public.doa_proyectos_generales
  where numero_proyecto = 'PC12_214'
);

-- 6. Demo incoming query from the known contact
insert into public.doa_consultas_entrantes (
  id,
  created_at,
  asunto,
  remitente,
  cuerpo_original,
  clasificacion,
  respuesta_ia
)
select
  '9f95dfeb-c55d-47f8-b65c-886dfd306ddb',
  timezone('utc', now()),
  'Antenna installation in PC-12',
  'jesus.arevalotorres@gmail.com',
  'Hello, we need support for a new antenna installation in our PC-12 fleet. We already worked with your team on EC-NLX and EC-MJT. Could you review scope, expected inputs and estimated lead time for one aircraft as initial case?',
  'Cliente conocido solicita proyecto nuevo',
  'Buenos dias Jesus, gracias por contactar de nuevo. Hemos identificado vuestro operador como cliente conocido y vemos antecedentes recientes en proyectos PC12_208 y PC12_214. Si os parece, podemos revisar el alcance inicial para una aeronave y despues extenderlo al resto de la flota si aplica.'
where not exists (
  select 1
  from public.doa_consultas_entrantes
  where remitente = 'jesus.arevalotorres@gmail.com'
    and asunto = 'Antenna installation in PC-12'
);

commit;

-- Optional extension once the live schema of public.doa_aeronaves_registro is confirmed:
--   - create one row for EC-NLX
--   - create one row for EC-MJT
--   - link them to cliente_id and modelo_id if those foreign keys exist there
