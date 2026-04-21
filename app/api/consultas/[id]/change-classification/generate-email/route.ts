import OpenAI from 'openai'
import { NextRequest } from 'next/server'
import { requireUserApi } from '@/lib/auth/require-user'

export const runtime = 'nodejs'

const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-sonnet-4'

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

function buildConsultationSummary(consultation: Record<string, unknown>): string {
  const lines: string[] = ['## CONSULTATION DATA']
  const fields: [string, string][] = [
    ['Entry number', String(consultation.numero_entrada ?? '')],
    ['Subject', String(consultation.asunto ?? '')],
    ['Client (remitente)', String(consultation.remitente ?? '')],
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

  const affectsPrimaryStructure = consultation.affects_primary_structure
  if (affectsPrimaryStructure) {
    lines.push('')
    lines.push('STRUCTURAL DATA:')
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

function formatClassificationAnswers(answers: ClassificationAnswer[]): string {
  if (!answers || answers.length === 0) return ''

  const G12_QUESTIONS = [
    'Is there a Change to the General Configuration?',
    'Is there a Change to the principles of construction?',
    'Have the assumptions used for Certification been invalidated?',
    'Do the changes have appreciable effect on weight?',
    'Do the changes have appreciable effect on balance?',
    'Do the changes have appreciable effect on structural strength?',
    'Do the changes have appreciable effect on reliability?',
    'Do the changes have appreciable effect on operational characteristics?',
    'Do the changes require an adjustment of certification basis?',
    'Do the changes require a new interpretation of the requirements used for the TC basis?',
    'Do the changes contain aspects of compliance demonstration not previously accepted?',
    'Do the changes require considerable new substantiation data and reassessment?',
    'Do the changes alter the limitations directly approved by the Agency?',
    'Are the changes mandated by an Airworthiness Directive?',
    'Do the changes introduce or affect function where failure condition is catastrophic or hazardous?',
    'Do the changes affect significantly any other airworthiness characteristic?',
  ]

  const lines: string[] = ['## CURRENT CLASSIFICATION STATE (G12-01 Answers)']
  let hasAnyAnswer = false

  answers.forEach((entry, idx) => {
    const questionText = G12_QUESTIONS[idx]
    if (!questionText) return

    const answerLabel =
      entry.answer === 'yes' ? 'YES' : entry.answer === 'no' ? 'NO' : 'PENDING'

    if (entry.answer !== null || entry.justification) {
      hasAnyAnswer = true
      lines.push(`Q${idx + 1}: ${questionText}`)
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

function formatChatHistory(history: ChatHistoryItem[]): string {
  if (!history || history.length === 0) return ''

  const lines: string[] = ['## ENGINEER-AI DISCUSSION SUMMARY']
  history.forEach((item) => {
    const roleLabel = item.role === 'user' ? 'Engineer' : item.role === 'assistant' ? 'AI' : 'System'
    lines.push(`[${roleLabel}]: ${item.content}`)
  })

  return lines.join('\n')
}

const EMAIL_SYSTEM_PROMPT = [
  'You are a DOA (Design Organisation Approval) engineering assistant specialised in EASA Part 21J.',
  'Your task is to generate a professional email in Spanish requesting missing documentation or information from a client.',
  '',
  'Analyze the provided consultation data, the engineer-AI discussion, and the current classification answers.',
  'Identify what documentation, data, or information is MISSING or insufficient to complete the change classification and approval process.',
  '',
  'Common items that may be missing include:',
  '- Informes de analisis de esfuerzos (stress analysis reports)',
  '- Datos de peso y balance (weight & balance data)',
  '- Planos o croquis de la modificacion (drawings/sketches)',
  '- Documentacion STC (Supplemental Type Certificate)',
  '- ICA - Instructions for Continued Airworthiness',
  '- Evaluacion EWIS (Electrical Wiring Interconnection System)',
  '- Justificacion de la base de certificacion (certification basis justification)',
  '- Informes de ensayos (test reports)',
  '- Especificaciones de materiales (material specifications)',
  '- Datos de instalacion (installation data)',
  '- Manual de mantenimiento actualizado (updated maintenance manual)',
  '- Analisis de seguridad / evaluacion de riesgos (safety analysis / risk assessment)',
  '- Datos de compatibilidad electromagnetica (EMC data)',
  '- Documentacion del fabricante del equipo (equipment manufacturer documentation)',
  '',
  'RULES FOR THE EMAIL:',
  '- Write entirely in Spanish',
  '- Professional and courteous tone, appropriate for EASA Part 21J technical correspondence',
  '- No emojis',
  '- Address the client by name if available',
  '- Reference the consultation entry number (numero_entrada) in the greeting',
  '- Be specific and technical about what is needed -- do not be vague',
  '- Use clean paragraphs with a numbered list of required items',
  '- Each required item should explain briefly WHY it is needed',
  '- End with a suggested deadline (e.g., 10 business days) and contact information placeholder',
  '- The email body should be plain text (no HTML)',
  '- Do not include email headers (From:, To:, Date:) -- just the body',
  '',
  'RESPONSE FORMAT:',
  'You MUST respond with valid JSON and nothing else. No markdown code fences, no explanation outside the JSON.',
  'The JSON must have exactly this structure:',
  '{',
  '  "subject": "string with the email subject line, must include the numero_entrada",',
  '  "body": "string with the full email body in plain text",',
  '  "missingItems": ["array", "of", "missing", "item", "descriptions"]',
  '}',
].join('\n')

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
      return jsonResponse(400, 'Consulta no valida.')
    }

    const body = (await request.json()) as {
      chatHistory?: unknown
      currentAnswers?: unknown
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return jsonResponse(500, 'OPENROUTER_API_KEY is not configured.')
    }

    // Fetch consultation data
    const { data: consultation, error: consultError } = await supabase
      .from('doa_consultas_entrantes')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (consultError) {
      return jsonResponse(500, consultError.message)
    }

    if (!consultation) {
      return jsonResponse(404, 'Consulta no encontrada.')
    }

    // Build context sections
    const consultationSummary = buildConsultationSummary(consultation as Record<string, unknown>)

    const chatHistory = Array.isArray(body.chatHistory)
      ? (body.chatHistory as ChatHistoryItem[]).filter(
          (item): item is ChatHistoryItem =>
            item &&
            typeof item === 'object' &&
            (item.role === 'assistant' || item.role === 'system' || item.role === 'user') &&
            typeof item.content === 'string' &&
            item.content.trim().length > 0,
        )
      : []

    const chatHistoryText = formatChatHistory(chatHistory)

    const classificationText = Array.isArray(body.currentAnswers)
      ? formatClassificationAnswers(body.currentAnswers as ClassificationAnswer[])
      : ''

    // Determine client name from consultation
    const clientName = consultation.remitente
      ? String(consultation.remitente).split('@')[0].replace(/[._-]/g, ' ')
      : null
    const numeroEntrada = consultation.numero_entrada ?? consultation.codigo ?? id

    const userPrompt = [
      consultationSummary,
      chatHistoryText ? `\n---\n\n${chatHistoryText}` : '',
      classificationText ? `\n---\n\n${classificationText}` : '',
      '',
      '---',
      '',
      `Client contact: ${clientName ?? 'Unknown'}`,
      `Client email: ${consultation.remitente ?? 'Unknown'}`,
      `Consultation entry number: ${numeroEntrada}`,
      '',
      'Based on all the above, generate the email requesting the missing information and documentation.',
    ]
      .filter((line) => line !== undefined)
      .join('\n')

    // Call OpenRouter (non-streaming)
    const modelName = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL
    const openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    })

    const completion = await openai.chat.completions.create(
      {
        messages: [
          { role: 'system', content: EMAIL_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        model: modelName,
        stream: false,
        temperature: 0.3,
      },
      {
        headers: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'DOA Email Draft Generator',
        },
      },
    )

    const rawContent = completion.choices[0]?.message?.content ?? ''

    // Parse the JSON response from the model
    let parsed: { subject: string; body: string; missingItems: string[] }

    try {
      // Strip markdown code fences if present
      const cleaned = rawContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()

      parsed = JSON.parse(cleaned)
    } catch {
      // If JSON parsing fails, attempt to extract structured data from the raw text
      console.error('Failed to parse email generation response as JSON:', rawContent.slice(0, 200))
      return jsonResponse(
        502,
        'The AI model returned an invalid response format. Please try again.',
      )
    }

    // Validate the parsed response
    if (
      typeof parsed.subject !== 'string' ||
      typeof parsed.body !== 'string' ||
      !Array.isArray(parsed.missingItems)
    ) {
      return jsonResponse(
        502,
        'The AI model returned an incomplete response. Please try again.',
      )
    }

    return Response.json({
      subject: parsed.subject,
      body: parsed.body,
      missingItems: parsed.missingItems,
    })
  } catch (error) {
    console.error('generate-email POST error:', error)
    return jsonResponse(
      500,
      error instanceof Error ? error.message : 'Unexpected server error.',
    )
  }
}
