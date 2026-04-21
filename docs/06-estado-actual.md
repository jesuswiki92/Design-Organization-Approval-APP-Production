# Status actual de la aplicacion

## Crear Project New (manual) (2026-04-15)

Alta manual de projects desde el Tablero (boton "Crear Project New" arriba
a la derecha). Es un flujo independiente del automatico de Quotations
(`/api/incoming-requests/[id]/open-project`): se usa cuando un project no nace de
una request entrante.

- New endpoint `POST /api/projects/create-manual`: deriva project_number,
  crea carpetas, inserta en `doa_projects` (con `incoming_request_id = null`) y
  genera un `.docx` por cada template G12/G18 seleccionada reemplazando
  `project_code` y `document_code` en `word/document.xml` via `jszip`.
- New estructura de carpetas para estos projects:
  `00. Project info / 01. Compliance documents / 02. Working documents /
  03. Reference material / 04. Deliveries / 05. Correspondence`,
  anidada bajo `{NEW_ROOT}/{client}/{avion}/{year}/{project_number}`.
- Nuevas variables de entorno en `.env.local.example`:
  `DOA_PROJECTS_NEW_ROOT` (raiz de projects manuales) y
  `DOA_PLANTILLAS_ROOT` (path de los `.dotx`).
- Modulos nuevos: `lib/projects/templates-docx.ts`,
  `lib/projects/create-manual.ts`, `components/project/NewProjectModal.tsx`,
  y endpoints soporte `/api/clients`, `/api/aircraft/manufacturers`,
  `/api/aircraft/models`. Requiere la dependencia `jszip`.

## Sprint 2 — Close-the-loop: Validation DOH/DOS (2026-04-17)

Sprint 2 cierra el bucle de validation: un project con todos los deliverables
listos ya puede ser sent a validation, recibir decision firmada por DOH/DOS
con HMAC-SHA256 y volver a execution con observations estructuradas.

### Que ha aterrizado

- New table `doa_project_validations` — registro inmutable de cada decision
  de validation (migracion `202604170000_doa_project_validations.sql`).
- New table `doa_project_signatures` — firmas de no repudio Part 21J con
  HMAC-SHA256 sobre el canonical JSON del payload firmado
  (migracion `202604170010_doa_project_signatures.sql`).
- Helper de firma en `lib/signatures/hmac.ts`: `canonicalJSON`,
  `computeSignature`, `verifySignature`. Lee `DOA_SIGNATURE_HMAC_SECRET` y
  soporta rotacion por `hmac_key_id` (actualmente `v1`).
- Endpoints nuevos:
  - `POST /api/projects/[id]/send-to-validation` — transiciona desde
    `in_execution | internal_review | ready_for_validation` a `in_validation`
    tras comprobar que todos los deliverables estan en `completed` o
    `not_applicable`.
  - `POST /api/projects/[id]/validate` — registra la decision (`approved` o
    `returned`), firma HMAC y transiciona a `validated` o
    `returned_to_execution`. Maneja inconsistencias con
    `project.validar.signature_inconsistent` y `project.validar.state_inconsistent`.
  - `POST /api/projects/[id]/resume` — transiciona de
    `returned_to_execution` a `in_execution`.
  - `GET /api/projects/[id]/validations` — lista validaciones enriquecidas con
    el email del validador.
- Page new `/engineering/validations` — cola de projects en `in_validation`
  con cards, progreso de deliverables y tiempo en cola.
- `ValidationTab.tsx` en el detalle de project: timeline de decisiones,
  form DOH/DOS con observations por deliverable y CTAs segun status.
- Deep link `?tab=validation` en el detalle de project.
- En `DeliverablesTab` ahora aparece un CTA "Send a validation" cuando todos
  los deliverables estan listos y el project esta en
  `in_execution | internal_review | ready_for_validation`.
- Constantes de UI para validation en `lib/workflow-states.ts`:
  `VALIDATION_ROLE_LABELS`, `VALIDATION_DECISION_LABELS`,
  `OBSERVATION_SEVERITY_LABELS`, `DELIVERABLE_VALIDATION_READY_STATES`.
- Tipos `ProjectValidation`, `ProjectSignature`, `ValidationRole`,
  `ValidationDecision`, `ObservationSeverity`, `ValidationObservation`,
  `DeliverableSnapshot`, `SignerRole`, `SignatureType` en
  `types/database.ts`.

### Variables de entorno requeridas

- `DOA_SIGNATURE_HMAC_SECRET` — obligatoria en cualquier entorno que firme
  decisiones (dev/stage/prod). Si falta, `POST /validate` devuelve 500 con
  mensaje claro. Anadida a `.env.example`.

### Eventos de observabilidad emitidos

- `project.validation.submitted` (success/failure)
- `project.validation.decided` (success/failure)
- `project.validation.resumed` (success)
- `project.validar.signature_inconsistent` (failure, severity=error)
- `project.validar.state_inconsistent` (failure, severity=error)

### TODOs / follow-ups

- **TODO(RLS)**: hoy cualquier user_label autenticado puede registrar una
  decision de validation. Falta gating por role (solo DOH/DOS para
  `validation_approval`) — implementar cuando exista table de roles.
- **TODO(nav)**: anadir entrada "Validaciones" en `components/layout/Sidebar.tsx`.
  El sidebar actual solo lista rutas top-level (`/projects`, `/quotations`,
  etc.), no subrutas de `/engineering/*`, asi que la entrada requiere decidir
  la taxonomia de navegacion primero.
- **TODO(HMAC rotation)**: politica formal de rotacion del secreto.
  Actualmente solo soporta `v1`; rotar requiere anadir `v2` a
  `getSecretForKeyId` y un process de re-firma opcional para registros
  historicos.
- **TODO(sprint-3/4)**: reutilizar `doa_project_signatures` para
  `delivery_release` y `closure` cuando se construyan esas fases.

## Sprint 1 — Close-the-loop (2026-04-16)

Sprint 1 landed: un project recien open ya puede vivir dentro de la app. Entregables principales:

- New maquina de statuses de execution de project (13 statuses + 4 fases) en `lib/workflow-states.ts` bajo `PROJECT_EXECUTION_STATES`, persistida en `doa_projects.execution_status` y `doa_projects.current_phase` (migracion `202604161000_proyectos_execution_status.sql`).
- Registro de deliverables por project en la new table `doa_project_deliverables` (migracion `202604161010_doa_project_deliverables.sql`), sembrada desde las selecciones de compliance de la request origen al llamar a `POST /api/projects/[id]/plan`.
- Configuracion visual de los 13 statuses sembrada en `doa_workflow_state_config` (scope `project_execution`, migracion `202604161020_doa_workflow_state_config_project_execution_seed.sql`).
- Endpoint `GET/POST /api/projects/[id]/deliverables` para listar y dar de high deliverables sueltos.
- Portfolio `/engineering/portfolio` ya no usa array vacio: lee `doa_projects` real y muestra badge resuelto con la maquina v2 cuando el project tiene `execution_status`.
- Detalle de project estrena un stepper horizontal (`components/project/ProjectStateStepper.tsx`) con las 4 fases y 13 statuses, y un tab "Deliverables" read-only con CTA "Planificar project" cuando `execution_status === 'project_opened'`.
- Nota: la agrupacion del Kanban del portfolio sigue usando el flujo legacy (`getProjectOperationalState`). Reagrupar por `current_phase` queda pending para Sprint 2.

## Resumen

La aplicacion DOA Operations Hub ya tiene una base estable para seguir iterando por lotes pequenos. La superficie visible esta concentrada en:

- `Quotations`, con board real, vista de lista, detalle de quotation, capa editable de statuses y detalle de requests entrantes con Aircraft Data, Project History y TCDS
- `Projects Historical`, con lista buscable y ficha de detalle en solo lectura
- `Projects`, con superficie visual y portfolio aun desacoplado de data reales
- `Clients`, ya conectado a `doa_clients` y `doa_client_contacts`
- `Asistente DOA`, is_active via OpenRouter

La app no esta en fase de bootstrap. Esta en fase de consolidacion y reconexion selectiva de data.

---

## Verificacion local realizada

Validation hecha sobre el repo actual el `2026-04-02`:

- `npm run lint` -> OK
- `npm run smoke` -> OK
- `npm run build` -> OK

Resultado practico:

- La navegacion protegida responde como se espera en smoke
- `api/workflow/transition` sigue devolviendo `503` a proposito
- `api/tools/chat` queda fuera del smoke por defecto salvo activacion explicita
- El build de produccion pasa con Next.js 16.2.1, React 19.2.4 y TypeScript

---

## Quotations

### Vista primary

La page `/quotations` funciona como workspace commercial con selector de vistas:

- `Tablero` como vista primary
- `Lista` como lectura alternativa de los mismos statuses
- Scroll horizontal real en columnas
- Scroll vertical real en la shell

No es una portada mock. Es una superficie real de trabajo visual, aunque hoy no consuma aun un model completo de quotations persistidas.

### Statuses del board (pipeline unificado de 10 columnas)

El board de `Quotations` es un pipeline unificado de 10 statuses que cubre desde la recepcion de una request hasta el closure de la quote:

| # | Status | Codigo technical | Color |
|---|--------|---------------|-------|
| 1 | Request received | `request_received` | sky |
| 2 | Form sent. Awaiting response | `form_sent` | cyan |
| 3 | General form received. Review | `form_received` | teal |
| 4 | Define scope. Preliminary | `define_scope` | emerald |
| 5 | Scope defined. Prepare quote | `scope_defined` | green |
| 6 | Quote prepared. Review | `quote_in_review` | amber |
| 7 | Quote sent to client | `quote_sent` | violet |
| 8 | Quote accepted | `quote_accepted` | indigo |
| 9 | Quote rejected | `quote_rejected` | rose |
| 10 | Review final. Abrir project | `final_review` | slate |

Ademas existe el status `archived` que oculta la request del tablero.

La arquitectura de statuses esta separada por capas:

- Definicion technical en `lib/workflow-states.ts` (`QUOTATION_BOARD_STATES` + `QUOTATION_BOARD_STATE_CONFIG`)
- Resolucion de labels, colores y sort_order en `lib/workflow-state-config.ts`
- Lectura server-side en `lib/workflow-state-config.server.ts`
- Persistencia via `app/api/workflow/state-config/route.ts`

Status real hoy:

- Los labels visibles, colores y sort_order se pueden editar
- Los `state_code` siguen siendo fijos
- Si `doa_workflow_state_config` no existe o falla, la app vuelve a defaults definidos en codigo
- Los statuses custom del board siguen siendo locales en `localStorage`

### Cambio de status via n8n

El cambio de status en las tarjetas del tablero y en la page de detalle funciona con el mismo patron que projects:

1. El user_label selecciona un new status en el dropdown (`QuotationStateSelector`)
2. El componente llama al webhook de n8n `doa-quotation-cambio-status`
3. n8n actualiza el campo `status` en `doa_incoming_requests` via nodo Supabase nativo
4. La app refresca y lee el new status de Supabase

Componentes involucrados:

| Pieza | Archivo | Que hace |
|-------|---------|----------|
| Selector de status | `app/(dashboard)/quotations/QuotationStateSelector.tsx` | Dropdown con los 10 statuses, llama al webhook |
| Webhook n8n | Workflow `DOA - Cambio Status Quotation` (ID: `pU645EznWCSbSq2Y`) | Recibe el POST y actualiza Supabase |
| API route (backup) | `app/api/incoming-requests/[id]/state/route.ts` | PATCH directo a Supabase, acepta ambos scopes de statuses |
| Variable de entorno | `DOA_QUOTATION_STATE_WEBHOOK_URL` | URL del webhook en `.env.local` (server-only, consumida por el proxy `/api/webhooks/quotation-state`) |

Payload que envia el selector al webhook:
```json
{
  "incoming_request_id": "uuid",
  "consulta_codigo": "QRY-XXXXXXXX",
  "previous_status": "request_received",
  "new_status": "define_scope",
  "fecha_hora": "2026-04-05T19:30:00.000Z"
}
```

### Mapeo de statuses legacy

Las requests entrantes originales usaban 3 statuses (`new`, `awaiting_form`, `form_received`). La funcion `mapIncomingStateToQuotationLane()` en `quotation-board-data.ts` convierte estos statuses legacy a columnas del pipeline unificado:

- `new` → `request_received`
- `awaiting_form` → `form_sent`
- `form_received` → `form_received`

Si el status ya es un codigo del pipeline (ej: `define_scope`), se usa tal cual sin conversion.

**Importante**: el board usa `estadoBackend` (el valor crudo de Supabase) para colocar tarjetas en columnas, NO el valor normalizado de `normalizeIncomingStatus()` que solo reconoce los 3 statuses legacy.

### Detalle de quotation

`/quotations/[id]` existe y ya tiene base visual para crecer:

- Resumen ejecutivo
- Alcance technical y supuestos
- Pricing y estrategia commercial
- Snapshot operativo
- Historial y siguientes pasos

Todavia no esta conectado a un backend final de quotations.

### Consultas entrantes

Las requests entrantes son la fuente de data primary del tablero de quotations. Cada request entrante se muestra como una tarjeta en el pipeline:

- `doa_incoming_requests` esta conectada
- `doa_client_contacts` esta conectada y se usa en el detalle de request para matching de client por email del sender
- n8n crea la fila inicial y rellena `form_url`
- El detalle `/quotations/incoming/[id]` existe e incluye:
  - **Dropdown de cambio de status** en la cabecera (mismo `QuotationStateSelector` que el tablero)
  - Seccion colapsable **Aircraft Data** con data de aircraft, upload y visualizacion de TCDS en PDF
  - Seccion colapsable **Project History** que muestra projects previos del client cuando se identifica un client conocido
  - Boton "+" en Project History que enlaza a `/historical-projects` para consultar el historical completo
- Seccion colapsable **Define scope. Preliminary** con comparacion 1-to-1 entre la request actual y los projects referencia (8 campos: description, aircraft, MSN, client, type trabajo, TCDS, objetivo operativo, año)
  - Seccion colapsable **Definir documentacion** con las 44 templates de compliance agrupadas por category como checkboxes. Pre-seleccion automatica basada en documents del project referencia. El ingeniero valida y guarda la seleccion. Data persistidos en `doa_incoming_requests.documentos_compliance` (jsonb). Plantillas servidas desde table `doa_compliance_templates`.
- `app/api/incoming-requests/[id]/send-client/route.ts` envia al webhook de n8n usando `form_url` ya existente
- Guardado de documents compliance via webhook n8n `DOA - Guardar Documents Compliance` (ID: `FUmlV5uBEnacTVs2`, path: `doa-compliance-docs`). Variable: `DOA_COMPLIANCE_DOCS_WEBHOOK_URL`
- La response del form ya no la aloja la app: n8n sirve el HTML y guarda en `doa_form_responses`
- El send de forms al client usa un unico webhook n8n (`doa-form-submit`) con campo `section` que determina el branching (client/aircraft)

Limite actual:

- La preview del form en `Mas detalle` depende de que las templates locales de `Forms` sigan alineadas con el HTML real que sirve n8n
- El tablero no tiene Supabase Realtime — tras cambiar status hay que esperar al `router.refresh()` para ver el movimiento (a diferencia de Projects que si tiene Realtime)

---

## Projects Historical

Superficie new para request de projects pasados, accesible desde el detalle de requests entrantes.

### Vista de lista

- `/historical-projects` muestra una table con search de todos los projects historicos
- Table con filtrado y search por text libre

### Vista de detalle

- `/historical-projects/[id]` presenta una ficha de project en modo solo lectura
- Secciones: data basicos, origen, description, documentacion DOA, metadata
- No es editable; sirve como referencia para el equipo commercial durante el triage de requests

### Acceso

- Desde el detalle de request entrante (`/quotations/incoming/[id]`), el boton "+" en la seccion Project History enlaza a esta superficie
- Tambien accesible directamente por URL

---

## Projects

### Naming visible

La seccion technical `Engineering` se presenta al user_label como `Projects`.

### Status funcional

Hay dos superficies distintas que no conviene mezclar:

- `app/(dashboard)/engineering/page.tsx` -> superficie visual primary con board y lista mock
- `app/(dashboard)/engineering/portfolio/page.tsx` -> portfolio preparado, hoy sin data reales porque `projects` arranca vacio

Ademas existe workspace de detalle en `/engineering/projects/[id]`, pero depende de data de project, documents y tareas que no estan hoy reconectados como flujo completo.

Conclusiones practicas:

- `Projects` esta preparado para seguir creciendo
- No es aun un workflow operativo tan maduro como `Quotations`
- Cualquier trabajo aqui debe asumir reconexion progresiva de data

---

## Clients

`/clients` ya carga data reales desde `doa_clients`.

Esto la convierte en una de las areas menos mock del repo actual y en buen candidato para mejoras incrementales seguras.

Status real hoy:

- `doa_client_contacts` ya esta conectado en la app
- `Quotations` resuelve client conocido/desconocido por email del sender
- El detalle de request reutiliza el panel de client en la vista `Mas detalle`

---

## Databases y tools

- `/databases` sigue funcionando como navegador de catalogo, no como panel de operacion real de cada table
- `/tools/expert` usa `app/api/tools/chat/route.ts` con OpenRouter
- El chat no declara acceso a documents internos ni RAG real

---

## Mapa technical corto

La arquitectura que hoy manda en el repo es esta:

- `app/` define rutas y entrypoints
- `components/` contiene layout, UI base y piezas de feature
- `lib/` concentra workflow, config compartida y conexiones
- `store/` mantiene status UI minimo con Zustand
- `supabase/migrations/` refleja cambios de esquema y limpieza reciente
- `docs/` ya es la fuente primary para entender el status del producto
- `n8n-workflows/` describe ya el flujo real commercial para requests y forms
- n8n usa un unico webhook `doa-form-submit` con campo `section` para branching entre flujos de client y aircraft
- n8n tiene workflows dedicados para cambio de status: `doa_Project_cambio_Estado` (projects) y `DOA - Cambio Status Quotation` (quotations)

---

## Riesgos y hotspots para iterar

### Hotspot 1: workflow state config
- La app ya esta preparada para persistir labels, colores y sort_order
- La table `doa_workflow_state_config` sigue pending de migracion en este repo
- Cualquier cambio de statuses debe respetar esa realidad

### Hotspot 2: dominio de Projects
- La UI existe
- El flujo de data aun no esta consolidado
- Es facil meter logica visual new sobre una base todavia mock

### Hotspot 3: detalle de quotation
- La pantalla existe y la composicion esta avanzada
- Ya esta alineada con el flujo real de n8n para `form_url`
- Conviene evitar volver a introducir logica de forms alojados en app

### Hotspot 4: documentacion vs codigo
- El repo ya tiene buena documentacion
- Hay que mantenerla sincronizada porque varias zonas estan en reconexion parcial y es facil asumir mas madurez de la real

---

## Siguientes pasos recomendados

### Pending inmediato (proxima sesion)

- Anadir Supabase Realtime al tablero de Quotations para que las tarjetas se muevan en tiempo real tras cambiar status (mismo patron que ProjectsClient)
- Limpiar el componente `IncomingQueryStateControl` en `QuotationStatesBoard.tsx` — ya no se usa (reemplazado por `QuotationStateSelector`) pero sigue en el archivo
- Verificar que el n8n workflow `DOA - Cambio Status Quotation` esta activado y funcionando correctamente en todos los statuses

### Mejoras de consolidacion

- Asentar la migracion de `doa_workflow_state_config` para quitar la ambiguedad de persistencia
- Elegir si el siguiente frente incremental va por `Clients`, `Quotations` o `Projects`
- Mantener sincronizadas `Forms/` y el HTML real servido por n8n para que la preview siga siendo fiel
- Cuando una superficie pase de mock a real, actualizar `docs/02-bases-de-data.md` y este document en el mismo lote

### Auditoria de codigo

Ver `docs/07-auditoria-codigo.md` para el listado completo de 58 hallazgos. Resumen:
- 8 criticos (seguridad — para pre-produccion)
- 12 altos (estabilidad y dead code)
- 18 medios (rendimiento y UX)
- 20 bajos (quality de codigo)

---

## Sprint 3 — Close the loop (delivery al client)

Sprint 3 cierra el flujo del project desde `validated` hasta `client_confirmation`. La decision aprobada de DOH/DOS pasa a generar un Statement of Compliance (SoC) en PDF firmado HMAC, se envia al client via n8n y queda pending de su confirmacion mediante un enlace publico.

### Lo que landea

- **New table** `doa_project_deliveries` que registra cada dispatch (SoC + email) con state machine internal `pending -> sending -> sent -> client_confirmed` / `failed`. Migracion en `supabase/migrations/202604180000_doa_project_deliveries.sql`.
- **Renderer SoC PDF** (`lib/pdf/soc-renderer.tsx`) + builder de payload canonico determinista (`lib/pdf/canonical-payload.ts`). El mismo payload se firma HMAC y se renderiza como PDF.
- **Endpoints nuevos** bajo `app/api/projects/[id]/`:
  - `prepare-delivery` (POST) — genera y sube el SoC, transita `validated -> preparing_delivery`.
  - `send-delivery` (POST) — firma `delivery_release`, llama al webhook n8n, transita `preparing_delivery -> delivered`.
  - `confirmar-delivery` (POST y GET, PUBLICO sin auth) — recibe el token del enlace del email, marca la delivery como confirmada y transita a `client_confirmation`.
  - `deliveries` (GET) — lista de deliveries del project.
  - `deliveries/[deliveryId]/soc-pdf` (GET) — redirect 302 a signed URL fresca del PDF.
- **Pestana "Delivery"** (`app/(dashboard)/engineering/projects/[id]/DeliveryTab.tsx`) con deep link `?tab=delivery`. Adapta su UI al execution_status: CTA "Prepare delivery" en `validated`, preview del PDF + form de send en `preparing_delivery`, espera de confirmacion en `delivered`, confirmacion en `client_confirmation`. Siempre muestra el timeline de deliveries debajo.
- **Runbook n8n** en `docs/n8n-workflows/DOA-Send-Entregables.md` con la forma del webhook, verificacion HMAC y response esperada.

### Variables de entorno

- `DOA_SIGNATURE_HMAC_SECRET` (reusada de Sprint 2) — firma HMAC del release.
- `N8N_DELIVERY_WEBHOOK_URL` (NUEVA, requerida) — URL del webhook n8n que envia el email.
- `DOA_N8N_WEBHOOK_SECRET` (NUEVA, opcional) — si se define, la peticion al webhook incluye `x-doa-signature` (HMAC-SHA256 hex del raw body). Si no se define, la llamada sigue funcionando pero queda un TODO en logs.
- `NEXT_PUBLIC_APP_URL` (NUEVA, requerida) — base URL publica usada para construir el `confirmation_link` del email.
- `DOA_COMPANY_NAME` y `DOA_COMPANY_APPROVAL_NO` (opcionales) — aparecen como letterhead del SoC.

### Pasos manuales (uno por entorno)

1. Crear bucket `doa-deliverables` en Supabase Storage (private, sin politicas publicas). Las URL firmadas se generan desde el endpoint con el admin client.
2. Configurar las nuevas variables de entorno en `.env.local` (dev) y en el VPS (prod).
3. Importar el workflow n8n descrito en `docs/n8n-workflows/DOA-Send-Entregables.md`, pegarle la URL publica en `N8N_DELIVERY_WEBHOOK_URL` y copiar el secreto en `DOA_N8N_WEBHOOK_SECRET`.
4. Aplicar la migracion `202604180000_doa_project_deliveries.sql` (no se aplica automaticamente).

### TODOs flagged

- RLS por role: hoy cualquier user_label autenticado puede disparar un release; deberia restringirse a DOH/DOS.
- Retry automatico del webhook n8n en fallos transitorios.
- Plantilla HTML mas rica para el email (MJML).
- Rotacion de tokens de confirmacion (hoy el token vive indefinidamente hasta confirmar).
- Mapear `subpart_easa` desde el catalogo de templates cuando exista (hoy viene del deliverable o null).

## Sprint 4 — Cierre del project y precedentes (close-the-loop)

Sprint 4 cierra el bucle operativo. Un project confirmado por el client pasa a `closed` (con outcome, lecciones aprendidas y snapshot firmado de metricas), y despues a `project_archived` (reindex del precedente en Pinecone + refresh de la MV de metricas). El expediente archived alimenta el asistente de futuras cotizaciones y projects.

### Lo que landea

- **New table** `doa_project_closures` (`supabase/migrations/202604190000_doa_project_closures.sql`): una fila por project con outcome (`successful | successful_with_reservations | problematic | aborted`), snapshot jsonb de metricas computadas al closure, firma HMAC (via `signature_id -> doa_project_signatures`) y notes de closure.
- **New table** `doa_project_lessons` (`supabase/migrations/202604190010_doa_project_lessons.sql`): lecciones aprendidas con category (`technical | process | client | quality | planning | tools | regulatory | other`), type (`positive | negative | improvement | risk`), impact, recommendation y `tags text[]` indexado con GIN. Pueden asociarse a un closure (`closure_id`) o vivir sueltas (p.ej. retro tardia).
- **Materialized view** `doa_project_metrics_mv` (`supabase/migrations/202604190020_doa_project_metrics_mv.sql`) con agregados por project (deliverables/validaciones/deliveries, outcome, lecciones, dias). Tiene indice unique en `project_id` para soportar `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
- **Endpoints nuevos**:
  - `POST /api/projects/[id]/close` — valida outcome, computa snapshot, firma HMAC la decision de closure (signer_role=`doh`, signature_type=`closure`), crea la closure row, inserta lecciones en batch y transiciona `client_confirmation -> closed`.
  - `POST /api/projects/[id]/archive` — transiciona `closed -> project_archived`, dispara `reindexPrecedente(id)` (fail-soft) y `refresh_doa_project_metrics_mv` (fail-soft).
  - `GET /api/projects/[id]/closure` — devuelve la closure row, resumen de firma y lista de lecciones.
  - `GET|POST /api/projects/[id]/lessons` — listar y crear lecciones del project, aunque no este en closure.
  - `POST /api/engineering/precedentes/reindex` — reindex manual de un project concreto o de los ultimos 200 en `closed | project_archived` (fail-soft cuando Pinecone no esta configurado).
- **Helper** `lib/rag/precedentes.ts` (`reindexPrecedente(proyectoId)`): compone un text estructurado con outcome, deliverables, validaciones, deliveries, lecciones y lo upserta al indice Pinecone via records API (integrated embedding, sin embedding local).
- **Pestana "Cierre"** (`app/(dashboard)/engineering/projects/[id]/ClosureTab.tsx`) con deep link `?tab=closure`. Muestra el form de closure cuando el project esta en `client_confirmation`, vista read-only + CTA "Archive" cuando esta `closed`, y vista read-only + CTA "Reindexar precedente" cuando ya esta `project_archived`. Siempre expone el bloque de metricas computadas y la lista de lecciones.
- **Page de metricas** `app/(dashboard)/engineering/metrics/page.tsx` (+ `MetricsClient.tsx`). Intenta leer la MV y, si no existe, computa agregados en vivo desde tablas base mostrando un banner de modo fallback. Incluye KPIs, distribucion por fase/status, outcomes de closure y top-10 projects de mayor duracion.
- **PrecedentesSection extendida** con badge de fuente (`historical` para el indice OpenAI legacy, `archived` / `closed` para el new indice Pinecone) y contador de lecciones aprendidas asociado cuando el endpoint lo provee.

### Variables de entorno

- `DOA_SIGNATURE_HMAC_SECRET` (reusada) — firma HMAC del closure.
- `PINECONE_API_KEY` (NUEVA, opcional) — si falta, el reindex de precedentes queda fail-soft con warn en el log; el closure y el archived siguen funcionando.
- `PINECONE_INDEX_HOST` (NUEVA, opcional) — host del indice integrated-embedding (ej: `https://doa-precedentes-xxxx.svc.<region>.pinecone.io`). Se obtiene de la consola de Pinecone.
- `PINECONE_INDEX_PRECEDENTES` (NUEVA, opcional) — name del indice (solo para logs).
- `PINECONE_NAMESPACE` (NUEVA, opcional) — por defecto `__default__`.
- `PINECONE_PRECEDENTES_TEXT_FIELD` (NUEVA, opcional) — por defecto `text`; debe coincidir con el fieldMap del indice.

### Pasos manuales (uno por entorno)

1. Aplicar las migraciones en sort_order: `202604190000_doa_project_closures.sql`, `202604190010_doa_project_lessons.sql`, `202604190020_doa_project_metrics_mv.sql`.
2. Crear el indice Pinecone (integrated embedding, fieldMap `text`). Ejemplo: `doa-precedentes`, model `multilingual-e5-large` o equivalente.
3. Completar las variables de entorno de Pinecone en `.env.local` (dev) y en el VPS (prod).
4. Crear la funcion SQL `refresh_doa_project_metrics_mv()` SECURITY DEFINER (RPC) que ejecute `REFRESH MATERIALIZED VIEW CONCURRENTLY doa_project_metrics_mv;`. Mientras no exista, el archived seguira funcionando pero anotara warn en `project.archive.mv_refresh_failed`.
5. (Opcional) Ejecutar `POST /api/engineering/precedentes/reindex` con body vacio para indexar los projects ya cerrados/archivados.

### TODOs flagged

- Enforzar `signer_role` real (hoy se fija a `doh` en el closure). Requiere table/politica de roles.
- Completar `planned_hours` y `actual_hours` en la MV cuando existan los campos en `doa_projects` (hoy viene `NULL`).
- Calcular dwell por fase a partir de un historial de transiciones (hoy `days_in_execution|validation|delivery` son `NULL`). Requiere table `doa_project_state_history` o similar.
- Crear la RPC `refresh_doa_project_metrics_mv()` mencionada arriba.
- Unificar la carga de precedentes `historical` (legacy OpenAI) y `archived` (Pinecone) en un solo endpoint rankeado; hoy `PrecedentesSection` solo consume el legacy y el badge `Historical` es por defecto.
- RLS por role para `close` y `archive` (hoy cualquier user_label autenticado puede disparar el closure).
- Visibilidad en sidebar/engineering de la page `/engineering/metrics` (hoy se accede por URL directa).

## Bucle closed

Con Sprint 4 el ciclo completo **request -> cotizacion -> project -> validation -> delivery -> closure -> precedentes** queda implementado end-to-end. Los projects archivados alimentan el engine de search vectorial, las lecciones aprendidas quedan indexadas y la MV agrega el status operativo global del portafolio.
