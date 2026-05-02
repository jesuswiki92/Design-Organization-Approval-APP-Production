/**
 * Shared helpers for `doa_form_tokens_v2`.
 *
 * - `resolveFormTokenBySlug`: usado por la ruta publica `/f/[token]` y por
 *   `/api/forms/[token]/submit` para hacer el not-found / expired / used check.
 * - `ensureTokenForIncoming`: usado por endpoints internos que necesitan
 *   garantizar (o crear) un token vigente para una `incoming_request_id`.
 *   Comparten ambos sites la misma logica de reuse / recreate para no diverger.
 */

import crypto from 'node:crypto'

import { supabaseServer } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Resolver publico (lectura) — sin cambios respecto a la version anterior.
// ---------------------------------------------------------------------------

export type FormTokenRow = {
  token: string
  slug: string
  incoming_request_id: string
  expires_at: string
  used_at: string | null
  first_viewed_at: string | null
  view_count: number | null
  client_kind: 'known' | 'unknown'
  is_demo: boolean | null
}

export type ResolveTokenReason = 'lookup_failed' | 'not_found' | 'expired' | 'used'

export type ResolveTokenResult =
  | { ok: true; row: FormTokenRow }
  | { ok: false; status: 404 | 410 | 500; reason: ResolveTokenReason }

export async function resolveFormTokenBySlug(
  slug: string,
): Promise<ResolveTokenResult> {
  const { data, error } = await supabaseServer
    .from('doa_form_tokens_v2')
    .select(
      'token, slug, incoming_request_id, expires_at, used_at, first_viewed_at, view_count, client_kind, is_demo',
    )
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error('forms/token: error fetching token row', error)
    return { ok: false, status: 500, reason: 'lookup_failed' }
  }

  if (!data) {
    return { ok: false, status: 404, reason: 'not_found' }
  }

  const row = data as FormTokenRow

  if (row.used_at) {
    return { ok: false, status: 410, reason: 'used' }
  }

  const expiresAt = Date.parse(row.expires_at)
  if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
    return { ok: false, status: 410, reason: 'expired' }
  }

  return { ok: true, row }
}

// ---------------------------------------------------------------------------
// Helpers compartidos para ENSURE (reuse-or-create).
// ---------------------------------------------------------------------------

/** TTL por defecto para nuevos tokens (en dias). */
export const TOKEN_TTL_DAYS = 30

/**
 * Construye el slug humano: `{entry_number_lower}-{random6hex}`.
 * Si no hay entry_number, fallback a `inc-{id_first8}-{random6hex}`.
 */
export function buildFormSlug(
  entryNumber: string | null | undefined,
  requestId: string,
  token: string,
): string {
  const base = (entryNumber ?? '').trim().toLowerCase()
  const suffix = token.replace(/-/g, '').slice(0, 6).toLowerCase()
  if (base) {
    return `${base}-${suffix}`
  }
  return `inc-${requestId.slice(0, 8).toLowerCase()}-${suffix}`
}

export type EnsureTokenInput = {
  incomingId: string
  entryNumber: string | null | undefined
  clientKind: 'known' | 'unknown'
  isDemo?: boolean
}

export type EnsureTokenResult = {
  slug: string
  token: string
  clientKind: 'known' | 'unknown'
  expiresAt: string
  reused: boolean
}

/**
 * Garantiza que existe un token VIGENTE para la `incomingId` dada.
 *
 * Reglas:
 *   - Si existe y `used_at IS NULL` y `expires_at > now()` → reusar.
 *   - Si existe pero esta usado o expirado → DELETE viejo y crear uno nuevo.
 *   - Si no existe → crear uno nuevo.
 *
 * Lanza Error en fallo Supabase para que el caller lo convierta en HTTP 500.
 */
export async function ensureTokenForIncoming(
  input: EnsureTokenInput,
): Promise<EnsureTokenResult> {
  const { incomingId, entryNumber, clientKind, isDemo = false } = input

  // 1) Buscar token existente.
  const { data: existing, error: existingError } = await supabaseServer
    .from('doa_form_tokens_v2')
    .select('slug, token, client_kind, used_at, expires_at')
    .eq('incoming_request_id', incomingId)
    .maybeSingle()

  if (existingError) {
    throw new Error(
      `Supabase select error (doa_form_tokens_v2): ${existingError.message}`,
    )
  }

  if (existing) {
    const expiresMs = Date.parse(existing.expires_at as string)
    const isFresh =
      !existing.used_at &&
      Number.isFinite(expiresMs) &&
      expiresMs > Date.now()

    if (isFresh) {
      return {
        slug: existing.slug as string,
        token: existing.token as string,
        clientKind: existing.client_kind as 'known' | 'unknown',
        expiresAt: existing.expires_at as string,
        reused: true,
      }
    }

    // Stale (usado o expirado): borrar para poder crear uno nuevo (la columna
    // incoming_request_id es UNIQUE, asi que un INSERT directo fallaria).
    const { error: deleteError } = await supabaseServer
      .from('doa_form_tokens_v2')
      .delete()
      .eq('incoming_request_id', incomingId)

    if (deleteError) {
      throw new Error(
        `Supabase delete error (doa_form_tokens_v2): ${deleteError.message}`,
      )
    }
  }

  // 2) Crear nuevo token.
  const token = crypto.randomUUID()
  const slug = buildFormSlug(entryNumber, incomingId, token)
  const expiresAt = new Date(
    Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  const { error: insertError } = await supabaseServer
    .from('doa_form_tokens_v2')
    .insert({
      token,
      slug,
      incoming_request_id: incomingId,
      expires_at: expiresAt,
      client_kind: clientKind,
      is_demo: isDemo,
    })

  if (insertError) {
    throw new Error(
      `Supabase insert error (doa_form_tokens_v2): ${insertError.message}`,
    )
  }

  return {
    slug,
    token,
    clientKind,
    expiresAt,
    reused: false,
  }
}
