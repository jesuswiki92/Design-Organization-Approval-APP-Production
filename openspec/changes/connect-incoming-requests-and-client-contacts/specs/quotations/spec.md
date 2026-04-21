# Delta for Quotations

## ADDED Requirements

### Requirement: Incoming requests appear as board cards

The system MUST render each row from `doa_incoming_requests` as a card in the `request_received` lane of `/quotations`.

#### Scenario: Board loads incoming requests

- GIVEN there are one or more rows in `doa_incoming_requests`
- WHEN the `/quotations` board loads
- THEN each row appears as a card in `request_received`
- AND each card identifies the request unambiguously

#### Scenario: No incoming requests exist

- GIVEN `doa_incoming_requests` returns no rows
- WHEN the `/quotations` board loads
- THEN `request_received` renders without cards
- AND the page remains usable

### Requirement: Cards preserve backend state metadata

The system MUST preserve the real backend `status` on each incoming-request card as visible metadata, even when the card is displayed in `request_received`.

#### Scenario: State differs from visual lane

- GIVEN a consultation has a backend `status` other than the first board state
- WHEN the board renders the card
- THEN the card still appears in `request_received`
- AND the card shows the real backend `status` as metadata

### Requirement: Incoming cards open the incoming detail route

The system MUST open `/quotations/incoming/[id]` when a user selects an incoming-request card.

#### Scenario: User opens a card

- GIVEN an incoming-request card is visible
- WHEN the user selects the card
- THEN the app navigates to `/quotations/incoming/[id]`
- AND the detail page shows that same request

