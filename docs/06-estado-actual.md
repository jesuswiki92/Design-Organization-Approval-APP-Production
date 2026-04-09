# Estado actual de la aplicacion

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
