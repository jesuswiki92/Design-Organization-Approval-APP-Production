## Exploration: connect incoming requests and client contacts

### Current State
`/quotations` renderiza el board desde [app/(dashboard)/quotations/page.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/page.tsx) y [app/(dashboard)/quotations/QuotationStatesBoard.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/QuotationStatesBoard.tsx). Las columnas reales ya existen, pero las cards salen de `EMPTY_CARDS` en [app/(dashboard)/quotations/quotation-board-data.ts](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/quotation-board-data.ts), por eso el tablero está vacío. Los enlaces de card y lista apuntan siempre a `/quotations/[id]`, que hoy es una capa visual de quotation final y no el detalle de request entrante.

`doa_incoming_requests` ya está conectada en el detalle [app/(dashboard)/quotations/incoming/[id]/page.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/incoming/[id]/page.tsx) y en la normalización de [app/(dashboard)/quotations/incoming-queries.ts](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/incoming-queries.ts). El esquema real confirmado en Supabase contiene: `id`, `created_at`, `subject`, `sender`, `original_body`, `classification`, `ai_response`, `status`, `client_email_sent_at`, `client_email_sent_by`, `last_client_draft`, `entry_number`. Hay 3 requests reales y ahora mismo todas están en `status = espera_formulario_cliente`.

`/clients` carga solo `doa_clients` desde [app/(dashboard)/clients/page.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/clients/page.tsx) y el panel izquierdo en [app/(dashboard)/clients/ClientsPageClient.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/clients/ClientsPageClient.tsx) aún no pinta contacts. El esquema real de `doa_client_contacts` contiene: `id`, `client_id`, `name`, `last_name`, `email`, `phone`, `job_title`, `is_primary`, `active`, `created_at`, con FK a `doa_clients.id`. Hay 24 contacts repartidos entre clients y todos los ejemplos inspeccionados tienen al menos un primary.

### Affected Areas
- [app/(dashboard)/quotations/page.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/page.tsx) — hoy solo carga configuración de statuses; deberá cargar también requests entrantes para construir cards reales.
- [app/(dashboard)/quotations/QuotationsClient.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/QuotationsClient.tsx) — tendrá que recibir los data iniciales del board.
- [app/(dashboard)/quotations/QuotationStatesBoard.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/QuotationStatesBoard.tsx) — hoy asume cards de quotation final con enlace fijo; necesita soportar cards de request entrante.
- [app/(dashboard)/quotations/quotation-board-data.ts](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/quotation-board-data.ts) — aquí encaja un adaptador `IncomingRequest -> QuotationCard` y la inyección de cards en `request_received`.
- [app/(dashboard)/quotations/incoming-queries.ts](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/quotations/incoming-queries.ts) — ya centraliza normalización de status y código; conviene reutilizarla para no duplicar lógica.
- [app/(dashboard)/clients/page.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/clients/page.tsx) — deberá cargar contacts junto con clients.
- [app/(dashboard)/clients/ClientsPageClient.tsx](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/app/(dashboard)/clients/ClientsPageClient.tsx) — el panel izquierdo debe aceptar y renderizar contacts.
- [types/database.ts](C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/01.Desarrollo de App/types/database.ts) — ya tiene `ClientContact` y `ClientWithContacts`; conviene usarlos como contrato.

### Approaches
1. **Conectar ambos frentes con adaptación mínima en servidor** — cargar data reales en `page.tsx`, mapearlos a props serializables y pintar UI sin mover la lógica de data al client.
   - Pros: sigue el patrón actual `page.tsx` servidor + `*Client.tsx` interfaz; reduce risk; permite delivery incremental; reutiliza `toIncomingQuery`.
   - Cons: requiere tocar contrato de props en ambas pantallas y adaptar el board a un type de card más flexible.
   - Effort: Medium

2. **Hacer fetch desde client para cards y contacts** — dejar las páginas servidor casi vacías y resolver con `useEffect`.
   - Pros: cambios rápidos en superficie.
   - Cons: rompe la convención del repo; duplica manejo de carga/error; expone más complejidad al client; peor SSR.
   - Effort: Low

3. **Construir una capa de dominio new para quotations entrantes y contacts antes de pintar nada** — repositorios, mapeadores y tipos específicos.
   - Pros: arquitectura más limpia a largo plazo.
   - Cons: demasiado alcance para el primer paso; retrasa ver valor en UI; añade complejidad sin necesidad inmediata.
   - Effort: High

### Recommendation
Usar el enfoque 1. En `Quotations`, cargar `doa_incoming_requests` en servidor, reutilizar `toIncomingQuery`, y adaptar el board para aceptar cards con `href` y `kind`. En esta primera iteración, todas las requests entrarán en la columna `request_received`, pero cada card conservará su `status` real como metadato visible para no perder contexto. El CTA debe abrir `/quotations/incoming/[id]`, no `/quotations/[id]`.

En `Clients`, hacer dos queries en servidor: clients y contacts. Después agrupar contacts por `client_id` y pasar `ClientWithContacts[]` al client. Es más seguro que depender ahora de un `select` relacional tipado y encaja con el model ya definido en tipos.

### Risks
- Las 3 requests reales ya no están en `new`, sino en `espera_formulario_cliente`. Si se fuerzan todas a `request_received`, el board puede representar una simplificación operativa que no coincide con el status real.
- `QuotationStatesBoard` y `ListRow` asumen semántica de quotation final: `owner`, `due`, `amount`, `tag` y enlace a `/quotations/[id]`. Hay que decidir placeholders o campos específicos de request entrante para no mostrar ruido.
- El detalle de `Clients` es un panel estrecho; si se mete demasiada información de contacts, puede quedar saturado. Conviene priorizar primary primero y secundarios después.
- No hay runner de tests dedicado; la validation práctica seguirá dependiendo de `lint`, `build` y smoke/manual.

### Ready for Proposal
Yes — el cambio está suficientemente delimitado y se puede proponer como una delivery incremental en dos frentes de UI con data reales, sin tocar todavía transiciones complejas del workflow.
