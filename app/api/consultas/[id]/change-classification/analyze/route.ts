import { NextRequest } from 'next/server'
import { requireUserApi } from '@/lib/auth/require-user'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { getLiteLLM, MODEL_LLM_DEFAULT, MODEL_EMBEDDING_CLOUD } from '@/lib/llm/litellm-client'

export const runtime = 'nodejs'

const G12_QUESTIONS = [
  { n: 1, q: "Is there a Change to the General Configuration?", group: "critical" },
  { n: 2, q: "Is there a Change to the principles of construction?", group: "critical" },
  { n: 3, q: "Have the assumptions used for Certification been invalidated?", group: "critical" },
  { n: 4, q: "Do the changes have appreciable effect on weight?", group: "standard" },
  { n: 5, q: "Do the changes have appreciable effect on balance?", group: "standard" },
  { n: 6, q: "Do the changes have appreciable effect on structural strength?", group: "standard" },
  { n: 7, q: "Do the changes have appreciable effect on reliability?", group: "standard" },
  { n: 8, q: "Do the changes have appreciable effect on operational characteristics?", group: "standard" },
  { n: 9, q: "Do the changes require an adjustment of certification basis?", group: "standard" },
  { n: 10, q: "Do the changes require a new interpretation of the requirements used for the TC basis?", group: "standard" },
  { n: 11, q: "Do the changes contain aspects of compliance demonstration not previously accepted?", group: "standard" },
  { n: 12, q: "Do the changes require considerable new substantiation data and reassessment?", group: "standard" },
  { n: 13, q: "Do the changes alter the limitations directly approved by the Agency?", group: "standard" },
  { n: 14, q: "Are the changes mandated by an Airworthiness Directive?", group: "standard" },
  { n: 15, q: "Do the changes introduce or affect function where failure condition is catastrophic or hazardous?", group: "standard" },
  { n: 16, q: "Do the changes affect significantly any other airworthiness characteristic?", group: "standard" },
]

function jsonResponse(status: number, data: unknown) {
  return Response.json(data, { status })
}

function buildClientContext(consultation: Record<string, unknown>): string {
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
    ['Additional notes', String(consultation.additional_notes ?? '')],
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
  const impactLocation = consultation.impact_location

  if (fuselagePosition || staLocation) {
    lines.push('')
    lines.push('LOCATION DATA:')
    if (impactLocation) lines.push(`- Installation area: ${impactLocation}`)
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

    const openai = getLiteLLM()
    const embResponse = await openai.embeddings.create({
      model: MODEL_EMBEDDING_CLOUD,
      input: query,
    })
    const queryEmbedding = embResponse.data[0].embedding

    const adminClient = createSupabaseAdmin(supabaseUrl, serviceKey)
    const { data, error } = await adminClient.rpc('match_ams_part21', {
      query_embedding: queryEmbedding,
      match_count: 8,
    })

    if (error || !data) return ''

    const chunks = (data as Array<{ content: string; similarity: number }>)
      .filter((r) => r.similarity > 0.3)
      .map((r) => r.content)
      .join('\n\n---\n\n')

    return chunks ? `## REGULATORY REFERENCE (from AMC-GM Part-21 & G12-01 RAG)\n\n${chunks}` : ''
  } catch {
    return ''
  }
}

const SYSTEM_PROMPT = `You are a DOA (Design Organisation Approval) engineering analyst under EASA Part 21J.

You are evaluating a NEW incoming modification request using the G12-01 Change Classification form.

You will receive:
1. CLIENT DATA — the modification request details from the client's form
2. REFERENCE PROJECT — a PROJECT_SUMMARY from a similar completed project (if available)
3. REGULATORY REFERENCE — relevant excerpts from AMC-GM Part-21 and G12-01 criteria

Your task: Answer each of the 16 G12-01 classification questions for this NEW modification.

For each question, return:
- "answer": "yes", "no", or null (if you cannot determine with available information)
- "justification": A concise explanation (max 50 words). If answer is null, explain what information is missing.
- "confidence": "high", "medium", or "low"

RULES:
- Be conservative: if uncertain, use null rather than guessing
- For questions about weight/balance (Q4, Q5): most modifications have SOME effect, but "appreciable" means significant enough to require re-evaluation
- For Q14 (Airworthiness Directive): only answer "yes" if there's explicit AD reference
- Base your analysis on the actual modification described, not assumptions
- Use the reference project as guidance but remember the new project may differ

EVALUATION RULES BY QUESTION:

Q1-Q3 (CRITICAL): Compare modification description against examples in 21A.101(b)(1)(i) and 21A.101(b)(1)(ii). If any match → YES, stop classifying, contact EASA.

Q4 (WEIGHT): Calculate weight variation as percentage of MTOW.
  - < ±1% MTOW → NO (minor)
  - 1-2% MTOW → null (consult engineer, confidence: low)
  - > 2% MTOW → needs exhaustive analysis (confidence: low)
  - > 3% MTOW → YES (major)
  If no weight data provided → null with confidence: low.

Q5 (BALANCE): Evaluate ΔMoment = ΔWeight × arm from datum.
  Consider fuselage position (fwd/mid/aft) and STA if provided.
  Weight at extreme stations has greater CG impact.
  If weight is < 1% MTOW and position is mid → likely NO.

Q6 (STRUCTURAL STRENGTH):
  - If affects primary structure (PSE) → YES (major)
  - If attaches to secondary structure only → evaluate further but likely NO
  - If no structural attachment → NO

Q7 (RELIABILITY): Evaluate based on system complexity, new components, maintenance impact.

Q8 (OPERATIONAL): Check if modification changes how aircraft is operated, requires AFM changes, or new procedures.

Q9-Q13: Evaluate based on regulatory expertise and TCDS data.

Q14 (AD): Check related_to_ad field. Only YES if explicitly motivated by an AD.

Q15 (CATASTROPHIC/HAZARDOUS): Consider what systems are affected. Avionics/electrical involvement alone is not sufficient — evaluate the actual failure mode severity.

Q16: Catch-all — consider crashworthiness, aeroelasticity, performance, maintenance.

Respond ONLY with valid JSON array of 16 objects: [{"question_number": 1, "answer": "yes"|"no"|null, "justification": "...", "confidence": "high"|"medium"|"low"}, ...]`

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

    const body = (await request.json()) as { referenceProjectId?: string }
    const referenceProjectId = typeof body.referenceProjectId === 'string' ? body.referenceProjectId.trim() : ''

    // Fetch consultation
    const { data: consultation, error: consultError } = await supabase
      .from('consultas_entrantes')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (consultError) return jsonResponse(500, { error: consultError.message })
    if (!consultation) return jsonResponse(404, { error: 'Consulta no encontrada.' })

    // Build client context
    const clientContext = buildClientContext(consultation as Record<string, unknown>)

    // Fetch reference project if provided
    let referenceContext = ''
    if (referenceProjectId) {
      const { data: project } = await supabase
        .from('proyectos_historico')
        .select('numero_proyecto, titulo, aeronave, summary_md')
        .eq('id', referenceProjectId)
        .maybeSingle()

      if (project?.summary_md) {
        referenceContext = `## REFERENCE PROJECT (Historical Precedent)\nProject: ${project.numero_proyecto} — ${project.titulo}\nAircraft: ${project.aeronave}\n\n${project.summary_md}`
      }
    }

    // Fetch RAG context
    const modDescription = `${consultation.modification_summary ?? ''} ${consultation.operational_goal ?? ''} ${consultation.impact_location ?? ''} aircraft modification change classification`
    const ragContext = await fetchRagContext(modDescription)

    // Build prompt
    const userMessage = [
      'Analyze this modification and answer all 16 G12-01 questions.\n',
      clientContext,
      referenceContext ? `\n---\n\n${referenceContext}` : '',
      ragContext ? `\n---\n\n${ragContext}` : '',
      '\n\nQuestions to answer:',
      ...G12_QUESTIONS.map((q) => `Q${q.n} (${q.group}): ${q.q}`),
    ].join('\n')

    const modelName = MODEL_LLM_DEFAULT
    const openai = getLiteLLM()

    const completion = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      model: modelName,
      temperature: 0.1,
    })

    const rawContent = completion.choices[0]?.message?.content ?? ''

    let answers: unknown
    try {
      const cleaned = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      answers = JSON.parse(cleaned)
    } catch {
      console.error('change-classification/analyze — parse error:', rawContent)
      return jsonResponse(500, { error: 'No se pudo interpretar la respuesta del modelo.' })
    }

    return jsonResponse(200, {
      answers,
      model: modelName,
      debug: {
        systemPrompt: SYSTEM_PROMPT,
        userMessage,
        ragChunks: ragContext ? ragContext.split('\n\n---\n\n').length : 0,
        referenceProject: referenceProjectId || null,
        tokenEstimate: Math.round((SYSTEM_PROMPT.length + userMessage.length) / 4),
      },
    })
  } catch (error) {
    console.error('change-classification/analyze — error:', error)
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Error inesperado.' })
  }
}
