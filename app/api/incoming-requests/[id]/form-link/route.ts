/**
 * ============================================================================
 * POST /api/incoming-requests/[id]/form-link
 * ============================================================================
 *
 * Session-authenticated endpoint that returns the public form URL for an
 * incoming request. Reuses the most recent active token or mints a new one
 * via `ensureFormLink` (service-role insert).
 *
 * Used by the "Check form before sending" button on the client composer so
 * the reviewer can preview the form the client will receive — without having
 * to trigger the n8n `forms/issue-link` webhook.
 *
 * Response 200:
 *   { url, token, source: 'existing' | 'created', expires_at }
 * Errors:
 *   401 unauthorized (session)
 *   404 not_found    (incoming request id does not exist)
 *   500 internal     (server misconfiguration or DB error)
 */

import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'
import { ensureFormLink } from '@/lib/forms/ensure-form-link'

export const runtime = 'nodejs'

function jsonError(status: number, error: string, details?: unknown) {
  return Response.json({ error, ...(details ? { details } : {}) }, { status })
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth

  const { id } = await context.params
  if (!id) {
    return jsonError(400, 'invalid_request')
  }

  const result = await ensureFormLink({ incomingRequestId: id })

  if (!result.ok) {
    if (result.error === 'not_found') {
      return jsonError(404, 'not_found')
    }
    if (result.error === 'app_url_missing') {
      return jsonError(
        500,
        'app_url_missing',
        'NEXT_PUBLIC_APP_URL is not configured on the server.',
      )
    }
    return jsonError(500, 'internal')
  }

  return Response.json({
    url: result.url,
    token: result.token,
    source: result.source,
    expires_at: result.expires_at,
  })
}
