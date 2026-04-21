import OpenAI from 'openai'
import { NextRequest } from 'next/server'
import { requireUserApi } from '@/lib/auth/require-user'
import {
  COMPLIANCE_TEMPLATES,
  CATEGORY_LABELS,
  FAMILIA_TO_TEMPLATES,
} from '@/lib/compliance-templates'

export const runtime = 'nodejs'

const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-sonnet-4'

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

function buildConsultaContext(consultation: Record<string, unknown>): string {
  const lines: string[] = ['## NEW MODIFICATION REQUEST (Client Data)']
  const fields: [string, string][] = [
    ['Aircraft', `${consultation.aircraft_manufacturer ?? ''} ${consultation.aircraft_model ?? ''}`],
    ['MSN', String(consultation.aircraft_msn ?? '')],
    ['TCDS', String(consultation.tcds_number ?? '')],
    ['Work type', String(consultation.work_type ?? '')],
    ['Modification description', String(consultation.modification_summary ?? '')],
    ['Operational goal', String(consultation.operational_goal ?? '')],
    ['Location on aircraft', String(consultation.impact_location ?? '')],
    ['Structural attachment', String(consultation.impact_structural_attachment ?? '')],
    ['Structural interface', String(consultation.impact_structural_interface ?? '')],
    ['Electrical wiring', String(consultation.impact_electrical ?? '')],
    ['Avionics/instruments', String(consultation.impact_avionics ?? '')],
    ['Cabin layout affected', String(consultation.impact_cabin_layout ?? '')],
    ['Pressurized area', String(consultation.impact_pressurized ?? '')],
    ['Operational change', String(consultation.impact_operational_change ?? '')],
    ['Affects primary structure', String(consultation.affects_primary_structure ?? '')],
    ['Related to AD', String(consultation.related_to_ad ?? '')],
    ['Additional notes', String(consultation.additional_notes ?? '')],
  ]
  for (const [label, value] of fields) {
    const v = value.trim()
    if (v && v !== 'null' && v !== 'undefined') lines.push(`- ${label}: ${v}`)
  }
  return lines.join('\n')
}

function buildTemplatesCatalog(): string {
  const byCategory: Record<string, string[]> = {}
  for (const t of COMPLIANCE_TEMPLATES) {
    if (!byCategory[t.category]) byCategory[t.category] = []
    byCategory[t.category].push(`  - ${t.code}: ${t.name}`)
  }
  const lines: string[] = ['## AVAILABLE COMPLIANCE TEMPLATES']
  for (const [category, items] of Object.entries(byCategory)) {
    lines.push(`\n### ${CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}`)
    lines.push(...items)
  }
  return lines.join('\n')
}

function buildReferenceContext(
  project: {
    project_number?: string | null
    title?: string | null
    aircraft?: string | null
    summary_md?: string | null
  },
  familias: string[],
  codesFromFamilias: string[],
): string {
  const lines: string[] = ['## REFERENCE PROJECT (Historical Precedent)']
  lines.push(`Project: ${project.project_number ?? 'N/A'} — ${project.title ?? 'N/A'}`)
  if (project.aircraft) lines.push(`Aircraft: ${project.aircraft}`)
  if (project.summary_md) {
    lines.push('')
    lines.push('Summary:')
    lines.push(project.summary_md)
  }
  if (familias.length > 0) {
    lines.push('')
    lines.push(`Document families used in this reference project (${familias.length}):`)
    for (const f of familias) lines.push(`  - ${f}`)
  }
  if (codesFromFamilias.length > 0) {
    lines.push('')
    lines.push(
      `Compliance codes derived from those families (use these as baseline): ${codesFromFamilias.join(', ')}`,
    )
  }
  return lines.join('\n')
}

const SYSTEM_PROMPT = `You are a DOA (Design Organisation Approval) engineering analyst under EASA Part 21J.

You are evaluating a NEW incoming modification request to recommend which COMPLIANCE DOCUMENTS should be produced for this project.

You will receive:
1. CLIENT DATA — the modification request details
2. AVAILABLE COMPLIANCE TEMPLATES — the full catalog of 44 template codes (G12-xx, G18-xx) organized by category
3. REFERENCE PROJECT — a similar completed project with the list of document families that were actually used (if available)

Your task: Recommend the subset of templates that should be selected for this modification.

METHODOLOGY:
- Start from the reference project's baseline (if provided) and ADJUST based on the specific characteristics of the new modification.
- G12-01 (Change Classification) and G12-17 (Modification Description) are ALMOST ALWAYS required.
- G12-21 (Weight and Balance Report) is required if there is any weight data or the modification affects weight/balance.
- G12-20 (Structural Analysis) is required if the modification affects primary structure (PSE) or has structural attachment.
- G12-14 (Electrical Load Analysis) is required if electrical wiring is involved.
- G12-16 (Flammability Analysis) is required for cabin modifications with new materials.
- G12-18 (Hazard Analysis) is required for safety-critical systems.
- G12-22/G12-23 (Fatigue/Damage Tolerance) are required for structural modifications on primary structure.
- G12-24/G12-36 (Ground Test) are typically paired.
- G12-26/G12-38 (Flight Test) are required for changes affecting flight characteristics or new function.
- G12-28 (Flight Manual Supplement) is required if modification changes operational procedures or limitations.
- G12-39 (Certification Plan STC Major) is required for Major changes; G12-12 (Certification Plan Minor) for Minor.
- G18-02 (Master Document List) is required for all STC/Major projects.
- For REPAIRS (work_type=repair), prefer G12-46 (Repair Description), G12-07 (Minor Repair Approval), G12-10 (Repair DoC), G12-42 (Damage Assessment).

For each RECOMMENDED template, return:
- "code": the template code (e.g., "G12-01")
- "justification": A concise reason (max 40 words) tied to the specific modification characteristics.
- "confidence": "high", "medium", or "low"

RULES:
- Only include templates you ACTIVELY RECOMMEND. Do not include templates that are not applicable.
- Do not invent codes. Only use codes from the AVAILABLE COMPLIANCE TEMPLATES list.
- Be concrete: reference specific data from the modification (weight, structural impact, etc.) in the justification.

Respond ONLY with valid JSON:
{ "recommendations": [{"code": "G12-01", "justification": "...", "confidence": "high"}, ...] }`

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUserApi()
    if (auth instanceof Response) return auth
    const { supabase } = auth
    const { id } = await context.params

    if (!id) return jsonResponse(400, { error: 'Request ID requerido.' })

    const body = (await request.json().catch(() => ({}))) as { referenceProjectId?: string }
    const referenceProjectId =
      typeof body.referenceProjectId === 'string' ? body.referenceProjectId.trim() : ''

    if (!process.env.OPENROUTER_API_KEY) {
      return jsonResponse(500, { error: 'OPENROUTER_API_KEY no configurada.' })
    }

    // Fetch consultation
    const { data: consultation, error: consultError } = await supabase
      .from('doa_incoming_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (consultError) return jsonResponse(500, { error: consultError.message })
    if (!consultation) return jsonResponse(404, { error: 'Request no encontrada.' })

    const consultaContext = buildConsultaContext(consultation as Record<string, unknown>)
    const templatesCatalog = buildTemplatesCatalog()

    // Fetch reference project + its document families (baseline)
    let referenceContext = ''
    let familias: string[] = []
    let codesFromFamilias: string[] = []

    if (referenceProjectId) {
      const { data: project } = await supabase
        .from('doa_historical_projects')
        .select('project_number, title, aircraft, summary_md')
        .eq('id', referenceProjectId)
        .maybeSingle()

      const { data: docs } = await supabase
        .from('doa_historical_project_documents')
        .select('familia_documental')
        .eq('project_id', referenceProjectId)

      if (docs && Array.isArray(docs)) {
        const uniqueFamilias = new Set<string>()
        for (const d of docs) {
          const f = (d as { familia_documental?: string | null }).familia_documental
          if (f && typeof f === 'string') uniqueFamilias.add(f)
        }
        familias = [...uniqueFamilias]
        const codesSet = new Set<string>()
        for (const f of familias) {
          const mapped = FAMILIA_TO_TEMPLATES[f]
          if (mapped) for (const c of mapped) codesSet.add(c)
        }
        codesFromFamilias = [...codesSet]
      }

      if (project || familias.length > 0) {
        referenceContext = buildReferenceContext(project ?? {}, familias, codesFromFamilias)
      }
    }

    const userMessage = [
      'Recommend the compliance templates that should be produced for this modification.',
      '',
      consultaContext,
      referenceContext ? `\n---\n\n${referenceContext}` : '',
      `\n---\n\n${templatesCatalog}`,
    ].join('\n')

    const modelName = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL
    const openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    })

    const completion = await openai.chat.completions.create(
      {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        model: modelName,
        temperature: 0.2,
      },
      {
        headers: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'DOA Compliance Documents Suggester',
        },
      },
    )

    const rawContent = completion.choices[0]?.message?.content ?? ''

    let parsed: { recommendations?: Array<{ code: string; justification: string; confidence: string }> }
    try {
      const cleaned = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('compliance-documents/suggest — parse error:', rawContent)
      return jsonResponse(500, { error: 'No se pudo interpretar la response del model.' })
    }

    const validCodes = new Set(COMPLIANCE_TEMPLATES.map((t) => t.code))
    const recommendations = (parsed.recommendations ?? []).filter((r) => validCodes.has(r.code))

    return jsonResponse(200, {
      recommendations,
      model: modelName,
      referenceProjectId: referenceProjectId || null,
      baselineCodes: codesFromFamilias,
      debug: {
        tokenEstimate: Math.round((SYSTEM_PROMPT.length + userMessage.length) / 4),
        referenceFamilias: familias.length,
      },
    })
  } catch (error) {
    console.error('compliance-documents/suggest — error:', error)
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Error inesperado.',
    })
  }
}
