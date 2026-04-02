# Quotations Specification

## Purpose

This spec defines how incoming consultation cards behave in the Quotations board and how users manually change their state from the card UI.

## Requirements

### Requirement: Incoming cards follow their real state

The system MUST render each card created from `doa_consultas_entrantes` in the board lane that matches its normalized backend state. The system MUST NOT force all incoming cards into `entrada_recibida`.

#### Scenario: Card loads in the matching lane

- GIVEN a consultation row exists with a normalized incoming state
- WHEN the Quotations board loads
- THEN the card appears in the lane for that state
- AND the card does not appear in `entrada_recibida` unless that is its mapped lane

#### Scenario: No matching lane exists

- GIVEN a consultation row exists whose state has no visible lane
- WHEN the board loads
- THEN the card is not silently forced into `entrada_recibida`
- AND the UI keeps the item distinguishable from other lanes

### Requirement: Cards expose manual state control

The system MUST show a state control next to `Más detalle` for incoming consultation cards. The control MUST display the current state and MUST open a dropdown or select menu with all valid states for the incoming-query flow.

#### Scenario: User opens the state control

- GIVEN an incoming consultation card is visible
- WHEN the user clicks the state control next to `Más detalle`
- THEN a dropdown or select menu appears
- AND the current state is shown as the selected value

### Requirement: State changes persist and update placement

The system MUST persist a selected state change to `doa_consultas_entrantes.estado` and MUST refresh the board so the card appears in the lane for the new state.

#### Scenario: User changes the state

- GIVEN an incoming consultation card is visible
- WHEN the user selects a different valid state from the state control
- THEN the new state is saved to `doa_consultas_entrantes.estado`
- AND the card is shown in the lane for that state after refresh

#### Scenario: Invalid state selection is not accepted

- GIVEN a state value is not valid for the incoming-query flow
- WHEN the user tries to apply it
- THEN the change is rejected
- AND the card remains in its previous lane
