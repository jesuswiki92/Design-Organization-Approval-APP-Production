## Exploration: connect incoming requests and client contacts

### Current State
`/quotations` renderiza el board desde [app/(dashboard)/quotations/page.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/page.tsx) y [app/(dashboard)/quotations/QuotationStatesBoard.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/QuotationStatesBoard.tsx). Las columnas reales ya existen, pero las cards salen de `EMPTY_CARDS` en [app/(dashboard)/quotations/quotation-board-data.ts](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/quotation-board-data.ts), por eso el tablero está vacío. Los enlaces de card y lista apuntan siempre a `/quotations/[id]`, que hoy es una capa visual de quotation final y no el detalle de consulta entrante.

`doa_consultas_entrantes` ya está conectada en el detalle [app/(dashboard)/quotations/incoming/[id]/page.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/incoming/[id]/page.tsx) y en la normalización de [app/(dashboard)/quotations/incoming-queries.ts](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/incoming-queries.ts). El esquema real confirmado en Supabase contiene: `id`, `created_at`, `asunto`, `remitente`, `cuerpo_original`, `clasificacion`, `respuesta_ia`, `estado`, `correo_cliente_enviado_at`, `correo_cliente_enviado_by`, `ultimo_borrador_cliente`, `numero_entrada`. Hay 3 consultas reales y ahora mismo todas están en `estado = espera_formulario_cliente`.

`/clients` carga solo `doa_clientes_datos_generales` desde [app/(dashboard)/clients/page.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/clients/page.tsx) y el panel izquierdo en [app/(dashboard)/clients/ClientsPageClient.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/clients/ClientsPageClient.tsx) aún no pinta contactos. El esquema real de `doa_clientes_contactos` contiene: `id`, `cliente_id`, `nombre`, `apellidos`, `email`, `telefono`, `cargo`, `es_principal`, `activo`, `created_at`, con FK a `doa_clientes_datos_generales.id`. Hay 24 contactos repartidos entre clientes y todos los ejemplos inspeccionados tienen al menos un principal.

### Affected Areas
- [app/(dashboard)/quotations/page.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/page.tsx) — hoy solo carga configuración de estados; deberá cargar también consultas entrantes para construir cards reales.
- [app/(dashboard)/quotations/QuotationsClient.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/QuotationsClient.tsx) — tendrá que recibir los datos iniciales del board.
- [app/(dashboard)/quotations/QuotationStatesBoard.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/QuotationStatesBoard.tsx) — hoy asume cards de quotation final con enlace fijo; necesita soportar cards de consulta entrante.
- [app/(dashboard)/quotations/quotation-board-data.ts](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/quotation-board-data.ts) — aquí encaja un adaptador `ConsultaEntrante -> QuotationCard` y la inyección de cards en `entrada_recibida`.
- [app/(dashboard)/quotations/incoming-queries.ts](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/incoming-queries.ts) — ya centraliza normalización de estado y código; conviene reutilizarla para no duplicar lógica.
- [app/(dashboard)/clients/page.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/clients/page.tsx) — deberá cargar contactos junto con clientes.
- [app/(dashboard)/clients/ClientsPageClient.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/clients/ClientsPageClient.tsx) — el panel izquierdo debe aceptar y renderizar contactos.
- [types/database.ts](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/types/database.ts) — ya tiene `ClienteContacto` y `ClienteWithContactos`; conviene usarlos como contrato.

### Approaches
1. **Conectar ambos frentes con adaptación mínima en servidor** — cargar datos reales en `page.tsx`, mapearlos a props serializables y pintar UI sin mover la lógica de datos al cliente.
   - Pros: sigue el patrón actual `page.tsx` servidor + `*Client.tsx` interfaz; reduce riesgo; permite entrega incremental; reutiliza `toIncomingQuery`.
   - Cons: requiere tocar contrato de props en ambas pantallas y adaptar el board a un tipo de card más flexible.
   - Effort: Medium

2. **Hacer fetch desde cliente para cards y contactos** — dejar las páginas servidor casi vacías y resolver con `useEffect`.
   - Pros: cambios rápidos en superficie.
   - Cons: rompe la convención del repo; duplica manejo de carga/error; expone más complejidad al cliente; peor SSR.
   - Effort: Low

3. **Construir una capa de dominio nueva para quotations entrantes y contactos antes de pintar nada** — repositorios, mapeadores y tipos específicos.
   - Pros: arquitectura más limpia a largo plazo.
   - Cons: demasiado alcance para el primer paso; retrasa ver valor en UI; añade complejidad sin necesidad inmediata.
   - Effort: High

### Recommendation
Usar el enfoque 1. En `Quotations`, cargar `doa_consultas_entrantes` en servidor, reutilizar `toIncomingQuery`, y adaptar el board para aceptar cards con `href` y `kind`. En esta primera iteración, todas las consultas entrarán en la columna `entrada_recibida`, pero cada card conservará su `estado` real como metadato visible para no perder contexto. El CTA debe abrir `/quotations/incoming/[id]`, no `/quotations/[id]`.

En `Clientes`, hacer dos queries en servidor: clientes y contactos. Después agrupar contactos por `cliente_id` y pasar `ClienteWithContactos[]` al cliente. Es más seguro que depender ahora de un `select` relacional tipado y encaja con el modelo ya definido en tipos.

### Risks
- Las 3 consultas reales ya no están en `nuevo`, sino en `espera_formulario_cliente`. Si se fuerzan todas a `entrada_recibida`, el board puede representar una simplificación operativa que no coincide con el estado real.
- `QuotationStatesBoard` y `ListRow` asumen semántica de quotation final: `owner`, `due`, `amount`, `tag` y enlace a `/quotations/[id]`. Hay que decidir placeholders o campos específicos de consulta entrante para no mostrar ruido.
- El detalle de `Clientes` es un panel estrecho; si se mete demasiada información de contactos, puede quedar saturado. Conviene priorizar principal primero y secundarios después.
- No hay runner de tests dedicado; la validación práctica seguirá dependiendo de `lint`, `build` y smoke/manual.

### Ready for Proposal
Yes — el cambio está suficientemente delimitado y se puede proponer como una entrega incremental en dos frentes de UI con datos reales, sin tocar todavía transiciones complejas del workflow.
