/**
 * ============================================================================
 * POST /api/incoming-requests/[id]/draft-reply
 * ============================================================================
 *
 * Genera (manualmente, on-demand) una respuesta IA para una solicitud entrante
 * y la persiste en `doa_incoming_requests_v2.ai_reply`.
 *
 * IMPORTANTE — change vs sub-slice A: aquí también garantizamos un token de
 * formulario para esta `incoming_request_id` (reuse si ya existe, INSERT en
 * caso contrario) y *sustituimos* el placeholder `{{FORM_LINK}}` en el cuerpo
 * generado antes de persistirlo. Así el operador ve el enlace real ya en el
 * textarea y `/send-reply` solo hace de sender, sin generar nada nuevo.
 *
 * Decide entre prompt "known" / "unknown" segun si el sender resuelve a un
 * cliente registrado. Devuelve `{ ok, body, kind, formUrl }`.
 *
 * Sin auth (frame-only). Cuando se reconecte auth se le pondra un guard.
 * ============================================================================
 */

import { NextResponse } from 'next/server'

import { draftReply } from '@/automations/inbound-email/draft-reply'
import {
  extractSenderEmail,
  resolveIncomingClientRecord,
} from '@/app/(dashboard)/quotations/incoming-queries'
import { ensureTokenForIncoming } from '@/lib/forms/token'
import { supabaseServer } from '@/lib/supabase/server'
import type { Client, ClientContact, IncomingRequest } from '@/types/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FORM_LINK_TOKEN = '{{FORM_LINK}}'

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
    console.error('draft-reply: error fetching clients', error)
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
    console.error('draft-reply: error fetching client contacts', error)
    return []
  }

  return (data ?? []) as unknown as ClientContact[]
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params

  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'Missing id' },
      { status: 400 },
    )
  }

  try {
    const { data: row, error: fetchError } = await supabaseServer
      .from('doa_incoming_requests_v2')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !row) {
      if (fetchError) {
        console.error('draft-reply: error fetching incoming request', fetchError)
      }
      return NextResponse.json(
        { ok: false, error: 'Incoming request not found' },
        { status: 404 },
      )
    }

    const incoming = row as unknown as IncomingRequest
    const [clients, contacts] = await Promise.all([
      loadClients(),
      loadClientContacts(),
    ])

    const matchedClient = resolveIncomingClientRecord(
      incoming.sender,
      clients,
      contacts,
    )
    const clientKind: 'known' | 'unknown' = matchedClient ? 'known' : 'unknown'

    // 1) Ensure a form token exists for this request and build the public URL.
    let slug: string
    try {
      const ensured = await ensureTokenForIncoming({
        incomingId: id,
        entryNumber: incoming.entry_number,
        clientKind,
      })
      slug = ensured.slug
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown form-token error'
      console.error('draft-reply: ensureTokenForIncoming failed', error)
      return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3010'
    const formUrl = `${baseUrl}/f/${slug}`

    // 2) Persist form_url on the request now (operator may want to see it
    //    even before regenerating the AI body, e.g. via DB inspection).
    const { error: formUrlError } = await supabaseServer
      .from('doa_incoming_requests_v2')
      .update({ form_url: formUrl })
      .eq('id', id)

    if (formUrlError) {
      console.error('draft-reply: error updating form_url', formUrlError)
      // Non-fatal: the URL is also derivable from the slug. Continue.
    }

    // 3) Generate the AI body.
    const senderEmail =
      extractSenderEmail(incoming.sender) ?? incoming.sender ?? ''

    const result = await draftReply({
      subject: incoming.subject ?? '',
      body: incoming.original_body ?? '',
      senderEmail,
      companyName: matchedClient?.name ?? null,
    })

    // 4) Substitute {{FORM_LINK}} with the real URL — if the placeholder is
    //    missing (the model occasionally drops it), append the URL on a new
    //    line so the operator sees it inline.
    const draftedBody = result.body ?? ''
    const substitutedBody = draftedBody.includes(FORM_LINK_TOKEN)
      ? draftedBody.split(FORM_LINK_TOKEN).join(formUrl)
      : `${draftedBody.trimEnd()}\n\n${formUrl}\n`

    // 5) Persist the substituted body.
    const { error: updateError } = await supabaseServer
      .from('doa_incoming_requests_v2')
      .update({ ai_reply: substitutedBody })
      .eq('id', id)

    if (updateError) {
      console.error('draft-reply: error updating ai_reply', updateError)
      return NextResponse.json(
        { ok: false, error: `Supabase update error: ${updateError.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      body: substitutedBody,
      kind: clientKind,
      formUrl,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error generating draft'
    console.error('draft-reply: unexpected error', error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
