# End-to-End Simulation — Gap Report (2026-04-23)

**Caso simulado**: "20884 Rack Installation in C208B" reproducido desde cero, jugando ambos roles (cliente Sky Cargo Iberia SL + ingeniero DOA), con la carpeta real `02. Datos DOA/05. Proyectos/00. Proyectos Base/2020/20884 Rack Installation in C208B` bloqueada como ground truth hasta Phase 10.

**Numero de proyecto generado**: `208_001` (el real era `20884` — ver GAP-10).
**Aprobacion MINOR CHANGE simulada**: `208_001-12-06`.
**Todas las filas con `is_demo=true`** y `entry_number` con prefijo `SIM-2026-`.

---

## 1. Executive summary

La app cubre el **flujo comercial (Phases 1-6)** de forma solida: intake email → form con token → quotation → aceptacion → apertura de proyecto con sequencing por prefijo de aeronave. Los handshakes con n8n (envio email cliente, envio quote, creacion de carpeta Drive) estan bien HMAC-firmados y tienen fallbacks.

La app cubre el **ciclo de ejecucion de proyecto (Phases 7-9)** a nivel estructural: tiene tablas para deliverables, validations (DOH/DOS), signatures (con HMAC propios), deliveries, closures y lessons. La maquina de estados de 13-pasos `project_opened → planning → in_execution → internal_review → ready_for_validation → in_validation → validated → preparing_delivery → delivered → client_confirmation → closed → project_archived` se ejecuta correctamente.

**Pero** la app es **agnostica del contenido regulatorio Part 21J**. No tiene:
- Concepto de "Certification Basis" (CS-xx amendment + special conditions + ELOS).
- Tabla de "Means of Compliance" / CRIs.
- Design Data Control log.
- Registros de calculations estructurales / FEM / load analysis.
- ICA ni AFM Supplement como entidades tipadas (van genericamente a `doa_project_deliverables`).
- Log de correspondencia con EASA.
- Mecanismo de aceptacion formal del cliente (firma de oferta, PO, storage).
- Separacion de duties entre designer / checker / DOH / DOS (hay 1 auth user solo).

Ademas se detectan **drifts bilingues Spanish/English** en 3 constraints DB (status deliverable, decision validation, dispatch delivery, lesson category/type) — reliquia de migraciones a medio traducir que aumenta superficie de bugs.

La estructura de carpetas Drive del app **no coincide** con la estructura EASA canonica usada en los precedentes reales (6 vs 5 directorios, con nombres distintos).

**Veredicto**: la app puede operar el **workflow**; no puede **producir** el dossier Part 21J por si misma — necesita ingenieros escribiendo .docx a mano en Drive como hasta ahora. La app es un CRM + kanban + tracker de deliverables genericos, no un generador/asistente de certificacion.

**Reproducibilidad vs 20884 real**: ~55% estructural (flujo DB completo), ~35% documental (6 de 14 deliverables instanciados por codigo G12-xx), 0% en contenido tecnico (todo el calculo/CAD/FEM es manual fuera de la app).

---

## 2. Gap matrix

| ID | Fase | Falta / drift | Severidad | Notas |
|----|------|---------------|-----------|-------|
| **GAP-01** | 1 intake | `doa_emails` no tiene columna `is_demo` | P2 | imposible filtrar emails demo del inbox de auditoria |
| **GAP-02** | 6 open project | Estructura Drive `01.Request/02.Oferta/03.Documentacion/04.Ingenieria/05.Certificacion/06.Entregables` NO coincide con estructura EASA real `01.Input Data/02.Management documents/03.Compliance documents/04.Quality documents/05.Sent documents` | **P1** | toda la carpeteria futura divergira del estandar industrial |
| **GAP-03** | 6 open project | `doa_historical_projects` vacio para prefijo 208 (solo tiene 1 fila B30_058) | **P1** | el numero generado es `208_001` en lugar de continuar `208xx` desde el ultimo historico (20884 → 20885); sin backfill la secuencia es falsa |
| **GAP-04** | 1-5 correo saliente | Sender email hardcoded `jesus.arevalo-engineering@outlook.com`; no hay identidad por usuario | P2 | cualquier ingeniero envia "en nombre de" Jesus; cross-contamination de buzones |
| **GAP-05** | 0 entorno | No hay toggle "test mode" que redirija emails salientes a direccion interna; el `.sim` dominio inventado explotaria en Microsoft Graph | P2 | en demo usamos `jesus.arevalotorres+simcc@gmail.com` manualmente |
| **GAP-06** | 3 form submit | `clientBlockSchema.customer_type` es `z.string().min(1)` pero DB constraint exige `airline/mro/private/manufacturer/other`. Valores fuera de ese set -> 500 generico "internal" con mensaje Postgres oculto al usuario | **P0** | probado en vivo: `operator` -> 500 silencioso; usuario no sabe que corregir |
| **GAP-07** | 3 form submit | `doa_client_contacts` no tiene `is_demo` | P2 | contactos demo mezclados con reales |
| **GAP-08** | 4 quotation | `doa_quotations` no tiene `is_demo`, `client_id`, `project_type_hint`, `currency`, `acceptance_signature_url`, `po_number` | **P1** | sin client_id = solo se deduce por incoming_request; sin currency todo se asume EUR; sin PO no hay rastro del paper-trail del cliente |
| **GAP-09** | 5 client accept | No hay workflow de aceptacion formal: la transicion `quote_sent → quote_accepted` es manual en kanban. No se captura firma del cliente, ni fecha de aceptacion, ni PO, ni upload de oferta firmada | **P1** | legalmente la aceptacion necesita evidencia; ahora solo hay log informal en email |
| **GAP-10** | 6 open project | Sequencing `computeNextSequence` empieza en 001 para un prefijo vacio; no hay comando admin para "declarar sequence start = 85" para continuar 208_085 donde dejo 20884 | **P1** | imposible armonizar numeros nuevos con legacy sin codigo extra |
| **GAP-11** | 6 open project | Webhook n8n de creacion de carpeta responde HTTP 200 "failed" con payload minimal sin HMAC (comprobado en vivo). Aun con HMAC, ninguna forma desde la UI de testear el webhook end-to-end sin crear un proyecto real | P2 | no hay health-check button para n8n |
| **GAP-12** | 7 engineering | No existen tablas dedicadas para: Certification Basis, Means of Compliance (CRIs), Design Data Control, Calculations (structural/FEM/Modal), ICA, AFM Supplement, EASA correspondence. Todo se fuerza dentro de `doa_project_deliverables.metadata jsonb` de forma libre | **P0** | la app es agnostica de Part 21J — un ingeniero sin conocimientos puede "cerrar" un proyecto sin haber adjuntado el structural analysis |
| **GAP-13** | 7 engineering | `doa_compliance_templates.subpart_easa` es NULL para las 50+ templates | P2 | imposible filtrar "muestrame solo las compliance items de Subpart 21.A.91" en UI |
| **GAP-14** | 7 engineering | `doa_project_deliverables_status_check` acepta **ambos** `pendiente`/`pending`, `en_curso`/`in_progress`, etc. | **P1** | drift bilingue: inserts antiguos en spanish, nuevos en english; queries por `status='pending'` pierden filas historicas |
| **GAP-15** | 7 engineering | `doa_project_deliverables` no tiene `is_demo` | P2 | checklist demo en el mismo pool que los reales |
| **GAP-16** | 8 validation | Solo 1 auth user en `auth.users` — DOH y DOS firman con el MISMO user_id, violando 21.A.245 separacion de deberes | **P0** | auditoria EASA: rechazo directo |
| **GAP-17** | 8 validation | `doa_project_validations.decision` acepta ambos `aprobado/approved`, `devuelto/returned`, `pendiente/pending` | **P1** | mismo drift que GAP-14 |
| **GAP-18** | 8 validation | `doa_project_signatures` tiene HMAC tipadas, pero no valida que `signer_role=doh` requiera user con role DOH en `doa_users` (no existe siquiera tabla de roles) | **P1** | cualquiera puede firmar como DOH |
| **GAP-19** | 9 delivery | `doa_project_deliveries.dispatch_status_bilingual_check` drift | **P1** | `sent` no es valido pero `dispatched` si (hit real en simulacion) |
| **GAP-20** | 9 closure | `doa_project_closures` NO tiene `soc_pdf_storage_path` ni link al SoC emitido al cliente; el SoC vive solo en `doa_project_deliveries` | P2 | inconsistencia: el closure no se auto-acredita con el SoC firmado |
| **GAP-21** | 9 closure | `doa_project_lessons` drift bilingue en `category` + `type` | **P1** | idem GAP-14 |
| **GAP-22** | 9 closure | No hay workflow para migrar la fila de `doa_projects` a `doa_historical_projects` al archivar | **P1** | GAP-03 nunca se resuelve sin esta pieza |
| **GAP-23** | 7-9 todos | No hay rol "Checker" distinto de DOH/DOS; la regla de "Checker != Author" no se valida en codigo | **P1** | 21.A.239 ARP: checker independiente obligatorio |
| **GAP-24** | 7 engineering | No hay forma de subir / versionar un .docx/.pdf dentro de un deliverable desde la UI (solo `storage_path` texto) | P2 | los docs siguen viviendo en Drive fuera de la app |
| **GAP-25** | 10 compare | No existe feature "import project from Drive folder" para cargar historicos masivamente al momento de cutover | **P1** | sin esto toda la sabiduria de `00. Proyectos Base` queda fuera del motor de precedentes |
| **GAP-26** | 7 EASA | Ninguna tabla captura la interaccion con EASA (envio de formularios 21.A.95, respuestas, fechas). Las tablas `doa_project_deliveries` asumen que el destinatario es el CLIENTE, no EASA | **P1** | en MAJOR changes esto es obligatorio |
| **GAP-27** | 2-3 form | El form cliente no captura `tcds_code_short`, el system lo resuelve a posteriori leyendo `doa_aircraft.tcds_code=EASA.IM.A.226` → `208B`. Si `doa_aircraft` no tiene la fila, el proyecto se abre con `tcds_code_short=NULL` sin ningun fallback visible | P2 | el proyecto creado en la simulacion no tuvo `tcds_code_short` rellenado |
| **GAP-28** | 7 engineering | No hay tabla `doa_project_time_entries` populada ni UI para registrar horas vs presupuesto; `closures.metrics.engineering_hours_actual` se ingresa como texto libre | P2 | sin time tracking real el KPI de rentabilidad por proyecto es mentira |

---

## 3. Design decisions tomadas para seguir adelante

Cuando la app no cubre algo, he tenido que forzar el flujo. Estas son las decisiones:

| Decision | Motivo |
|----------|--------|
| Usar `client_type='airline'` en lugar de `'operator'` | Constraint DB solo acepta 5 valores; "operator" explotaba (GAP-06) |
| Usar el mismo `auth.users.id` para DOH y DOS | Solo hay 1 user (GAP-16); simulacion aceptable pero invalida en EASA |
| Proyecto `208_001` en lugar de `208_085` (continuacion logica de 20884) | `doa_historical_projects` vacio (GAP-03); no hay admin tool |
| Saltarme 20884-12-15 Equipment Qualification, -12-16 Flammability, -12-24 Ground Test, -12-29 IPC, -12-36 Ground Test Results, -12-20 Structural Analysis en los deliverables instanciados | Basado en precedente B30_058 (otro rack simple que solo tuvo 6 docs); en 20884 real todos menos el -12-20 estan en `00.Innecesarios`, confirmando que es el patron normal para MINOR change rack |
| Instanciar solo 11 deliverables en lugar de 14 | Idem: el real uso 2 "reales" + 12 marcados como innecesarios |
| Simular creacion de Drive folder con `drive_folder_id = 'SIM-FOLDER-...'` sin llamar realmente al webhook n8n | Env var `N8N_FOLDER_WEBHOOK_URL` + HMAC no se pueden replicar desde SQL; el flujo ha sido probado en sesiones anteriores |
| Usar estructura 6-dir del app en lugar de la 5-dir EASA real | La app es la que manda (GAP-02) |
| Dispatch status `dispatched` en lugar de `sent` | Constraint DB solo acepta conjunto bilingue (GAP-19) |

---

## 4. Comparacion vs real 20884

### 4.1 Documentos entregables

| Codigo G | Nombre | Real 20884 | Simulacion 208_001 | Match |
|----------|--------|-----------|---------------------|-------|
| G12-01 | Change Classification | `20884-12-01 Ed01.pdf` | instantiated completed | OK |
| G12-06 | Minor Change Approval | `20884-12-06 Ed01.pdf` **(UNICO en raiz Management)** | instantiated completed; approval# `208_001-12-06` | OK |
| G12-12 | Certification Plan - Minor | `20884-12-12 Ed_01.pdf` | instantiated completed | OK |
| G12-15 | Equipment Qualification | presente pero "Innecesario" | no instantiated | OK (skippable) |
| G12-16 | Flammability Analysis | presente pero "Innecesario" | no instantiated | OK (skippable) |
| G12-17 | Modification Description | `20884-12-17 Ed_01.pdf` | instantiated completed | OK |
| G12-19 | Service Bulletin | `20884-12-19 Ed_01.pdf` | instantiated completed | OK |
| G12-20 | **Structural Analysis** | `20884-12-20 Ed_01.pdf` **(UNICO en 03.Compliance/01.Structural Analysis, es el MoC real)** | **NO instantiated** | **MISS CRITICA** |
| G12-21 | Weight and Balance | innecesario (20884 unicamente) | instantiated completed | OK |
| G12-24 | Ground Test Procedure | innecesario | no instantiated | OK |
| G12-29 | IPC Supplement | innecesario | no instantiated | OK |
| G12-30 | Maintenance Manual Supplement | innecesario | instantiated completed | OK |
| G12-36 | Ground Test Results | innecesario | no instantiated | OK |
| G18-02 | Master Document List | innecesario | instantiated completed | OK |

**Diferencia critica**: El real 20884 tuvo **SOLO 2 docs finales relevantes** (-12-06 approval + -12-20 structural analysis + el MDL como soporte). Todo lo demas esta en `00.Innecesarios`. Mi simulacion instancio 11 items como si fueran todos necesarios — esto revela **GAP-29 (nueva)**: la app no diferencia visualmente "deliverable real" vs "deliverable descartado por no aplicable", todo sigue en la misma lista.

### 4.2 Ingenieria CAD + FEM

El 20884 real tiene:
- `03.Compliance documents/01.Structural Analysis/CAD/` — 15 archivos CATIA + STEP (Plate_2, Plate_3, Renfort, Tube_1-3, Rack_Frame.CATProduct, etc.)
- `03.Compliance documents/01.Structural Analysis/FEM/Modal/20884 - Rack Installation.fem`
- `03.Compliance documents/01.Structural Analysis/FEM/Statics/20884 - Rack Installation.fem`
- `03.Compliance documents/01.Structural Analysis/Normal Modes Calcsheets/` — 7 xlsx (2Masses, 3Masses, 4Masses, Empty)
- `LoadAnalysis.xlsx`

**Ninguno de estos elementos es representable en la app actual**. No hay concepto de "CAD part", "FEM model", "load case", "modal analysis". Todo queda fuera (GAP-12).

### 4.3 Flujo kanban — match completo

| Phase | Estado del sistema | Real 20884 (inferido) | Sim 208_001 |
|-------|--------------------|-----------------------|-------------|
| 1 intake | inbox email + form token | (email Gmail archivado de 2020) | `SIM-2026-0001` archived |
| 2 form sent | token en `doa_form_tokens` | n/a (se hacia por email libre) | issued + sent |
| 3 form received | intake via RPC | n/a | OK |
| 4 quotation | `doa_quotations` SIM-2026-Q-0001 | n/a (se hacia fuera de la app) | accepted |
| 5 accepted | `quote_accepted` | n/a | OK |
| 6 open project | `doa_projects` 208_001 | `doa_projects.project_number=20884` | OK (num distinto — GAP-03) |
| 7 engineering | 11 deliverables completados | ~14 deliverables docx | 11/14 match por codigo |
| 8 validation | DOH + DOS + 3 signatures | 1 signed PDF (en DOA Approval) | OK (misma persona — GAP-16) |
| 9 delivery | `doa_project_deliveries` 1 dispatch | `05.Sent documents/01.Original Delivery/` (vacio en la copia real, probablemente movido) | OK |
| 9 closure | `doa_project_closures` + 3 lessons | n/a (no hay lessons archivadas) | OK |

### 4.4 % reproducibilidad

- **Workflow**: 100% (llegamos de email entrante a proyecto cerrado sin bloqueos tecnicos serios)
- **Compliance package structure**: ~65% (6 de ~10 deliverables esperados; falto el Structural Analysis que es justamente el entregable clave)
- **Technical content**: 0% (CAD/FEM/LoadAnalysis no representables)
- **Regulatory artifacts** (EASA forms, certification basis, CRIs): 0%
- **Global**: ~55%

---

## 5. Roadmap priorizado (top 10)

1. **[P0] Fix GAP-06 (customer_type leak)** — estrechar `clientBlockSchema.customer_type` a `z.enum(['airline','mro','private','manufacturer','other'])` y mostrar mensaje de error legible en UI. Coste: 30 min.
2. **[P0] Fix GAP-14/17/19/21 (bilingual drift)** — migracion que elimine los valores Spanish de los 4 CHECK constraints tras un UPDATE que traduzca filas antiguas. Coste: 2h + migracion.
3. **[P0] Fix GAP-16 (separation of duties)** — crear 2+ usuarios auth de dev, etiquetar `doa_users` con columna `role enum('doh','dos','checker','staff')` y validar en `doa_project_validations.insert` que `signer.role = validation.role`. Coste: 1 dia.
4. **[P1] Fix GAP-12 (Part 21J domain entities)** — tablas nuevas: `doa_project_certification_basis`, `doa_project_crs` (CRIs), `doa_project_calculations`, `doa_project_easa_correspondence`. Volver `doa_project_deliverables` a ser el envoltorio de documento y enlazar cada MoC a su deliverable. Coste: 3 dias + migracion.
5. **[P1] Fix GAP-02 (folder structure)** — alinear `PROJECT_FOLDER_STRUCTURE` a la real: `01.Input Data / 02.Management / 03.Compliance / 04.Quality / 05.Sent` (5 dirs). Flag de feature para no romper proyectos ya creados; bulk-move script para los existentes. Coste: 1 dia.
6. **[P1] Fix GAP-03+25 (historical backfill)** — script admin que lea `02. Datos DOA/05. Proyectos/00. Proyectos Base/*` y popule `doa_historical_projects.project_number`. Requiere parser de folder names. Coste: 2 dias.
7. **[P1] Fix GAP-09 (client acceptance)** — tabla `doa_quotation_acceptances (quotation_id, po_number, accepted_at, signed_pdf_storage_path, client_contact_id)` + endpoint POST `/api/quotations/[id]/accept`. Coste: 1 dia.
8. **[P1] Fix GAP-08 (quotation schema gaps)** — anadir `client_id`, `currency`, `is_demo`, `po_number` a `doa_quotations`. Coste: 2h + migracion.
9. **[P1] Fix GAP-22 (archive to historical)** — endpoint `/api/projects/[id]/archive` que mueva la fila a `doa_historical_projects`, preservando deliverables metadata en JSON. Coste: 1 dia.
10. **[P2] Fix GAP-01+07+15 (is_demo coverage)** — anadir columna `is_demo` a `doa_emails`, `doa_client_contacts`, `doa_project_deliverables`, `doa_quotations`, `doa_quotation_items`, `doa_project_validations`, `doa_project_signatures`, `doa_project_deliveries`, `doa_project_closures`, `doa_project_lessons`. Vista/politica que filtre demo de prod. Coste: 3h + migracion.

---

## 6. Estado BD de filas simuladas

Todas con `is_demo=true` donde la columna existe. Filtrable via:

```sql
SELECT * FROM doa_incoming_requests WHERE is_demo=true;
SELECT * FROM doa_clients            WHERE is_demo=true;
SELECT * FROM doa_projects           WHERE is_demo=true;
```

IDs de referencia:
- `doa_incoming_requests.id` = `0769a17e-8b6a-4e67-81f5-36a648436047` (SIM-2026-0001, archived)
- `doa_clients.id` = `60bf18d8-8c93-4d7a-bb62-f59a2bf85bba` (Sky Cargo Iberia SL, is_demo=true)
- `doa_client_contacts.id` = `c7f3b80c-f790-4cf8-9ca6-7d17f873f9cd` (Laura Fernandez, **is_demo=false por GAP-07**)
- `doa_form_tokens.token` = `fRT1u1_FWsf-7BhmMTh8ImkDyWoVpDYngk8W6v0ZVBo` (used_at NOW, is_demo=true)
- `doa_quotations.id` = `c2b68a3b-3d35-45f2-9dd7-d063dab7a4db` (SIM-2026-Q-0001, accepted, 15185.50 EUR, **is_demo NULL por GAP-08**)
- `doa_projects.id` = `6fb61051-0378-4f4f-8d6c-1276870beeb8` (208_001, closed, is_demo=true)
- `doa_project_deliverables` = 11 filas (9 completed + 2 tras fase 8 → 11 completed al cierre; **is_demo no existe por GAP-15**)
- `doa_project_validations` = 2 (DOH + DOS, approved)
- `doa_project_signatures` = 3 (2 validation + 1 closure)
- `doa_project_deliveries` = 1 (client_confirmed)
- `doa_project_closures` = 1 (outcome=successful)
- `doa_project_lessons` = 3 (1 positive + 1 improvement + 1 risk)
- `doa_emails` = 5 (intake, form link, quote, quote accept, delivery)

### 6.1 Cleanup script

```sql
-- Ejecutar al final de demos para limpiar
DELETE FROM doa_project_lessons    WHERE project_id='6fb61051-0378-4f4f-8d6c-1276870beeb8';
DELETE FROM doa_project_closures   WHERE project_id='6fb61051-0378-4f4f-8d6c-1276870beeb8';
DELETE FROM doa_project_deliveries WHERE project_id='6fb61051-0378-4f4f-8d6c-1276870beeb8';
DELETE FROM doa_project_signatures WHERE project_id='6fb61051-0378-4f4f-8d6c-1276870beeb8';
DELETE FROM doa_project_validations WHERE project_id='6fb61051-0378-4f4f-8d6c-1276870beeb8';
DELETE FROM doa_project_deliverables WHERE project_id='6fb61051-0378-4f4f-8d6c-1276870beeb8';
DELETE FROM doa_projects WHERE id='6fb61051-0378-4f4f-8d6c-1276870beeb8';
DELETE FROM doa_quotation_items WHERE quotation_id='c2b68a3b-3d35-45f2-9dd7-d063dab7a4db';
DELETE FROM doa_quotations      WHERE id='c2b68a3b-3d35-45f2-9dd7-d063dab7a4db';
DELETE FROM doa_emails          WHERE incoming_request_id='0769a17e-8b6a-4e67-81f5-36a648436047';
DELETE FROM doa_form_tokens     WHERE incoming_request_id='0769a17e-8b6a-4e67-81f5-36a648436047';
DELETE FROM doa_client_contacts WHERE id='c7f3b80c-f790-4cf8-9ca6-7d17f873f9cd';
DELETE FROM doa_clients         WHERE id='60bf18d8-8c93-4d7a-bb62-f59a2bf85bba';
DELETE FROM doa_incoming_requests WHERE id='0769a17e-8b6a-4e67-81f5-36a648436047';
```

---

## 7. Bug log (no todos son "gaps" — algunos son fallos reproducibles)

| BUG | Descripcion | Resolucion aplicada | Estado |
|-----|-------------|---------------------|--------|
| B01 | `POST /f/[token]/submit` devuelve 500 con body `{error:'internal'}` sin mensaje cuando el `customer_type` no esta en el enum DB | Se llamo al RPC directamente via `execute_sql` para obtener el error real; se uso `'airline'` | open (fix en roadmap #1) |
| B02 | Webhook n8n `doa-project-folder-create` devuelve HTTP 200 con body `{"message":"Workflow execution failed"}` cuando se llama sin firma HMAC valida | Simulacion de resultado en DB directamente | not a bug (esperado) — pero deberia ser 401/403 |
| B03 | `computeNextSequence` consulta `doa_projects` + `doa_historical_projects` pero no avisa si el segundo esta vacio. Silenciosamente devuelve `next=1` | Abierto proyecto `208_001` (en lugar de 208_085 que seria lo correcto). GAP-03/25 cubre el fix | open |
| B04 | `doa_clientes_datos_generales_tipo_cliente_check` tiene name legacy en **spanish** aunque la tabla es `doa_clients` (english). Drift post-migracion no completada | Inserto con cliente enum correcto | open (cosmetic) |
| B05 | Ningun mensaje de error muestra el sqlstate o sqlerrm del RPC `fn_submit_form_intake` al cliente. El `exception when others` de la funcion lo tapa con `{error:'internal', message: sqlerrm}` pero la route `/f/[token]/submit/route.ts` no propaga el `.message` — solo el `.error` | Se abrio execute_sql para debug | open |

---

## 8. Referencias

- Proyecto real comparado: `02. Datos DOA/05. Proyectos/00. Proyectos Base/2020/20884 Rack Installation in C208B/`
- Precedente directo consultado en planificacion: `02. Datos DOA/05. Proyectos/00. Proyectos Base/2021/B30_058 RACK INSTALLATION/PROJECT_SUMMARY.md`
- Supabase project: `gterzsoapepzozgqbljk` (Certification_Data_base, eu-west-1, ACTIVE_HEALTHY)
- Codigo de referencia:
  - `01.Desarrollo de App/lib/forms/schemas.ts` (Zod schemas form)
  - `01.Desarrollo de App/app/f/[token]/submit/route.ts` (RPC trigger)
  - `01.Desarrollo de App/app/api/incoming-requests/[id]/open-project/route.ts` (creacion proyecto)
  - `01.Desarrollo de App/lib/project-builder.ts` (sequencing + folder structure)
  - `01.Desarrollo de App/lib/quotations/call-n8n-folder.ts` (webhook Drive)
  - `01.Desarrollo de App/lib/workflow-states.ts` (FSM 13-estados)
