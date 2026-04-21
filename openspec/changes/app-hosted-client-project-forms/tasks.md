# Tasks: App-Hosted Client Project Forms

## Phase 1: Foundation

- [ ] 1.1 Create a Supabase migration under `supabase/migrations/` for `doa_request_form_links` and `doa_request_form_responses`, with token hash, consultation linkage, variant, status, expiry, submission timestamps, normalized fields, and JSON payload.
- [ ] 1.2 Update `types/database.ts` with the new form link/response row types and the `known_client | unknown_client` variant contract.
- [ ] 1.3 Add shared form constants/helpers for the locked v1 field set, the `Tipo de client` dropdown, and the conditional `Referencia internal del project` rule.

## Phase 2: Core Implementation

- [ ] 2.1 Add a link-generation helper in `app/api/incoming-requests/[id]/send-client/route.ts` that creates or reuses the public form token and builds `formUrl` for the consultation.
- [ ] 2.2 Extend the existing send-client webhook payload to include `formToken` and `formUrl` without removing the current email fields.
- [ ] 2.3 Implement `app/api/forms/[token]/route.ts` to resolve public form context by token, serve known/unknown variant data, and persist submissions to Supabase.
- [ ] 2.4 Build `app/(public)/forms/[token]/page.tsx` with the unknown-client layout (`Data del client` + technical block) and the known-client layout (client summary + technical block).
- [ ] 2.5 Build `app/(dashboard)/quotations/forms/page.tsx` as the internal `Forms` catalog with a table/list of form links and a single `open/view` action per row.

## Phase 3: Quotations Wiring

- [ ] 3.1 Add the `Forms` button/entry to `app/(dashboard)/quotations/page.tsx` and wire it to the internal forms catalog page.
- [ ] 3.2 Ensure the quotations flow selects the correct form variant from the existing client matching result before generating the link.
- [ ] 3.3 Keep the public form path and the internal catalog page aligned with the same consultation record so resend/open behavior stays deterministic.

## Phase 4: Verification

- [ ] 4.1 Verify the public route returns a safe state for invalid or expired tokens and renders both variants correctly.
- [ ] 4.2 Verify `send-client` creates/reuses a link row, sends `formUrl`/`formToken`, and still preserves the existing email payload.
- [ ] 4.3 Verify the internal `Forms` catalog opens from Quotations and only exposes `view/open` in v1.
- [ ] 4.4 Run `npm run lint` and `npm run build` after wiring the form routes and Supabase persistence.
