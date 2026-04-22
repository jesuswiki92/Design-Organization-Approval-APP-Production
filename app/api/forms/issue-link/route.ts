/**
 * ============================================================================
 * POST /api/forms/issue-link  (Forms v2)
 * ============================================================================
 *
 * Called by n8n (HMAC-signed) to mint a single-use capability token for a
 * public intake form. Inserts a row into `doa_form_tokens` and returns the
 * public URL the n8n workflow will email to the client.
 *
 * Request body  (HMAC-signed, see `lib/security/webhook.ts`):
 *   {
 *     incoming_request_id: string (uuid),
 *     slug: 'cliente_conocido' | 'cliente_desconocido',
 *     ttl_days?: number  // default 14, max 60
 *   }
 *
 * Response 200:
 *   {
 *     url: string,         // absolute https URL of the form
 *     token: string,
 *     expires_at: string   // ISO timestamp
 *   }
 *
 * Error shapes (JSON):
 *   401  { error: 'unauthorized', reason }
 *   400  { error: 'invalid_payload', details }
 *   500  { error: 'internal' }
 */

import 'server-only'

import { randomBytes, timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { issueLinkSchema } from '@/lib/forms/schemas'
import { requireWebhookSignature } from '@/lib/security/webhook'
import type { IssueLinkResponse } from '@/types/database'

export const runtime = 'nodejs'

const DEFAULT_TTL_DAYS = 14

function verifyBearer(authHeader: string | null): boolean {
  const secret = process.env.DOA_N8N_INBOUND_SECRET
  if (!secret || secret.trim().length === 0) return false
  if (!authHeader) return false
  const prefix = 'Bearer '
  if (!authHeader.startsWith(prefix)) return false
  const provided = authHeader.slice(prefix.length).trim()
  if (provided.length === 0) return false

  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(secret, 'utf8')
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  // 1) Auth: Bearer token (preferred) OR HMAC signature (legacy)
  const raw = await request.text()
  const authHeader = request.headers.get('authorization')
  const hasBearer = authHeader?.toLowerCase().startsWith('bearer ') ?? false

  if (hasBearer) {
    if (!verifyBearer(authHeader)) {
      return NextResponse.json(
        { error: 'unauthorized', reason: 'invalid_bearer' },
        { status: 401 },
      )
    }
  } else {
    const sigCheck = await requireWebhookSignature(raw, request.headers)
    if (!sigCheck.ok) {
      return NextResponse.json(
        { error: 'unauthorized', reason: sigCheck.reason },
        { status: 401 },
      )
    }
  }

  // 2) Parse + validate body
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json(
      { error: 'invalid_payload', details: 'body must be JSON' },
      { status: 400 },
    )
  }

  const validation = issueLinkSchema.safeParse(parsed)
  if (!validation.success) {
    return NextResponse.json(
      { error: 'invalid_payload', details: validation.error.issues },
      { status: 400 },
    )
  }
  const { incoming_request_id, slug, ttl_days } = validation.data

  // 3) Generate a 256-bit token (base64url-safe, 43 chars)
  const token = randomBytes(32).toString('base64url')
  const effectiveTtl = ttl_days ?? DEFAULT_TTL_DAYS
  const expiresAt = new Date(Date.now() + effectiveTtl * 24 * 60 * 60 * 1000)

  // 4) Insert via service role (bypasses RLS)
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('doa_form_tokens' as never)
    .insert({
      token,
      slug,
      incoming_request_id,
      expires_at: expiresAt.toISOString(),
    } as never)

  if (error) {
    console.error('[forms/issue-link] insert failed:', error)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  // 5) Build absolute URL from NEXT_PUBLIC_APP_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error(
      '[forms/issue-link] NEXT_PUBLIC_APP_URL is not configured — cannot build public form URL',
    )
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  const payload: IssueLinkResponse = {
    url: `${appUrl.replace(/\/$/, '')}/f/${token}`,
    token,
    expires_at: expiresAt.toISOString(),
  }

  return NextResponse.json(payload, { status: 200 })
}
