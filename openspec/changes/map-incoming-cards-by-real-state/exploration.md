## Exploration: map incoming cards by real state

### Current State
`/quotations` already fetches `doa_incoming_requests` in [app/(dashboard)/quotations/page.tsx](C:/Users/Jesús%20Andr%C3%A9s/Desktop/Aplicaciones%20-%20Desarrollo/Design%20Organization%20Approval%20-%20APP%20Production/01.Desarrollo%20de%20App/app/(dashboard)/quotations/page.tsx), normalizes rows through [app/(dashboard)/quotations/incoming-queries.ts](C:/Users/Jes%C3%BAs%20Andr%C3%A9s/Desktop/Aplicaciones%20-%20Desarrollo/Design%20Organization%20Approval%20-%20APP%20Production/01.Desarrollo%20de%20App/app/(dashboard)/quotations/incoming-queries.ts), and injects the resulting cards into the board in [app/(dashboard)/quotations/quotation-board-data.ts](C:/Users/Jes%C3%BAs%20Andr%C3%A9s/Desktop/Aplicaciones%20-%20Desarrollo/Design%20Organization%20Approval%20-%20APP%20Production/01.Desarrollo%20de%20App/app/(dashboard)/quotations/quotation-board-data.ts). The current behavior is still artificial: all incoming-query cards are forced into `request_received`, while the real backend state is only shown as metadata on the card.

The state model already contains two separate scopes in [lib/workflow-state-config.ts](C:/Users/Jes%C3%BAs%20Andr%C3%A9s/Desktop/Aplicaciones%20-%20Desarrollo/Design%20Organization%20Approval%20-%20APP%20Production/01.Desarrollo%20de%20App/lib/workflow-state-config.ts): `quotation_board` and `incoming_queries`. `incoming_queries` already defines `new`, `awaiting_form`, and `form_received`, and `toIncomingQuery()` already normalizes `espera_formulario_cliente` to `awaiting_form`. The mismatch is therefore not in normalization; it is in lane selection, because the board only renders `quotation_board` lanes.

### Affected Areas
- [app/(dashboard)/quotations/quotation-board-data.ts](C:/Users/Jes%C3%BAs%20Andr%C3%A9s/Desktop/Aplicaciones%20-%20Desarrollo/Design%20Organization%20Approval%20-%20APP%20Production/01.Desarrollo%20de%20App/app/(dashboard)/quotations/quotation-board-data.ts) — current adapter forces all incoming cards into `request_received`.
- [app/(dashboard)/quotations/QuotationStatesBoard.tsx](C:/Users/Jes%C3%BAs%20Andr%C3%A9s/Desktop/Aplicaciones%20-%20Desarrollo/Design%20Organization%20Approval%20-%20APP%20Production/01.Desarrollo%20de%20App/app/(dashboard)/quotations/QuotationStatesBoard.tsx) — renders lanes from resolved `quotation_board` rows only.
- [app/(dashboard)/quotations/incoming-queries.ts](C:/Users/Jes%C3%BAs%20Andr%C3%A9s/Desktop/Aplicaciones%20-%20Desarrollo/Design%20Organization%20Approval%20-%20APP%20Production/01.Desarrollo%20de%20App/app/(dashboard)/quotations/incoming-queries.ts) — already maps `espera_formulario_cliente` to the normalized incoming state `awaiting_form`.
- [lib/workflow-state-config.ts](C:/Users/Jesús%20Andr%C3%A9s/Desktop/Aplicaciones%20-%20Desarrollo/Design%20Organization%20Approval%20-%20APP%20Production/01.Desarrollo%20de%20App/lib/workflow-state-config.ts) — defines the two workflow scopes and default rows that can be reused as the source of truth.
- [types/database.ts](C:/Users/Jesús%20Andr%C3%A9s/Desktop/Aplicaciones%20-%20Desarrollo/Design%20Organization%20Approval%20-%20APP%20Production/01.Desarrollo%20de%20App/types/database.ts) — contains the typed workflow config rows and `IncomingRequest` contract.

### Approaches
1. **Map real backend state to a board lane key** — add a pure mapping layer that resolves each incoming card to the correct visible lane, using the normalized incoming state plus the workflow-state config.
   - Pros: keeps the board faithful to backend state; minimal UI churn; easy to test; lets us preserve the current board shell.
   - Cons: requires deciding what happens when an incoming state has no corresponding board lane yet.
   - Effort: Medium

2. **Render incoming-query lanes as first-class board columns** — extend the board so it can render both `quotation_board` and `incoming_queries` lanes together, with cards placed directly by their normalized state.
   - Pros: closest match to real business states; removes the artificial `request_received` bucket.
   - Cons: broader UI change; may require tweaking styling, ordering, and the list view.
   - Effort: Medium-High

3. **Keep the current board and only rename the first lane** — relabel `request_received` to match the incoming state while keeping the rest of the structure intact.
   - Pros: smallest code change.
   - Cons: still wrong semantically if the backend state is not actually `request_received`; hides the real workflow instead of fixing it.
   - Effort: Low

### Recommendation
Use approach 2 if the goal is strict fidelity to the real workflow, because the board already has separate state scopes and the current design can support a mixed-lane model without introducing a new data source. The key implementation detail is to stop forcing incoming cards into `request_received` and instead place them in the lane derived from their normalized backend state. For `espera_formulario_cliente`, that means using the `awaiting_form` incoming-query state rather than the board's initial entry lane.

If the team wants the smallest safe increment first, implement approach 1 as a bridge: create a mapping helper that decides the lane from `estadoBackend`, then let the board render the mapped lane. That keeps the change local and lets us later decide whether incoming-query lanes should be shown alongside quotation-board lanes or folded into the same board layout.

### Risks
- There is no existing quotation-board lane named `espera_formulario_cliente`; the visible lane will need to come from the normalized incoming state or a new lane definition.
- `QuotationStatesBoard` currently assumes the quotation workflow is the only visible lane set, so introducing real-state placement may require a small refactor in list and board views.
- If the mapping is implemented too literally, cards may disappear from the current board until the new lane is wired into the UI.
- The current `incoming_queries` normalizer and the board state config use different labels by design; the change must preserve that separation instead of collapsing them accidentally.

### Ready for Proposal
Yes. The next step is to define the mapping contract from `IncomingRequest.estadoBackend` to visible board lane keys and decide whether the board should render mixed scopes or only incoming-query lanes for the early workflow.
