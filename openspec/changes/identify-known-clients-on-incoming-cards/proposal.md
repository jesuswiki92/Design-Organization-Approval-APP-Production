# Proposal: Identify Known Clients on Incoming Cards

## Intent

The Quotations board needs to distinguish unknown senders from existing clients using the data already stored in Supabase. Today incoming cards show only generic sender fields, which makes it impossible to tell whether a request came from a known company/contact or from an unregistered sender.

## Scope

### In Scope
- Resolve incoming request identity by exact email match against `doa_client_contacts.email`.
- Normalize sender and contact emails with `trim().toLowerCase()` before comparing.
- Show `client desconocido` when there is no exact match.
- Show `empresa + contacto + email` when the sender matches a known contact.
- Keep the change limited to the current incoming-card rendering path.

### Out of Scope
- Fuzzy matching, domain-based matching, or inference from sender names.
- Creating or editing client records from the board.
- Changing quotation workflow state logic.

## Approach

Load the client master data and contacts alongside incoming requests, reuse the existing client/contact model, and enrich each incoming card before rendering it. The lookup must be deterministic: normalize the sender email, compare it only with normalized contact emails, and use the matched contact's company and personal details if found. Unknown matches fall back to the explicit `client desconocido` label.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/(dashboard)/quotations/page.tsx` | Modified | Load client and contact data needed for identity resolution. |
| `app/(dashboard)/quotations/incoming-queries.ts` | Modified | Add normalized sender/email helpers and identity enrichment. |
| `app/(dashboard)/quotations/quotation-board-data.ts` | Modified | Pass known/unknown identity data into the card model. |
| `app/(dashboard)/quotations/QuotationStatesBoard.tsx` | Modified | Render the new identity text on incoming cards. |
| `types/database.ts` | Possibly Modified | Add view-model fields only if needed for the enriched card shape. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `sender` includes a display name instead of a plain email | Medium | Extract the email before matching and reject malformed values. |
| Duplicate contact emails exist | Low | Use a deterministic resolution rule and prefer active contacts. |
| Unknown cards hide useful context | Medium | Keep the raw sender email visible if the UI needs operational context. |

## Rollback Plan

Revert the identity enrichment so incoming cards go back to the current generic sender display. No schema migration is required.

## Dependencies

- Existing client/contact tables in Supabase.
- Existing `Client`, `ClientContact`, and `ClientWithContacts` structures in `types/database.ts`.

## Success Criteria

- [ ] A sender with no matching contact email renders as `client desconocido`.
- [ ] A sender with a matching contact email renders `empresa + contacto + email`.
- [ ] Matching is exact and case-insensitive after trimming.
- [ ] The board renders the enriched identity without changing quotation state behavior.
