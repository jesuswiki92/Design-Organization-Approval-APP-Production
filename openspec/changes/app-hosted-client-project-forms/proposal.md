# Proposal: App-Hosted Client Project Forms

## Intent

We need to replace external form tooling with app-hosted forms that fit the existing Quotations workflow. The form must support two cases: known clients get only technical project questions, while unknown clients get client data plus the same technical project block. This keeps the flow under our control, tied to Supabase state and future automation.

## Scope

### In Scope
- Public form route per consultation token.
- Two form variants: known client and unknown client.
- Unknown client form fields: company/contact data plus technical project questions.
- Known client form fields: technical project questions only, with client summary prefilled from Supabase.
- Persist responses and form status in Supabase.

### Out of Scope
- Tally or other external form providers.
- Complex multi-step wizard flows.
- CRM-like editing of client records from the form.

## Approach

Create a public form URL linked to `doa_incoming_requests.id` through a secure token. Resolve whether the sender is a known client from the quotations flow; if yes, prefill the client summary and show only the technical section. If not, show the full client-data block. Save submissions as structured JSON plus normalized key fields, then let the existing automation/state flow consume the result.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/(public)/forms/[token]/page.tsx` | New | Public form entry point. |
| `app/api/forms/*` | New | Load form context and submit responses. |
| `supabase/*` | New | Tables for form links and responses. |
| `types/database.ts` | Modified | Add form/link/response view models if needed. |
| `app/(dashboard)/quotations/*` | Modified | Generate and hand off form URLs from the existing flow. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Public tokens can be shared | Medium | Use long random tokens, expiry, and single-use rules where needed. |
| Known-client matching is wrong | Medium | Reuse the exact email-based identity resolution already in Quotations. |
| Form grows too large | Medium | Keep the first version fixed to the locked field set. |

## Rollback Plan

Disable the public form route and stop generating form links. Existing quotations state logic remains unchanged, so rollback does not require removing current board or email flows.

## Dependencies

- Existing client/contact data in Supabase.
- Existing email-based client identity resolution.
- n8n or the current email workflow for sending the form URL.

## Success Criteria

- [ ] Unknown clients see client data plus technical questions.
- [ ] Known clients see only the technical project questions.
- [ ] Form submissions persist to Supabase with a stable link to the consultation.
- [ ] The form can be opened from a public URL without login.
