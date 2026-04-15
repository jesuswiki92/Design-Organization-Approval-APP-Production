## Exploration: identify-known-clients-on-incoming-cards

### Current State
The Quotations board currently fetches incoming requests only from `doa_consultas_entrantes` in `app/(dashboard)/quotations/page.tsx` and normalizes them through `toIncomingQuery()` in `app/(dashboard)/quotations/incoming-queries.ts`.

Each incoming card is then built in `app/(dashboard)/quotations/quotation-board-data.ts` with sender data duplicated into generic card fields such as `owner` and `customer`. There is no current lookup against existing client master data or contacts, so the board cannot distinguish between a known customer and an unknown sender.

The Clients area already loads the two relevant tables together in `app/(dashboard)/clients/page.tsx`:
- `doa_clientes_datos_generales`
- `doa_clientes_contactos`

The repo types support this model directly in `types/database.ts`:
- `Cliente`
- `ClienteContacto`
- `ClienteWithContactos`

Relevant database structure already present in the repo:
- `doa_clientes_datos_generales.nombre` stores the company name
- `doa_clientes_contactos.cliente_id` links contacts to the company record
- `doa_clientes_contactos.nombre`, `apellidos`, `email`, `es_principal`, `activo` store the person-level contact data
- `doa_consultas_entrantes.remitente` is the incoming sender field currently rendered on cards

### Affected Areas
- `app/(dashboard)/quotations/page.tsx` — would need to fetch the client/contact dataset needed to resolve sender identity while loading the board.
- `app/(dashboard)/quotations/incoming-queries.ts` — would need a deterministic identity-enrichment step for each incoming request.
- `app/(dashboard)/quotations/quotation-board-data.ts` — would need to render either `cliente desconocido` or `empresa + contacto + email` into the card model.
- `app/(dashboard)/quotations/QuotationStatesBoard.tsx` — may need small presentational updates if the card layout should show the enriched identity more clearly.
- `app/(dashboard)/clients/page.tsx` — useful as the existing pattern for loading `doa_clientes_datos_generales` + `doa_clientes_contactos`.
- `types/database.ts` — already supports the client/contact structures; may only need small view-model additions if a dedicated incoming-card identity shape is introduced.
- `docs/02-bases-de-datos.md` — already documents the two relevant client tables and supports this implementation direction.

### Approaches
1. **Exact email match against `doa_clientes_contactos.email`**
   - Pros: deterministic, auditable, and easy to explain; directly supported by the current schema; avoids false positives.
   - Cons: does not recognize a company if the sender email is new but belongs to the same domain.
   - Effort: Low

2. **Domain fallback using `doa_clientes_datos_generales.dominio_email` after failing exact contact match**
   - Pros: can identify the company even when the exact person is not yet registered.
   - Cons: weaker and more ambiguous; user asked for `empresa + contacto + email` when known, which requires a real contact, not only a domain; can misclassify shared domains or subsidiaries.
   - Effort: Medium

3. **Fuzzy matching by name/body/domain**
   - Pros: maximizes apparent recognition.
   - Cons: not defensible for workflow automation; high false-positive risk; difficult to validate operationally.
   - Effort: High

### Recommendation
Use **Approach 1** as the authoritative matching rule:

**Exact matching rule**
- Take the incoming sender email from `doa_consultas_entrantes.remitente`
- Normalize it with `trim().toLowerCase()`
- Match it only against `doa_clientes_contactos.email`, also normalized with `trim().toLowerCase()`
- If there is an exact match:
  - treat the sender as a known client contact
  - show `empresa` from `doa_clientes_datos_generales.nombre`
  - show `contacto` as `nombre + apellidos` from `doa_clientes_contactos`
  - show the matched `email`
- If there is no exact match:
  - show `cliente desconocido`
  - optionally keep the raw sender email visible elsewhere on the card if needed for operations

This is the safest incremental rule because it is binary, testable, and already supported by the current repo data model. It also fits the example you gave: `jesus.arevalotorres@gmail.com` should render as `cliente desconocido` when no exact contact record exists.

### Risks
- `doa_consultas_entrantes.remitente` may sometimes include a display name instead of a plain email; if so, the app needs a strict email extraction step before matching.
- If duplicate contact emails exist across records, the resolution order must be deterministic, ideally favoring active contacts first.
- If the card only shows `cliente desconocido` and hides the raw sender completely, operators may lose useful context on unknown requests.
- Loading all clients and contacts into the Quotations page is acceptable for the current scale, but a larger dataset may later need a narrower query or server-side lookup optimization.

### Ready for Proposal
Yes. The orchestrator should move this to proposal with the exact-match rule as source of truth and specify the rendering contract:
- Unknown sender: `cliente desconocido`
- Known sender: `empresa + contacto + email`
