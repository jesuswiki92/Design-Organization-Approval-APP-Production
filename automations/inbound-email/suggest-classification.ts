/**
 * ============================================================================
 * suggest-classification — AI-assisted Major/Minor classification via OpenRouter
 * ============================================================================
 *
 * Builds a structured prompt from the incoming request + classification trigger
 * catalog + project archetypes catalog and asks Claude to pre-fill the wizard
 * (GT-A..G answers, decision, justification, suggested archetype).
 *
 * Reuses the same OpenRouter direct-fetch pattern as `classify.ts` and
 * `draft-reply.ts` (no SDK). Model is taken from `OPENROUTER_CLASSIFIER_MODEL`
 * with fallback to `anthropic/claude-sonnet-4.5`.
 *
 * The function returns a typed `ClassificationSuggestion` value that the API
 * route forwards verbatim to the client. The schema below mirrors the JSON
 * schema we send to OpenRouter so that we can rely on structured output.
 * ============================================================================
 */

import type {
  ClassificationTrigger,
  IncomingRequest,
  ProjectArchetype,
} from '@/types/database'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.5'
const REQUEST_TIMEOUT_MS = 30_000

// ---------------------------------------------------------------------------
// Public types — exported for the API route + client component.
// ---------------------------------------------------------------------------

export type SuggestionAnswer = 'yes' | 'no' | 'unknown'
export type SuggestionDecision = 'major' | 'minor' | 'unknown'
export type SuggestionConfidence = 'high' | 'medium' | 'low'

export interface SuggestionTriggerEntry {
  answer: SuggestionAnswer
  reason: string
}

export interface ClassificationSuggestion {
  decision: SuggestionDecision
  is_repair: boolean
  suggested_archetype_code: string | null
  archetype_confidence: SuggestionConfidence
  triggers: {
    'GT-A': SuggestionTriggerEntry
    'GT-B': SuggestionTriggerEntry
    'GT-C': SuggestionTriggerEntry
    'GT-D': SuggestionTriggerEntry
    'GT-E': SuggestionTriggerEntry
    'GT-F': SuggestionTriggerEntry
    'GT-G': SuggestionTriggerEntry
  }
  repair_triggers: Record<string, SuggestionTriggerEntry> | null
  justification: string
  similar_reference_projects: string[]
  confidence_overall: SuggestionConfidence
  model_used: string
}

// ---------------------------------------------------------------------------
// System prompt — concise but rigorous.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a senior EASA Part-21J Design Organisation Approval (DOA) classification assistant.

Your job: classify a proposed change to an aircraft type design as Major or Minor, per GM 21.A.91 (Issue 2 Amdt 17).

Use the following authoritative framework:

GENERIC TRIGGERS (any positive answer forces MAJOR):
- GT-A: Change to general configuration.
- GT-B: Change to principles of construction.
- GT-C: Assumptions used for certification invalidated.
- GT-D: Appreciable effect on weight, balance, structural strength, reliability, operational characteristics, noise, fuel venting, exhaust emission.
- GT-E: Adjustment of certification basis or new interpretation of CS / FAR.
- GT-F: Compliance demonstration not previously accepted (novel MoC, CRI).
- GT-G: Limitations approved by the Agency are altered (AFM, MTOW, MMEL, operating envelope).

If the request describes a REPAIR rather than a modification, also consider GM 21.A.435: repair affecting Principal Structural Elements (PSE), repair requiring extensive substantiation, repair at a sensitive area, repeat repair, or repair invalidating a previous Major Repair.

Output rules:
- Be conservative: if there is genuine doubt, classify as Major.
- Only mark a trigger as 'yes' when there is clear textual evidence in the input. Cite the evidence in 'reason'.
- Mark 'unknown' only when information is genuinely missing — not as a substitute for analysis.
- If ALL triggers are 'no', the decision must be 'minor'.
- If ANY trigger is 'yes', the decision must be 'major'.
- If any trigger is 'unknown' AND none are 'yes', you MAY return 'unknown' for decision, but prefer 'major' under the conservative principle.
- Justification must explicitly cite trigger codes (GT-X) and the archetype that best matches.
- 'similar_reference_projects' is optional — leave it empty if no internal project codes are visible in the prompt context.

Respond ONLY with the JSON object that conforms to the schema. No prose, no markdown.`

// ---------------------------------------------------------------------------
// Prompt builder — XML-style payload for clarity.
// ---------------------------------------------------------------------------

function escapeXml(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = typeof value === 'string' ? value : String(value)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildArchetypeBlock(archetypes: ProjectArchetype[]): string {
  if (archetypes.length === 0) return '<archetypes>(empty)</archetypes>'
  const items = archetypes
    .map(
      (a) =>
        `  <archetype code="${escapeXml(a.code)}" typical_classification="${escapeXml(a.typical_classification)}">\n    <title>${escapeXml(a.title)}</title>\n    <description>${escapeXml(a.description ?? '')}</description>\n  </archetype>`,
    )
    .join('\n')
  return `<archetypes>\n${items}\n</archetypes>`
}

function buildTriggerBlock(triggers: ClassificationTrigger[]): string {
  if (triggers.length === 0) return '<triggers>(empty)</triggers>'
  const items = triggers
    .map(
      (t) =>
        `  <trigger code="${escapeXml(t.code)}" severity="${escapeXml(t.severity)}" source="${escapeXml(t.source_ref ?? '')}">\n    <label>${escapeXml(t.label)}</label>\n    <explanation>${escapeXml(t.short_explanation ?? '')}</explanation>\n  </trigger>`,
    )
    .join('\n')
  return `<triggers>\n${items}\n</triggers>`
}

function buildIncomingBlock(incoming: IncomingRequest): string {
  return [
    '<incoming>',
    `  <entry_number>${escapeXml(incoming.entry_number)}</entry_number>`,
    `  <subject>${escapeXml(incoming.subject)}</subject>`,
    `  <sender>${escapeXml(incoming.sender)}</sender>`,
    '  <aircraft>',
    `    <manufacturer>${escapeXml(incoming.aircraft_manufacturer)}</manufacturer>`,
    `    <model>${escapeXml(incoming.aircraft_model)}</model>`,
    `    <count>${escapeXml(incoming.aircraft_count)}</count>`,
    `    <msn>${escapeXml(incoming.aircraft_msn)}</msn>`,
    `    <tcds>${escapeXml(incoming.tcds_number)}</tcds>`,
    `    <location>${escapeXml(incoming.aircraft_location)}</location>`,
    '  </aircraft>',
    `  <work_type>${escapeXml(incoming.work_type)}</work_type>`,
    `  <existing_project_code>${escapeXml(incoming.existing_project_code)}</existing_project_code>`,
    `  <modification_summary>${escapeXml(incoming.modification_summary)}</modification_summary>`,
    `  <operational_goal>${escapeXml(incoming.operational_goal)}</operational_goal>`,
    '  <impacts>',
    `    <pressurized>${escapeXml(incoming.impact_pressurized)}</pressurized>`,
    `    <structural_attachment>${escapeXml(incoming.impact_structural_attachment)}</structural_attachment>`,
    `    <structural_interface>${escapeXml(incoming.impact_structural_interface)}</structural_interface>`,
    `    <electrical>${escapeXml(incoming.impact_electrical)}</electrical>`,
    `    <avionics>${escapeXml(incoming.impact_avionics)}</avionics>`,
    `    <cabin_layout>${escapeXml(incoming.impact_cabin_layout)}</cabin_layout>`,
    `    <location>${escapeXml(incoming.impact_location)}</location>`,
    `    <operational_change>${escapeXml(incoming.impact_operational_change)}</operational_change>`,
    '  </impacts>',
    '  <booleans>',
    `    <is_aog>${escapeXml(incoming.is_aog)}</is_aog>`,
    `    <has_drawings>${escapeXml(incoming.has_drawings)}</has_drawings>`,
    `    <has_equipment>${escapeXml(incoming.has_equipment)}</has_equipment>`,
    `    <has_previous_mod>${escapeXml(incoming.has_previous_mod)}</has_previous_mod>`,
    `    <has_manufacturer_docs>${escapeXml(incoming.has_manufacturer_docs)}</has_manufacturer_docs>`,
    `    <affects_primary_structure>${escapeXml(incoming.affects_primary_structure)}</affects_primary_structure>`,
    `    <related_to_ad>${escapeXml(incoming.related_to_ad)}</related_to_ad>`,
    '  </booleans>',
    `  <ad_reference>${escapeXml(incoming.ad_reference)}</ad_reference>`,
    `  <weight_kg>${escapeXml(incoming.installation_weight_kg)}</weight_kg>`,
    `  <fuselage_position>${escapeXml(incoming.fuselage_position)}</fuselage_position>`,
    `  <sta_location>${escapeXml(incoming.sta_location)}</sta_location>`,
    `  <equipment_details>${escapeXml(incoming.equipment_details)}</equipment_details>`,
    `  <previous_mod_ref>${escapeXml(incoming.previous_mod_ref)}</previous_mod_ref>`,
    `  <additional_notes>${escapeXml(incoming.additional_notes)}</additional_notes>`,
    `  <body><![CDATA[${(incoming.original_body ?? '').slice(0, 8000)}]]></body>`,
    '</incoming>',
  ].join('\n')
}

function buildUserPrompt(input: {
  incoming: IncomingRequest
  triggers: ClassificationTrigger[]
  archetypes: ProjectArchetype[]
}): string {
  return [
    'Classify the following incoming aeronautical change request. Use the supplied trigger catalog and archetype list. Respond ONLY with the JSON object.',
    '',
    buildIncomingBlock(input.incoming),
    '',
    buildArchetypeBlock(input.archetypes),
    '',
    'Generic triggers reminder (the same as in the system prompt, repeated here with the catalog metadata):',
    buildTriggerBlock(input.triggers),
  ].join('\n')
}

// ---------------------------------------------------------------------------
// JSON schema for OpenRouter structured output.
// ---------------------------------------------------------------------------

const TRIGGER_OBJECT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answer: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    reason: { type: 'string' },
  },
  required: ['answer', 'reason'],
} as const

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    decision: { type: 'string', enum: ['major', 'minor', 'unknown'] },
    is_repair: { type: 'boolean' },
    suggested_archetype_code: { type: ['string', 'null'] },
    archetype_confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    triggers: {
      type: 'object',
      additionalProperties: false,
      properties: {
        'GT-A': TRIGGER_OBJECT_SCHEMA,
        'GT-B': TRIGGER_OBJECT_SCHEMA,
        'GT-C': TRIGGER_OBJECT_SCHEMA,
        'GT-D': TRIGGER_OBJECT_SCHEMA,
        'GT-E': TRIGGER_OBJECT_SCHEMA,
        'GT-F': TRIGGER_OBJECT_SCHEMA,
        'GT-G': TRIGGER_OBJECT_SCHEMA,
      },
      required: ['GT-A', 'GT-B', 'GT-C', 'GT-D', 'GT-E', 'GT-F', 'GT-G'],
    },
    repair_triggers: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        'RP-1': TRIGGER_OBJECT_SCHEMA,
        'RP-2': TRIGGER_OBJECT_SCHEMA,
        'RP-3': TRIGGER_OBJECT_SCHEMA,
        'RP-4': TRIGGER_OBJECT_SCHEMA,
        'RP-5': TRIGGER_OBJECT_SCHEMA,
      },
    },
    justification: { type: 'string' },
    similar_reference_projects: {
      type: 'array',
      items: { type: 'string' },
    },
    confidence_overall: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: [
    'decision',
    'is_repair',
    'suggested_archetype_code',
    'archetype_confidence',
    'triggers',
    'justification',
    'similar_reference_projects',
    'confidence_overall',
  ],
} as const

// ---------------------------------------------------------------------------
// OpenRouter call + parsing.
// ---------------------------------------------------------------------------

interface OpenRouterChoice {
  message?: {
    content?: string | null
  }
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[]
}

const TRIGGER_CODES = ['GT-A', 'GT-B', 'GT-C', 'GT-D', 'GT-E', 'GT-F', 'GT-G'] as const

function isAnswer(value: unknown): value is SuggestionAnswer {
  return value === 'yes' || value === 'no' || value === 'unknown'
}

function isConfidence(value: unknown): value is SuggestionConfidence {
  return value === 'high' || value === 'medium' || value === 'low'
}

function normalizeTrigger(value: unknown): SuggestionTriggerEntry {
  if (!value || typeof value !== 'object') {
    return { answer: 'unknown', reason: 'Model returned no value' }
  }
  const obj = value as { answer?: unknown; reason?: unknown }
  return {
    answer: isAnswer(obj.answer) ? obj.answer : 'unknown',
    reason: typeof obj.reason === 'string' ? obj.reason : '',
  }
}

function parseSuggestion(
  raw: string | null | undefined,
  modelUsed: string,
): ClassificationSuggestion {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty content from OpenRouter')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    throw new Error(`Could not parse model JSON: ${message}`)
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Model JSON is not an object')
  }

  const obj = parsed as Record<string, unknown>

  const decision: SuggestionDecision =
    obj.decision === 'major' || obj.decision === 'minor' || obj.decision === 'unknown'
      ? obj.decision
      : 'unknown'

  const isRepair = typeof obj.is_repair === 'boolean' ? obj.is_repair : false

  const suggestedArchetype =
    typeof obj.suggested_archetype_code === 'string'
      ? obj.suggested_archetype_code
      : null

  const archetypeConfidence: SuggestionConfidence = isConfidence(obj.archetype_confidence)
    ? obj.archetype_confidence
    : 'low'

  const triggersRaw = (obj.triggers ?? {}) as Record<string, unknown>
  const triggers = {
    'GT-A': normalizeTrigger(triggersRaw['GT-A']),
    'GT-B': normalizeTrigger(triggersRaw['GT-B']),
    'GT-C': normalizeTrigger(triggersRaw['GT-C']),
    'GT-D': normalizeTrigger(triggersRaw['GT-D']),
    'GT-E': normalizeTrigger(triggersRaw['GT-E']),
    'GT-F': normalizeTrigger(triggersRaw['GT-F']),
    'GT-G': normalizeTrigger(triggersRaw['GT-G']),
  }

  // Repair triggers — best-effort, allow any code (RP-1, RP-2, …) the model returns.
  let repairTriggers: Record<string, SuggestionTriggerEntry> | null = null
  if (
    obj.repair_triggers &&
    typeof obj.repair_triggers === 'object' &&
    !Array.isArray(obj.repair_triggers)
  ) {
    const map: Record<string, SuggestionTriggerEntry> = {}
    for (const [k, v] of Object.entries(obj.repair_triggers as Record<string, unknown>)) {
      map[k] = normalizeTrigger(v)
    }
    repairTriggers = map
  }

  const justification =
    typeof obj.justification === 'string' && obj.justification.trim().length > 0
      ? obj.justification.trim()
      : 'No justification provided by the model.'

  const similarRefs = Array.isArray(obj.similar_reference_projects)
    ? (obj.similar_reference_projects as unknown[])
        .filter((v): v is string => typeof v === 'string')
        .slice(0, 3)
    : []

  const overallConfidence: SuggestionConfidence = isConfidence(obj.confidence_overall)
    ? obj.confidence_overall
    : 'low'

  // Avoid lint warning for unused TRIGGER_CODES if we ever drop a key.
  void TRIGGER_CODES

  return {
    decision,
    is_repair: isRepair,
    suggested_archetype_code: suggestedArchetype,
    archetype_confidence: archetypeConfidence,
    triggers,
    repair_triggers: repairTriggers,
    justification,
    similar_reference_projects: similarRefs,
    confidence_overall: overallConfidence,
    model_used: modelUsed,
  }
}

// ---------------------------------------------------------------------------
// Public entrypoint.
// ---------------------------------------------------------------------------

export class ClassifierNotConfiguredError extends Error {
  constructor() {
    super('AI assistant not configured: OPENROUTER_API_KEY missing')
    this.name = 'ClassifierNotConfiguredError'
  }
}

export class ClassifierTimeoutError extends Error {
  constructor() {
    super(`OpenRouter request timed out after ${REQUEST_TIMEOUT_MS}ms`)
    this.name = 'ClassifierTimeoutError'
  }
}

export async function suggestClassification(input: {
  incoming: IncomingRequest
  triggers: ClassificationTrigger[]
  archetypes: ProjectArchetype[]
}): Promise<ClassificationSuggestion> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    throw new ClassifierNotConfiguredError()
  }

  const model =
    process.env.OPENROUTER_CLASSIFIER_MODEL?.trim() || DEFAULT_MODEL

  const userPrompt = buildUserPrompt(input)

  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'classification_suggestion',
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
    temperature: 0.1,
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://forms.aeroaplications.com',
        'X-Title': 'DOA Operations Hub - Classification Assist',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ClassifierTimeoutError()
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const snippet = (await response.text().catch(() => '')).slice(0, 500)
    throw new Error(`OpenRouter error ${response.status}: ${snippet}`)
  }

  const data = (await response.json()) as OpenRouterResponse
  const content = data.choices?.[0]?.message?.content ?? null

  console.log('[suggest-classification] raw model content:', content)

  return parseSuggestion(content, model)
}
