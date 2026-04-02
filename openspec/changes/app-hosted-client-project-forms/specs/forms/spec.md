# Forms Specification

## Purpose

Provide app-hosted public forms for consultation follow-up, with two variants driven by whether the sender is a known client. The form must capture client data only when needed and always collect the technical project information required to define the work.

## Requirements

### Requirement: Public tokenized access
The system MUST expose each form through a public token linked to `doa_consultas_entrantes.id`. The token MUST identify the consultation without requiring login.

#### Scenario: Open form from public URL
- GIVEN a valid public token
- WHEN the client opens the form URL
- THEN the system SHALL load the consultation context
- AND the form SHALL render without authentication

#### Scenario: Invalid token
- GIVEN an unknown or expired token
- WHEN the URL is opened
- THEN the system SHALL not expose consultation data
- AND the user SHALL see a safe not-found or expired state

### Requirement: Known and unknown client variants
The system MUST support two variants: known client and unknown client. Known client forms MUST show a client summary header and only the technical project block. Unknown client forms MUST include the client-data block plus the technical project block.

#### Scenario: Known client form
- GIVEN the sender matches an existing client contact
- WHEN the form is loaded
- THEN the system SHALL show the detected client summary
- AND the form SHALL include only the technical project questions

#### Scenario: Unknown client form
- GIVEN the sender does not match an existing client contact
- WHEN the form is loaded
- THEN the system SHALL show the client-data block
- AND the form SHALL show the technical project questions

### Requirement: Client-data block
For unknown clients, the form MUST collect company and contact data. `Dominio email` MUST NOT be asked directly and MUST be derived from the sender email. `Tipo de cliente` MUST be a dropdown.

#### Scenario: Unknown client data entry
- GIVEN the form is in unknown-client mode
- WHEN the user fills the client-data block
- THEN the system SHALL accept empresa, CIF/VAT, país, ciudad, dirección, teléfono, web, tipo de cliente, notas, nombre contacto, apellidos, email, teléfono contacto y cargo
- AND the system SHALL derive the email domain from the sender email

### Requirement: Technical project block
The system MUST collect the locked technical questions for all forms: project identification, aircraft details, available technical base, and operation/planning.

#### Scenario: Technical project submission
- GIVEN any form variant
- WHEN the user completes the technical project block
- THEN the system SHALL capture the project description, objective, work type, aircraft data, technical references, and planning details
- AND the submission SHALL be valid only when the required technical fields are present

### Requirement: Conditional reference field
`Referencia interna del proyecto` MUST be shown only when `Tipo de trabajo` is `Modificación a proyecto existente`.

#### Scenario: Existing project modification
- GIVEN `Tipo de trabajo` is `Modificación a proyecto existente`
- WHEN the technical block is displayed
- THEN the system SHALL require `Referencia interna del proyecto`

#### Scenario: New project modification
- GIVEN `Tipo de trabajo` is `Modificación nueva`
- WHEN the technical block is displayed
- THEN the system SHALL hide `Referencia interna del proyecto`

### Requirement: Supabase persistence
The system MUST store form submissions in Supabase and link each response to the originating consultation.

#### Scenario: Submit form
- GIVEN a valid form submission
- WHEN the user submits the form
- THEN the system SHALL persist the response in Supabase
- AND the stored record SHALL retain the consultation link

#### Scenario: Repeat access after submission
- GIVEN a previously submitted form
- WHEN the public link is reopened
- THEN the system SHOULD show the latest known state of the consultation
