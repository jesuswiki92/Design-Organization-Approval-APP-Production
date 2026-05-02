/**
 * ============================================================================
 * POST /api/incoming-requests/[id]/classification/suggest
 * ============================================================================
 *
 * Returns an AI-suggested pre-fill for the Major / Minor classification wizard
 * (ReviewSummaryPanel) of an incoming request, based on:
 *   - the incoming request data (subject, body, aircraft, impacts, etc.),
 *   - the catalog of generic GT-A..G triggers,
 *   - the catalog of project archetypes.
 *
 * Does NOT persist anything — the engineer reviews and saves manually via the
 * existing POST /api/incoming-requests/[id]/classification endpoint.
 *
 * Frame-only: no auth (will be locked down once auth is reconnected).
 * ============================================================================
 */

import { NextResponse } from 'next/server'

import {
  ClassifierNotConfiguredError,
  ClassifierTimeoutError,
  suggestClassification,
} from '@/automations/inbound-email/suggest-classification'
import { supabaseServer } from '@/lib/supabase/server'
import type {
  ClassificationTrigger,
  IncomingRequest,
  ProjectArchetype,
} from '@/types/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function loadGenericTriggers(): Promise<ClassificationTrigger[]> {
  const { data, error } = await supabaseServer
    .from('doa_classification_triggers')
    .select('code, label, severity, short_explanation, source_ref, discipline, parent_trigger_code, sort_order, created_at')
    .is('discipline', null)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('suggest-classification: error fetching triggers', error)
    return []
  }
  return (data ?? []) as unknown as ClassificationTrigger[]
}

async function loadProjectArchetypes(): Promise<ProjectArchetype[]> {
  const { data, error } = await supabaseServer
    .from('doa_project_archetypes')
    .select('code, title, description, typical_aircraft_classes, typical_classification, typical_documents, is_active, created_at, updated_at')
    .eq('is_active', true)
    .order('code', { ascending: true })

  if (error) {
    console.error('suggest-classification: error fetching archetypes', error)
    return []
  }
  return (data ?? []) as unknown as ProjectArchetype[]
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params

  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'Missing incoming request id' },
      { status: 400 },
    )
  }

  // 1) Resolve the incoming request — 404 if missing.
  const { data: row, error: fetchError } = await supabaseServer
    .from('doa_incoming_requests_v2')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !row) {
    if (fetchError) {
      console.error('suggest-classification: error fetching incoming', fetchError)
    }
    return NextResponse.json(
      { ok: false, error: 'Incoming request not found' },
      { status: 404 },
    )
  }

  const incoming = row as unknown as IncomingRequest

  // 2) Load catalogs in parallel.
  const [triggers, archetypes] = await Promise.all([
    loadGenericTriggers(),
    loadProjectArchetypes(),
  ])

  // 3) Call the classifier.
  try {
    const suggestion = await suggestClassification({
      incoming,
      triggers,
      archetypes,
    })

    console.log('[suggest-classification] suggestion summary:', {
      incoming_id: id,
      decision: suggestion.decision,
      archetype: suggestion.suggested_archetype_code,
      confidence: suggestion.confidence_overall,
      model: suggestion.model_used,
    })

    return NextResponse.json({ ok: true, suggestion })
  } catch (error) {
    if (error instanceof ClassifierNotConfiguredError) {
      console.warn('suggest-classification: API key not configured')
      return NextResponse.json(
        { ok: false, error: 'AI assistant not configured' },
        { status: 503 },
      )
    }
    if (error instanceof ClassifierTimeoutError) {
      console.error('suggest-classification: timeout', error)
      return NextResponse.json(
        { ok: false, error: 'AI assistant timed out — try again in a moment' },
        { status: 504 },
      )
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('suggest-classification: unexpected error', error)
    return NextResponse.json(
      { ok: false, error: `AI assistant failed: ${message}` },
      { status: 500 },
    )
  }
}
