# Flujo de Consultas Entrantes y Pipeline de Cotizaciones

## Resumen
Este documento explica como funciona hoy el flujo completo de consultas y cotizaciones: desde que un cliente envia un email hasta el cierre de la oferta. n8n es la fuente de verdad para el alta inicial, la URL del formulario, la respuesta del cliente, y los cambios de estado en el pipeline.

## Pipeline unificado de 10 estados

El tablero de quotations muestra un pipeline unico de 10 columnas. Las consultas entrantes y las cotizaciones comparten el mismo board:

### Fase de recepcion (estados 1-3, automaticos via n8n)

1. **Entrada recibida** (`entrada_recibida`) — Ha llegado una consulta de un cliente por email. n8n procesa el email y crea la fila en `doa_consultas_entrantes`.
2. **Formulario enviado. Esperando respuesta** (`formulario_enviado`) — El ingeniero envio el formulario al cliente. La app usa `url_formulario` y n8n envia el email.
3. **Formulario general recibido. Revisar** (`formulario_recibido`) — El cliente completo el formulario. n8n guarda la respuesta en `doa_respuestas_formularios`.

### Fase de cotizacion (estados 4-10, cambio manual via dropdown)

4. **Definir alcance. Preliminar** (`definir_alcance`) — Revisar la informacion y definir el alcance del trabajo.
5. **Alcance definido. Preparar oferta** (`alcance_definido`) — Alcance claro, preparar la oferta economica.
6. **Oferta preparada. Revisar** (`oferta_en_revision`) — Oferta lista, revision interna antes de enviar.
7. **Oferta enviada a cliente** (`oferta_enviada`) — Oferta enviada, esperando respuesta del cliente.
8. **Oferta aceptada** (`oferta_aceptada`) — El cliente acepto la oferta.
9. **Oferta rechazada** (`oferta_rechazada`) — El cliente rechazo la oferta.
10. **Revision final. Abrir proyecto** (`revision_final`) — Revision final antes de abrir proyecto en Engineering.

Ademas existe **Archivado** (`archivado`) que oculta la consulta del tablero.

### Cambio de estado

El cambio de estado funciona via n8n (mismo patron que proyectos):
1. El usuario selecciona un nuevo estado en el dropdown de la tarjeta o de la pagina de detalle
2. `QuotationStateSelector` llama al webhook `doa-quotation-cambio-estado`
3. n8n actualiza el campo `estado` en `doa_consultas_entrantes`
4. La app refresca y lee el nuevo estado

## Diagrama del flujo

```
Cliente envia email
  -> n8n procesa el email
  -> n8n crea fila en doa_consultas_entrantes + url_formulario -> Estado: ENTRADA_RECIBIDA
  -> Ingeniero revisa y envia respuesta con formulario
  -> App usa url_formulario existente
  -> n8n envia el email -> Estado: FORMULARIO_ENVIADO
  -> Cliente rellena el formulario
  -> n8n recibe respuesta y la guarda en doa_respuestas_formularios -> Estado: FORMULARIO_RECIBIDO
  -> Ingeniero cambia estado manualmente via dropdown en el tablero o detalle:
     -> DEFINIR_ALCANCE -> ALCANCE_DEFINIDO -> OFERTA_EN_REVISION
     -> OFERTA_ENVIADA -> OFERTA_ACEPTADA / OFERTA_RECHAZADA -> REVISION_FINAL
  -> Cada cambio manual llama al webhook n8n que actualiza Supabase
```

## Campo `url_formulario`

La tabla `doa_consultas_entrantes` contiene el campo `url_formulario`. Almacena la URL publica del formulario que se envia al cliente. n8n la genera durante el alta de la consulta y la persiste directamente en la fila. La app la lee para componer el email de respuesta al cliente.

## Arquitectura de envio de formularios

### Plantillas HTML

Los formularios son HTML puro servido por n8n. Las plantillas se almacenan como archivos `.txt` en Google Drive y n8n las inyecta dinamicamente al servir la pagina.

Existen dos variantes:

| Variante | Cuando se usa | Secciones |
|----------|---------------|-----------|
| `cliente_desconocido` | Cliente nuevo, sin datos previos | Empresa + Contacto + Aeronave |
| `cliente_conocido` | Cliente ya registrado en el sistema | Solo Aeronave |

### Webhook unico: `doa-form-submit`

Ambas variantes envian sus datos al mismo webhook `doa-form-submit`. Cada POST incluye un campo oculto `section` que indica el tipo de datos enviados:

- `section=client` -> datos de empresa y contacto
- `section=aircraft` -> datos de aeronave y TCDS

### Branching en n8n

El workflow ramifica segun el valor de `section`:

```
POST doa-form-submit
  |
  +-- section=client  --> Crear Cliente + Crear Contacto --> Respond
  |
  +-- section=aircraft --> Actualizar Consulta (doa_consultas_entrantes) --> Respond
```

### Tecnica de envio: iframe oculto

Las paginas servidas por n8n tienen `origin: null`, lo que impide usar `fetch` o `XMLHttpRequest` por restricciones CORS. Para evitarlo, el formulario hace POST a traves de un `<iframe>` oculto (`target="hidden_iframe"`). El iframe recibe la respuesta de n8n sin provocar errores de CORS ni redirigir la pagina principal.

### Subida de TCDS PDF

El archivo PDF del TCDS se sube directamente a Supabase Storage desde el formulario del cliente (antes del submit). La URL resultante se almacena como `tcds_pdf_url` en `doa_consultas_entrantes` y viaja junto con el resto de datos del formulario en el POST de `section=aircraft`.

## Donde esta el codigo

| Parte del flujo | Archivo | Que hace |
|-----------------|---------|----------|
| Workspace de quotations | `app/(dashboard)/quotations/page.tsx` | Pagina principal con tablero/lista y la base visual del flujo comercial |
| Cabecera, tabs y tablero | `app/(dashboard)/quotations/QuotationStatesBoard.tsx` | Selector de vistas, columnas del pipeline, editor de estados |
| Selector de estado | `app/(dashboard)/quotations/QuotationStateSelector.tsx` | Dropdown reutilizable con 10 estados, llama al webhook n8n |
| Datos del tablero | `app/(dashboard)/quotations/quotation-board-data.ts` | Mapeo de estados legacy a columnas del pipeline, construccion de lanes |
| Detalle de quotation | `app/(dashboard)/quotations/[id]/page.tsx` | Pagina de detalle con bloques preparados para crecer |
| Detalle de consulta | `app/(dashboard)/quotations/incoming/[id]/page.tsx` | Vista detallada con dropdown de estado en cabecera |
| Enviar al cliente | `app/api/consultas/[id]/send-client/route.ts` | API que usa `url_formulario` ya persistida y envia el email via n8n |
| Cambiar estado (API) | `app/api/consultas/[id]/state/route.ts` | PATCH directo a Supabase, acepta estados legacy y de pipeline |
| Estados | `lib/workflow-states.ts` | Definicion de los 10 estados del pipeline y los 3 estados legacy |
| Configuracion editable | `lib/workflow-state-config.ts` + `app/api/workflow/state-config/route.ts` | Labels, colores y orden editables |
| Tipos de datos | `types/database.ts` -> `ConsultaEntrante` | Estructura de datos de una consulta |
| Logica de estados | `app/(dashboard)/quotations/incoming-queries.ts` | Normalizacion de estados legacy y opciones del pipeline |

### Workflows n8n relevantes

| Workflow | ID | Que hace |
|----------|-----|----------|
| DOA - 0 - Outlook a App | `pEFW1V46yyLR58c8` | Procesa emails entrantes y crea consultas |
| DOA - Enviar Correo al Cliente | `I59H3jFoXXPkRCGc` | Envia email con formulario al cliente |
| DOA - Receptor Formularios Clientes | `PSxOBxPkeFSkeiDj` | Recibe respuestas de formularios |
| DOA - Cambio Estado Quotation | `pU645EznWCSbSq2Y` | Cambia estado de consulta via webhook |
| doa_Project_cambio_Estado | `CtfHgtdFa29gt1Yh` | Cambia estado de proyecto via webhook |

## Estado actual de la UI

- El tablero de quotations muestra un pipeline unificado de 10 columnas con datos reales de `doa_consultas_entrantes`
- Las tarjetas tienen un dropdown para cambiar de estado que llama al webhook de n8n
- La pagina de detalle (`/quotations/incoming/[id]`) tiene el mismo dropdown en la cabecera
- La vista `Lista` usa los mismos estados del pipeline
- Los estados custom del board se crean y eliminan localmente por ahora
- Los labels, colores y orden de los estados base se pueden editar sin cambiar el `state_code`

## Detalle tecnico: mapeo de estados

El campo `estado` en `doa_consultas_entrantes` puede contener tanto estados legacy (`nuevo`, `esperando_formulario`, `formulario_recibido`) como estados del pipeline (`definir_alcance`, `oferta_enviada`, etc.).

La funcion `mapIncomingStateToQuotationLane()` en `quotation-board-data.ts` decide en que columna va cada tarjeta:
- Si el valor ya es un estado del pipeline → se usa tal cual
- Si es un estado legacy → se convierte (`nuevo` → `entrada_recibida`, `esperando_formulario` → `formulario_enviado`, etc.)

**Importante**: el board usa `estadoBackend` (valor crudo de la BD) para el mapeo, NO el valor normalizado por `normalizeIncomingStatus()` que solo reconoce los 3 estados legacy.

## Como anadir un nuevo estado al pipeline

1. Anadir el estado en `lib/workflow-states.ts` -> `QUOTATION_BOARD_STATES`
2. Anadir la configuracion visual en `QUOTATION_BOARD_STATE_CONFIG` (label, color, descripcion)
3. Anadir la entrada en `QUOTATION_BOARD_DEFAULT_ROWS` en `lib/workflow-state-config.ts` con `sort_order`
4. Anadir la key en `EMPTY_QUOTATION_CARDS` en `quotation-board-data.ts`
5. El `QuotationStateSelector` se actualiza automaticamente porque lee de `QUOTATION_BOARD_STATES`
