# Estado actual de la aplicacion

## Crear Proyecto Nuevo (manual) (2026-04-15)

Alta manual de proyectos desde el Tablero (boton "Crear Proyecto Nuevo" arriba
a la derecha). Es un flujo independiente del automatico de Quotations
(`/api/consultas/[id]/abrir-proyecto`): se usa cuando un proyecto no nace de
una consulta entrante.

- Nuevo endpoint `POST /api/proyectos/crear-manual`: deriva numero_proyecto,
  crea carpetas, inserta en `doa_proyectos` (con `consulta_id = null`) y
  genera un `.docx` por cada plantilla G12/G18 seleccionada reemplazando
  `project_code` y `document_code` en `word/document.xml` via `jszip`.
- Nueva estructura de carpetas para estos proyectos:
  `00. Project info / 01. Compliance documents / 02. Working documents /
  03. Reference material / 04. Deliveries / 05. Correspondence`,
  anidada bajo `{NEW_ROOT}/{cliente}/{avion}/{anio}/{numero_proyecto}`.
- Nuevas variables de entorno en `.env.local.example`:
  `DOA_PROJECTS_NEW_ROOT` (raiz de proyectos manuales) y
  `DOA_PLANTILLAS_ROOT` (ruta de los `.dotx`).
- Modulos nuevos: `lib/proyectos/plantillas-docx.ts`,
  `lib/proyectos/crear-manual.ts`, `components/project/NewProjectModal.tsx`,
  y endpoints soporte `/api/clientes`, `/api/aeronaves/fabricantes`,
  `/api/aeronaves/modelos`. Requiere la dependencia `jszip`.

## Sprint 2 — Close-the-loop: Validacion DOH/DOS (2026-04-17)

Sprint 2 cierra el bucle de validacion: un proyecto con todos los deliverables
listos ya puede ser enviado a validacion, recibir decision firmada por DOH/DOS
con HMAC-SHA256 y volver a ejecucion con observaciones estructuradas.

### Que ha aterrizado

- Nueva tabla `doa_project_validations` — registro inmutable de cada decision
  de validacion (migracion `202604170000_doa_project_validations.sql`).
- Nueva tabla `doa_project_signatures` — firmas de no repudio Part 21J con
  HMAC-SHA256 sobre el canonical JSON del payload firmado
  (migracion `202604170010_doa_project_signatures.sql`).
- Helper de firma en `lib/signatures/hmac.ts`: `canonicalJSON`,
  `computeSignature`, `verifySignature`. Lee `DOA_SIGNATURE_HMAC_SECRET` y
  soporta rotacion por `hmac_key_id` (actualmente `v1`).
- Endpoints nuevos:
  - `POST /api/proyectos/[id]/enviar-a-validacion` — transiciona desde
    `en_ejecucion | revision_interna | listo_para_validacion` a `en_validacion`
    tras comprobar que todos los deliverables estan en `completado` o
    `no_aplica`.
  - `POST /api/proyectos/[id]/validar` — registra la decision (`aprobado` o
    `devuelto`), firma HMAC y transiciona a `validado` o
    `devuelto_a_ejecucion`. Maneja inconsistencias con
    `project.validar.signature_inconsistent` y `project.validar.state_inconsistent`.
  - `POST /api/proyectos/[id]/retomar` — transiciona de
    `devuelto_a_ejecucion` a `en_ejecucion`.
  - `GET /api/proyectos/[id]/validations` — lista validaciones enriquecidas con
    el email del validador.
- Pagina nueva `/engineering/validations` — cola de proyectos en `en_validacion`
  con cards, progreso de deliverables y tiempo en cola.
- `ValidationTab.tsx` en el detalle de proyecto: timeline de decisiones,
  formulario DOH/DOS con observaciones por deliverable y CTAs segun estado.
- Deep link `?tab=validacion` en el detalle de proyecto.
- En `DeliverablesTab` ahora aparece un CTA "Enviar a validacion" cuando todos
  los deliverables estan listos y el proyecto esta en
  `en_ejecucion | revision_interna | listo_para_validacion`.
- Constantes de UI para validacion en `lib/workflow-states.ts`:
  `VALIDATION_ROLE_LABELS`, `VALIDATION_DECISION_LABELS`,
  `OBSERVATION_SEVERITY_LABELS`, `DELIVERABLE_VALIDATION_READY_STATES`.
- Tipos `ProjectValidation`, `ProjectSignature`, `ValidationRole`,
  `ValidationDecision`, `ObservationSeverity`, `ValidationObservation`,
  `DeliverableSnapshot`, `SignerRole`, `SignatureType` en
  `types/database.ts`.

### Variables de entorno requeridas

- `DOA_SIGNATURE_HMAC_SECRET` — obligatoria en cualquier entorno que firme
  decisiones (dev/stage/prod). Si falta, `POST /validar` devuelve 500 con
  mensaje claro. Anadida a `.env.example`.

### Eventos de observabilidad emitidos

- `project.validation.submitted` (success/failure)
- `project.validation.decided` (success/failure)
- `project.validation.resumed` (success)
- `project.validar.signature_inconsistent` (failure, severity=error)
- `project.validar.state_inconsistent` (failure, severity=error)

### TODOs / follow-ups

- **TODO(RLS)**: hoy cualquier usuario autenticado puede registrar una
  decision de validacion. Falta gating por rol (solo DOH/DOS para
  `validation_approval`) — implementar cuando exista tabla de roles.
- **TODO(nav)**: anadir entrada "Validaciones" en `components/layout/Sidebar.tsx`.
  El sidebar actual solo lista rutas top-level (`/proyectos`, `/quotations`,
  etc.), no subrutas de `/engineering/*`, asi que la entrada requiere decidir
  la taxonomia de navegacion primero.
- **TODO(HMAC rotation)**: politica formal de rotacion del secreto.
  Actualmente solo soporta `v1`; rotar requiere anadir `v2` a
  `getSecretForKeyId` y un proceso de re-firma opcional para registros
  historicos.
- **TODO(sprint-3/4)**: reutilizar `doa_project_signatures` para
  `delivery_release` y `closure` cuando se construyan esas fases.

## Sprint 1 — Close-the-loop (2026-04-16)

Sprint 1 landed: un proyecto recien abierto ya puede vivir dentro de la app. Entregables principales:

- Nueva maquina de estados de ejecucion de proyecto (13 estados + 4 fases) en `lib/workflow-states.ts` bajo `PROJECT_EXECUTION_STATES`, persistida en `doa_proyectos.estado_v2` y `doa_proyectos.fase_actual` (migracion `202604161000_proyectos_estado_v2.sql`).
- Registro de deliverables por proyecto en la nueva tabla `doa_project_deliverables` (migracion `202604161010_doa_project_deliverables.sql`), sembrada desde las selecciones de compliance de la consulta origen al llamar a `POST /api/proyectos/[id]/planificar`.
- Configuracion visual de los 13 estados sembrada en `doa_workflow_state_config` (scope `project_execution`, migracion `202604161020_doa_workflow_state_config_project_execution_seed.sql`).
- Endpoint `GET/POST /api/proyectos/[id]/deliverables` para listar y dar de alta deliverables sueltos.
- Portfolio `/engineering/portfolio` ya no usa array vacio: lee `doa_proyectos` real y muestra badge resuelto con la maquina v2 cuando el proyecto tiene `estado_v2`.
- Detalle de proyecto estrena un stepper horizontal (`components/project/ProjectStateStepper.tsx`) con las 4 fases y 13 estados, y un tab "Deliverables" read-only con CTA "Planificar proyecto" cuando `estado_v2 === 'proyecto_abierto'`.
- Nota: la agrupacion del Kanban del portfolio sigue usando el flujo legacy (`getProjectOperationalState`). Reagrupar por `fase_actual` queda pendiente para Sprint 2.

## Resumen

La aplicacion DOA Operations Hub ya tiene una base estable para seguir iterando por lotes pequenos. La superficie visible esta concentrada en:

- `Quotations`, con board real, vista de lista, detalle de quotation, capa editable de estados y detalle de consultas entrantes con Aircraft Data, Project History y TCDS
- `Proyectos Historico`, con lista buscable y ficha de detalle en solo lectura
- `Proyectos`, con superficie visual y portfolio aun desacoplado de datos reales
- `Clientes`, ya conectado a `doa_clientes_datos_generales` y `doa_clientes_contactos`
- `Asistente DOA`, activo via OpenRouter

La app no esta en fase de bootstrap. Esta en fase de consolidacion y reconexion selectiva de datos.

---

## Verificacion local realizada

Validacion hecha sobre el repo actual el `2026-04-02`:

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

### Vista principal

La pagina `/quotations` funciona como workspace comercial con selector de vistas:

- `Tablero` como vista principal
- `Lista` como lectura alternativa de los mismos estados
- Scroll horizontal real en columnas
- Scroll vertical real en la shell

No es una portada mock. Es una superficie real de trabajo visual, aunque hoy no consuma aun un modelo completo de quotations persistidas.

### Estados del board (pipeline unificado de 10 columnas)

El board de `Quotations` es un pipeline unificado de 10 estados que cubre desde la recepcion de una consulta hasta el cierre de la oferta:

| # | Estado | Codigo tecnico | Color |
|---|--------|---------------|-------|
| 1 | Entrada recibida | `entrada_recibida` | sky |
| 2 | Formulario enviado. Esperando respuesta | `formulario_enviado` | cyan |
| 3 | Formulario general recibido. Revisar | `formulario_recibido` | teal |
| 4 | Definir alcance. Preliminar | `definir_alcance` | emerald |
| 5 | Alcance definido. Preparar oferta | `alcance_definido` | green |
| 6 | Oferta preparada. Revisar | `oferta_en_revision` | amber |
| 7 | Oferta enviada a cliente | `oferta_enviada` | violet |
| 8 | Oferta aceptada | `oferta_aceptada` | indigo |
| 9 | Oferta rechazada | `oferta_rechazada` | rose |
| 10 | Revision final. Abrir proyecto | `revision_final` | slate |

Ademas existe el estado `archivado` que oculta la consulta del tablero.

La arquitectura de estados esta separada por capas:

- Definicion tecnica en `lib/workflow-states.ts` (`QUOTATION_BOARD_STATES` + `QUOTATION_BOARD_STATE_CONFIG`)
- Resolucion de labels, colores y orden en `lib/workflow-state-config.ts`
- Lectura server-side en `lib/workflow-state-config.server.ts`
- Persistencia via `app/api/workflow/state-config/route.ts`

Estado real hoy:

- Los labels visibles, colores y orden se pueden editar
- Los `state_code` siguen siendo fijos
- Si `doa_workflow_state_config` no existe o falla, la app vuelve a defaults definidos en codigo
- Los estados custom del board siguen siendo locales en `localStorage`

### Cambio de estado via n8n

El cambio de estado en las tarjetas del tablero y en la pagina de detalle funciona con el mismo patron que proyectos:

1. El usuario selecciona un nuevo estado en el dropdown (`QuotationStateSelector`)
2. El componente llama al webhook de n8n `doa-quotation-cambio-estado`
3. n8n actualiza el campo `estado` en `doa_consultas_entrantes` via nodo Supabase nativo
4. La app refresca y lee el nuevo estado de Supabase

Componentes involucrados:

| Pieza | Archivo | Que hace |
|-------|---------|----------|
| Selector de estado | `app/(dashboard)/quotations/QuotationStateSelector.tsx` | Dropdown con los 10 estados, llama al webhook |
| Webhook n8n | Workflow `DOA - Cambio Estado Quotation` (ID: `pU645EznWCSbSq2Y`) | Recibe el POST y actualiza Supabase |
| API route (backup) | `app/api/consultas/[id]/state/route.ts` | PATCH directo a Supabase, acepta ambos scopes de estados |
| Variable de entorno | `DOA_QUOTATION_STATE_WEBHOOK_URL` | URL del webhook en `.env.local` (server-only, consumida por el proxy `/api/webhooks/quotation-state`) |

Payload que envia el selector al webhook:
```json
{
  "consulta_id": "uuid",
  "consulta_codigo": "QRY-XXXXXXXX",
  "estado_anterior": "entrada_recibida",
  "estado_nuevo": "definir_alcance",
  "fecha_hora": "2026-04-05T19:30:00.000Z"
}
```

### Mapeo de estados legacy

Las consultas entrantes originales usaban 3 estados (`nuevo`, `esperando_formulario`, `formulario_recibido`). La funcion `mapIncomingStateToQuotationLane()` en `quotation-board-data.ts` convierte estos estados legacy a columnas del pipeline unificado:

- `nuevo` → `entrada_recibida`
- `esperando_formulario` → `formulario_enviado`
- `formulario_recibido` → `formulario_recibido`

Si el estado ya es un codigo del pipeline (ej: `definir_alcance`), se usa tal cual sin conversion.

**Importante**: el board usa `estadoBackend` (el valor crudo de Supabase) para colocar tarjetas en columnas, NO el valor normalizado de `normalizeIncomingStatus()` que solo reconoce los 3 estados legacy.

### Detalle de quotation

`/quotations/[id]` existe y ya tiene base visual para crecer:

- Resumen ejecutivo
- Alcance tecnico y supuestos
- Pricing y estrategia comercial
- Snapshot operativo
- Historial y siguientes pasos

Todavia no esta conectado a un backend final de quotations.

### Consultas entrantes

Las consultas entrantes son la fuente de datos principal del tablero de quotations. Cada consulta entrante se muestra como una tarjeta en el pipeline:

- `doa_consultas_entrantes` esta conectada
- `doa_clientes_contactos` esta conectada y se usa en el detalle de consulta para matching de cliente por email del remitente
- n8n crea la fila inicial y rellena `url_formulario`
- El detalle `/quotations/incoming/[id]` existe e incluye:
  - **Dropdown de cambio de estado** en la cabecera (mismo `QuotationStateSelector` que el tablero)
  - Seccion colapsable **Aircraft Data** con datos de aeronave, upload y visualizacion de TCDS en PDF
  - Seccion colapsable **Project History** que muestra proyectos previos del cliente cuando se identifica un cliente conocido
  - Boton "+" en Project History que enlaza a `/proyectos-historico` para consultar el historico completo
- Seccion colapsable **Definir alcance. Preliminar** con comparacion 1-to-1 entre la consulta actual y los proyectos referencia (8 campos: descripcion, aeronave, MSN, cliente, tipo trabajo, TCDS, objetivo operativo, año)
  - Seccion colapsable **Definir documentacion** con las 44 plantillas de compliance agrupadas por categoria como checkboxes. Pre-seleccion automatica basada en documentos del proyecto referencia. El ingeniero valida y guarda la seleccion. Datos persistidos en `doa_consultas_entrantes.documentos_compliance` (jsonb). Plantillas servidas desde tabla `doa_plantillas_compliance`.
- `app/api/consultas/[id]/send-client/route.ts` envia al webhook de n8n usando `url_formulario` ya existente
- Guardado de documentos compliance via webhook n8n `DOA - Guardar Documentos Compliance` (ID: `FUmlV5uBEnacTVs2`, path: `doa-compliance-docs`). Variable: `DOA_COMPLIANCE_DOCS_WEBHOOK_URL`
- La respuesta del formulario ya no la aloja la app: n8n sirve el HTML y guarda en `doa_respuestas_formularios`
- El envio de formularios al cliente usa un unico webhook n8n (`doa-form-submit`) con campo `section` que determina el branching (client/aircraft)

Limite actual:

- La preview del formulario en `Mas detalle` depende de que las plantillas locales de `Formularios` sigan alineadas con el HTML real que sirve n8n
- El tablero no tiene Supabase Realtime — tras cambiar estado hay que esperar al `router.refresh()` para ver el movimiento (a diferencia de Proyectos que si tiene Realtime)

---

## Proyectos Historico

Superficie nueva para consulta de proyectos pasados, accesible desde el detalle de consultas entrantes.

### Vista de lista

- `/proyectos-historico` muestra una tabla con busqueda de todos los proyectos historicos
- Tabla con filtrado y busqueda por texto libre

### Vista de detalle

- `/proyectos-historico/[id]` presenta una ficha de proyecto en modo solo lectura
- Secciones: datos basicos, origen, descripcion, documentacion DOA, metadata
- No es editable; sirve como referencia para el equipo comercial durante el triage de consultas

### Acceso

- Desde el detalle de consulta entrante (`/quotations/incoming/[id]`), el boton "+" en la seccion Project History enlaza a esta superficie
- Tambien accesible directamente por URL

---

## Proyectos

### Naming visible

La seccion tecnica `Engineering` se presenta al usuario como `Proyectos`.

### Estado funcional

Hay dos superficies distintas que no conviene mezclar:

- `app/(dashboard)/engineering/page.tsx` -> superficie visual principal con board y lista mock
- `app/(dashboard)/engineering/portfolio/page.tsx` -> portfolio preparado, hoy sin datos reales porque `projects` arranca vacio

Ademas existe workspace de detalle en `/engineering/projects/[id]`, pero depende de datos de proyecto, documentos y tareas que no estan hoy reconectados como flujo completo.

Conclusiones practicas:

- `Proyectos` esta preparado para seguir creciendo
- No es aun un workflow operativo tan maduro como `Quotations`
- Cualquier trabajo aqui debe asumir reconexion progresiva de datos

---

## Clientes

`/clients` ya carga datos reales desde `doa_clientes_datos_generales`.

Esto la convierte en una de las areas menos mock del repo actual y en buen candidato para mejoras incrementales seguras.

Estado real hoy:

- `doa_clientes_contactos` ya esta conectado en la app
- `Quotations` resuelve cliente conocido/desconocido por email del remitente
- El detalle de consulta reutiliza el panel de cliente en la vista `Mas detalle`

---

## Databases y herramientas

- `/databases` sigue funcionando como navegador de catalogo, no como panel de operacion real de cada tabla
- `/tools/experto` usa `app/api/tools/chat/route.ts` con OpenRouter
- El chat no declara acceso a documentos internos ni RAG real

---

## Mapa tecnico corto

La arquitectura que hoy manda en el repo es esta:

- `app/` define rutas y entrypoints
- `components/` contiene layout, UI base y piezas de feature
- `lib/` concentra workflow, config compartida y conexiones
- `store/` mantiene estado UI minimo con Zustand
- `supabase/migrations/` refleja cambios de esquema y limpieza reciente
- `docs/` ya es la fuente principal para entender el estado del producto
- `n8n-workflows/` describe ya el flujo real comercial para consultas y formularios
- n8n usa un unico webhook `doa-form-submit` con campo `section` para branching entre flujos de cliente y aeronave
- n8n tiene workflows dedicados para cambio de estado: `doa_Project_cambio_Estado` (proyectos) y `DOA - Cambio Estado Quotation` (quotations)

---

## Riesgos y hotspots para iterar

### Hotspot 1: workflow state config
- La app ya esta preparada para persistir labels, colores y orden
- La tabla `doa_workflow_state_config` sigue pendiente de migracion en este repo
- Cualquier cambio de estados debe respetar esa realidad

### Hotspot 2: dominio de Proyectos
- La UI existe
- El flujo de datos aun no esta consolidado
- Es facil meter logica visual nueva sobre una base todavia mock

### Hotspot 3: detalle de quotation
- La pantalla existe y la composicion esta avanzada
- Ya esta alineada con el flujo real de n8n para `url_formulario`
- Conviene evitar volver a introducir logica de formularios alojados en app

### Hotspot 4: documentacion vs codigo
- El repo ya tiene buena documentacion
- Hay que mantenerla sincronizada porque varias zonas estan en reconexion parcial y es facil asumir mas madurez de la real

---

## Siguientes pasos recomendados

### Pendiente inmediato (proxima sesion)

- Anadir Supabase Realtime al tablero de Quotations para que las tarjetas se muevan en tiempo real tras cambiar estado (mismo patron que ProyectosClient)
- Limpiar el componente `IncomingQueryStateControl` en `QuotationStatesBoard.tsx` — ya no se usa (reemplazado por `QuotationStateSelector`) pero sigue en el archivo
- Verificar que el n8n workflow `DOA - Cambio Estado Quotation` esta activado y funcionando correctamente en todos los estados

### Mejoras de consolidacion

- Asentar la migracion de `doa_workflow_state_config` para quitar la ambiguedad de persistencia
- Elegir si el siguiente frente incremental va por `Clientes`, `Quotations` o `Proyectos`
- Mantener sincronizadas `Formularios/` y el HTML real servido por n8n para que la preview siga siendo fiel
- Cuando una superficie pase de mock a real, actualizar `docs/02-bases-de-datos.md` y este documento en el mismo lote

### Auditoria de codigo

Ver `docs/07-auditoria-codigo.md` para el listado completo de 58 hallazgos. Resumen:
- 8 criticos (seguridad — para pre-produccion)
- 12 altos (estabilidad y dead code)
- 18 medios (rendimiento y UX)
- 20 bajos (calidad de codigo)

---

## Sprint 3 — Close the loop (entrega al cliente)

Sprint 3 cierra el flujo del proyecto desde `validado` hasta `confirmacion_cliente`. La decision aprobada de DOH/DOS pasa a generar un Statement of Compliance (SoC) en PDF firmado HMAC, se envia al cliente via n8n y queda pendiente de su confirmacion mediante un enlace publico.

### Lo que landea

- **Nueva tabla** `doa_project_deliveries` que registra cada dispatch (SoC + email) con state machine interno `pendiente -> enviando -> enviado -> confirmado_cliente` / `fallo`. Migracion en `supabase/migrations/202604180000_doa_project_deliveries.sql`.
- **Renderer SoC PDF** (`lib/pdf/soc-renderer.tsx`) + builder de payload canonico determinista (`lib/pdf/canonical-payload.ts`). El mismo payload se firma HMAC y se renderiza como PDF.
- **Endpoints nuevos** bajo `app/api/proyectos/[id]/`:
  - `preparar-entrega` (POST) — genera y sube el SoC, transita `validado -> preparando_entrega`.
  - `enviar-entrega` (POST) — firma `delivery_release`, llama al webhook n8n, transita `preparando_entrega -> entregado`.
  - `confirmar-entrega` (POST y GET, PUBLICO sin auth) — recibe el token del enlace del email, marca la delivery como confirmada y transita a `confirmacion_cliente`.
  - `deliveries` (GET) — lista de entregas del proyecto.
  - `deliveries/[deliveryId]/soc-pdf` (GET) — redirect 302 a signed URL fresca del PDF.
- **Pestana "Entrega"** (`app/(dashboard)/engineering/projects/[id]/DeliveryTab.tsx`) con deep link `?tab=entrega`. Adapta su UI al estado_v2: CTA "Preparar entrega" en `validado`, preview del PDF + form de envio en `preparando_entrega`, espera de confirmacion en `entregado`, confirmacion en `confirmacion_cliente`. Siempre muestra el timeline de entregas debajo.
- **Runbook n8n** en `docs/n8n-workflows/DOA-Enviar-Entregables.md` con la forma del webhook, verificacion HMAC y respuesta esperada.

### Variables de entorno

- `DOA_SIGNATURE_HMAC_SECRET` (reusada de Sprint 2) — firma HMAC del release.
- `N8N_DELIVERY_WEBHOOK_URL` (NUEVA, requerida) — URL del webhook n8n que envia el email.
- `DOA_N8N_WEBHOOK_SECRET` (NUEVA, opcional) — si se define, la peticion al webhook incluye `x-doa-signature` (HMAC-SHA256 hex del raw body). Si no se define, la llamada sigue funcionando pero queda un TODO en logs.
- `NEXT_PUBLIC_APP_URL` (NUEVA, requerida) — base URL publica usada para construir el `confirmation_link` del email.
- `DOA_COMPANY_NAME` y `DOA_COMPANY_APPROVAL_NO` (opcionales) — aparecen como letterhead del SoC.

### Pasos manuales (uno por entorno)

1. Crear bucket `doa-deliverables` en Supabase Storage (privado, sin politicas publicas). Las URL firmadas se generan desde el endpoint con el admin client.
2. Configurar las nuevas variables de entorno en `.env.local` (dev) y en el VPS (prod).
3. Importar el workflow n8n descrito en `docs/n8n-workflows/DOA-Enviar-Entregables.md`, pegarle la URL publica en `N8N_DELIVERY_WEBHOOK_URL` y copiar el secreto en `DOA_N8N_WEBHOOK_SECRET`.
4. Aplicar la migracion `202604180000_doa_project_deliveries.sql` (no se aplica automaticamente).

### TODOs flagged

- RLS por rol: hoy cualquier usuario autenticado puede disparar un release; deberia restringirse a DOH/DOS.
- Retry automatico del webhook n8n en fallos transitorios.
- Plantilla HTML mas rica para el email (MJML).
- Rotacion de tokens de confirmacion (hoy el token vive indefinidamente hasta confirmar).
- Mapear `subpart_easa` desde el catalogo de plantillas cuando exista (hoy viene del deliverable o null).

## Sprint 4 — Cierre del proyecto y precedentes (close-the-loop)

Sprint 4 cierra el bucle operativo. Un proyecto confirmado por el cliente pasa a `cerrado` (con outcome, lecciones aprendidas y snapshot firmado de metricas), y despues a `archivado_proyecto` (reindex del precedente en Pinecone + refresh de la MV de metricas). El expediente archivado alimenta el asistente de futuras cotizaciones y proyectos.

### Lo que landea

- **Nueva tabla** `doa_project_closures` (`supabase/migrations/202604190000_doa_project_closures.sql`): una fila por proyecto con outcome (`exitoso | exitoso_con_reservas | problematico | abortado`), snapshot jsonb de metricas computadas al cierre, firma HMAC (via `signature_id -> doa_project_signatures`) y notas de cierre.
- **Nueva tabla** `doa_project_lessons` (`supabase/migrations/202604190010_doa_project_lessons.sql`): lecciones aprendidas con categoria (`tecnica | proceso | cliente | calidad | planificacion | herramientas | regulatoria | otro`), tipo (`positiva | negativa | mejora | riesgo`), impacto, recomendacion y `tags text[]` indexado con GIN. Pueden asociarse a un cierre (`closure_id`) o vivir sueltas (p.ej. retro tardia).
- **Materialized view** `doa_project_metrics_mv` (`supabase/migrations/202604190020_doa_project_metrics_mv.sql`) con agregados por proyecto (deliverables/validaciones/entregas, outcome, lecciones, dias). Tiene indice unique en `proyecto_id` para soportar `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
- **Endpoints nuevos**:
  - `POST /api/proyectos/[id]/cerrar` — valida outcome, computa snapshot, firma HMAC la decision de cierre (signer_role=`doh`, signature_type=`closure`), crea la closure row, inserta lecciones en batch y transiciona `confirmacion_cliente -> cerrado`.
  - `POST /api/proyectos/[id]/archivar` — transiciona `cerrado -> archivado_proyecto`, dispara `reindexPrecedente(id)` (fail-soft) y `refresh_doa_project_metrics_mv` (fail-soft).
  - `GET /api/proyectos/[id]/closure` — devuelve la closure row, resumen de firma y lista de lecciones.
  - `GET|POST /api/proyectos/[id]/lessons` — listar y crear lecciones del proyecto, aunque no este en cierre.
  - `POST /api/engineering/precedentes/reindex` — reindex manual de un proyecto concreto o de los ultimos 200 en `cerrado | archivado_proyecto` (fail-soft cuando Pinecone no esta configurado).
- **Helper** `lib/rag/precedentes.ts` (`reindexPrecedente(proyectoId)`): compone un texto estructurado con outcome, deliverables, validaciones, entregas, lecciones y lo upserta al indice Pinecone via records API (integrated embedding, sin embedding local).
- **Pestana "Cierre"** (`app/(dashboard)/engineering/projects/[id]/ClosureTab.tsx`) con deep link `?tab=cierre`. Muestra el formulario de cierre cuando el proyecto esta en `confirmacion_cliente`, vista read-only + CTA "Archivar" cuando esta `cerrado`, y vista read-only + CTA "Reindexar precedente" cuando ya esta `archivado_proyecto`. Siempre expone el bloque de metricas computadas y la lista de lecciones.
- **Pagina de metricas** `app/(dashboard)/engineering/metrics/page.tsx` (+ `MetricsClient.tsx`). Intenta leer la MV y, si no existe, computa agregados en vivo desde tablas base mostrando un banner de modo fallback. Incluye KPIs, distribucion por fase/estado, outcomes de cierre y top-10 proyectos de mayor duracion.
- **PrecedentesSection extendida** con badge de fuente (`historico` para el indice OpenAI legacy, `archivado` / `cerrado` para el nuevo indice Pinecone) y contador de lecciones aprendidas asociado cuando el endpoint lo provee.

### Variables de entorno

- `DOA_SIGNATURE_HMAC_SECRET` (reusada) — firma HMAC del cierre.
- `PINECONE_API_KEY` (NUEVA, opcional) — si falta, el reindex de precedentes queda fail-soft con warn en el log; el cierre y el archivado siguen funcionando.
- `PINECONE_INDEX_HOST` (NUEVA, opcional) — host del indice integrated-embedding (ej: `https://doa-precedentes-xxxx.svc.<region>.pinecone.io`). Se obtiene de la consola de Pinecone.
- `PINECONE_INDEX_PRECEDENTES` (NUEVA, opcional) — nombre del indice (solo para logs).
- `PINECONE_NAMESPACE` (NUEVA, opcional) — por defecto `__default__`.
- `PINECONE_PRECEDENTES_TEXT_FIELD` (NUEVA, opcional) — por defecto `text`; debe coincidir con el fieldMap del indice.

### Pasos manuales (uno por entorno)

1. Aplicar las migraciones en orden: `202604190000_doa_project_closures.sql`, `202604190010_doa_project_lessons.sql`, `202604190020_doa_project_metrics_mv.sql`.
2. Crear el indice Pinecone (integrated embedding, fieldMap `text`). Ejemplo: `doa-precedentes`, modelo `multilingual-e5-large` o equivalente.
3. Completar las variables de entorno de Pinecone en `.env.local` (dev) y en el VPS (prod).
4. Crear la funcion SQL `refresh_doa_project_metrics_mv()` SECURITY DEFINER (RPC) que ejecute `REFRESH MATERIALIZED VIEW CONCURRENTLY doa_project_metrics_mv;`. Mientras no exista, el archivado seguira funcionando pero anotara warn en `project.archivar.mv_refresh_failed`.
5. (Opcional) Ejecutar `POST /api/engineering/precedentes/reindex` con body vacio para indexar los proyectos ya cerrados/archivados.

### TODOs flagged

- Enforzar `signer_role` real (hoy se fija a `doh` en el cierre). Requiere tabla/politica de roles.
- Completar `horas_plan` y `horas_real` en la MV cuando existan los campos en `doa_proyectos` (hoy viene `NULL`).
- Calcular dwell por fase a partir de un historial de transiciones (hoy `dias_en_ejecucion|validacion|entrega` son `NULL`). Requiere tabla `doa_project_state_history` o similar.
- Crear la RPC `refresh_doa_project_metrics_mv()` mencionada arriba.
- Unificar la carga de precedentes `historico` (legacy OpenAI) y `archivado` (Pinecone) en un solo endpoint rankeado; hoy `PrecedentesSection` solo consume el legacy y el badge `Historico` es por defecto.
- RLS por rol para `cerrar` y `archivar` (hoy cualquier usuario autenticado puede disparar el cierre).
- Visibilidad en sidebar/engineering de la pagina `/engineering/metrics` (hoy se accede por URL directa).

## Bucle cerrado

Con Sprint 4 el ciclo completo **consulta -> cotizacion -> proyecto -> validacion -> entrega -> cierre -> precedentes** queda implementado end-to-end. Los proyectos archivados alimentan el motor de busqueda vectorial, las lecciones aprendidas quedan indexadas y la MV agrega el estado operativo global del portafolio.
