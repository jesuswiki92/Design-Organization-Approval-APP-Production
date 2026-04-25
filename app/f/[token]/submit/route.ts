/**
 * ============================================================================
 * POST /f/[token]/submit  (Forms v2 — public form submission)
 * ============================================================================
 *
 * Called by the browser (same-origin) when the user submits the public intake
 * form rendered at `GET /f/[token]`. No auth session — we rely on the token
 * in the URL. Atomicity (validate → insert client → update incoming_request →
 * consume token) lives inside the Postgres function `fn_submit_form_intake`.
 *
 * Contract is defined in `lib/forms/schemas.ts`.
 *
 * Status mapping from the RPC JSON result:
 *   { status: 'ok', client_id?, contact_id? }   → 200 { status: 'ok' }
 *   { error: 'token_not_found' }                → 404
 *   { error: 'token_expired' }                  → 410
 *   { error: 'token_used' }                     → 410
 *   { error: 'internal', message }              → 500 (message server-only)
 *   zod validation failure                      → 400 { error, details }
 */

import 'server-only'

import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { submitFormSchema } from '@/lib/forms/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RpcResult =
  | { status: 'ok'; client_id?: string | null; contact_id?: string | null }
  | { error: 'token_not_found' }
  | { error: 'token_expired' }
  | { error: 'token_used' }
  | { error: 'internal'; message?: string }

function getFirstValidationMessage(details: unknown): string | null {
  if (!Array.isArray(details) || details.length === 0) return null
  const first = details[0]
  if (!first || typeof first !== 'object') return null
  const message = 'message' in first ? first.message : null
  return typeof message === 'string' && message.trim().length > 0
    ? message.trim()
    : null
}

function mapRpcInternalMessage(message: string | undefined): {
  status: number
  message?: string
} {
  if (!message) return { status: 500 }

  if (
    message.includes('doa_clientes_datos_generales_tipo_cliente_check') ||
    message.includes('customer_type')
  ) {
    return {
      status: 400,
      message:
        'customer_type must be one of: airline, mro, private, manufacturer, other',
    }
  }

  return { status: 500 }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params
  if (!token || typeof token !== 'string') {
    return NextResponse.json(
      { error: 'token_not_found' },
      { status: 404 },
    )
  }

  // 1) Parse + validate body against the canonical schema
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_payload', details: 'body must be JSON' },
      { status: 400 },
    )
  }

  const validation = submitFormSchema.safeParse(raw)
  if (!validation.success) {
    const issues = validation.error.issues
    return NextResponse.json(
      {
        error: 'invalid_payload',
        details: issues,
        message:
          getFirstValidationMessage(issues) ??
          'Please review the form fields and try again.',
      },
      { status: 400 },
    )
  }

  // 2) Invoke the atomic RPC. Service role — bypasses RLS.
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc(
    'fn_submit_form_intake' as never,
    {
      p_token: token,
      p_payload: validation.data,
    } as never,
  )

  if (error) {
    console.error('[/f/[token]/submit] rpc transport error:', error)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  const result = data as RpcResult | null
  if (!result || typeof result !== 'object') {
    console.error('[/f/[token]/submit] rpc returned no result')
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  if ('status' in result && result.status === 'ok') {
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  }

  if ('error' in result) {
    switch (result.error) {
      case 'token_not_found':
        return NextResponse.json(
          { error: 'token_not_found' },
          { status: 404 },
        )
      case 'token_expired':
        return NextResponse.json(
          { error: 'token_expired' },
          { status: 410 },
        )
      case 'token_used':
        return NextResponse.json(
          { error: 'token_used' },
          { status: 410 },
        )
      case 'internal':
      default:
        const mapped = mapRpcInternalMessage(
          'message' in result ? result.message : undefined,
        )
        console.error(
          '[/f/[token]/submit] rpc internal error:',
          'message' in result ? result.message : '(no message)',
        )
        return NextResponse.json(
          {
            error: mapped.status === 400 ? 'invalid_payload' : 'internal',
            ...(mapped.message ? { message: mapped.message } : {}),
          },
          { status: mapped.status },
        )
    }
  }

  // Shouldn't get here — defensive fallthrough.
  console.error('[/f/[token]/submit] unexpected rpc result shape:', result)
  return NextResponse.json({ error: 'internal' }, { status: 500 })
}
