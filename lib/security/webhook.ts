/**
 * ============================================================================
 * Inbound webhook HMAC verification (Block 5 / Item B)
 * ============================================================================
 *
 * Helper for API routes that RECEIVE webhooks from n8n (or any trusted
 * external caller). Verifies the `x-doa-signature` header against
 * HMAC-SHA256(raw_body, DOA_N8N_INBOUND_SECRET).
 *
 * Usage in a route:
 *
 *   import { requireWebhookSignature } from '@/lib/security/webhook'
 *
 *   export async function POST(request: Request) {
 *     const raw = await request.text()
 *     const check = await requireWebhookSignature(raw, request.headers)
 *     if (!check.ok) {
 *       return Response.json({ error: check.reason }, { status: 401 })
 *     }
 *     const body = JSON.parse(raw)
 *     // ... handle webhook ...
 *   }
 *
 * Design decisions:
 * - The helper operates on the RAW string body (not parsed JSON) so that the
 *   HMAC computed by the sender matches byte-for-byte.
 * - If `DOA_N8N_INBOUND_SECRET` is not set:
 *     - In production (`NODE_ENV === 'production'`) the helper FAILS CLOSED.
 *       It logs `webhook.auth.unconfigured` with severity=error and returns
 *       `{ ok: false, reason: 'secret_not_configured' }`. Callers MUST return
 *       500 (not 401), since this is a server misconfiguration, not a client
 *       failure. Fixed as S1 in the 2026-04-23 security audit.
 *     - In non-production the helper logs a one-shot warn event and allows
 *       the request through to keep dev envs unblocked.
 * - Failure paths log `webhook.auth.rejected` (severity=warn) with enough
 *   context to triage without leaking the signature.
 *
 * Env vars:
 *   DOA_N8N_INBOUND_SECRET  — shared secret. REQUIRED in production; the
 *                             helper refuses every request otherwise.
 *
 * Consumers (current):
 *   (none — there are no inbound webhooks yet; this helper exists so the first
 *   one added has a drop-in primitive.)
 */

import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

import { logServerEvent } from '@/lib/observability/server'

const SIGNATURE_HEADER = 'x-doa-signature'

// Module-level flag so we log the "unconfigured" warning only once per process.
let unconfiguredLogged = false

export type WebhookCheck =
  | { ok: true; reason?: undefined }
  | { ok: false; reason: string }

/**
 * Compare the provided hex signature against
 * HMAC-SHA256(body, DOA_N8N_INBOUND_SECRET) using timing-safe equality.
 * Exposed so tests / alternative call sites can reuse the bare primitive.
 */
export function verifyHmacRaw(body: string, providedSig: string): boolean {
  const secret = process.env.DOA_N8N_INBOUND_SECRET
  if (!secret || secret.trim().length === 0) return false

  const expected = createHmac('sha256', secret).update(body).digest('hex')
  if (expected.length !== providedSig.length) return false

  try {
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(providedSig, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Verify inbound webhook signature.
 *
 * @param rawBody  The raw string body of the request (read via `request.text()`).
 *                 Must NOT be the JSON-parsed object — HMAC is computed over
 *                 the exact bytes.
 * @param headers  The request headers (`request.headers`).
 * @returns        `{ ok: true }` if verification passed OR the inbound secret
 *                 is not configured (dev fallback). `{ ok: false, reason }`
 *                 otherwise.
 */
export async function requireWebhookSignature(
  rawBody: string,
  headers: Headers,
): Promise<WebhookCheck> {
  const secret = process.env.DOA_N8N_INBOUND_SECRET

  if (!secret || secret.trim().length === 0) {
    // Fail-closed in production (S1 in 2026-04-23 security audit). We refuse
    // every request when the secret is missing so that a misconfigured deploy
    // cannot silently accept unauthenticated webhooks.
    if (process.env.NODE_ENV === 'production') {
      if (!unconfiguredLogged) {
        unconfiguredLogged = true
        await logServerEvent({
          eventName: 'webhook.auth.unconfigured',
          eventCategory: 'security',
          outcome: 'failure',
          severity: 'error',
          metadata: {
            note: 'DOA_N8N_INBOUND_SECRET is not configured; refusing unauthenticated webhook',
          },
        })
      }
      console.error(
        '[webhook.auth] DOA_N8N_INBOUND_SECRET is not configured; refusing unauthenticated webhook',
      )
      return { ok: false, reason: 'secret_not_configured' }
    }

    // Non-production fallback: keep dev unblocked but log loudly.
    if (!unconfiguredLogged) {
      unconfiguredLogged = true
      await logServerEvent({
        eventName: 'webhook.auth.unconfigured',
        eventCategory: 'security',
        outcome: 'info',
        severity: 'warn',
        metadata: {
          note: 'DOA_N8N_INBOUND_SECRET is not set. Inbound webhooks are accepted without signature verification (dev only).',
        },
      })
    }
    return { ok: true }
  }

  const providedSig = headers.get(SIGNATURE_HEADER)?.trim() ?? ''
  if (!providedSig) {
    await logServerEvent({
      eventName: 'webhook.auth.rejected',
      eventCategory: 'security',
      outcome: 'failure',
      severity: 'warn',
      metadata: { reason: 'missing_signature_header' },
    })
    return { ok: false, reason: 'missing_signature_header' }
  }

  const ok = verifyHmacRaw(rawBody, providedSig)
  if (!ok) {
    await logServerEvent({
      eventName: 'webhook.auth.rejected',
      eventCategory: 'security',
      outcome: 'failure',
      severity: 'warn',
      metadata: { reason: 'invalid_signature' },
    })
    return { ok: false, reason: 'invalid_signature' }
  }

  return { ok: true }
}
