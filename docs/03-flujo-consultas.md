# Flujo de Consultas Entrantes y Pipeline de Cotizaciones

## Resumen
Este document explica como funciona hoy el flujo completo de requests y cotizaciones: desde que un client envia un email hasta el closure de la quote. n8n es la fuente de verdad para el high inicial, la URL del form, la response del client, y los cambios de status en el pipeline.

## Pipeline unificado de 10 statuses

El tablero de quotations muestra un pipeline unico de 10 columnas. Las requests entrantes y las cotizaciones comparten el mismo board:

### Fase de recepcion (statuses 1-3, automaticos via n8n)

1. **Request received** (`request_received`) — Ha llegado una request de un client por email. n8n procesa el email y crea la fila en `doa_incoming_requests`.
2. **Form sent. Awaiting response** (`form_sent`) — El ingeniero send el form al client. La app usa `form_url` y n8n envia el email.
3. **General form received. Review** (`form_received`) — El client completo el form. n8n guarda la response en `doa_form_responses`.

### Fase de cotizacion (statuses 4-10, cambio manual via dropdown)

4. **Define scope. Preliminary** (`define_scope`) — Revisar la informacion y definir el alcance del trabajo.
5. **Scope defined. Prepare quote** (`scope_defined`) — Alcance claro, prepare la quote economica.
6. **Quote prepared. Review** (`quote_in_review`) — Oferta lista, review internal antes de send.
7. **Quote sent to client** (`quote_sent`) — Oferta sent, awaiting response del client.
8. **Quote accepted** (`quote_accepted`) — El client acepto la quote.
9. **Quote rejected** (`quote_rejected`) — El client rechazo la quote.
10. **Review final. Abrir project** (`final_review`) — Review final antes de abrir project en Engineering.

Ademas existe **Archived** (`archived`) que oculta la request del tablero.

### Cambio de status

El cambio de status funciona via n8n (mismo patron que projects):
1. El user_label selecciona un new status en el dropdown de la tarjeta o de la page de detalle
2. `QuotationStateSelector` llama al webhook `doa-quotation-cambio-status`
3. n8n actualiza el campo `status` en `doa_incoming_requests`
4. La app refresca y lee el new status

## Diagrama del flujo

```
Client envia email
  -> n8n procesa el email
  -> n8n crea fila en doa_incoming_requests + form_url -> Status: REQUEST_RECEIVED
  -> Ingeniero revisa y envia response con form
  -> App usa form_url existente
  -> n8n envia el email -> Status: FORM_SENT
  -> Client rellena el form
  -> n8n recibe response y la guarda en doa_form_responses -> Status: FORM_RECEIVED
  -> Ingeniero cambia status manualmente via dropdown en el tablero o detalle:
     -> DEFINE_SCOPE -> SCOPE_DEFINED -> QUOTE_IN_REVIEW
     -> QUOTE_SENT -> QUOTE_ACCEPTED / QUOTE_REJECTED -> FINAL_REVIEW
  -> Cada cambio manual llama al webhook n8n que actualiza Supabase
```

## Campo `form_url`

La table `doa_incoming_requests` contiene el campo `form_url`. Almacena la URL publica del form que se envia al client. n8n la genera durante el high de la request y la persiste directamente en la fila. La app la lee para componer el email de response al client.

## Arquitectura de send de forms

### Plantillas HTML

Los forms son HTML puro servido por n8n. Las templates se almacenan como archivos `.txt` en Google Drive y n8n las inyecta dinamicamente al servir la page.

Existen dos variantes:

| Variante | Cuando se usa | Secciones |
|----------|---------------|-----------|
| `cliente_desconocido` | Client new, sin data previos | Empresa + Contacto + Aircraft |
| `cliente_conocido` | Client ya registrado en el sistema | Solo Aircraft |

### Webhook unico: `doa-form-submit`

Ambas variantes envian sus data al mismo webhook `doa-form-submit`. Cada POST incluye un campo oculto `section` que indica el type de data enviados:

- `section=client` -> data de empresa y contacto
- `section=aircraft` -> data de aircraft y TCDS

### Branching en n8n

El workflow ramifica segun el valor de `section`:

```
POST doa-form-submit
  |
  +-- section=client  --> Crear Client + Crear Contacto --> Respond
  |
  +-- section=aircraft --> Actualizar Request (doa_incoming_requests) --> Respond
```

### Technical de send: iframe oculto

Las paginas servidas por n8n tienen `origin: null`, lo que impide usar `fetch` o `XMLHttpRequest` por restricciones CORS. Para evitarlo, el form hace POST a traves de un `<iframe>` oculto (`target="hidden_iframe"`). El iframe recibe la response de n8n sin provocar errores de CORS ni redirigir la page primary.

### Subida de TCDS PDF

El archivo PDF del TCDS se sube directamente a Supabase Storage desde el form del client (antes del submit). La URL resultante se almacena como `tcds_pdf_url` en `doa_incoming_requests` y viaja junto con el resto de data del form en el POST de `section=aircraft`.

## Donde esta el codigo

| Parte del flujo | Archivo | Que hace |
|-----------------|---------|----------|
| Workspace de quotations | `app/(dashboard)/quotations/page.tsx` | Page primary con tablero/lista y la base visual del flujo commercial |
| Cabecera, tabs y tablero | `app/(dashboard)/quotations/QuotationStatesBoard.tsx` | Selector de vistas, columnas del pipeline, editor de statuses |
| Selector de status | `app/(dashboard)/quotations/QuotationStateSelector.tsx` | Dropdown reutilizable con 10 statuses, llama al webhook n8n |
| Data del tablero | `app/(dashboard)/quotations/quotation-board-data.ts` | Mapeo de statuses legacy a columnas del pipeline, construccion de lanes |
| Detalle de quotation | `app/(dashboard)/quotations/[id]/page.tsx` | Page de detalle con bloques preparados para crecer |
| Detalle de request | `app/(dashboard)/quotations/incoming/[id]/page.tsx` | Vista detallada con dropdown de status en cabecera |
| Send al client | `app/api/incoming-requests/[id]/send-client/route.ts` | API que usa `form_url` ya persistida y envia el email via n8n |
| Cambiar status (API) | `app/api/incoming-requests/[id]/state/route.ts` | PATCH directo a Supabase, acepta statuses legacy y de pipeline |
| Statuses | `lib/workflow-states.ts` | Definicion de los 10 statuses del pipeline y los 3 statuses legacy |
| Configuracion editable | `lib/workflow-state-config.ts` + `app/api/workflow/state-config/route.ts` | Labels, colores y sort_order editables |
| Tipos de data | `types/database.ts` -> `IncomingRequest` | Estructura de data de una request |
| Logica de statuses | `app/(dashboard)/quotations/incoming-queries.ts` | Normalizacion de statuses legacy y opciones del pipeline |

### Workflows n8n relevantes

| Workflow | ID | Que hace |
|----------|-----|----------|
| DOA - 0 - Outlook a App | `pEFW1V46yyLR58c8` | Procesa emails entrantes y crea requests |
| DOA - Send Email al Client | `I59H3jFoXXPkRCGc` | Envia email con form al client |
| DOA - Receptor Forms Clients | `PSxOBxPkeFSkeiDj` | Recibe responses de forms |
| DOA - Cambio Status Quotation | `pU645EznWCSbSq2Y` | Cambia status de request via webhook |
| doa_Project_cambio_Estado | `CtfHgtdFa29gt1Yh` | Cambia status de project via webhook |

## Status actual de la UI

- El tablero de quotations muestra un pipeline unificado de 10 columnas con data reales de `doa_incoming_requests`
- Las tarjetas tienen un dropdown para cambiar de status que llama al webhook de n8n
- La page de detalle (`/quotations/incoming/[id]`) tiene el mismo dropdown en la cabecera
- La vista `Lista` usa los mismos statuses del pipeline
- Los statuses custom del board se crean y eliminan localmente por ahora
- Los labels, colores y sort_order de los statuses base se pueden editar sin cambiar el `state_code`

## Detalle technical: mapeo de statuses

El campo `status` en `doa_incoming_requests` puede contener tanto statuses legacy (`new`, `awaiting_form`, `form_received`) como statuses del pipeline (`define_scope`, `quote_sent`, etc.).

La funcion `mapIncomingStateToQuotationLane()` en `quotation-board-data.ts` decide en que columna va cada tarjeta:
- Si el valor ya es un status del pipeline → se usa tal cual
- Si es un status legacy → se convierte (`new` → `request_received`, `awaiting_form` → `form_sent`, etc.)

**Importante**: el board usa `estadoBackend` (valor crudo de la BD) para el mapeo, NO el valor normalizado por `normalizeIncomingStatus()` que solo reconoce los 3 statuses legacy.

## Como anadir un new status al pipeline

1. Anadir el status en `lib/workflow-states.ts` -> `QUOTATION_BOARD_STATES`
2. Anadir la configuracion visual en `QUOTATION_BOARD_STATE_CONFIG` (label, color, description)
3. Anadir la entrada en `QUOTATION_BOARD_DEFAULT_ROWS` en `lib/workflow-state-config.ts` con `sort_order`
4. Anadir la key en `EMPTY_QUOTATION_CARDS` en `quotation-board-data.ts`
5. El `QuotationStateSelector` se actualiza automaticamente porque lee de `QUOTATION_BOARD_STATES`
