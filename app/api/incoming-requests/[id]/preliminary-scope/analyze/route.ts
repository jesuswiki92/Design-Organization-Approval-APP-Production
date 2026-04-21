import OpenAI from 'openai'
import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'

export const runtime = 'nodejs'

const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-sonnet-4'

const SYSTEM_PROMPT = `You are a DOA (Design Organisation Approval) engineering analyst under EASA Part 21J.

You are evaluating a NEW incoming modification request from a client. You will receive:
1. The CLIENT REQUEST — form data describing what the client wants (aircraft, modification type, impact answers, resources, etc.)
2. A REFERENCE PROJECT — a PROJECT_SUMMARY from a similar completed historical project, used as precedent.

Your task: Analyze the NEW client request in light of the reference project and determine:

1. **classification**: Whether this NEW modification is likely "major" or "minor" per EASA Part 21 criteria (CS-21.A.91). Consider:
   - Does it have an appreciable effect on mass, balance, structural strength, reliability, operational characteristics, noise, fuel venting, exhaust emissions, or other airworthiness factors?
   - If yes → "major". If no → "minor". If insufficient data → "unknown".
2. **classification_rationale**: One sentence (max 40 words) explaining your reasoning for this NEW project.
3. **certification_basis**: The likely applicable certification specification for this NEW project (e.g. "CS-23", "CS-25", "CS-VLA", "CS-27"). Infer from the aircraft type and the reference project. If not determinable, return null.
4. **impact_areas**: Engineering disciplines likely impacted by this NEW modification. For each:
   - "discipline": One of: "Structures", "Avionics", "Electrical", "Interiors", "Flammability", "Weights and Balance", "ICA", "Flight Manual", "Certification", "Production"
   - "detected": true
   - "rationale": Short sentence (max 20 words) explaining why for THIS new project
   - "from_reference": true if the reference project also had this discipline, false if it's new for this request

Base your analysis primarily on what the client described. Use the reference project to fill gaps and validate assumptions, but remember — the reference is a precedent, not a template. The new project may differ.

IMPORTANT: Respond ONLY with valid JSON. No markdown wrapping, no explanation outside the JSON.`

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

function buildClientRequestContext(consultation: Record<string, unknown>): string {
  const lines: string[] = ['## CLIENT REQUEST (New Modification)']

  const fields: [string, string][] = [
    ['Aircraft manufacturer', String(consultation.aircraft_manufacturer ?? '')],
    ['Aircraft model', String(consultation.aircraft_model ?? '')],
    ['Aircraft count', String(consultation.aircraft_count ?? '')],
    ['MSN / Registration', String(consultation.aircraft_msn ?? '')],
    ['TCDS Number', String(consultation.tcds_number ?? '')],
    ['Work type', String(consultation.work_type ?? '')],
    ['Modification description', String(consultation.modification_summary ?? '')],
    ['Operational goal', String(consultation.operational_goal ?? '')],
    ['Location on aircraft', String(consultation.impact_location ?? '')],
    ['Structural attachment required', String(consultation.impact_structural_attachment ?? '')],
    ['Structural interface description', String(consultation.impact_structural_interface ?? '')],
    ['Electrical wiring involved', String(consultation.impact_electrical ?? '')],
    ['Avionics / instruments involved', String(consultation.impact_avionics ?? '')],
    ['Cabin layout affected', String(consultation.impact_cabin_layout ?? '')],
    ['Pressurized area', String(consultation.impact_pressurized ?? '')],
    ['Operational change', String(consultation.impact_operational_change ?? '')],
    ['Equipment available', String(consultation.has_equipment ?? '')],
    ['Equipment details', String(consultation.equipment_details ?? '')],
    ['Drawings available', String(consultation.has_drawings ?? '')],
    ['Manufacturer docs available', String(consultation.has_manufacturer_docs ?? '')],
    ['Previous similar modification', String(consultation.has_previous_mod ?? '')],
    ['Previous modification reference', String(consultation.previous_mod_ref ?? '')],
    ['Target date', String(consultation.target_date ?? '')],
    ['AOG', String(consultation.is_aog ?? '')],
    ['Aircraft location', String(consultation.aircraft_location ?? '')],
    ['Additional notes', String(consultation.additional_notes ?? '')],
  ]

  for (const [label, value] of fields) {
    if (value && value !== 'null' && value !== 'undefined' && value !== '') {
      lines.push(`- ${label}: ${value}`)
    }
  }

  // Also include the original email subject/body if available
  if (consultation.subject) {
    lines.push(`- Original email subject: ${consultation.subject}`)
  }

  return lines.join('\n')
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUserApi()
    if (auth instanceof Response) return auth

    const { supabase } = auth
    const { id } = await context.params

    if (!id) {
      return jsonResponse(400, { error: 'Request ID requerido.' })
    }

    const body = (await request.json()) as {
      referenceProjectId?: unknown
    }

    const referenceProjectId =
      typeof body.referenceProjectId === 'string' ? body.referenceProjectId.trim() : ''

    if (!referenceProjectId) {
      return jsonResponse(400, { error: 'referenceProjectId es requerido.' })
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return jsonResponse(500, { error: 'OPENROUTER_API_KEY no esta configurada.' })
    }

    // Fetch the consultation data
    const { data: consultation, error: consultationError } = await supabase
      .from('doa_incoming_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (consultationError) {
      return jsonResponse(500, { error: consultationError.message })
    }

    if (!consultation) {
      return jsonResponse(404, { error: 'Request no encontrada.' })
    }

    const refs = Array.isArray(consultation.proyectos_referencia)
      ? consultation.proyectos_referencia
      : []

    if (!refs.includes(referenceProjectId)) {
      return jsonResponse(400, { error: 'El project no esta marcado como referencia en esta request.' })
    }

    // Fetch the reference project summary
    const { data: project, error: projectError } = await supabase
      .from('doa_historical_projects')
      .select('id, project_number, title, aircraft, summary_md')
      .eq('id', referenceProjectId)
      .maybeSingle()

    if (projectError) {
      return jsonResponse(500, { error: projectError.message })
    }

    if (!project) {
      return jsonResponse(404, { error: 'Project de referencia no encontrado.' })
    }

    if (!project.summary_md || !project.summary_md.trim()) {
      return jsonResponse(400, { error: 'El project de referencia no tiene PROJECT_SUMMARY disponible.' })
    }

    // Build context for the AI
    const clientContext = buildClientRequestContext(consultation as Record<string, unknown>)
    const referenceContext = `## REFERENCE PROJECT (Historical Precedent)\nProject: ${project.project_number} — ${project.title}\nAircraft: ${project.aircraft}\n\n${project.summary_md}`

    const userMessage = `Analyze this NEW modification request. Use the reference project as precedent.\n\n${clientContext}\n\n---\n\n${referenceContext}`

    // Send to AI
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
        temperature: 0.1,
      },
      {
        headers: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'DOA Preliminary Scope Analyzer',
        },
      },
    )

    const rawContent = completion.choices[0]?.message?.content ?? ''

    let analysisJson: unknown
    try {
      const cleaned = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      analysisJson = JSON.parse(cleaned)
    } catch {
      console.error('preliminary-scope/analyze — failed to parse AI response:', rawContent)
      return jsonResponse(500, { error: 'No se pudo interpretar la response del model.' })
    }

    return jsonResponse(200, {
      analysis: analysisJson,
      model: modelName,
      referenceProject: {
        id: project.id,
        project_number: project.project_number,
        title: project.title,
        aircraft: project.aircraft,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado del servidor.'
    console.error('preliminary-scope/analyze — error:', error)
    return jsonResponse(500, { error: message })
  }
}
