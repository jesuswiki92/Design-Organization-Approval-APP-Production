# Tasks: Map Incoming Cards by Real State

## Phase 1: State Contract and Persistence

- [ ] 1.1 Add `app/api/incoming-requests/[id]/state/route.ts` to validate allowed incoming-query states and persist `doa_incoming_requests.status`.
- [ ] 1.2 Update `app/(dashboard)/quotations/incoming-queries.ts` so the incoming state list and lane mapping are the single source of truth for board placement and the manual selector.
- [ ] 1.3 Align `app/(dashboard)/quotations/send-client` state advancement with the same state constants so email flow and manual state flow stay consistent.

## Phase 2: Board and Manual State UI

- [ ] 2.1 Refactor `app/(dashboard)/quotations/quotation-board-data.ts` to stop forcing every incoming card into `request_received` and map each card to the lane for its real normalized state.
- [ ] 2.2 Update `app/(dashboard)/quotations/QuotationStatesBoard.tsx` so incoming cards render in the correct lane and keep the real backend state visible on the card.
- [ ] 2.3 Add a compact state button next to `Mas detalle` in the incoming card actions, showing the current state and opening a dropdown/select with all valid incoming-query states.
- [ ] 2.4 Wire the selector to call the new state route, then refresh the quotations page so the card moves immediately after save.

## Phase 3: Verification and Cleanup

- [ ] 3.1 Verify the quotations board with a real `doa_incoming_requests` row in each supported state and confirm each card lands in the matching lane.
- [ ] 3.2 Verify the manual state selector updates Supabase, reloads the board, and preserves the updated lane after refresh.
- [ ] 3.3 Run `npm run lint`, `npm run build`, and `npm run smoke` from the app root and fix any regressions before closing the change.
