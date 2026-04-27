/**
 * ============================================================================
 * POST /api/forms/[token]/submit
 * ============================================================================
 *
 * Recibe la entrega del formulario público (`app/f/[token]`) por parte del
 * cliente final. El parámetro `token` en la URL es el `slug` legible
 * (ej. `qry-2026-0001-9a8039`) — el UUID `token` real vive en columna y nunca
 * se expone.
 *
 * Pasos:
 *   1. Resolver y validar la fila de `doa_form_tokens_v2` por slug:
 *      - 404 si no existe.
 *      - 410 si está expirada.
 *      - 409 si ya fue enviada (`used_at IS NOT NULL`).
 *   2. Validar el body con Zod (`lib/forms/schemas.ts`).
 *   3. INSERT en `doa_form_submissions_v2` (esto SIEMPRE va; si falla,
 *      devolvemos 500 antes de tocar nada más — sin submission no hay flujo).
 *   4. UPDATE `doa_form_tokens_v2.used_at = now()`.
 *   5. Si `client_kind === 'unknown'`: INSERT en `doa_clients_v2` y
 *      `doa_client_contacts_v2`, y enlazar la request al nuevo client_id.
 *   6. UPDATE `doa_incoming_requests_v2` con `status='form_received'` y los
 *      campos denormalizados que el operador necesita ver de un vistazo.
 *
 * Contrato de fallo: si los pasos 4-6 fallan después de un INSERT exitoso del
 * paso 3, devolvemos 200 (la submission está capturada — el dato del cliente
 * NO se pierde) pero loggeamos el error con contexto. Los pasos posteriores
 * son idempotentes y se pueden replay-ear desde el panel interno.
 *
 * Sin auth (slug es la credencial). RLS de la tabla con anon key permite el
 * INSERT desde aquí — verificado en migración inicial de v2.
 * ============================================================================
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { supabaseServer } from '@/lib/supabase/server'
import { submitFormSchema } from '@/lib/forms/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type FormTokenRow = {
  token: string
  slug: string
  incoming_request_id: string
  expires_at: string
  used_at: string | null
  client_kind: 'known' | 'unknown'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Best-effort parse of `desired_timeline` to a real DATE column value. */
function parseTargetDate(input: string | undefined): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  // Strict YYYY-MM-DD (the only shape Postgres `date` accepts here without
  // surprises). Free-text inputs like "Q2 2026" return null on purpose.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const t = Date.parse(trimmed)
  if (!Number.isFinite(t)) return null
  return trimmed
}

function flattenZodError(err: z.ZodError): string {
  return err.issues
    .map((issue) => {
      const path = issue.path.join('.') || '(root)'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token: slug } = await context.params

  if (!slug) {
    return NextResponse.json(
      { ok: false, error: 'Missing token' },
      { status: 400 },
    )
  }

  // 1) Parse body
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  // 2) Resolve token row
  const { data: tokenRow, error: tokenError } = await supabaseServer
    .from('doa_form_tokens_v2')
    .select('token, slug, incoming_request_id, expires_at, used_at, client_kind')
    .eq('slug', slug)
    .maybeSingle()

  if (tokenError) {
    console.error('forms/submit: error fetching token row', tokenError)
    return NextResponse.json(
      { ok: false, error: 'Failed to resolve form token' },
      { status: 500 },
    )
  }

  if (!tokenRow) {
    return NextResponse.json(
      { ok: false, error: 'Form link not found' },
      { status: 404 },
    )
  }

  const token = tokenRow as FormTokenRow

  const expiresAt = Date.parse(token.expires_at)
  if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
    return NextResponse.json(
      { ok: false, error: 'Form link has expired' },
      { status: 410 },
    )
  }

  if (token.used_at) {
    return NextResponse.json(
      { ok: false, error: 'Form link has already been used' },
      { status: 409 },
    )
  }

  // 3) Validate the body — zod discriminates on client_kind. Defensive:
  //    cross-check that the client-submitted client_kind matches the token's
  //    client_kind, since the token row is the canonical source of truth.
  const parsed = submitFormSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: `Validation failed: ${flattenZodError(parsed.error)}` },
      { status: 422 },
    )
  }

  const input = parsed.data
  if (input.client_kind !== token.client_kind) {
    return NextResponse.json(
      {
        ok: false,
        error: `client_kind mismatch: token expects '${token.client_kind}'`,
      },
      { status: 400 },
    )
  }

  // 4) Build the submission payload (always-present project fields).
  const project = input.project
  const submissionPayload: Record<string, unknown> = {
    incoming_request_id: token.incoming_request_id,
    aircraft_manufacturer: project.aircraft_manufacturer ?? null,
    aircraft_model: project.aircraft_model,
    registration: project.registration ?? null,
    project_type: project.project_type,
    modification_description: project.modification_description,
    affected_aircraft_count: project.affected_aircraft_count,
    ata_chapter: project.ata_chapter ?? null,
    applicable_regulation: project.applicable_regulation ?? null,
    has_previous_approval: project.has_previous_approval,
    reference_document: project.reference_document ?? null,
    aircraft_location: project.aircraft_location ?? null,
    desired_timeline: project.desired_timeline ?? null,
    is_aog: project.is_aog,
    has_drawings: project.has_drawings,
    additional_notes: project.additional_notes ?? null,
    status: 'submitted',
  }

  if (input.client_kind === 'unknown') {
    submissionPayload.company_name = input.company.company_name
    submissionPayload.vat_tax_id = input.company.vat_tax_id
    submissionPayload.country = input.company.country
    submissionPayload.city = input.company.city ?? null
    submissionPayload.address = input.company.address ?? null
    submissionPayload.company_phone = input.company.company_phone ?? null
    submissionPayload.website = input.company.website ?? null
    submissionPayload.contact_first_name = input.contact.contact_first_name
    submissionPayload.contact_last_name = input.contact.contact_last_name
    submissionPayload.contact_email = input.contact.contact_email
    submissionPayload.contact_phone = input.contact.contact_phone ?? null
    submissionPayload.position_role = input.contact.position_role ?? null
  }

  // 5) Capture the submission FIRST. This is the only step we cannot lose.
  const { data: insertedSubmission, error: submissionError } = await supabaseServer
    .from('doa_form_submissions_v2')
    .insert(submissionPayload)
    .select('id')
    .single()

  if (submissionError || !insertedSubmission) {
    console.error('forms/submit: failed to insert submission', submissionError)
    return NextResponse.json(
      {
        ok: false,
        error: `Could not save your submission: ${
          submissionError?.message ?? 'unknown error'
        }`,
      },
      { status: 500 },
    )
  }

  const submissionId = (insertedSubmission as { id: string }).id

  // 6) From here on, errors are NON-fatal: we logged the submission, the rest
  //    is opportunistic state propagation. Each step logs its own error so
  //    operators can replay manually from the dashboard.

  // 6a) Mark the token as used.
  const usedAtIso = new Date().toISOString()
  const { error: tokenUpdateError } = await supabaseServer
    .from('doa_form_tokens_v2')
    .update({ used_at: usedAtIso })
    .eq('token', token.token)
  if (tokenUpdateError) {
    console.error(
      'forms/submit: failed to mark token used (non-fatal)',
      tokenUpdateError,
      { submissionId, slug: token.slug },
    )
  }

  // 6b) For unknown clients: create the client + contact and link the request.
  let createdClientId: string | null = null
  if (input.client_kind === 'unknown') {
    const company = input.company
    const contact = input.contact

    const emailDomain = (() => {
      const at = contact.contact_email.lastIndexOf('@')
      if (at === -1) return null
      return contact.contact_email.slice(at + 1).toLowerCase() || null
    })()

    const { data: clientInserted, error: clientInsertError } = await supabaseServer
      .from('doa_clients_v2')
      .insert({
        name: company.company_name,
        cif_vat: company.vat_tax_id,
        country: company.country,
        city: company.city ?? null,
        address: company.address ?? null,
        phone: company.company_phone ?? null,
        website: company.website ?? null,
        active: true,
        email_domain: emailDomain,
      })
      .select('id')
      .single()

    if (clientInsertError || !clientInserted) {
      console.error(
        'forms/submit: failed to insert doa_clients_v2 (non-fatal)',
        clientInsertError,
        { submissionId, slug: token.slug },
      )
    } else {
      createdClientId = (clientInserted as { id: string }).id

      const { error: contactInsertError } = await supabaseServer
        .from('doa_client_contacts_v2')
        .insert({
          client_id: createdClientId,
          first_name: contact.contact_first_name,
          last_name: contact.contact_last_name,
          email: contact.contact_email,
          phone: contact.contact_phone ?? null,
          role: contact.position_role ?? null,
          is_primary: true,
          active: true,
        })

      if (contactInsertError) {
        console.error(
          'forms/submit: failed to insert doa_client_contacts_v2 (non-fatal)',
          contactInsertError,
          { submissionId, clientId: createdClientId },
        )
      }
    }
  }

  // 6c) Update the incoming request: status + denormalized project fields.
  //     `is_aog` and `has_drawings` are TEXT in doa_incoming_requests_v2 even
  //     though they're booleans in doa_form_submissions_v2 (legacy from the
  //     older 'yes'/'no' encoding). We write 'true'/'false' for clarity.
  const incomingUpdates: Record<string, unknown> = {
    status: 'form_received',
    aircraft_manufacturer: project.aircraft_manufacturer ?? null,
    aircraft_model: project.aircraft_model,
    aircraft_count: project.affected_aircraft_count,
    aircraft_msn: project.registration ?? null,
    work_type: project.project_type,
    modification_summary: project.modification_description,
    aircraft_location: project.aircraft_location ?? null,
    additional_notes: project.additional_notes ?? null,
    is_aog: project.is_aog ? 'true' : 'false',
    has_drawings: project.has_drawings ? 'true' : 'false',
    target_date: parseTargetDate(project.desired_timeline),
  }

  if (createdClientId) {
    incomingUpdates.client_id = createdClientId
  }

  const { error: incomingUpdateError } = await supabaseServer
    .from('doa_incoming_requests_v2')
    .update(incomingUpdates)
    .eq('id', token.incoming_request_id)

  if (incomingUpdateError) {
    console.error(
      'forms/submit: failed to update incoming request (non-fatal)',
      incomingUpdateError,
      { submissionId, requestId: token.incoming_request_id },
    )
  }

  return NextResponse.json({
    ok: true,
    submissionId,
    redirectStatus: 'form_received',
  })
}
