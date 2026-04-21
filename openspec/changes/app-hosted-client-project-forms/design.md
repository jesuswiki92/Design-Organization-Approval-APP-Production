# Design: App-Hosted Client Project Forms

## Technical Approach

The app will own both the public form experience and the internal form catalog. Public access will live under `app/(public)/forms/[token]/page.tsx`, while Quotations will expose an internal `Forms` entry that opens `app/(dashboard)/quotations/forms/page.tsx`. This keeps public submission separate from internal management, but both are linked to the same consultation record.

Known vs unknown client is resolved before the link is sent. If the sender matches an existing contact by email, the public form shows a short variant with only the technical project section and a client summary. If not, it shows the client-data block plus the same technical section.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Internal navigation | Add a `Forms` entry under Quotations and an internal catalog page at `app/(dashboard)/quotations/forms/page.tsx` | Hide form management inside the public route, or place it outside Quotations | The catalog belongs with the quotation workflow and gives operators a visible place to inspect, resend, or open forms. |
| Public route | Use a tokenized public route under `app/(public)/forms/[token]/page.tsx` | Use Tally/external forms, or a dashboard-only page | A public token route keeps the UX inside the app and lets Supabase and n8n stay the system of record. |
| Link storage | Store a hashed token plus consultation linkage in Supabase | Store only the raw token in the URL, or generate links only in n8n | Hashing keeps the public link lookup safe, while the database remains the source of truth for reuse and resends. |
| Payload shape | Store normalized columns plus a JSON payload | Store only JSON | Normalized fields support search/reporting; JSON preserves the exact submitted shape for future changes. |

## Data Flow

    Quotations send-client
            |
            v
    app/api/incoming-requests/[id]/send-client/route.ts
            |
            | create or reuse link row
            v
    doa_request_form_links (token hash + consultation_id + variant)
            |
            | include public URL in webhook payload
            v
    n8n email sends https://.../forms/[token]
            |
            v
    app/(public)/forms/[token]/page.tsx
            |
            | resolve token -> link -> known/unknown variant
            v
    app/api/forms/[token]/route.ts
            |
            | insert response + update consultation state
            v
    doa_request_form_responses + doa_incoming_requests
            |
            v
    Quotations refresh / internal catalog

The public page will resolve the sender identity from the consultation link row, not by re-deriving it in the browser. The internal catalog page will list links with a simple table: form name, consultation, variant, status, and an open/view action.

## File Changes

| File | Action | Description |
|---|---|---|
| `app/(public)/forms/[token]/page.tsx` | Create | Public form renderer for known and unknown client variants. |
| `app/api/forms/[token]/route.ts` | Create | GET form context and POST responses for tokenized public forms. |
| `app/(dashboard)/quotations/forms/page.tsx` | Create | Internal forms catalog with list/table and open/view actions. |
| `app/(dashboard)/quotations/page.tsx` | Modify | Add the `Forms` button/entry that links to the internal catalog. |
| `app/(dashboard)/quotations/QuotationsClient.tsx` | Modify | Accept and render the catalog navigation entry if needed by layout. |
| `app/api/incoming-requests/[id]/send-client/route.ts` | Modify | Add `formUrl` / `formToken` to the webhook payload and upsert the form link row. |
| `types/database.ts` | Modify | Add form link/response row types and the form variant contract. |
| `supabase/migrations/*` | Create | Add form link and response tables. |

## Interfaces / Contracts

```ts
type FormVariant = 'known_client' | 'unknown_client'

type ConsultaFormLink = {
  id: string
  incoming_request_id: string
  token_hash: string
  variant: FormVariant
  client_id: string | null
  contact_id: string | null
  status: 'draft' | 'sent' | 'opened' | 'submitted'
  expires_at: string | null
  submitted_at: string | null
}
```

Unknown-client submissions SHALL persist both a JSON payload and normalized fields for company/contact/project data. Known-client submissions SHALL persist only the technical section plus the consultation linkage. `email_domain` SHALL be derived from the sender email, not entered in the form.

Conditional logic:
- `Referencia internal del project` MUST be shown only when `Tipo de trabajo = Modificacion a project existente`.
- The aircraft picker SHOULD use the existing model catalog when available, with a fallback free-text value if needed.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Token hashing, variant selection, conditional field rules | Validate helper functions and field visibility logic. |
| Integration | Link creation and submission persistence | Confirm `send-client` creates/reuses the link row and form submission writes response data. |
| E2E | Public form and internal catalog | Open `/forms/[token]`, submit both variants, and verify the Quotations catalog link exists. |

## Migration / Rollout

Add the new tables and deploy the routes behind the existing quotations flow. No backfill is required. Existing quotations/email behavior remains in place; the new form link is an additive capability.

## Open Questions

- [ ] Should the internal forms catalog allow cloning/resending a link in v1, or only viewing/opening it?
