import OpenAI from 'openai'
import { NextRequest } from 'next/server'
import { requireUserApi } from '@/lib/auth/require-user'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-sonnet-4'

const G12_QUESTIONS = [
  { n: 1, q: 'Is there a Change to the General Configuration?' },
  { n: 2, q: 'Is there a Change to the principles of construction?' },
  { n: 3, q: 'Have the assumptions used for Certification been invalidated?' },
  { n: 4, q: 'Do the changes have appreciable effect on weight?' },
  { n: 5, q: 'Do the changes have appreciable effect on balance?' },
  { n: 6, q: 'Do the changes have appreciable effect on structural strength?' },
  { n: 7, q: 'Do the changes have appreciable effect on reliability?' },
  { n: 8, q: 'Do the changes have appreciable effect on operational characteristics?' },
  { n: 9, q: 'Do the changes require an adjustment of certification basis?' },
  { n: 10, q: 'Do the changes require a new interpretation of the requirements used for the TC basis?' },
  { n: 11, q: 'Do the changes contain aspects of compliance demonstration not previously accepted?' },
  { n: 12, q: 'Do the changes require considerable new substantiation data and reassessment?' },
  { n: 13, q: 'Do the changes alter the limitations directly approved by the Agency?' },
  { n: 14, q: 'Are the changes mandated by an Airworthiness Directive?' },
  { n: 15, q: 'Do the changes introduce or affect function where failure condition is catastrophic or hazardous?' },
  { n: 16, q: 'Do the changes affect significantly any other airworthiness characteristic?' },
]

const SYSTEM_PROMPT = [
  'You are a DOA (Design Organisation Approval) engineering copilot specialised in EASA Part 21J change classification.',
  'You have deep expertise in 21.A.91 criteria for classifying major vs minor changes to type design.',
  'You are thoroughly familiar with AMC and GM to Part 21, specifically the G12-01 guidance material for change classification.',
  'When explaining your reasoning, reference specific regulatory paragraphs (e.g., 21.A.91, 21.A.101(b), CS-25, AMC 21.A.91).',
  'Adopt a conservative approach: when evidence is ambiguous or incomplete, recommend classifying the change as major.',
  'Discuss the engineering rationale behind each G12-01 question when relevant to the user\'s query.',
  'Answer in the same language as the user\'s question.',
  'Use the supplied context (consultation data, current classification state, and regulatory references) to ground your answers.',
  'Do not claim that you searched databases or documents beyond the supplied context.',
].join(' ')

type ChatHistoryItem = {
  content: string
  role: 'assistant' | 'system' | 'user'
}

type ClassificationAnswer = {
  answer: 'yes' | 'no' | null
  confidence: 'high' | 'medium' | 'low'
  justification: string
}

function jsonResponse(status: number, error: string) {
  return Response.json({ error }, { status })
}

function normalizeHistory(history: unknown): ChatHistoryItem[] {
  if (!Array.isArray(history)) return []

  return history
    .filter((item): item is ChatHistoryItem => {
      if (!item || typeof item !== 'object') return false

      const role = (item as { role?: unknown }).role
      const content = (item as { content?: unknown }).content

      return (
        (role === 'assistant' || role === 'system' || role === 'user') &&
        typeof content === 'string' &&
        content.trim().length > 0
      )
    })
    .slice(-12)
}

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function buildClientContext(consultation: Record<string, unknown>): string {
  const lines: string[] = ['## MODIFICATION REQUEST (Client Data)']
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
  if (consultation.subject) lines.push(`- Original subject: ${consultation.subject}`)

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

function formatCurrentAnswers(answers: ClassificationAnswer[]): string {
  if (!answers || answers.length === 0) return ''

  const lines: string[] = ['## CURRENT CLASSIFICATION STATE (G12-01 Answers)']
  let hasAnyAnswer = false

  answers.forEach((entry, idx) => {
    const questionDef = G12_QUESTIONS[idx]
    if (!questionDef) return

    const answerLabel =
      entry.answer === 'yes' ? 'YES' : entry.answer === 'no' ? 'NO' : 'PENDING'

    if (entry.answer !== null || entry.justification) {
      hasAnyAnswer = true
      lines.push(`Q${questionDef.n}: ${questionDef.q}`)
      lines.push(`  Answer: ${answerLabel} (confidence: ${entry.confidence ?? 'unknown'})`)
      if (entry.justification) lines.push(`  Justification: ${entry.justification}`)
    }
  })

  if (!hasAnyAnswer) return ''

  const yesCount = answers.filter((a) => a.answer === 'yes').length
  const noCount = answers.filter((a) => a.answer === 'no').length
  const pendingCount = answers.filter((a) => a.answer === null).length

  lines.push('')
  lines.push(`Summary: ${yesCount} YES, ${noCount} NO, ${pendingCount} PENDING`)
  if (yesCount > 0) lines.push('Current classification tendency: MAJOR change')
  else if (pendingCount === 0) lines.push('Current classification tendency: MINOR change')

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

    return chunks ? `## REGULATORY REFERENCE (from AMC-GM Part-21 & G12-01 RAG)\n\n${chunks}` : ''
  } catch {
    return ''
  }
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
      return jsonResponse(400, 'Request no valida.')
    }

    const body = (await request.json()) as {
      currentAnswers?: unknown
      history?: unknown
      question?: unknown
    }

    const question = typeof body.question === 'string' ? body.question.trim() : ''
    if (!question) {
      return jsonResponse(400, 'Question is required.')
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return jsonResponse(500, 'OPENROUTER_API_KEY is not configured.')
    }

    const { data: consultation, error: consultError } = await supabase
      .from('doa_incoming_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (consultError) {
      return jsonResponse(500, consultError.message)
    }

    if (!consultation) {
      return jsonResponse(404, 'Request no encontrada.')
    }

    const clientContext = buildClientContext(consultation as Record<string, unknown>)

    const currentAnswers = Array.isArray(body.currentAnswers)
      ? formatCurrentAnswers(body.currentAnswers as ClassificationAnswer[])
      : ''

    const ragQuery = `${question} ${consultation.modification_summary ?? ''} EASA Part 21 change classification major minor 21.A.91 G12-01`
    const ragContext = await fetchRagContext(ragQuery)

    const contextMessage = [
      clientContext,
      currentAnswers ? `\n---\n\n${currentAnswers}` : '',
      ragContext ? `\n---\n\n${ragContext}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const modelName = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL
    const history = normalizeHistory(body.history)
    const openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    })

    const completion = await openai.chat.completions.create(
      {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: contextMessage },
          ...history.map((item) => ({
            content: item.content,
            role: item.role,
          })),
          { role: 'user', content: question },
        ],
        model: modelName,
        stream: true,
        temperature: 0.25,
      },
      {
        headers: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'DOA Change Classification Copilot',
        },
      },
    )

    const encoder = new TextEncoder()

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let fullAnswer = ''

        try {
          controller.enqueue(encoder.encode(sseEvent('meta', { model: modelName })))

          for await (const chunk of completion) {
            const token = chunk.choices[0]?.delta?.content ?? ''
            if (!token) continue

            fullAnswer += token
            controller.enqueue(encoder.encode(sseEvent('token', { token })))
          }

          controller.enqueue(
            encoder.encode(sseEvent('done', { answer: fullAnswer, model: modelName })),
          )
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unexpected error while streaming.'
          controller.enqueue(encoder.encode(sseEvent('error', { error: message })))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream; charset=utf-8',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.'
    return jsonResponse(500, message)
  }
}
