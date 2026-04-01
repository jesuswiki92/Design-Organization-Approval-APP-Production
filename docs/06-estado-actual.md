# Estado actual de la aplicacion

## Resumen

La aplicacion DOA Operations Hub sigue siendo un workspace interno para consultas, quotations y proyectos, pero la superficie visible actual ya esta enfocada en dos areas principales:

- `Quotations`, con tablero real, vista de lista y detalle de quotation.
- `Proyectos`, con tablero y lista mock para validar estetica y navegacion.

## Quotations

### Vista principal

La pagina `/quotations` ya no es una vista estatica. Ahora funciona como un workspace con selector de vistas:

- `Tablero` es la vista principal.
- `Lista` muestra los mismos datos en formato tabla ligera.
- El board tiene scroll horizontal real porque las columnas tienen ancho fijo.
- La pagina conserva scroll vertical real porque la shell principal usa contenedores con `overflow-y-auto`.
- Las columnas base ya no cargan cards mock; quedan vacias hasta que entren casos reales.

### Estados del board

El tablero de `Quotations` usa siete estados base:

- `Entrada recibida`
- `Triage`
- `Alcance definido`
- `Oferta en redaccion`
- `Revision interna`
- `Pendiente de envio`
- `Seguimiento / cierre`

Los estados creados desde la UI se guardan localmente en `localStorage`. Tambien se pueden borrar desde la propia UI, pero los estados base quedan bloqueados.

Los estados base ya tienen una capa de configuracion editable:

- Los codigos tecnicos siguen fijos en codigo y workflow
- El nombre visible, la descripcion, el color y el orden se pueden editar desde la UI
- La persistencia compartida se apoya en `doa_workflow_state_config`
- Si la tabla falla o no existe, la app vuelve a los defaults definidos en codigo

### Detalle de quotation

El detalle de quotation sigue preparado en `/quotations/[id]`, pero ahora la vista principal de quotations ya no fabrica cards ficticias para llegar a él.

La pagina de detalle ya tiene bloques preparados para crecer:

- Resumen ejecutivo
- Alcance tecnico y supuestos
- Pricing, esfuerzo y estrategia comercial
- Snapshot operativo
- Historial y siguientes pasos

De momento estos bloques son base visual para futuras iteraciones.

## Proyectos

### Naming visible

La seccion visible que antes se presentaba como `Engineering` ahora se muestra al usuario como `Proyectos`.

### Vista principal

La pagina principal de `Proyectos` ahora funciona como una superficie estetica con dos modos:

- `Tablero`, con siete columnas mock y cards de ejemplo.
- `Lista`, con los mismos datos mock en formato tabla compacta.

Los estados mock inventados para esta vista son:

- `Intake`
- `Discovery`
- `Architecture`
- `Build`
- `Verification`
- `Release`
- `Observability`

La vista es intencionalmente mock para evaluar composicion visual y navegacion, no persistencia.

## Flujo de consultas entrantes

El flujo de consultas entrantes sigue estando operativo y documentado como base del proceso comercial:

- `Nueva entrada`
- `Formulario enviado`
- `Formulario recibido. Revisar`

La seccion de consultas entrantes sigue conectada al concepto de `Quotations`, pero ahora la experiencia de quotations tiene un tablero propio mas completo y una pagina de detalle separada.

## Estado operativo y limites

- La parte visual de `Quotations` prioriza ahora navegacion, lectura rapida y detalle progresivo.
- La configuracion visual de estados ya puede persistirse en Supabase sin tocar los identificadores tecnicos.
- La pagina de detalle de quotation ya existe, pero aun no esta conectada a un modelo de datos real de backend.
- `Proyectos` es por ahora una superficie mock para validacion estetica.

## Siguientes pasos recomendados

- Conectar `/quotations/[id]` a datos reales cuando exista el modelo final.
- Reemplazar los datos mock de `Proyectos` por datos persistidos cuando el flujo de engineering se cierre.
