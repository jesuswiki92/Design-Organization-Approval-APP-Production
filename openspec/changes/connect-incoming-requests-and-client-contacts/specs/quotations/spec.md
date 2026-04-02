# Delta for Quotations

## ADDED Requirements

### Requirement: Incoming requests appear as board cards

The system MUST render each row from `doa_consultas_entrantes` as a card in the `entrada_recibida` lane of `/quotations`.

#### Scenario: Board loads incoming requests

- GIVEN there are one or more rows in `doa_consultas_entrantes`
- WHEN the `/quotations` board loads
- THEN each row appears as a card in `entrada_recibida`
- AND each card identifies the request unambiguously

#### Scenario: No incoming requests exist

- GIVEN `doa_consultas_entrantes` returns no rows
- WHEN the `/quotations` board loads
- THEN `entrada_recibida` renders without cards
- AND the page remains usable

### Requirement: Cards preserve backend state metadata

The system MUST preserve the real backend `estado` on each incoming-request card as visible metadata, even when the card is displayed in `entrada_recibida`.

#### Scenario: State differs from visual lane

- GIVEN a consultation has a backend `estado` other than the first board state
- WHEN the board renders the card
- THEN the card still appears in `entrada_recibida`
- AND the card shows the real backend `estado` as metadata

### Requirement: Incoming cards open the incoming detail route

The system MUST open `/quotations/incoming/[id]` when a user selects an incoming-request card.

#### Scenario: User opens a card

- GIVEN an incoming-request card is visible
- WHEN the user selects the card
- THEN the app navigates to `/quotations/incoming/[id]`
- AND the detail page shows that same request

