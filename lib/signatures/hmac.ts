/**
 * ============================================================================
 * HMAC signatures for Part 21J non-repudiation (Sprint 2)
 * ============================================================================
 *
 * Server-side helpers to sign arbitrary payloads with HMAC-SHA256 and later
 * verify them. The current rotation key id is 'v1'. To rotate, introduce
 * 'v2' and extend `getSecretForKeyId` with the mapping.
 *
 * Canonicalization rule (MUST stay stable across versions):
 *   - Primitives (string, number, boolean, null) serialize as standard JSON.
 *   - Arrays serialize in order, with each element canonicalized recursively.
 *   - Objects serialize with keys sorted lexicographically at every level.
 *   - `undefined` values are dropped (same as JSON.stringify).
 *
 * Consumers:
 *   - lib/signatures/hmac.ts          (this file)
 *   - app/api/proyectos/[id]/validar/route.ts
 *   - supabase/migrations/202604170010_project_signatures.sql
 *
 * Env var: DOA_SIGNATURE_HMAC_SECRET (REQUIRED in all envs that sign).
 */

import 'server-only'

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const CURRENT_HMAC_KEY_ID = 'v1'

type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | CanonicalValue[]
  | { [key: string]: CanonicalValue }

/**
 * Recursively sort object keys and JSON-serialize `input` into a stable string.
 * See module-level comment for the exact rule.
 */
export function canonicalJSON(input: unknown): string {
  return JSON.stringify(toCanonical(input))
}

function toCanonical(value: unknown): CanonicalValue {
  if (value === null) return null
  if (value === undefined) return null // dropped at parent level; safeguard here

  if (Array.isArray(value)) {
    return value.map((item) => toCanonical(item))
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

    const out: Record<string, CanonicalValue> = {}
    for (const [k, v] of entries) {
      out[k] = toCanonical(v)
    }
    return out
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  // bigint, symbol, function, etc. — coerce to string to avoid throwing.
  return String(value)
}

function getSecretForKeyId(keyId: string): string {
  if (keyId !== CURRENT_HMAC_KEY_ID) {
    throw new Error(
      `HMAC key id "${keyId}" not recognized. Current key id: "${CURRENT_HMAC_KEY_ID}".`,
    )
  }
  const secret = process.env.DOA_SIGNATURE_HMAC_SECRET
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      'Signature secret not configured. Set DOA_SIGNATURE_HMAC_SECRET in environment.',
    )
  }
  return secret
}

export type ComputedSignature = {
  payloadHash: string
  hmacSignature: string
  hmacKeyId: string
}

/**
 * Compute the SHA-256 hash of the canonical JSON and its HMAC-SHA256 using
 * the current secret. Throws if `DOA_SIGNATURE_HMAC_SECRET` is missing.
 */
export function computeSignature(payload: unknown): ComputedSignature {
  const secret = getSecretForKeyId(CURRENT_HMAC_KEY_ID)
  const canonical = canonicalJSON(payload)

  const payloadHash = createHash('sha256').update(canonical).digest('hex')
  const hmacSignature = createHmac('sha256', secret)
    .update(canonical)
    .digest('hex')

  return {
    payloadHash,
    hmacSignature,
    hmacKeyId: CURRENT_HMAC_KEY_ID,
  }
}

/**
 * Recompute the hash + HMAC for `payload` and compare them to the provided
 * values using timing-safe equality. Returns true iff both match.
 */
export function verifySignature(
  payload: unknown,
  providedHash: string,
  providedSignature: string,
  keyId: string = CURRENT_HMAC_KEY_ID,
): boolean {
  try {
    const secret = getSecretForKeyId(keyId)
    const canonical = canonicalJSON(payload)

    const expectedHash = createHash('sha256').update(canonical).digest('hex')
    const expectedSig = createHmac('sha256', secret)
      .update(canonical)
      .digest('hex')

    return (
      safeEqualHex(expectedHash, providedHash) &&
      safeEqualHex(expectedSig, providedSignature)
    )
  } catch {
    return false
  }
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    const ab = Buffer.from(a, 'hex')
    const bb = Buffer.from(b, 'hex')
    if (ab.length !== bb.length) return false
    return timingSafeEqual(ab, bb)
  } catch {
    return false
  }
}
