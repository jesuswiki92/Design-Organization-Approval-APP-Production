# 4 Parked Bugs — Diagnostic Report

> Read-only diagnosis. No code was modified.
> App root: `01.Desarrollo de App`
> Tables renamed: `doa_*` → `ams_*` (bootstrap migration `20260418000000_ams_bootstrap.sql`).

Executive summary of where the bug is owned:

| Bug | Owned by                 | Status              |
| --- | ------------------------ | ------------------- |
| 1   | App (`send-client`)      | 100% fixable in-app |
| 2   | App (`send-client`) + syncer | 100% fixable in-app |
| 3   | n8n workflow WF1         | Blocker — needs n8n fix |
| 4   | n8n workflow WF1         | Blocker — needs n8n fix |

Bugs 1 and 2 are both caused by the same root issue: the app's send pipeline never persists an outgoing email row anywhere that downstream systems look for it. Bugs 3 and 4 are both failures of the same n8n node (`Actualizar Fila entrantes`), which is using the wrong matching/update strategy for an already-existing consulta.

---

## Bug 1: `correo_cliente_enviado_at` / `correo_cliente_enviado_by` NULL after sending

### Symptom
After a user approves and sends a reply to the client via the composer, the DB fields `correo_cliente_enviado_at` and `correo_cliente_enviado_by` in `ams_consultas_entrantes` remain NULL. The UI is prepared to render them (`app/(dashboard)/quotations/incoming/[id]/page.tsx:983`) but they never get set.

### Root cause
The send route does NOT write those two columns. Instead, it writes two parallel/legacy columns (`reply_body`, `reply_sent_at`) that exist alongside `correo_cliente_enviado_at`/`correo_cliente_enviado_by` in the same table.

Evidence — `app/api/consultas/[id]/send-client/route.ts:214-218`:

```ts
// Guardar la respuesta enviada en Supabase para mostrarla en el hilo de emails
const { error: replyError } = await supabase
  .from('ams_consultas_entrantes')
  .update({ reply_body: message, reply_sent_at: now })
  .eq('id', id)
```

There are only two places in the entire codebase that UPDATE `ams_consultas_entrantes`:
- `app/api/consultas/[id]/send-client/route.ts:216-218` — writes `reply_body`, `reply_sent_at` (not `correo_cliente_enviado_*`).
- `app/api/consultas/[id]/change-classification/route.ts:56` — writes `change_classification` only.

No other server code, no DB trigger (`supabase/migrations/20260418000000_ams_bootstrap.sql:961-972`), no n8n node (`01. Soporte_App/n8n-workflows/DOA - Enviar Correo al Cliente.json:73-91` only updates `estado`) writes `correo_cliente_enviado_at` or `correo_cliente_enviado_by`. Those columns are effectively orphaned — they exist in the schema and are read by the UI, but nothing writes them.

It looks like `reply_body`/`reply_sent_at` were introduced as parallel columns at some point and the send handler was migrated to write them without migrating (or in addition to) the original `correo_cliente_*` fields.

### Proposed fix
Update the Supabase write in `app/api/consultas/[id]/send-client/route.ts` to also persist the two tracking fields:

```ts
// app/api/consultas/[id]/send-client/route.ts:215-218
const { error: replyError } = await supabase
  .from('ams_consultas_entrantes')
  .update({
    reply_body: message,
    reply_sent_at: now,
    correo_cliente_enviado_at: now,
    correo_cliente_enviado_by: user.id,
  })
  .eq('id', id)
```

`user.id` is already in scope from `const { user, supabase } = auth` (line 72). `now` is already an ISO timestamp string from line 133.

Optional (cleaner, longer-term): pick one set of columns and deprecate the other. The "final" fields that the UI displays are `correo_cliente_enviado_*`; `reply_body`/`reply_sent_at` are only read by the same page and `preliminary-scope/chat/route.ts` for AI-context purposes. If you want to consolidate, keep `correo_cliente_enviado_*` + move the message text into a new `ultimo_borrador_cliente_enviado` (or reuse `reply_body`).

### Risk
**Low.** It's a pure additive UPDATE on the same row the route already updates. Payload to n8n is unchanged.

### Regression risk
- **Very low.** The only thing that could break is if some other consumer interprets "`correo_cliente_enviado_at IS NOT NULL`" as a signal and triggers on it. A grep shows only the detail page reads these fields, so the only visible effect is "the timestamp now shows up under the composer" — which is exactly the fix.
- If you also consolidate `reply_body`/`reply_sent_at`, that IS a breaking change — do it in a separate migration.

---

## Bug 2: Outgoing `.eml` files NOT saved in the "1. Email" folder

### Symptom
When a user sends an email through the app, no `.eml` archive appears in the consulta's "1. Email" folder.

### Root cause
The local-folder `.eml` archiver (`lib/quotations/sync-consulta-emails.ts`) does work — but it only materializes rows that exist in `ams_emails`. Outgoing emails sent via the app's `send-client` route are never inserted into `ams_emails`, so there is nothing for the sync function to write.

Flow of evidence:

1. `lib/quotations/sync-consulta-emails.ts:86-89` reads from `ams_emails`:

   ```ts
   const { data: emails, error: dbError } = await supabase
     .from('ams_emails')
     .select('*')
     .eq('consulta_id', consultaId)
     .order('fecha', { ascending: true })
   ```

   It writes one `.eml` per row into `{SIMULATION_BASE_PATH}/{numero_entrada}/1. Email/`.

2. `app/(dashboard)/quotations/incoming/[id]/page.tsx:363-369` is the only caller — triggered fire-and-forget when a user opens the consulta detail page.

3. `app/api/consultas/[id]/send-client/route.ts` — grep shows it NEVER inserts into `ams_emails`. It only forwards to the n8n webhook (`DOA_SEND_CLIENT_WEBHOOK_URL`) and updates `reply_body`/`reply_sent_at` on the consulta row.

4. `01. Soporte_App/n8n-workflows/DOA - Enviar Correo al Cliente.json` — the n8n workflow ONLY updates `estado` on `doa_consultas_entrantes` and calls Outlook `Send Email`. It does NOT insert into `doa_emails` / `ams_emails` either.

Grep confirms there is no INSERT into `ams_emails` anywhere in the app (`app/`, `lib/`) or in any n8n workflow JSON.

Result: outgoing emails exist only as payload-in-transit and a `reply_body` blob on the consulta row; they never become rows in `ams_emails`, so `syncConsultaEmails` never has anything "saliente" to write. Incoming emails work (presumably because n8n inserts them — see Bug 3), so `.eml` files for inbound exist, but for outbound never.

Secondary concern: even if the row existed, `syncConsultaEmails` only runs on page-open of the detail page, so the archive lags until someone visits the page. That's a design choice, not a bug — just worth noting.

### Proposed fix
Two-part fix in `app/api/consultas/[id]/send-client/route.ts`, after the webhook call succeeds (after line 212, alongside the existing `reply_body` update):

```ts
// After webhookResponse.ok check, before logServerEvent success branch
await supabase.from('ams_emails').insert({
  consulta_id: id,
  direccion: 'saliente',
  de: process.env.DOA_SENDER_EMAIL ?? null, // or pull from user/settings
  para: to,
  asunto: subject,
  cuerpo: finalMessage,      // the HTML that was actually sent
  fecha: now,
  mensaje_id: null,          // n8n doesn't return one today; optional
  en_respuesta_a: null,      // optional: lookup the most recent ams_emails row for this consulta with direccion='entrante'
})
```

Schema sanity-check (`supabase/migrations/20260418000000_ams_bootstrap.sql:307-321`): `ams_emails` has `direccion` constrained to `'entrante' | 'saliente'` (line 319). `consulta_id` is a FK to `ams_consultas_entrantes` with ON DELETE CASCADE (line 779). All the columns used above are nullable except `direccion`.

After the INSERT, call the existing syncer so the file lands immediately rather than on next page view:

```ts
// Still inside send-client POST, after the ams_emails insert:
const { data: consultaRow } = await supabase
  .from('ams_consultas_entrantes')
  .select('numero_entrada')
  .eq('id', id)
  .maybeSingle()
if (consultaRow?.numero_entrada) {
  // Import at top: import { syncConsultaEmails } from '@/lib/quotations/sync-consulta-emails'
  syncConsultaEmails(consultaRow.numero_entrada, id).catch((err) =>
    console.error('send-client: syncConsultaEmails failed:', err),
  )
}
```

### Risk
**Medium.** One new INSERT into a table that's already wired for incoming emails; the `direccion='saliente'` branch is untested end-to-end today. The Realtime subscription in `CenterColumnCollapsible.tsx:353-371` already watches `ams_emails` INSERT events and will light up the new outbound row in the UI immediately — that is likely desired, but verify the UI renders outbound rows correctly (it treats `direccion='saliente'` consistently per `CenterColumnCollapsible.tsx:411-417`).

### Regression risk
- **Low-Med.** The email thread UI already supports both directions — no new branch needed. If the UI somewhere only filters for `direccion='entrante'`, you'll see doubled rows (legacy `reply_body` view + new `ams_emails` row for the same content). Recommend removing the legacy "last reply" rendering in a follow-up once `ams_emails` coverage is verified.
- The folder-write depends on `DOA_SIMULATION_BASE_PATH` being set to a writable path on whatever host runs Next.js. That's currently a dev-machine path hardcoded as a fallback in `lib/quotations/sync-consulta-emails.ts:10-12` and `lib/quotations/ensure-consulta-folder.ts:7-9`. On the VPS, either `DOA_SIMULATION_BASE_PATH` must be defined or the syncer will silently write outside expected locations. Verify env before shipping.

---

## Bug 3: `consulta_id` mismatch in `ams_emails`

### Symptom
New incoming emails are sometimes linked to the wrong consulta (`consulta_id` points to a stale or different consulta).

### Root cause (n8n-side — blocker)
The app does not insert into `ams_emails`. Incoming emails must be inserted by the n8n workflow `DOA - 0 - Outlook a App _Correos Entrantes_`. However, reading that workflow's JSON (`01. Soporte_App/n8n-workflows/DOA - 0 - Outlook a App _Correos Entrantes_.json`) reveals:

- The workflow creates a NEW row in `doa_consultas_entrantes` for each Outlook message (node `Crear fila en entrantes`, line 549).
- The node `Filtro Correo entrante` (line 362-379) assigns `id.supabase.doa.consultas.entrantes = $json.id` — the UUID that Supabase returned from that INSERT.
- Every subsequent UPDATE / URL generation uses that same UUID (lines 635, 686, 711).
- There is NO branch that looks up an existing consulta by thread-id, `In-Reply-To`, `Message-ID`, or a fuzzy match on `remitente + asunto`. Grep for `mensaje_id|in_reply_to|in-reply-to|thread` in the workflow returns zero hits.
- There is NO INSERT into `doa_emails` / `ams_emails` anywhere in the n8n workflow files on disk.

Given these two facts together, one of two things is happening in production:

**Hypothesis A (most likely):** A separate, in-production-only n8n workflow (not in this repo) is responsible for inserting into `ams_emails`, and that workflow does its own thread-matching. Its matching heuristic is failing — e.g., matching on `asunto` alone (which collides across "Re:" reply chains), or matching on `remitente` alone (which collides when the same client has multiple open consultas).

**Hypothesis B:** The workflow in this repo was updated to insert into `ams_emails` but with a stale payload — e.g., using `$('Filtro Correo entrante').item.json.id.supabase.doa.consultas.entrantes` (which always points to the most recently CREATED consulta, not the one the email thread belongs to). In that scenario, any reply email would be attached to whichever consulta was last created in the same batch run, causing visible mismatches.

Either way, the fix cannot be derived from the app code. The `ams_emails` schema has the right tools: `mensaje_id` (unique, `supabase/migrations/20260418000000_ams_bootstrap.sql:709`) and `en_respuesta_a` (self-FK, line 780) — those exist precisely for thread threading, and they're not being populated by any code path we can see.

### Proposed fix (app side — what we CAN do)
None direct; the mismatch occurs before the row reaches the app. However, the app CAN help:

1. Implement Bug 2's fix correctly: when the app inserts an outgoing email, populate `mensaje_id` and `en_respuesta_a` so outbound rows give n8n a correct anchor for the next inbound reply. To populate `en_respuesta_a`, SELECT the most recent `ams_emails` row with `direccion='entrante'` for this consulta and use its `id`.

2. Add a defensive check in `app/(dashboard)/quotations/incoming/[id]/page.tsx` or `CenterColumnCollapsible.tsx` that logs mismatches it detects — e.g., a `ams_emails` row whose `de` (sender address) doesn't match the consulta's `remitente`. That gives you audit data.

3. Long-term: add a backend route `POST /api/webhooks/email-inbound` that n8n calls with the raw Outlook payload, and do the thread-matching in application code (where you can unit-test and reuse the same logic that `send-client` uses). This removes the matching logic from n8n entirely.

### Root cause (proper fix — n8n)
**Needs n8n workflow inspection.** Specifically:
- Locate the production workflow that inserts into `ams_emails` (it is not in this repo's `01. Soporte_App/n8n-workflows/*.json`).
- Audit its matching strategy (Supabase `Get` or `Select` by `mensaje_id` / `en_respuesta_a` first, falling back to `remitente + asunto`, last resort create new consulta).
- Verify the node is using `$('Outlook Trigger').item.json.internetMessageHeaders` or equivalent to extract `In-Reply-To` / `References` headers. The Outlook node DOES expose `conversationId` and `internetMessageHeaders`.

Deferring to the parallel agent who is doing n8n MCP inspection.

### Risk
**High** if attempted blindly. The matching logic is load-bearing for data integrity of the inbox.

### Regression risk
- Any change to how n8n matches inbound emails can silently re-link historical rows if care isn't taken. A migration-style "rebind" should only be run on specific offending rows, never globally.

---

## Bug 4: Classification overwrite to 'Clasificacion pendiente'

### Symptom
A user sets the consulta's classification (e.g. to 'Modificación tipo I' — or per the app's canonical strings, `Cliente solicita modificacion a proyecto existente`). Some later automated process resets it to `Clasificacion pendiente`.

### Root cause (n8n-side — blocker)
There is no code in the app that writes `clasificacion` back to `'Clasificacion pendiente'`. Grep coverage:

- The app `app/api/consultas/[id]/change-classification/route.ts` writes to `change_classification` (jsonb), NOT to the scalar `clasificacion` column. So human classification via the UI goes to `change_classification`.
- The app never writes `'Clasificacion pendiente'` anywhere. The string only appears in:
  - `app/(dashboard)/quotations/incoming/[id]/ClientReplyComposer.tsx:86` — READ only, a UI branch to decide whether to show a default template.
  - `01. Soporte_App/n8n-workflows/DOA - 0 - Outlook a App _Correos Entrantes_.json` and `01. Soporte_App/n8n-workflows/ARQUITECTURA_N8N.md` — n8n WRITES it.

Per `ARQUITECTURA_N8N.md:102-108`, the AI classifier ("Preparar Ruta" / "Clasificar Correo IA") normalizes to exactly three values, one of which is `Clasificacion pendiente`.

Then in `DOA - 0 - Outlook a App _Correos Entrantes_.json:626-678`, the `Actualizar Fila entrantes` node runs:

```json
{
  "operation": "update",
  "tableId": "doa_consultas_entrantes",
  "filters": {
    "conditions": [{
      "keyName": "id",
      "condition": "eq",
      "keyValue": "={{ $('Filtro Correo entrante').item.json.id.supabase.doa.consultas.entrantes }}"
    }]
  },
  "fieldsUi": {
    "fieldValues": [
      { "fieldId": "remitente", ... },
      { "fieldId": "asunto", ... },
      { "fieldId": "cuerpo_original", ... },
      { "fieldId": "clasificacion",
        "fieldValue": "={{ $('Filtro Correo entrante').item.json.clasificacion.email }}" },
      { "fieldId": "estado", "fieldValue": "nuevo" }
    ]
  }
}
```

This UPDATE blindly overwrites `clasificacion` (and `estado`) with whatever the AI produced for the **latest incoming email** on that consulta. If the AI can't confidently classify the reply (very common for short "thanks" / "please see attached" replies from clients), it emits `Clasificacion pendiente` — and the app wipes the user's earlier classification on that consulta.

This is the same root problem that drives Bug 3 — the workflow appears to be running per-email and targeting an existing consulta row, but without the guardrail "do not regress `clasificacion` or `estado` if they're already set beyond `nuevo`."

Secondary issue: the node also forces `estado = 'nuevo'`, which would also clobber any workflow-state progress (`formulario_enviado`, `alcance_definido`, `oferta_enviada`, etc., per the CHECK constraint at `supabase/migrations/20260418000000_ams_bootstrap.sql:252`). Worth investigating alongside this bug.

### Proposed fix
**The fix belongs in the n8n workflow, not the app.** The correct pattern:

1. Before the `Actualizar Fila entrantes` node, add a Supabase `Get a row` on `ams_consultas_entrantes` by `id` to fetch the CURRENT `clasificacion` and `estado`.
2. In the UPDATE node's `fieldValues`, gate both fields conditionally:

   ```
   clasificacion:
     ={{ $('Get current row').item.json.clasificacion
         && $('Get current row').item.json.clasificacion !== 'Clasificacion pendiente'
         ? $('Get current row').item.json.clasificacion
         : $('Filtro Correo entrante').item.json.clasificacion.email }}

   estado:
     ={{ $('Get current row').item.json.estado
         && $('Get current row').item.json.estado !== 'nuevo'
         ? $('Get current row').item.json.estado
         : 'nuevo' }}
   ```

   In other words: write the AI's classification ONLY if there is no human-set classification yet.

3. Better yet, split the UPDATE into two nodes: one that updates only fields safe to overwrite on every reply (`cuerpo_original`, maybe not even that — these are historical), and one that only runs when the row is still in its initial state.

4. Simplest alternative if the AI classification is desired as a fallback: introduce a `clasificacion_ia` column separate from `clasificacion`. The app shows `clasificacion || clasificacion_ia` to the user. Human-set values never get wiped.

**App-side defensive measure (optional):** if it's acceptable to deprecate the scalar `clasificacion` column, migrate the human classification to `change_classification` (jsonb) exclusively — that column already exists and is untouched by n8n. The `clasificacion` column then becomes an advisory AI hint only.

### Risk
**High** (in n8n). Changing the overwrite behavior touches the core intake pipeline; a mistake will either stop classifying anything (AI output silently discarded) or keep overwriting (bug persists).

### Regression risk
- Fields downstream of `clasificacion` include the card channel label in `quotation-board-data.ts:186` (`query.clasificacion ?? 'Email'`) and template selection in `ClientReplyComposer.tsx:86`. Neither breaks if `clasificacion` is preserved — they break when it flips unexpectedly, which is today's bug. So preserving is the safe direction.
- Forcing `estado = 'nuevo'` on every reply is a parallel bug likely hiding behind Bug 4; fixing both together is recommended.

### Needs n8n workflow inspection
Yes. The offending node lives in workflow ID `pEFW1V46yyLR58c8` (`DOA - 0 - Outlook a App _Correos Entrantes_`), node name `Actualizar Fila entrantes`. There is a second, almost-identical node in the "Versión Draft" copy in the same JSON (lines 1625-1660) — whichever is live in production needs the same fix. Defer to the n8n-MCP agent.

---

## Priority order

Recommended fix order (data integrity → feature completeness → UX):

1. **Bug 4 (classification overwrite) — FIX FIRST.**
   - Highest data-integrity impact: human decisions are being silently wiped. Every day this stays broken, users lose trust that their classification sticks and stop using the feature.
   - Lives entirely in n8n, so fixing it does not require an app deploy. Can happen independently and quickly once the n8n-MCP agent locates the node.
   - Side benefit: the same fix pattern (gate `estado`) likely prevents state-machine regressions too.

2. **Bug 3 (consulta_id mismatch) — FIX SECOND.**
   - Same class of problem as Bug 4, same owner (n8n). While the n8n-MCP agent is already in WF1, this is the natural follow-on work. However it requires actually finding the n8n workflow that does the `ams_emails` INSERT, which appears to live outside this repo.
   - Data integrity impact is higher than the UX bugs (1, 2) because mismatched emails cause the UI to show wrong threads, which cascades into wrong replies.

3. **Bug 1 (correo_cliente_enviado_* NULL) — FIX THIRD.**
   - Pure additive app-side fix, ~2 lines of code, zero risk. Do it in the same PR as Bug 2.
   - UX impact (user can't see "sent at / sent by" in the detail page) but no data loss.

4. **Bug 2 (.eml files not saved) — FIX FOURTH, bundled with Bug 1.**
   - Requires a new INSERT into `ams_emails` plus eager call of the syncer. Medium risk because it introduces the first outbound `ams_emails` row the system has ever seen.
   - Recommend doing in the same PR as Bug 1, both in `send-client/route.ts` — one commit, one review, one deploy.
   - Feature completeness: audit/archive requirement; lower urgency than data integrity but still important for compliance.

### Blocker summary

| Bug | Blocker                                         |
| --- | ----------------------------------------------- |
| 1   | None. Ready to fix in `send-client/route.ts`.   |
| 2   | Needs env `DOA_SIMULATION_BASE_PATH` verified on VPS. Otherwise ready. |
| 3   | **Needs n8n workflow inspection.** Workflow that inserts into `ams_emails` is not in the repo. |
| 4   | **Needs n8n workflow inspection.** Node `Actualizar Fila entrantes` in workflow `pEFW1V46yyLR58c8`. |

---

## Appendix — files cited

- `app/api/consultas/[id]/send-client/route.ts` — the send proxy (writes `reply_body`/`reply_sent_at`, calls n8n webhook)
- `app/api/consultas/[id]/change-classification/route.ts` — user classification via UI (writes `change_classification` jsonb)
- `app/(dashboard)/quotations/incoming/[id]/page.tsx` — detail page (renders `correo_cliente_enviado_at`, fires `ensureConsultaFolder` + `syncConsultaEmails`)
- `app/(dashboard)/quotations/incoming/[id]/ClientReplyComposer.tsx` — composer UI that posts to `send-client`
- `app/(dashboard)/quotations/incoming/[id]/CenterColumnCollapsible.tsx` — email thread UI with Realtime subscription on `ams_emails`
- `lib/quotations/sync-consulta-emails.ts` — writes `.eml` files from `ams_emails` rows
- `lib/quotations/ensure-consulta-folder.ts` — creates `{numeroEntrada}/1. Email/` + `2. Adjuntos/`
- `supabase/migrations/20260418000000_ams_bootstrap.sql` — schema (relevant lines: 152-255 consulta, 307-321 emails, 961-972 triggers)
- `01. Soporte_App/n8n-workflows/DOA - 0 - Outlook a App _Correos Entrantes_.json` — WF1 intake (contains the offending `Actualizar Fila entrantes` node)
- `01. Soporte_App/n8n-workflows/DOA - Enviar Correo al Cliente.json` — WF3 send (only updates `estado`, does NOT insert into `ams_emails`)
- `01. Soporte_App/n8n-workflows/ARQUITECTURA_N8N.md` — workflow architecture reference
