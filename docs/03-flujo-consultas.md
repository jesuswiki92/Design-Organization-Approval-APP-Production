# Flujo de Consultas Entrantes

## Resumen
Este documento explica como funciona hoy el flujo principal de consultas: desde que un cliente envia un email hasta que recibimos su formulario, con n8n como fuente de verdad del alta inicial, la URL del formulario y la respuesta final.

## Los 3 estados

### 1. Nueva entrada
- **Que significa**: Ha llegado una consulta de un cliente por email
- **Como llega**: n8n procesa el email, crea una fila en `doa_consultas_entrantes` y rellena `url_formulario`
- **Que ve el ingeniero**: La consulta aparece en `/quotations` como "Nueva entrada"
- **Que tiene que hacer**: Revisar la consulta y enviar una respuesta al cliente

### 2. Formulario enviado
- **Que significa**: El ingeniero ya envio el email de respuesta al cliente con un enlace a un formulario
- **Como llega**: El ingeniero pulsa "Enviar al cliente" en la app
- **Que pasa por detras**: La app lee `url_formulario` desde `doa_consultas_entrantes`, sustituye el placeholder del borrador y llama a n8n para enviar el email real al cliente
- **Que ve el ingeniero**: La consulta pasa a "Formulario enviado"

### 3. Formulario recibido. Revisar
- **Que significa**: El cliente ha completado y enviado el formulario
- **Como llega**: n8n sirve el HTML del formulario, recibe la respuesta y la persiste en `doa_respuestas_formularios`
- **Que pasa despues**: Aqui entraran futuras fases de recoleccion de datos y automatizacion

## Diagrama del flujo

```
Cliente envia email
  -> n8n procesa el email
  -> n8n crea fila en doa_consultas_entrantes + url_formulario -> Estado: NUEVA ENTRADA
  -> Ingeniero revisa y envia respuesta con formulario
  -> App usa url_formulario existente
  -> n8n envia el email -> Estado: FORMULARIO_ENVIADO
  -> Cliente rellena el formulario
  -> n8n recibe respuesta y la guarda en doa_respuestas_formularios -> Estado: FORMULARIO_RECIBIDO_REVISAR
  -> Futuras fases de automatizacion
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
| Cabecera, tabs y tablero | `app/(dashboard)/quotations/QuotationStatesBoard.tsx` | Selector de vistas, columnas reales, editor de estados y superficie limpia sin cards mock |
| Datos compartidos de quotations | `app/(dashboard)/quotations/quotation-board-data.ts` | Helpers de persistencia local y normalizacion de estados sin datos ficticios |
| Detalle de quotation | `app/(dashboard)/quotations/[id]/page.tsx` | Pagina de detalle con bloques preparados para crecer |
| Panel de consultas nuevas | `app/(dashboard)/quotations/IncomingQueriesPanel.tsx` | Panel preparado para mostrar las consultas pendientes; todavia no esta montado en la pantalla principal actual |
| Detalle de consulta | `app/(dashboard)/quotations/incoming/[id]/page.tsx` | Vista detallada de una consulta con preview del formulario real |
| Enviar al cliente | `app/api/consultas/[id]/send-client/route.ts` | API que usa `url_formulario` ya persistida y envia el email via n8n |
| Estados | `lib/workflow-states.ts` | Definicion de los estados visuales del board y de las consultas entrantes |
| Configuracion editable de estados | `lib/workflow-state-config.ts` + `app/api/workflow/state-config/route.ts` | Capa que separa codigo tecnico y label visible, con persistencia preparada en Supabase cuando existe la tabla de configuracion |
| Tipos de datos | `types/database.ts` -> `ConsultaEntrante` | Estructura de datos de una consulta |
| Logica de estados | `app/(dashboard)/quotations/incoming-queries.ts` | Funciones para filtrar y normalizar estados |
| Workflows n8n | `../n8n-workflows/` | Fuente de verdad del alta de consulta, `url_formulario`, HTML publico y guardado de respuestas |

## Estado actual de la UI

- El tablero de quotations trabaja con ejemplos reales creados por n8n en `doa_consultas_entrantes`.
- La vista `Lista` usa los mismos estados del board y se mantiene vacia hasta que existan quotations reales.
- Los estados nuevos de quotations se crean y eliminan localmente por ahora.
- Los estados base de `Quotations` y del flujo de consultas ya pueden renombrarse, reordenarse y recolorearse desde la propia app sin cambiar el `state_code` tecnico.
- La seccion visible de `Engineering` ya se presenta como `Proyectos` y tiene vistas `Tablero` y `Lista` mock.

## Como anadir un nuevo estado

1. Anadir el estado visual en `lib/workflow-states.ts` -> `QUOTATION_BOARD_STATES`
2. Anadir la configuracion visual en `QUOTATION_BOARD_STATE_CONFIG` (label, color, descripcion)
3. Si el estado tambien debe afectar al flujo de consultas, actualizar `CONSULTA_ESTADOS` y `CONSULTA_STATE_CONFIG`
4. Si necesitas filtrar por el nuevo estado, actualizar `incoming-queries.ts` o la vista del tablero
