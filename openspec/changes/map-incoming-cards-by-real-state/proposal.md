# Proposal: Map Incoming Cards by Real State

## Intent

The Quotations board currently renders incoming requests in `entrada_recibida` even when Supabase says they are already in another state. That hides the real workflow and makes manual state changes harder to reason about. We need the board to reflect the actual backend state and give users a direct way to change it from the card UI.

## Scope

### In Scope
- Render `doa_consultas_entrantes` cards in the board column that matches their real normalized state.
- Add a manual state button next to `Más detalle` that opens a dropdown with all valid states.
- Persist state changes back to `doa_consultas_entrantes` and refresh the board placement after update.

### Out of Scope
- Reworking the entire quotation workflow model or introducing new backend states.
- Changing the client details flow beyond what is needed for the current board state update path.
- Automating additional workflow steps beyond the manual state selector.

## Approach

Use the existing incoming-query normalization as the source of truth, then map each card to the visible lane derived from that normalized state instead of forcing every card into `entrada_recibida`. Extend the card action area with a compact state control that writes the selected value to Supabase and triggers a UI refresh so the card moves to the correct lane.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/(dashboard)/quotations/quotation-board-data.ts` | Modified | Stop forcing all incoming cards into one lane and derive the visible lane from state. |
| `app/(dashboard)/quotations/QuotationStatesBoard.tsx` | Modified | Render cards by real lane and expose the new state action in the card UI. |
| `app/(dashboard)/quotations/incoming-queries.ts` | Modified | Keep the normalized incoming state mapping used by the board and selector. |
| `app/(dashboard)/quotations/page.tsx` | Modified | Pass the data shape needed for real-state placement and updates. |
| Supabase `doa_consultas_entrantes` | Modified | Update `estado` manually from the dropdown action. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A normalized incoming state has no matching visible lane yet | Medium | Add a clear fallback lane or explicit lane mapping before shipping. |
| Manual state updates can desync the UI if refresh is missed | Medium | Revalidate data after update and move the card from the refreshed server state. |

## Rollback Plan

Restore the previous adapter that forced cards into `entrada_recibida`, remove the manual state selector from the card UI, and keep the existing Supabase data unchanged except for already committed state transitions.

## Dependencies

- Existing workflow state definitions in `lib/workflow-state-config.ts`.
- Supabase write access for `doa_consultas_entrantes.estado`.

## Success Criteria

- [ ] Incoming cards appear in the board lane that matches their real state.
- [ ] The state button next to `Más detalle` opens a dropdown with valid states and saves the selection.
- [ ] After a manual change, the board refreshes and the card is shown in the correct lane.
