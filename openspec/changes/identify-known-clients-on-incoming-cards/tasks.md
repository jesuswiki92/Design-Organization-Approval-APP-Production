# Tasks: Identify Known Clients on Incoming Cards

## Phase 1: Data Shape and Resolution

- [x] 1.1 Update `app/(dashboard)/quotations/page.tsx` to fetch `doa_clientes_datos_generales` and `doa_clientes_contactos` alongside `doa_consultas_entrantes`.
- [x] 1.2 Add a deterministic helper in `app/(dashboard)/quotations/incoming-queries.ts` that extracts the sender email, normalizes with `trim().toLowerCase()`, and resolves against `doa_clientes_contactos.email`.
- [x] 1.3 Enrich the incoming-query model in `app/(dashboard)/quotations/quotation-board-data.ts` with `clientIdentity` for `known` and `unknown` cases.

## Phase 2: Board Rendering

- [x] 2.1 Update `app/(dashboard)/quotations/QuotationStatesBoard.tsx` to render `cliente desconocido` when identity resolution fails.
- [x] 2.2 Update the same card UI to render `empresa + contacto + email` when identity resolution succeeds.
- [x] 2.3 Keep state lanes, navigation, and existing quotation behavior unchanged while only swapping the identity text block.

## Phase 3: Verification

- [ ] 3.1 Add or update unit coverage for the email-normalization helper to prove exact case-insensitive matching and unknown fallback.
- [x] 3.2 Verify the Quotations board renders a known client card with company, contact name, and email.
- [x] 3.3 Verify an unknown sender such as `jesus.arevalotorres@gmail.com` renders as `cliente desconocido`.
- [x] 3.4 Run `npm run lint`, `npm run build`, and `npm run smoke` after the implementation.
