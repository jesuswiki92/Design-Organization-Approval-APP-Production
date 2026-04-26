/**
 * ============================================================================
 * classify — clasificacion AI del email entrante via OpenRouter
 * ============================================================================
 *
 * Slice 2. Llama directamente al endpoint de OpenRouter con `fetch` (sin SDK
 * para no anadir dependencias). El modelo se toma de la env
 * OPENROUTER_CLASSIFIER_MODEL; fallback `anthropic/claude-sonnet-4.5`.
 *
 * Devuelve siempre un `ClassificationResult` valido — si el LLM responde algo
 * fuera de las tres etiquetas o el JSON no parsea, degrada a
 * "Pending classification" para que el orquestador no aborte el lote.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.5'

const SYSTEM_PROMPT =
  "You are an email classifier for an aeronautical DOA. Analyze the subject and body of the email and return only valid JSON. Use exclusively one of these labels for the 'clasificacion' field: Client requests new project, Client requests modification to existing project, Pending classification. Use 'Client requests new project' when the client presents a need or project from scratch. Use 'Client requests modification to existing project' when the client mentions changes, adjustments, or extensions to an existing project. Use 'Pending classification' if the email is ambiguous or does not allow a confident decision. Return exclusively a JSON object with two keys: clasificacion and razon. razon must be a short sentence in English of maximum 20 words."

export type ClassificationLabel =
  | 'Client requests new project'
  | 'Client requests modification to existing project'
  | 'Pending classification'

export interface ClassificationResult {
  clasificacion: ClassificationLabel
  razon: string
}

const VALID_LABELS: ReadonlySet<ClassificationLabel> = new Set<ClassificationLabel>([
  'Client requests new project',
  'Client requests modification to existing project',
  'Pending classification',
])

const FALLBACK: ClassificationResult = {
  clasificacion: 'Pending classification',
  razon: 'Classifier returned invalid output',
}

interface OpenRouterChoice {
  message?: {
    content?: string | null
  }
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[]
}

function buildUserPrompt(input: {
  subject: string
  senderEmail: string
  bodyPreview: string
}): string {
  return `Clasifica este correo y responde solo json.\n\nASUNTO: ${input.subject}\n\nREMITENTE: ${input.senderEmail}\n\nCUERPO: ${input.bodyPreview}`
}

function parseClassification(raw: string | null | undefined): ClassificationResult {
  if (!raw || typeof raw !== 'string') {
    return { ...FALLBACK }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ...FALLBACK }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ...FALLBACK }
  }

  const obj = parsed as { clasificacion?: unknown; razon?: unknown }
  const label = typeof obj.clasificacion === 'string' ? obj.clasificacion.trim() : ''
  const razon = typeof obj.razon === 'string' ? obj.razon.trim() : ''

  if (!VALID_LABELS.has(label as ClassificationLabel)) {
    return { ...FALLBACK }
  }

  return {
    clasificacion: label as ClassificationLabel,
    razon: razon || 'No reason provided',
  }
}

export async function classifyEmail(input: {
  subject: string
  senderEmail: string
  bodyPreview: string
}): Promise<ClassificationResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'Falta la variable de entorno OPENROUTER_API_KEY. Anadela en .env.local.',
    )
  }

  const model =
    process.env.OPENROUTER_CLASSIFIER_MODEL?.trim() || DEFAULT_MODEL

  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 200,
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3010',
      'X-Title': 'DOA Inbound Email Classifier',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const snippet = (await res.text().catch(() => '')).slice(0, 500)
    throw new Error(`OpenRouter error ${res.status}: ${snippet}`)
  }

  const data = (await res.json()) as OpenRouterResponse
  const content = data.choices?.[0]?.message?.content ?? null
  return parseClassification(content)
}
