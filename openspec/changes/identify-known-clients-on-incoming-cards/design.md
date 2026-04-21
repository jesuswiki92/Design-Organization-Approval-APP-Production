# Design: Identify Known Clients on Incoming Cards

## Technical Approach

`Quotations` will load incoming requests plus client master data in the server page, then enrich each incoming card before it reaches the board. The matching rule stays deterministic: normalize the sender email and compare it only against normalized `doa_client_contacts.email`. If a match exists, the card gets a known-client identity; otherwise it renders as `client desconocido`.

This keeps identity resolution separate from quotation workflow state. The board still uses the existing state config and navigation; only the card identity payload changes.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Matching rule | Exact normalized email match against `doa_client_contacts.email` | Domain fallback, fuzzy matching | Exact matching is auditable, deterministic, and fits the request for `client desconocido` when no contact exists. |
| Enrichment point | Build identity in the Quotations server page and pass enriched cards down | Resolve inside the board component | Server-side enrichment matches the existing App Router pattern used by `Clients` and avoids duplicating lookup logic in the client tree. |

## Data Flow

    Supabase
      ├── doa_incoming_requests
      ├── doa_clients
      └── doa_client_contacts
           │
           ▼
    app/(dashboard)/quotations/page.tsx
           │  normalize sender email + build contact index
           ▼
    incoming-queries.ts -> quotation-board-data.ts
           │  attach known/unknown identity to each card
           ▼
    QuotationStatesBoard.tsx
           │  render identity text on the card
           ▼
    Board/List UI

## File Changes

| File | Action | Description |
|---|---|---|
| `app/(dashboard)/quotations/page.tsx` | Modify | Fetch client and contact rows alongside incoming queries, then pass both datasets to the board surface. |
| `app/(dashboard)/quotations/incoming-queries.ts` | Modify | Add sender email normalization and a pure identity-resolution helper. |
| `app/(dashboard)/quotations/quotation-board-data.ts` | Modify | Enrich `QuotationCard` with known/unknown client identity fields. |
| `app/(dashboard)/quotations/QuotationStatesBoard.tsx` | Modify | Render `client desconocido` or `empresa + contacto + email` from the enriched card model. |
| `types/database.ts` | Modify only if needed | Add view-model types only if the enriched card shape needs an explicit type. No schema change is expected. |

## Interfaces / Contracts

```ts
type IncomingClientIdentity =
  | {
      kind: 'known'
      companyName: string
      contactName: string
      email: string
      displayLabel: string
    }
  | {
      kind: 'unknown'
      displayLabel: 'client desconocido'
      senderEmail: string
    }

type QuotationCard = {
  // existing fields
  clientIdentity: IncomingClientIdentity
}
```

The helper that resolves identity SHOULD:
- trim and lower-case both values
- extract the email if `sender` includes a display name
- ignore non-matching contacts rather than guessing

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Email normalization and known/unknown resolution | Validate exact-match helper cases, including spacing and casing. |
| Integration | Quotations page data shaping | Confirm incoming requests are enriched with contact/company data before board rendering. |
| E2E | Card copy in the board | Verify unknown sender shows `client desconocido` and known sender shows company/contact/email. |

## Migration / Rollout

No migration required. The change only reads existing tables and enriches UI data.

## Open Questions

- [ ] Should unknown cards also show the raw sender email as supporting context, or only `client desconocido`?
