# Quotations Specification

## Purpose

Incoming quotation cards must show whether the sender is a known client or an unknown sender, using exact email matching against existing client contacts.

## Requirements

### Requirement: Resolve known sender identity by exact email match

The system MUST resolve an incoming card as a known client only when the sender email matches `doa_client_contacts.email` after `trim().toLowerCase()` normalization.
When a match exists, the card MUST display the company name, the contact name, and the contact email.

#### Scenario: Sender matches an existing contact

- GIVEN an incoming request whose sender email normalizes to an existing `doa_client_contacts.email`
- WHEN the Quotations board renders the card
- THEN the card MUST show the company name, contact name, and contact email

#### Scenario: Sender email does not match any known contact

- GIVEN an incoming request whose sender email does not match any normalized `doa_client_contacts.email`
- WHEN the Quotations board renders the card
- THEN the card MUST not be marked as a known client

### Requirement: Render unknown senders explicitly

The system MUST render unknown incoming senders with the label `client desconocido`.
Unknown sender cards MUST remain usable in the Quotations board and MUST still follow the existing quotation workflow behavior.

#### Scenario: Unknown sender is rendered

- GIVEN an incoming request whose sender email has no exact match in `doa_client_contacts`
- WHEN the card is rendered in the board
- THEN the card MUST show `client desconocido`

#### Scenario: Unknown sender keeps quotation behavior

- GIVEN an unknown incoming sender card
- WHEN the user interacts with the board
- THEN the card MUST still behave like a normal quotation card for state and navigation

### Requirement: Keep identity enrichment isolated from quotation logic

The system MUST enrich card identity without changing unrelated quotation behavior.
The existing quotation state flow, navigation, and board behavior outside identity display MUST remain unchanged.

#### Scenario: Board behavior remains stable

- GIVEN the Quotations board already renders incoming cards and workflow states
- WHEN identity enrichment is enabled
- THEN state movement, navigation, and other quotation behaviors MUST remain unchanged

#### Scenario: Matching is deterministic

- GIVEN a sender email and a stored contact email that differ only by case or surrounding spaces
- WHEN the system resolves identity
- THEN it MUST treat the values as the same email after normalization
