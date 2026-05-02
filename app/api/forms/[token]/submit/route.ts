/**
 * POST /api/forms/[token]/submit
 *
 * Receives the JSON payload posted by the inline JS in the rendered form HTML
 * (see `app/f/[token]/route.ts`). The `token` URL segment is the human slug.
 *
 * Pipeline:
 *   1. Resolve token (404/410/409).
 *   2. Validate body (Zod). Schema is picked by `client_kind` from the token.
 *   3. INSERT `doa_form_submissions_v2 (raw_payload, ...)` — fatal on failure.
 *   4. Mark token used (best-effort).
 *   5. For unknown: INSERT client + primary contact (best-effort).
 *   6. UPDATE `doa_incoming_requests_v2` with denormalized project fields
 *      (best-effort). Boolean-like columns are TEXT in this table, so we
 *      write 'true'/'false' strings. The select-with-`no_se` columns are
 *      written as-is (raw enum text).
 */

import { NextResponse } from 'next/server'
import type { ZodError } from 'zod'

import { supabaseServer } from '@/lib/supabase/server'
import { resolveFormTokenBySlug } from '@/lib/forms/token'
import {
  knownSubmitSchema,
  unknownSubmitSchema,
  type ItemWeightEntry,
  type KnownSubmitInput,
  type UnknownSubmitInput,
} from '@/lib/forms/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function zodErrorsToFieldMap(err: ZodError): Record<string, string> {
  // The HTML inline JS does `document.getElementById(k)` for each key in
  // `errors`, and the form inputs use the leaf field name as id (e.g.
  // `id="aircraft_count"`, not `id="aircraft.aircraft_count"`). So we collapse
  // each issue path to its last segment. If multiple issues collapse to the
  // same key we concatenate messages with '; '.
  const out: Record<string, string> = {}
  for (const issue of err.issues) {
    const last = issue.path[issue.path.length - 1]
    const key = typeof last === 'string' && last.length > 0 ? last : '_form'
    out[key] = out[key] ? `${out[key]}; ${issue.message}` : issue.message
  }
  return out
}

function emailDomainOf(email: string | undefined): string | null {
  if (!email) return null
  const at = email.lastIndexOf('@')
  if (at === -1) return null
  const domain = email.slice(at + 1).trim().toLowerCase()
  return domain.length > 0 ? domain : null
}

function boolToText(v: boolean | undefined): string | null {
  if (v === undefined) return null
  return v ? 'true' : 'false'
}

function buildIncomingUpdates(
  technical: KnownSubmitInput['technical'],
  aircraft: KnownSubmitInput['aircraft'],
): Record<string, unknown> {
  // columns marked TEXT below are legacy text-encoded booleans/enums.
  // All fields here come from the SHARED technical/aircraft blocks of the
  // schema — both `known` and `unknown` variants carry the same set, so we
  // do not branch by variant.
  const updates: Record<string, unknown> = {
    status: 'form_received',
    aircraft_manufacturer: aircraft.aircraft_manufacturer ?? null,
    aircraft_model: aircraft.aircraft_model ?? null,
    aircraft_count: aircraft.aircraft_count,
    aircraft_msn: aircraft.aircraft_msn ?? null,
    tcds_number: aircraft.tcds_number ?? null,
    tcds_pdf_url: aircraft.tcds_pdf_url ?? null,

    work_type: technical.work_type ?? null,
    existing_project_code: technical.existing_project_code ?? null,
    modification_summary: technical.modification_summary ?? null,
    operational_goal: technical.operational_goal ?? null,
    equipment_details: technical.equipment_details ?? null,
    previous_mod_ref: technical.previous_mod_ref ?? null,
    target_date: technical.target_date ?? null,
    aircraft_location: technical.aircraft_location ?? null,
    additional_notes: technical.additional_notes ?? null,

    has_equipment: technical.has_equipment ?? null,
    has_previous_mod: technical.has_previous_mod ?? null,
    has_drawings: boolToText(technical.has_drawings),
    has_manufacturer_docs: boolToText(technical.has_manufacturer_docs),
    is_aog: boolToText(technical.is_aog),

    impact_location: technical.impact_location ?? null,
    impact_structural_attachment: technical.impact_structural_attachment ?? null,
    impact_structural_interface: technical.impact_structural_interface ?? null,
    impact_electrical: technical.impact_electrical ?? null,
    impact_avionics: technical.impact_avionics ?? null,
    impact_cabin_layout: boolToText(technical.impact_cabin_layout),
    impact_pressurized: technical.impact_pressurized ?? null,
    impact_operational_change: technical.impact_operational_change ?? null,

    installation_drawings_urls: technical.installation_drawings ?? [],
    items_weight_list: (technical.items_weight_list ?? []) as ItemWeightEntry[],
    installation_weight_kg: technical.installation_weight_kg ?? null,

    fuselage_position: technical.fuselage_position ?? null,
    sta_location: technical.sta_location ?? null,
    affects_primary_structure: technical.affects_primary_structure ?? null,
    ad_reference: technical.ad_reference ?? null,
    // motivated_by_ad → related_to_ad (legacy column name)
    related_to_ad: technical.motivated_by_ad ?? null,
  }

  return updates
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token: slug } = await context.params

  if (!slug) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 })
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const resolved = await resolveFormTokenBySlug(slug)
  if (!resolved.ok) {
    if (resolved.status === 404) {
      return NextResponse.json(
        { ok: false, error: 'token_not_found', message: 'Form link not found' },
        { status: 404 },
      )
    }
    if (resolved.status === 410) {
      if (resolved.reason === 'used') {
        return NextResponse.json(
          { ok: false, error: 'token_used', message: 'Este formulario ya ha sido enviado' },
          { status: 410 },
        )
      }
      return NextResponse.json(
        { ok: false, error: 'token_expired', message: 'Este enlace ha caducado' },
        { status: 410 },
      )
    }
    return NextResponse.json(
      { ok: false, error: 'token_lookup_failed', message: 'Failed to resolve form token' },
      { status: 500 },
    )
  }

  const tokenRow = resolved.row

  let parsedKnown: KnownSubmitInput | null = null
  let parsedUnknown: UnknownSubmitInput | null = null
  if (tokenRow.client_kind === 'known') {
    const r = knownSubmitSchema.safeParse(rawBody)
    if (!r.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'validation_failed',
          message: 'Por favor rellena los campos marcados en rojo.',
          errors: zodErrorsToFieldMap(r.error),
        },
        { status: 400 },
      )
    }
    parsedKnown = r.data
  } else {
    const r = unknownSubmitSchema.safeParse(rawBody)
    if (!r.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'validation_failed',
          message: 'Por favor rellena los campos marcados en rojo.',
          errors: zodErrorsToFieldMap(r.error),
        },
        { status: 400 },
      )
    }
    parsedUnknown = r.data
  }

  const tokenIsDemo = tokenRow.is_demo === true

  // 3) Capture submission FIRST. Fatal on failure.
  const { data: insertedSubmission, error: submissionError } = await supabaseServer
    .from('doa_form_submissions_v2')
    .insert({
      incoming_request_id: tokenRow.incoming_request_id,
      raw_payload: rawBody,
      status: 'form_received',
      is_demo: tokenIsDemo,
    })
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

  // 4) Mark token used (best-effort).
  const { error: tokenUpdateError } = await supabaseServer
    .from('doa_form_tokens_v2')
    .update({ used_at: new Date().toISOString() })
    .eq('slug', tokenRow.slug)
  if (tokenUpdateError) {
    console.error(
      'forms/submit: failed to mark token used (non-fatal)',
      tokenUpdateError,
      { submissionId, slug: tokenRow.slug },
    )
  }

  // 5) For unknown clients: create the client + primary contact.
  let createdClientId: string | null = null
  if (parsedUnknown) {
    const c = parsedUnknown.client
    const { data: clientInserted, error: clientInsertError } = await supabaseServer
      .from('doa_clients_v2')
      .insert({
        name: c.company_name,
        cif_vat: c.vat_number ?? null,
        client_type: c.customer_type ?? null,
        country: c.country,
        city: c.city ?? null,
        address: c.address ?? null,
        phone: c.company_phone ?? null,
        website: c.website ?? null,
        email_domain: emailDomainOf(c.contact_email),
        active: true,
        is_demo: tokenIsDemo,
      })
      .select('id')
      .single()

    if (clientInsertError || !clientInserted) {
      console.error(
        'forms/submit: failed to insert doa_clients_v2 (non-fatal)',
        clientInsertError,
        { submissionId },
      )
    } else {
      createdClientId = (clientInserted as { id: string }).id
      const { error: contactInsertError } = await supabaseServer
        .from('doa_client_contacts_v2')
        .insert({
          client_id: createdClientId,
          first_name: c.contact_first_name,
          last_name: c.contact_last_name,
          email: c.contact_email,
          phone: c.contact_phone ?? null,
          role: c.contact_role ?? null,
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

  // 6) Update the incoming request with denormalized project fields.
  const technical = (parsedKnown ?? parsedUnknown)!.technical
  const aircraft = (parsedKnown ?? parsedUnknown)!.aircraft
  const incomingUpdates = buildIncomingUpdates(technical, aircraft)
  if (createdClientId) {
    incomingUpdates.client_id = createdClientId
  }

  const { error: incomingUpdateError } = await supabaseServer
    .from('doa_incoming_requests_v2')
    .update(incomingUpdates)
    .eq('id', tokenRow.incoming_request_id)

  if (incomingUpdateError) {
    console.error(
      'forms/submit: failed to update incoming request (non-fatal)',
      incomingUpdateError,
      { submissionId, requestId: tokenRow.incoming_request_id },
    )
  }

  return NextResponse.json({
    ok: true,
    submissionId,
    redirectStatus: 'form_received',
  })
}
