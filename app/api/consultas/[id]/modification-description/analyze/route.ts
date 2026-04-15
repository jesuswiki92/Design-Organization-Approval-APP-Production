import OpenAI from 'openai'
import { NextRequest } from 'next/server'
import { requireUserApi } from '@/lib/auth/require-user'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-sonnet-4'

/**
 * Section keys must match the ones used by ModificationDescriptionPanel:
 *   section.sub ?? String(section.number)
 * i.e. "3","4","5","6","7.1","7.2","7.3","7.4",
 *      "8.1","8.2","8.3","8.4","8.5","9","10","11","12","13"
 */
const SECTION_KEYS = [
  '3', '4', '5', '6',
  '7.1', '7.2', '7.3', '7.4',
  '8.1', '8.2', '8.3', '8.4', '8.5',
  '9', '10', '11', '12', '13',
] as const

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

function buildClientContext(consultation: Record<string, unknown>): string {
  const lines: string[] = ['## MODIFICATION REQUEST DATA']
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
    ['Additional notes', String(consultation.additional_notes ?? '')],
    ['MTOW (kg)', String(consultation.mtow_kg ?? '')],
  ]
  for (const [label, value] of fields) {
    const v = value.trim()
    if (v && v !== 'null' && v !== 'undefined') lines.push(`- ${label}: ${v}`)
  }
  if (consultation.asunto) lines.push(`- Original subject: ${consultation.asunto}`)

  // Weight data
  const estimatedWeight = consultation.estimated_weight_kg
  const itemsWeightList = consultation.items_weight_list as
    | Array<{ item: string; weight_added_kg: number; weight_removed_kg: number }>
    | null
    | undefined

  if (estimatedWeight || (itemsWeightList && itemsWeightList.length > 0)) {
    lines.push('')
    lines.push('WEIGHT DATA:')
    if (estimatedWeight) {
      lines.push(`- Total estimated weight change: ${estimatedWeight} kg`)
    }
    if (itemsWeightList && itemsWeightList.length > 0) {
      lines.push('- Items breakdown:')
      itemsWeightList.forEach((item, idx) => {
        lines.push(
          `  ${idx + 1}. ${item.item}: +${item.weight_added_kg ?? 0} kg / -${item.weight_removed_kg ?? 0} kg`,
        )
      })
    }
  }

  // Location data
  const fuselagePosition = consultation.fuselage_position
  const staLocation = consultation.sta_location

  if (fuselagePosition || staLocation) {
    lines.push('')
    lines.push('LOCATION DATA:')
    if (consultation.impact_location) lines.push(`- Installation area: ${consultation.impact_location}`)
    if (fuselagePosition) lines.push(`- Fuselage position: ${fuselagePosition}`)
    if (staLocation) lines.push(`- STA: ${staLocation}`)
  }

  // Structural data
  const affectsPrimaryStructure = consultation.affects_primary_structure
  const structuralAttachment = consultation.impact_structural_attachment
  const structuralInterface = consultation.impact_structural_interface

  if (affectsPrimaryStructure) {
    lines.push('')
    lines.push('STRUCTURAL DATA:')
    if (structuralAttachment) lines.push(`- Attaches to structure: ${structuralAttachment}`)
    if (structuralInterface) lines.push(`- Structural interface: ${structuralInterface}`)
    lines.push(`- Affects primary structure (PSE): ${affectsPrimaryStructure}`)
  }

  // Airworthiness Directive
  const relatedToAd = consultation.related_to_ad
  const adReference = consultation.ad_reference

  if (relatedToAd) {
    lines.push('')
    lines.push('AIRWORTHINESS DIRECTIVE:')
    lines.push(`- Motivated by AD: ${relatedToAd}`)
    if (adReference) lines.push(`- AD reference: ${adReference}`)
  }

  return lines.join('\n')
}

async function fetchRagContext(query: string): Promise<string> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) return ''

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) return ''

    const openai = new OpenAI({ apiKey: openaiKey })
    const embResponse = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: query,
    })
    const queryEmbedding = embResponse.data[0].embedding

    const adminClient = createSupabaseAdmin(supabaseUrl, serviceKey)
    const { data, error } = await adminClient.rpc('match_doa_part21', {
      query_embedding: queryEmbedding,
      match_count: 8,
    })

    if (error || !data) return ''

    const chunks = (data as Array<{ content: string; similarity: number }>)
      .filter((r) => r.similarity > 0.3)
      .map((r) => r.content)
      .join('\n\n---\n\n')

    return chunks ? `## REGULATORY REFERENCE (from AMC-GM Part-21 & EASA guidance)\n\n${chunks}` : ''
  } catch {
    return ''
  }
}

const SYSTEM_PROMPT = `You are a senior DOA (Design Organisation Approval) engineer under EASA Part 21 Subpart J.

You are writing the G12-17 Modification Description document for an aircraft modification. This document describes the design change in structured sections following the DOA's approved template.

You will receive:
1. MODIFICATION REQUEST DATA — details from the client's consultation form
2. REFERENCE PROJECT — a summary from a similar completed project (if available)
3. REGULATORY REFERENCE — relevant excerpts from EASA guidance material

Your task: Generate professional text content for each section of the G12-17 Modification Description document.

SECTION DEFINITIONS:
- Section 3 "OBJECTIVE AND SCOPE": Purpose of the modification, what it achieves, and boundaries of the design change.
- Section 4 "DEFINITIONS AND ACRONYMS": Relevant technical definitions and acronyms used in the document.
- Section 5 "APPLICABILITY": Aircraft type, model, MSN, TCDS applicability.
- Section 6 "REFERENCE DOCUMENTS": List of applicable reference documents (TCDS, ADs, STCs, AMM chapters, etc.).
- Section 7.1 "INITIAL CONFIGURATION": Description of the aircraft's current/baseline configuration before modification.
- Section 7.2 "FINAL CONFIGURATION": Description of the aircraft's configuration after the modification is completed.
- Section 7.3 "AFFECTED AREAS": Areas of the aircraft affected by the modification (structural, electrical, systems, etc.).
- Section 7.4 "AFFECTED APPROVED MANUALS": List of approved manuals requiring revision (AFM, WBM, AMM, IPC, etc.).
- Section 8.1 "ASSEMBLED COMPONENTS": Components/parts to be installed during the modification.
- Section 8.2 "DISASSEMBLED COMPONENTS": Components/parts to be removed during the modification.
- Section 8.3 "ELECTRICAL CONNECTIONS": Description of electrical wiring, connectors, and circuit breaker changes.
- Section 8.4 "STRUCTURAL PROVISIONS": Structural attachments, brackets, doublers, and interface with aircraft structure.
- Section 8.5 "EQUIPMENT QUALIFICATION": Qualification status of equipment being installed (ETSO, TSO, environmental qualification).
- Section 9 "SYSTEM OPERATION": How the modified system operates, including normal and abnormal procedures.
- Section 10 "ELECTRICAL BALANCE": Electrical load analysis impact — power consumption, circuit protection.
- Section 11 "WEIGHT AND BALANCE": Weight change breakdown, CG impact, moment calculations.
- Section 12 "VENTILATION AND DRAINAGE": Impact on pressurization, ventilation paths, drainage provisions.
- Section 13 "MODIFICATION INTERFACE": Interface with other systems, STCs, or modifications on the aircraft.

WRITING RULES:
- Use formal EASA Part 21J engineering language.
- Be specific — use actual data from the modification request (aircraft type, MSN, locations, weights, etc.).
- Where data is insufficient for a complete section, write what you can and add "[TBD - requires engineering input]" for missing details.
- Do NOT invent data — if weight is not provided, say weight analysis is pending, do not guess numbers.
- For Section 4 (Definitions): include standard aviation acronyms relevant to this modification type.
- For Section 6 (References): include standard references like the TCDS, applicable CS chapters, and any AD references.
- For weight sections: use the actual weight data provided. Calculate net weight change if item breakdown is available.
- Keep each section concise but technically complete.
- Write in third person, present tense.

Respond ONLY with valid JSON object. The keys MUST be exactly: "3","4","5","6","7.1","7.2","7.3","7.4","8.1","8.2","8.3","8.4","8.5","9","10","11","12","13".
Each value must be a string with the section content. Use \\n for line breaks within a section.

Example format:
{
  "3": "The purpose of this document is to describe...",
  "4": "AFM - Aircraft Flight Manual\\nAMM - Aircraft Maintenance Manual\\n...",
  "5": "This document is applicable to...",
  ...
}`

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUserApi()
    if (auth instanceof Response) return auth
    const { supabase } = auth
    const { id } = await context.params

    if (!id) return jsonResponse(400, { error: 'Consulta ID requerido.' })

    const body = (await request.json()) as {
      consultationData?: Record<string, unknown>
      referenceProjectId?: string
    }
    const referenceProjectId = typeof body.referenceProjectId === 'string' ? body.referenceProjectId.trim() : ''

    if (!process.env.OPENROUTER_API_KEY) {
      return jsonResponse(500, { error: 'OPENROUTER_API_KEY no configurada.' })
    }

    // Fetch consultation from database
    const { data: consultation, error: consultError } = await supabase
      .from('doa_consultas_entrantes')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (consultError) {
      console.error('modification-description/analyze — DB error:', consultError)
      return jsonResponse(500, { error: consultError.message })
    }
    if (!consultation) return jsonResponse(404, { error: 'Consulta no encontrada.' })

    // Build client context
    const clientContext = buildClientContext(consultation as Record<string, unknown>)

    // Fetch reference project if provided
    let referenceContext = ''
    if (referenceProjectId) {
      const { data: project } = await supabase
        .from('doa_proyectos_historico')
        .select('numero_proyecto, titulo, aeronave, summary_md')
        .eq('id', referenceProjectId)
        .maybeSingle()

      if (project?.summary_md) {
        referenceContext = `## REFERENCE PROJECT (Historical Precedent)\nProject: ${project.numero_proyecto} — ${project.titulo}\nAircraft: ${project.aeronave}\n\n${project.summary_md}`
      }
    }

    // Fetch RAG context
    const modDescription = `${consultation.modification_summary ?? ''} ${consultation.operational_goal ?? ''} ${consultation.impact_location ?? ''} aircraft modification description design change EASA Part 21J`
    const ragContext = await fetchRagContext(modDescription)

    // Build prompt
    const userMessage = [
      'Generate the G12-17 Modification Description content for all sections based on this modification request.\n',
      clientContext,
      referenceContext ? `\n---\n\n${referenceContext}` : '',
      ragContext ? `\n---\n\n${ragContext}` : '',
      '\n\nGenerate content for sections: 3, 4, 5, 6, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 8.5, 9, 10, 11, 12, 13.',
      'Return a JSON object with these exact keys and string values.',
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
          'X-Title': 'DOA Modification Description Generator',
        },
      },
    )

    const rawContent = completion.choices[0]?.message?.content ?? ''

    let parsed: Record<string, unknown>
    try {
      const cleaned = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('modification-description/analyze — parse error:', rawContent.slice(0, 500))
      return jsonResponse(500, { error: 'No se pudo interpretar la respuesta del modelo.' })
    }

    // Validate and sanitize: only keep known section keys with string values
    const sections: Record<string, string> = {}
    for (const key of SECTION_KEYS) {
      const value = parsed[key]
      if (typeof value === 'string' && value.trim()) {
        // Replace literal \n with actual newlines for multiline display
        sections[key] = value.replace(/\\n/g, '\n')
      } else {
        sections[key] = ''
      }
    }

    return jsonResponse(200, {
      sections,
      model: modelName,
      debug: {
        ragChunks: ragContext ? ragContext.split('\n\n---\n\n').length : 0,
        referenceProject: referenceProjectId || null,
        tokenEstimate: Math.round((SYSTEM_PROMPT.length + userMessage.length) / 4),
      },
    })
  } catch (error) {
    console.error('modification-description/analyze — error:', error)
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Error inesperado.' })
  }
}
