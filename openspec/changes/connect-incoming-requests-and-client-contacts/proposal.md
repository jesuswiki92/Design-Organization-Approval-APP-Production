## Change Proposal: connect incoming requests and client contacts

### Why
La app ya tiene dos superficies listas para trabajar con data reales pero incompletas:
- El board de `Quotations` ya existe, pero sigue vacío porque no consume `doa_incoming_requests`.
- El detalle de `Clients` ya muestra la ficha primary, pero no enseña los contacts de `doa_client_contacts`.

Esto limita el uso operativo de dos áreas que ya están maduras visualmente y frena el flujo natural de trabajo commercial.

### What Changes
1. Conectar `doa_incoming_requests` al board de `Quotations` para que cada registro aparezca como card en la columna `request_received`.
2. Adaptar la card/lista para que una request entrante abra su detalle real en `/quotations/incoming/[id]`.
3. Mantener el `status` real de la request como metadato visible en la card, aunque en esta iteración la ubicación visual sea siempre la primera columna.
4. Conectar `doa_client_contacts` al detalle de `Clients` y mostrar los contacts en el bloque izquierdo al seleccionar un client.
5. Ordenar contacts priorizando `is_primary = true` y luego el resto activos.

### Scope
**Incluido**
- Fetch servidor en `Quotations` y `Clients`.
- Adaptadores de data para UI.
- Ajuste de tipos/props y render de contacts.
- Ajuste de CTA/enlace para cards de request entrante.

**Excluido**
- Drag and drop o movimiento persistido de cards entre columnas.
- Conversión de request entrante en quotation final.
- Cambio de model backend de `/quotations/[id]`.
- Edición CRUD de contacts.

### Affected Modules
- `app/(dashboard)/quotations/page.tsx`
- `app/(dashboard)/quotations/QuotationsClient.tsx`
- `app/(dashboard)/quotations/QuotationStatesBoard.tsx`
- `app/(dashboard)/quotations/quotation-board-data.ts`
- `app/(dashboard)/quotations/incoming-queries.ts`
- `app/(dashboard)/clients/page.tsx`
- `app/(dashboard)/clients/ClientsPageClient.tsx`
- `types/database.ts`

### Implementation Strategy
1. En `Quotations`, leer `doa_incoming_requests` en servidor y normalizar con `toIncomingQuery`.
2. Crear un mapper desde request entrante a `QuotationCard` ampliado con `href` y, si hace falta, `kind`.
3. Inyectar esas cards solo en la lane `request_received`; dejar el resto de lanes vacías por ahora.
4. En `Clients`, leer contacts en una segunda query, agrupar por `client_id` y construir `ClientWithContacts[]`.
5. Pintar los contacts dentro del panel izquierdo, con una presentación compacta: primary destacado, email, phone y job_title.

### Verification
- `npm run lint`
- `npm run build`
- `npm run smoke`
- Validation manual de:
  - `/quotations` muestra cards reales.
  - La acción de una card abre `/quotations/incoming/[id]`.
  - `/clients` muestra contacts en el panel izquierdo del client seleccionado.

### Rollback Plan
- Revertir el cambio en `Quotations` al contrato anterior sin cards reales y volver a `EMPTY_CARDS`.
- Revertir el enriquecimiento de `ClientsPageClient` para volver a `Client[]` sin contacts.
- No se requieren migraciones ni cambios de esquema para deshacer este cambio.
