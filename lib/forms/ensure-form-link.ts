/**
 * ============================================================================
 * ensureFormLink — server-side helper
 * ============================================================================
 *
 * Returns the public form URL for an incoming request. If no active token
 * exists yet (real requests that never went through the n8n forms/issue-link
 * webhook, or where the column `form_url` was left empty), this helper mints
 * a new one using the service-role client and the same logic as
 * `POST /api/forms/issue-link`.
 *
 * Use this from authenticated routes (session-guarded) like:
 *   - `POST /api/incoming-requests/[id]/form-link` (the "Check form" button)
 *   - `POST /api/incoming-requests/[id]/send-client` (fallback when the
 *     composer forgot to persist the URL or when the real intake path never
 *     emitted a token).
 *
 * Do NOT call this from public / untrusted handlers — authentication must
 * happen in the caller.
 */

import 'server-only'

import { randomBytes } from 'node:crypto'

import { createAdminClient } from '@/lib/supabase/admin'

const DEFAULT_TTL_DAYS = 14

type TokenSlug = 'cliente_conocido' | 'cliente_desconocido'

export type EnsureFormLinkResult = {
  url: string
  token: string
  /** 'existing' if a valid token was reused, 'created' if a new one was minted. */
  source: 'existing' | 'created'
  expires_at: string | null
}

export type EnsureFormLinkError =
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'app_url_missing' }
  | { ok: false; error: 'internal'; details?: unknown }

export type EnsureFormLinkOk = { ok: true } & EnsureFormLinkResult

/**
 * Looks up the most recent active (unused, unexpired) token for the given
 * incoming request. If none exists, mints a new one.
 *
 * The slug defaults to `cliente_conocido` when the request already has an
 * associated client_id, otherwise `cliente_desconocido`. Callers can override
 * via the options object.
 */
export async function ensureFormLink(options: {
  incomingRequestId: string
  ttlDays?: number
  slugOverride?: TokenSlug
}): Promise<EnsureFormLinkOk | EnsureFormLinkError> {
  const { incomingRequestId } = options
  const ttlDays = options.ttlDays ?? DEFAULT_TTL_DAYS

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!appUrl) {
    console.error(
      '[ensureFormLink] NEXT_PUBLIC_APP_URL is not configured — cannot build public form URL',
    )
    return { ok: false, error: 'app_url_missing' }
  }
  const baseUrl = appUrl.replace(/\/$/, '')

  const supabase = createAdminClient()

  // 1) Verify the incoming request exists and fetch its client_id to pick slug.
  const requestResult = await supabase
    .from('doa_incoming_requests' as never)
    .select('id, client_id')
    .eq('id', incomingRequestId)
    .maybeSingle()

  if (requestResult.error) {
    console.error('[ensureFormLink] error loading incoming request:', requestResult.error)
    return { ok: false, error: 'internal', details: requestResult.error }
  }
  if (!requestResult.data) {
    return { ok: false, error: 'not_found' }
  }
  const row = requestResult.data as unknown as { client_id: string | null }

  const slug: TokenSlug =
    options.slugOverride ??
    (row.client_id ? 'cliente_conocido' : 'cliente_desconocido')

  // 2) Reuse the most recent valid token (not used, not expired).
  const nowIso = new Date().toISOString()
  const existingResult = await supabase
    .from('doa_form_tokens' as never)
    .select('token, expires_at')
    .eq('incoming_request_id', incomingRequestId)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingResult.error) {
    console.error('[ensureFormLink] error loading existing token:', existingResult.error)
    return { ok: false, error: 'internal', details: existingResult.error }
  }

  if (existingResult.data) {
    const existing = existingResult.data as unknown as {
      token: string
      expires_at: string | null
    }
    return {
      ok: true,
      url: `${baseUrl}/f/${existing.token}`,
      token: existing.token,
      source: 'existing',
      expires_at: existing.expires_at,
    }
  }

  // 3) No valid token — mint a new one.
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)

  const insertResult = await supabase
    .from('doa_form_tokens' as never)
    .insert({
      token,
      slug,
      incoming_request_id: incomingRequestId,
      expires_at: expiresAt.toISOString(),
    } as never)

  if (insertResult.error) {
    console.error('[ensureFormLink] insert failed:', insertResult.error)
    return { ok: false, error: 'internal', details: insertResult.error }
  }

  return {
    ok: true,
    url: `${baseUrl}/f/${token}`,
    token,
    source: 'created',
    expires_at: expiresAt.toISOString(),
  }
}
