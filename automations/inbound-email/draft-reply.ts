/**
 * ============================================================================
 * draft-reply — Draft de respuesta IA al email entrante via OpenRouter
 * ============================================================================
 *
 * Sub-Slice A. Genera el body de un email de respuesta profesional usando dos
 * prompts distintos segun si el remitente es un cliente conocido o no.
 *
 * El placeholder `{{FORM_LINK}}` queda en el texto literalmente; el backend lo
 * sustituira por la URL real del formulario en una fase posterior.
 *
 * Modelo: `OPENROUTER_DRAFT_MODEL` con fallback a `OPENROUTER_CLASSIFIER_MODEL`
 * y, en ultima instancia, a `anthropic/claude-sonnet-4.5`.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.5'
const FORM_LINK_TOKEN = '{{FORM_LINK}}'

const SYSTEM_PROMPT_KNOWN = `You are a professional email writer for an aeronautical Design Organisation (DOA) under EASA Part 21J.

You will receive the client's original email subject and body, along with the client's company name.

This is a KNOWN client that we already have in our system.

Write a professional reply email following these STRICT rules:

1. LANGUAGE: Reply in the SAME language as the client's original email.

2. TONE: Professional, concise, welcoming. No promises about feasibility, timelines, or costs.

3. STRUCTURE:
   - Greeting (use the sender's first name if visible)
   - Thank them for their inquiry
   - Since we already have their company details, explain that we just need the project-specific information to evaluate the request
   - The form will collect the key project details needed for our initial review
   - Include the token {{FORM_LINK}} on its own line where the form link should go. INSERT IT VERBATIM. DO NOT translate, reword, localize, capitalize differently, or alter it. The curly braces and the uppercase word FORM_LINK must be preserved exactly as written. Our backend will substitute {{FORM_LINK}} with the real URL after generation.
   - Mention that once received, we will review and come back with next steps
   - Sign off with:
     Kind regards,
     [Your Name]
     [Title] | [DOA / Company Name]
     [Email] | [Phone]

4. MANDATORY: The token {{FORM_LINK}} MUST appear exactly once in your response, verbatim and untranslated. Never omit it. Never replace it with a different phrase such as "project form", "access the form", or any translation. Output it literally as the seven characters: left-brace, left-brace, F, O, R, M, underscore, L, I, N, K, right-brace, right-brace.

5. Keep it SHORT: 4-6 sentences maximum.`

const SYSTEM_PROMPT_UNKNOWN = `You are a professional email writer for an aeronautical Design Organisation (DOA) under EASA Part 21J.

You will receive the client's original email subject and body.

This is a NEW client that we do NOT have in our system yet.

Write a professional reply email following these STRICT rules:

1. LANGUAGE: Reply in the SAME language as the client's original email.

2. TONE: Professional, concise, welcoming. No promises about feasibility, timelines, or costs.

3. STRUCTURE:
   - Greeting (use the sender's first name if visible)
   - Thank them for their inquiry
   - Explain that we need their company details and project information to evaluate the request
   - The form will collect both company information and project details
   - Include the token {{FORM_LINK}} on its own line where the form link should go. INSERT IT VERBATIM. DO NOT translate, reword, localize, capitalize differently, or alter it. The curly braces and the uppercase word FORM_LINK must be preserved exactly as written. Our backend will substitute {{FORM_LINK}} with the real URL after generation.
   - Mention that once received, we will review and come back with next steps
   - Sign off with:
     Kind regards,
     [Your Name]
     [Title] | [DOA / Company Name]
     [Email] | [Phone]

4. MANDATORY: The token {{FORM_LINK}} MUST appear exactly once in your response, verbatim and untranslated. Never omit it. Never replace it with a different phrase such as "project form", "access the form", or any translation. Output it literally as the seven characters: left-brace, left-brace, F, O, R, M, underscore, L, I, N, K, right-brace, right-brace.

5. Keep it SHORT: 4-6 sentences maximum.`

export interface DraftReplyInput {
  subject: string
  body: string
  senderEmail: string
  companyName: string | null
}

export interface DraftReplyResult {
  body: string
}

interface OpenRouterChoice {
  message?: {
    content?: string | null
  }
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[]
}

function buildUserPrompt(input: DraftReplyInput): string {
  const lines = [
    `Subject: ${input.subject}`,
    `Body: ${input.body}`,
    `Sender: ${input.senderEmail}`,
  ]

  if (input.companyName) {
    lines.push(`Company name: ${input.companyName}`)
  }

  return lines.join('\n')
}

export async function draftReply(input: DraftReplyInput): Promise<DraftReplyResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'Falta la variable de entorno OPENROUTER_API_KEY. Anadela en .env.local.',
    )
  }

  const model =
    process.env.OPENROUTER_DRAFT_MODEL?.trim() ||
    process.env.OPENROUTER_CLASSIFIER_MODEL?.trim() ||
    DEFAULT_MODEL

  const isKnown = input.companyName !== null && input.companyName.trim().length > 0
  const systemPrompt = isKnown ? SYSTEM_PROMPT_KNOWN : SYSTEM_PROMPT_UNKNOWN

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    temperature: 0.4,
    max_tokens: 600,
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3010',
      'X-Title': 'DOA Inbound Email Draft Reply',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const snippet = (await res.text().catch(() => '')).slice(0, 500)
    throw new Error(`OpenRouter draft-reply error ${res.status}: ${snippet}`)
  }

  const data = (await res.json()) as OpenRouterResponse
  const content = (data.choices?.[0]?.message?.content ?? '').trim()

  if (!content) {
    throw new Error('OpenRouter draft-reply error 200: empty response')
  }

  // Defensive: ensure the {{FORM_LINK}} token is present. The system prompt is
  // emphatic about it but LLMs occasionally misbehave; append it on its own
  // line so the downstream substitution still works.
  const finalBody = content.includes(FORM_LINK_TOKEN)
    ? content
    : `${content}\n\n${FORM_LINK_TOKEN}`

  return { body: finalBody }
}
