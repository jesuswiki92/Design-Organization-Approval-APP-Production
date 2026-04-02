# Estado actual de la aplicacion

## Resumen

La aplicacion DOA Operations Hub ya tiene una base estable para seguir iterando por lotes pequenos. La superficie visible esta concentrada en:

- `Quotations`, con board real, vista de lista, detalle de quotation y capa editable de estados
- `Proyectos`, con superficie visual y portfolio aun desacoplado de datos reales
- `Clientes`, ya conectado a `doa_clientes_datos_generales`
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

### Estados del board

El board de `Quotations` usa siete estados base:

- `Entrada recibida`
- `Triage`
- `Alcance definido`
- `Oferta en redaccion`
- `Revision interna`
- `Pendiente de envio`
- `Seguimiento / cierre`

La arquitectura actual de estados esta separada por capas:

- Definicion tecnica en `lib/workflow-states.ts`
- Resolucion de labels, colores y orden en `lib/workflow-state-config.ts`
- Lectura server-side en `lib/workflow-state-config.server.ts`
- Persistencia via `app/api/workflow/state-config/route.ts`

Estado real hoy:

- Los labels visibles, colores y orden se pueden editar
- Los `state_code` siguen siendo fijos
- Si `doa_workflow_state_config` no existe o falla, la app vuelve a defaults definidos en codigo
- Los estados custom del board siguen siendo locales en `localStorage`

### Detalle de quotation

`/quotations/[id]` existe y ya tiene base visual para crecer:

- Resumen ejecutivo
- Alcance tecnico y supuestos
- Pricing y estrategia comercial
- Snapshot operativo
- Historial y siguientes pasos

Todavia no esta conectado a un backend final de quotations.

### Consultas entrantes

El flujo de consultas entrantes sigue siendo una pieza activa del dominio comercial:

- `doa_consultas_entrantes` esta conectada
- El detalle `/quotations/incoming/[id]` existe
- `app/api/consultas/[id]/send-client/route.ts` envia al webhook de n8n y persiste avance de estado

Limite actual:

- El panel de consultas entrantes no es hoy la superficie principal de `/quotations`
- El flujo principal de board y lista esta priorizado sobre ese panel

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

Limite actual:

- La tabla `doa_clientes_contactos` sigue marcada como desconectada en la documentacion operativa

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
- Falta el modelo final y la conexion real de datos
- Conviene evitar acoplarla a contratos temporales si el backend aun no esta cerrado

### Hotspot 4: documentacion vs codigo
- El repo ya tiene buena documentacion
- Hay que mantenerla sincronizada porque varias zonas estan en reconexion parcial y es facil asumir mas madurez de la real

---

## Siguientes pasos recomendados

- Asentar la migracion de `doa_workflow_state_config` para quitar la ambiguedad de persistencia
- Elegir si el siguiente frente incremental va por `Clientes`, `Quotations` o `Proyectos`
- Cuando una superficie pase de mock a real, actualizar `docs/02-bases-de-datos.md` y este documento en el mismo lote
