## Change Proposal: connect incoming requests and client contacts

### Why
La app ya tiene dos superficies listas para trabajar con datos reales pero incompletas:
- El board de `Quotations` ya existe, pero sigue vacío porque no consume `doa_consultas_entrantes`.
- El detalle de `Clientes` ya muestra la ficha principal, pero no enseña los contactos de `doa_clientes_contactos`.

Esto limita el uso operativo de dos áreas que ya están maduras visualmente y frena el flujo natural de trabajo comercial.

### What Changes
1. Conectar `doa_consultas_entrantes` al board de `Quotations` para que cada registro aparezca como card en la columna `entrada_recibida`.
2. Adaptar la card/lista para que una consulta entrante abra su detalle real en `/quotations/incoming/[id]`.
3. Mantener el `estado` real de la consulta como metadato visible en la card, aunque en esta iteración la ubicación visual sea siempre la primera columna.
4. Conectar `doa_clientes_contactos` al detalle de `Clientes` y mostrar los contactos en el bloque izquierdo al seleccionar un cliente.
5. Ordenar contactos priorizando `es_principal = true` y luego el resto activos.

### Scope
**Incluido**
- Fetch servidor en `Quotations` y `Clientes`.
- Adaptadores de datos para UI.
- Ajuste de tipos/props y render de contactos.
- Ajuste de CTA/enlace para cards de consulta entrante.

**Excluido**
- Drag and drop o movimiento persistido de cards entre columnas.
- Conversión de consulta entrante en quotation final.
- Cambio de modelo backend de `/quotations/[id]`.
- Edición CRUD de contactos.

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
1. En `Quotations`, leer `doa_consultas_entrantes` en servidor y normalizar con `toIncomingQuery`.
2. Crear un mapper desde consulta entrante a `QuotationCard` ampliado con `href` y, si hace falta, `kind`.
3. Inyectar esas cards solo en la lane `entrada_recibida`; dejar el resto de lanes vacías por ahora.
4. En `Clientes`, leer contactos en una segunda query, agrupar por `cliente_id` y construir `ClienteWithContactos[]`.
5. Pintar los contactos dentro del panel izquierdo, con una presentación compacta: principal destacado, email, teléfono y cargo.

### Verification
- `npm run lint`
- `npm run build`
- `npm run smoke`
- Validación manual de:
  - `/quotations` muestra cards reales.
  - La acción de una card abre `/quotations/incoming/[id]`.
  - `/clients` muestra contactos en el panel izquierdo del cliente seleccionado.

### Rollback Plan
- Revertir el cambio en `Quotations` al contrato anterior sin cards reales y volver a `EMPTY_CARDS`.
- Revertir el enriquecimiento de `ClientsPageClient` para volver a `Cliente[]` sin contactos.
- No se requieren migraciones ni cambios de esquema para deshacer este cambio.
