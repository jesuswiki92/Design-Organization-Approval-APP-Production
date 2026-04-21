# Delta for Clients

## ADDED Requirements

### Requirement: Client detail includes contact records

The system MUST include contacts from `doa_clientes_contactos` in the left-side client detail block when a client is selected.

#### Scenario: Client has contacts

- GIVEN a client has one or more rows in `doa_clientes_contactos`
- WHEN the user opens that client in `/clients`
- THEN the left detail block shows the client contacts
- AND the contacts are associated with the selected client

#### Scenario: Client has no contacts

- GIVEN a client has no related contact rows
- WHEN the user opens that client in `/clients`
- THEN the client detail block still renders
- AND the contacts area is empty or shows a clear no-data state

### Requirement: Primary contact is easy to identify

The system SHOULD present the primary contact first when one exists, followed by the remaining contacts for the selected client.

#### Scenario: Primary contact exists

- GIVEN a client has a contact marked as primary
- WHEN the client detail block renders
- THEN the primary contact is shown before the other contacts
- AND the primary contact is clearly identifiable

### Requirement: Client data stays aligned with the selected client

The system MUST only show contacts that belong to the currently selected client.

#### Scenario: Switching between clients

- GIVEN two clients have different contact sets
- WHEN the user switches from one client to another
- THEN the contact block updates to the newly selected client
- AND contacts from the previous client are not shown

