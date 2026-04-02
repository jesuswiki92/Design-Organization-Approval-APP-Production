# Tasks: Connect Incoming Requests and Client Contacts

## Phase 1: Data Wiring

- [x] 1.1 Update `app/(dashboard)/quotations/page.tsx` to fetch `doa_consultas_entrantes` on the server, normalize rows with `toIncomingQuery`, and pass the incoming records into `QuotationsClient`.
- [x] 1.2 Update `app/(dashboard)/clients/page.tsx` to fetch `doa_clientes_contactos`, group them by `cliente_id`, and build `ClienteWithContactos[]` before rendering `ClientsPageClient`.
- [x] 1.3 Extend `app/(dashboard)/quotations/QuotationsClient.tsx` and `app/(dashboard)/clients/ClientsPageClient.tsx` props so the new hydrated data reaches the client surfaces without extra client-side fetching.

## Phase 2: Board and Client UI

- [x] 2.1 Update `app/(dashboard)/quotations/quotation-board-data.ts` with an incoming-query card mapper that sets `href` to `/quotations/incoming/[id]`, keeps the real backend `estado` as metadata, and marks the card as an incoming query.
- [x] 2.2 Update `app/(dashboard)/quotations/QuotationStatesBoard.tsx` so only `entrada_recibida` receives incoming cards and both board/list actions use the card `href` instead of `/quotations/[id]`.
- [x] 2.3 Update `app/(dashboard)/clients/ClientsPageClient.tsx` to render the selected client's contacts inside the left detail block, with the primary contact first and a clear empty state when no contacts exist.

## Phase 3: Verification

- [x] 3.1 Run `npm run lint` and fix any typing, prop, or lint errors introduced by the new data flow.
- [x] 3.2 Run `npm run build` to confirm the server/client split still compiles with the new props and Supabase queries.
- [ ] 3.3 Run `npm run smoke` and manually verify `/quotations` shows real cards in `entrada_recibida`, `/quotations/incoming/[id]` opens from a card, and `/clients` shows grouped contacts in the left panel.
