/**
 * ============================================================================
 * Outbound n8n HMAC secret resolution (hardening round 2026-04-22).
 * ============================================================================
 *
 * Canonicalises how the app picks up the shared secret used to sign
 * outbound calls to n8n workflows (`x-doa-signature` header).
 *
 * History:
 *   - Early code paths (transition, send-delivery, call-n8n-folder) read
 *     `DOA_N8N_WEBHOOK_SECRET`.
 *   - The inbound side (`lib/security/webhook.ts`, `/api/forms/issue-link`)
 *     reads `DOA_N8N_INBOUND_SECRET`.
 *   - In practice the value is THE SAME on both sides — the split name
 *     was accidental drift. We now treat `DOA_N8N_INBOUND_SECRET` as the
 *     canonical name and keep `DOA_N8N_WEBHOOK_SECRET` as a deprecated
 *     fallback so old deployments keep working until the variable is
 *     renamed in each environment.
 *
 * Behaviour:
 *   - Returns the first non-empty trimmed value, preferring canonical.
 *   - If both are set to DIFFERENT non-empty values, logs a one-shot
 *     warning (per process) so operators notice the drift.
 *   - Returns `undefined` only when neither is set. Callers decide what
 *     to do (throw in prod, warn in dev).
 * ============================================================================
 */

import 'server-only'

let warnedSecretDrift = false

export function resolveN8nSharedSecret(): string | undefined {
  const canonical = process.env.DOA_N8N_INBOUND_SECRET?.trim()
  const legacy = process.env.DOA_N8N_WEBHOOK_SECRET?.trim()

  if (canonical && legacy && canonical !== legacy && !warnedSecretDrift) {
    warnedSecretDrift = true
    console.warn(
      '[n8n-outbound] DOA_N8N_INBOUND_SECRET and DOA_N8N_WEBHOOK_SECRET are both set to DIFFERENT values. ' +
        'Using DOA_N8N_INBOUND_SECRET (canonical). Unify or remove the legacy var to silence this warning.',
    )
  }

  return canonical || legacy || undefined
}
