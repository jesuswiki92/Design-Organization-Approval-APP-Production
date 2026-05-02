/**
 * ============================================================================
 * POST /api/incoming-requests/[id]/form-url
 * ============================================================================
 *
 * Genera (o reusa) la URL del formulario publico para una `doa_incoming_requests_v2`.
 * Pensado como accion manual desde la pagina detalle del incoming, para los
 * casos en los que se quiere una URL nueva o el draft IA todavia no se ha
 * disparado.
 *
 * Reusa `ensureTokenForIncoming` de `lib/forms/token.ts` para no diverger del
 * lifecycle de tokens que usa `/api/incoming-requests/[id]/draft-reply`:
 *   - Si el token vigente existe → reuse.
 *   - Si el token esta usado o expirado → DELETE y crear uno nuevo.
 *   - Si no existe → crear uno nuevo.
 *
 * Sin auth (frame-only): la app todavia no tiene `requireUserApi()` reconectado.
 * Cuando lo este, este endpoint debe quedar tras el guard.
 * ============================================================================
 */

import { NextResponse, type NextRequest } from 'next/server'

import { resolveIncomingClientRecord } from '@/app/(dashboard)/quotations/incoming-queries'
import { ensureTokenForIncoming } from '@/lib/forms/token'
import { supabaseServer } from '@/lib/supabase/server'
import type { Client, ClientContact, IncomingRequest } from '@/types/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function loadClients(): Promise<Client[]> {
  const { data, error } = await supabaseServer
    .from('doa_clients_v2')
    .select(
      `
      id,
      name,
      vat_tax_id:cif_vat,
      country,
      city,
      address,
      phone,
      website,
      is_active:active,
      notes,
      created_at,
      email_domain,
      client_type
    `,
    )
    .order('name', { ascending: true })

  if (error) {
    console.error('form-url: error fetching clients', error)
    return []
  }

  return (data ?? []) as unknown as Client[]
}

async function loadClientContacts(): Promise<ClientContact[]> {
  const { data, error } = await supabaseServer
    .from('doa_client_contacts_v2')
    .select(
      `
      id,
      client_id,
      name:first_name,
      last_name,
      email,
      phone,
      job_title:role,
      is_primary,
      is_active:active,
      created_at
    `,
    )

  if (error) {
    console.error('form-url: error fetching client contacts', error)
    return []
  }

  return (data ?? []) as unknown as ClientContact[]
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params

  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'missing_id', message: 'Falta el id en la URL' },
      { status: 400 },
    )
  }

  try {
    // 1) Resolver el incoming.
    const { data: row, error: fetchError } = await supabaseServer
      .from('doa_incoming_requests_v2')
      .select('id, client_id, entry_number, sender')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      console.error('form-url: error fetching incoming request', fetchError)
      return NextResponse.json(
        {
          ok: false,
          error: 'lookup_failed',
          message: `Error consultando la solicitud: ${fetchError.message}`,
        },
        { status: 500 },
      )
    }

    if (!row) {
      return NextResponse.json(
        {
          ok: false,
          error: 'not_found',
          message: `No existe ninguna solicitud con id ${id}`,
        },
        { status: 404 },
      )
    }

    const incoming = row as Pick<
      IncomingRequest,
      'id' | 'client_id' | 'entry_number' | 'sender'
    >

    // 2) Determinar client_kind.
    //    Primero por client_id; si no, intentar resolver via sender contra
    //    clientes/contactos para no perder un known cuando el incoming no
    //    tenga aun la FK seteada (la heuristica del flow de inbound-email).
    let clientKind: 'known' | 'unknown'
    if (incoming.client_id) {
      clientKind = 'known'
    } else {
      const [clients, contacts] = await Promise.all([
        loadClients(),
        loadClientContacts(),
      ])
      const matched = resolveIncomingClientRecord(
        incoming.sender,
        clients,
        contacts,
      )
      clientKind = matched ? 'known' : 'unknown'
    }

    // 3) Garantizar token vigente.
    const ensured = await ensureTokenForIncoming({
      incomingId: incoming.id,
      entryNumber: incoming.entry_number,
      clientKind,
    })

    // 4) Construir la URL publica.
    const envBase = process.env.NEXT_PUBLIC_APP_URL?.trim()
    const base = envBase && envBase.length > 0 ? envBase : request.nextUrl.origin
    const url = `${base.replace(/\/$/, '')}/f/${ensured.slug}`

    return NextResponse.json({
      ok: true,
      url,
      slug: ensured.slug,
      clientKind: ensured.clientKind,
      expiresAt: ensured.expiresAt,
      reused: ensured.reused,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error generating form URL'
    console.error('form-url: unexpected error', error)
    return NextResponse.json(
      { ok: false, error: 'unexpected', message },
      { status: 500 },
    )
  }
}
