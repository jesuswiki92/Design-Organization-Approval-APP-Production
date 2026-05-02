/**
 * ============================================================================
 * POST /api/incoming-requests/[id]/classification
 * ============================================================================
 *
 * Saves the Major / Minor classification wizard answers for the engineer's
 * review of an incoming request. Two-step persistence:
 *
 *   1) Locate (or create) a `doa_projects_v2` row tied to this incoming via
 *      `created_from_consultation_id = incoming.id`. Default project_code is
 *      `incoming.entry_number` (cast to text) or `TBD-{first8 of incoming id}`,
 *      `op_state = 'OP-06'`, `current_stage = 2`.
 *   2) UPSERT the matching `doa_project_classifications` row with the
 *      seven generic GT-A..GT-G triggers, the engineer's decision and the
 *      free-form justification (stored in `final_statement`).
 *
 * Body shape:
 *   {
 *     triggers: { trigger_a_general_configuration: bool|null, ... },
 *     decision: 'major' | 'minor' | null,
 *     justification: string
 *   }
 *
 * Response: `{ ok, project_id, classification_id }`.
 *
 * No auth (frame-only). Will be locked down once auth is reconnected.
 * ============================================================================
 */

import { NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabase/server'
import type { ProjectClassificationKind } from '@/types/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TriggerKey =
  | 'trigger_a_general_configuration'
  | 'trigger_b_principles_construction'
  | 'trigger_c_assumptions_invalidated'
  | 'trigger_d_appreciable_effect'
  | 'trigger_e_cert_basis_adjustment'
  | 'trigger_f_compliance_not_accepted'
  | 'trigger_g_agency_limitations_altered'

const TRIGGER_KEYS: TriggerKey[] = [
  'trigger_a_general_configuration',
  'trigger_b_principles_construction',
  'trigger_c_assumptions_invalidated',
  'trigger_d_appreciable_effect',
  'trigger_e_cert_basis_adjustment',
  'trigger_f_compliance_not_accepted',
  'trigger_g_agency_limitations_altered',
]

type RequestBody = {
  triggers?: Partial<Record<TriggerKey, boolean | null>>
  decision?: ProjectClassificationKind | null
  justification?: string
}

function normalizeDecision(
  value: unknown,
): ProjectClassificationKind | null {
  if (value === 'major' || value === 'minor') return value
  return null
}

function normalizeBool(value: unknown): boolean | null {
  if (value === true) return true
  if (value === false) return false
  return null
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: incomingId } = await context.params

  if (!incomingId) {
    return NextResponse.json(
      { ok: false, error: 'Missing incoming request id' },
      { status: 400 },
    )
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  // Load the incoming request — used for project_code default and title.
  const { data: incoming, error: incomingError } = await supabaseServer
    .from('doa_incoming_requests_v2')
    .select('id, entry_number, subject')
    .eq('id', incomingId)
    .single()

  if (incomingError || !incoming) {
    return NextResponse.json(
      { ok: false, error: 'Incoming request not found' },
      { status: 404 },
    )
  }

  // 1) Find or create the project tied to this incoming.
  const { data: existingProject, error: existingProjectError } = await supabaseServer
    .from('doa_projects_v2')
    .select('id')
    .eq('created_from_consultation_id', incomingId)
    .maybeSingle()

  if (existingProjectError) {
    return NextResponse.json(
      {
        ok: false,
        error: `Could not look up project: ${existingProjectError.message}`,
      },
      { status: 500 },
    )
  }

  let projectId: string | null = existingProject?.id ?? null

  if (!projectId) {
    const incomingRow = incoming as {
      id: string
      entry_number: number | null
      subject: string | null
    }

    const projectCode =
      incomingRow.entry_number !== null && incomingRow.entry_number !== undefined
        ? String(incomingRow.entry_number)
        : `TBD-${incomingId.slice(0, 8)}`

    const title =
      incomingRow.subject && incomingRow.subject.trim().length > 0
        ? incomingRow.subject.trim()
        : `Incoming ${projectCode}`

    const { data: insertedProject, error: insertProjectError } = await supabaseServer
      .from('doa_projects_v2')
      .insert({
        project_code: projectCode,
        title,
        op_state: 'OP-06',
        current_stage: 2,
        created_from_consultation_id: incomingId,
      })
      .select('id')
      .single()

    if (insertProjectError || !insertedProject) {
      return NextResponse.json(
        {
          ok: false,
          error: `Could not create project: ${insertProjectError?.message ?? 'unknown'}`,
        },
        { status: 500 },
      )
    }

    projectId = (insertedProject as { id: string }).id
  }

  // 2) UPSERT the classification row for this project.
  const triggersInput = body.triggers ?? {}
  const triggerColumns: Record<TriggerKey, boolean | null> = {
    trigger_a_general_configuration: normalizeBool(
      triggersInput.trigger_a_general_configuration,
    ),
    trigger_b_principles_construction: normalizeBool(
      triggersInput.trigger_b_principles_construction,
    ),
    trigger_c_assumptions_invalidated: normalizeBool(
      triggersInput.trigger_c_assumptions_invalidated,
    ),
    trigger_d_appreciable_effect: normalizeBool(
      triggersInput.trigger_d_appreciable_effect,
    ),
    trigger_e_cert_basis_adjustment: normalizeBool(
      triggersInput.trigger_e_cert_basis_adjustment,
    ),
    trigger_f_compliance_not_accepted: normalizeBool(
      triggersInput.trigger_f_compliance_not_accepted,
    ),
    trigger_g_agency_limitations_altered: normalizeBool(
      triggersInput.trigger_g_agency_limitations_altered,
    ),
  }

  const decision = normalizeDecision(body.decision)
  const justification =
    typeof body.justification === 'string' ? body.justification : ''

  // Avoid `unused` warning if a future refactor drops a key.
  void TRIGGER_KEYS

  // Look up an existing classification row for this project (1-1 by design,
  // but the table does not declare a unique constraint).
  const { data: existingClassification, error: existingClassificationError } =
    await supabaseServer
      .from('doa_project_classifications')
      .select('id')
      .eq('project_id', projectId)
      .maybeSingle()

  if (existingClassificationError) {
    return NextResponse.json(
      {
        ok: false,
        error: `Could not look up classification: ${existingClassificationError.message}`,
      },
      { status: 500 },
    )
  }

  let classificationId: string | null = existingClassification?.id ?? null

  if (classificationId) {
    const { error: updateError } = await supabaseServer
      .from('doa_project_classifications')
      .update({
        ...triggerColumns,
        decision,
        final_statement: justification || null,
      })
      .eq('id', classificationId)

    if (updateError) {
      return NextResponse.json(
        {
          ok: false,
          error: `Could not update classification: ${updateError.message}`,
        },
        { status: 500 },
      )
    }
  } else {
    const { data: inserted, error: insertError } = await supabaseServer
      .from('doa_project_classifications')
      .insert({
        project_id: projectId,
        ...triggerColumns,
        decision,
        final_statement: justification || null,
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      return NextResponse.json(
        {
          ok: false,
          error: `Could not create classification: ${insertError?.message ?? 'unknown'}`,
        },
        { status: 500 },
      )
    }

    classificationId = (inserted as { id: string }).id
  }

  // Mirror decision onto `doa_projects_v2.classification` so listings can show
  // it without a join — best-effort, swallow errors silently.
  if (decision) {
    await supabaseServer
      .from('doa_projects_v2')
      .update({ classification: decision })
      .eq('id', projectId)
  }

  return NextResponse.json({
    ok: true,
    project_id: projectId,
    classification_id: classificationId,
  })
}
