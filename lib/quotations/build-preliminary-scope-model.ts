import type { Phase4ProjectBaseline } from '@/lib/project-summary-phase4'
import type { IncomingRequest } from '@/types/database'

type MaybeString = string | null | undefined

type PreliminaryScopeImpactDiscipline =
  | 'Structures'
  | 'Avionics'
  | 'Electrical'
  | 'Interiors'
  | 'Flammability'
  | 'Weights and Balance'
  | 'Instructions for Continued Airworthiness'
  | 'Flight Manual / Operational'
  | 'Certification / Compliance'
  | 'Production / Installation'
type PreliminaryScopeInferenceKey =
  | 'preliminary-engineering-reading'
  | 'baseline-continuity'
  | 'preliminary-certification-route'
  | 'preliminary-scope-hypothesis'
  | 'expected-engineering-focus'
  | 'confidence'

type PreliminaryScopeImpactDefinition = {
  baselineAliases: string[]
  directKeywords: string[]
  discipline: PreliminaryScopeImpactDiscipline
  notExpectedReason: string
  possibleKeywords: string[]
  possibleReason: string
  probableReason: string
}

type PreliminaryScopeImpactSignals = {
  hasCabinSignal: boolean
  hasCertificationContext: boolean
  hasEquipmentSignal: boolean
  hasInstallationSignal: boolean
  hasManualSignal: boolean
  hasNonMetallicSignal: boolean
  hasOperationalChangeSignal: boolean
  hasOperationalSystemSignal: boolean
}

type PreliminaryScopeImpactMatch = {
  fromBaseline: boolean
  fromRequest: boolean
}

type PreliminaryScopeContinuityAssessment = {
  detail: string
  highlight: string | null
}

export type PreliminaryScopeAircraftVariant = {
  manufacturer: string
  model: string
  eligible_msns: string
  mtow_kg: number | null
  base_regulation: string
  tcds_code: string
  tcds_code_short: string
}

export type PreliminaryScopeReferenceProject = {
  aircraft: string | null
  year: number | null
  baseline: Phase4ProjectBaseline
  created_at: string | null
  id: string
  project_number: string | null
  summary_md: string | null
  title: string | null
}

export type PreliminaryScopeModelInput = {
  clientLabel?: string | null
  consultation: IncomingRequest
  primaryAircraftVariant?: PreliminaryScopeAircraftVariant | null
  referenceProjects?: PreliminaryScopeReferenceProject[]
}

export type PreliminaryScopeMetric = {
  label: string
  value: string
}

export type PreliminaryScopeFact = {
  label: string
  value: string
}

export type PreliminaryScopeImpactStatus = 'probable' | 'possible' | 'not expected yet'

export type PreliminaryScopeImpact = {
  discipline: PreliminaryScopeImpactDiscipline
  rationale: string
  status: PreliminaryScopeImpactStatus
}

export type PreliminaryScopeInferenceItem = {
  key: PreliminaryScopeInferenceKey
  label: string
  value: string
}

export type PreliminaryScopeModel = {
  baseContribution: string[]
  clientProvided: PreliminaryScopeFact[]
  confidence: {
    label: 'Alta' | 'Media' | 'Baja'
    reasons: string[]
    score: number
  }
  context: {
    aircraftLabel: string
    chosenReferenceId: string | null
    chosenReferenceLabel: string
    clientLabel: string
    referenceCount: number
  }
  doaInference: PreliminaryScopeInferenceItem[]
  evidence: {
    precedentUnknowns: string[]
    rawSummaryMd: string | null
    summaryExcerpt: string | null
    tcdsNotes: string[]
  }
  impacts: PreliminaryScopeImpact[]
  missingInfo: {
    askClient: string[]
    internalValidation: string[]
  }
  proposedScope: {
    continuity: string | null
    headline: string
    metrics: PreliminaryScopeMetric[]
    summary: string
  }
  suggestedQuestions: string[]
}

const IMPACT_DEFINITIONS: PreliminaryScopeImpactDefinition[] = [
  {
    baselineAliases: ['estructural', 'estructural impact', 'structures', 'structure', 'support'],
    directKeywords: [
      'antenna',
      'bracket',
      'cutout',
      'doublers',
      'fuselage',
      'mount',
      'radome',
      'reinforcement',
      'skin',
      'structural',
      'structure',
      'support',
    ],
    discipline: 'Structures',
    notExpectedReason: 'No aparece todavia un indicio claro de delta estructural mas alla del montaje general.',
    possibleKeywords: ['fairing', 'installation', 'integrat', 'retrofit'],
    possibleReason: 'Si el embodiment acaba exigiendo soportes, refuerzos o tratamiento local, podria abrirse trabajo estructural.',
    probableReason: 'La integracion preliminar apunta a fijaciones, soportes o tratamiento estructural en la zona de instalacion.',
  },
  {
    baselineAliases: ['avionics', 'avionica', 'electronic equipment'],
    directKeywords: [
      'antenna',
      'avionic',
      'avionics',
      'com',
      'communication',
      'efb',
      'fms',
      'gps',
      'ifec',
      'iridium',
      'nav',
      'radome',
      'satcom',
      'transponder',
      'wifi',
    ],
    discipline: 'Avionics',
    notExpectedReason: 'No hay evidencia suficiente de interfaces funcionales o de sistema avionico.',
    possibleKeywords: ['equipment', 'install', 'system'],
    possibleReason: 'Si el equipo termina siendo parte de un sistema embarcado, habra que abrir la disciplina avionica.',
    probableReason: 'La lectura preliminar encaja con integracion de sistema o equipo avionico y sus interfaces funcionales.',
  },
  {
    baselineAliases: ['electrico', 'electrical', 'ewis', 'wiring'],
    directKeywords: [
      'breaker',
      'cable',
      'connector',
      'electrical',
      'electrico',
      'ewis',
      'harness',
      'load',
      'power',
      'wiring',
    ],
    discipline: 'Electrical',
    notExpectedReason: 'Aun no hay evidencia suficiente de una carga o interfaz electrica concreta.',
    possibleKeywords: ['antenna', 'avionics', 'equipment', 'install', 'radome', 'system'],
    possibleReason: 'Si la integracion confirma alimentacion, protecciones o cableado, esta disciplina pasara a ser probable.',
    probableReason: 'Una integracion de este type suele arrastrar alimentacion, protecciones, cableado o EWIS asociado.',
  },
  {
    baselineAliases: ['cabin', 'cabina', 'interior', 'interiors', 'monument'],
    directKeywords: [
      'cabina',
      'cabin',
      'galley',
      'interior',
      'interiors',
      'liner',
      'monument',
      'panel',
      'placard',
      'seat',
      'sidewall',
    ],
    discipline: 'Interiors',
    notExpectedReason: 'No hay evidencia de actuacion sobre monumentos, sidewalls o elementos propios de interiores.',
    possibleKeywords: ['access panel', 'close-out', 'cabin area'],
    possibleReason: 'Podria abrirse si la instalacion invade realmente zonas de cabina o requiere acabados interiores.',
    probableReason: 'La informacion disponible apunta a una actuacion directa sobre elementos de cabina o interiores.',
  },
  {
    baselineAliases: ['burn', 'flammability', 'fire', 'material'],
    directKeywords: [
      'burn',
      'flammability',
      'fire block',
      'lining',
      'material',
      'sidewall',
      'upholstery',
    ],
    discipline: 'Flammability',
    notExpectedReason: 'No se ve todavia evidencia directa de materiales interiores o close-outs sujetos a flammability.',
    possibleKeywords: ['close-out', 'composite', 'fairing', 'panel', 'radome'],
    possibleReason: 'Si aparecen fairings, close-outs o materiales no metalicos, podria abrirse una review de flammability.',
    probableReason: 'La modificacion parece tocar materiales o acabados que exigen una review explicita de flammability.',
  },
  {
    baselineAliases: ['mass', 'weight', 'weight and balance', 'weights'],
    directKeywords: ['arm', 'balance', 'cg', 'mass', 'moment', 'peso', 'weight'],
    discipline: 'Weights and Balance',
    notExpectedReason: 'No hay data suficientes para asegurar un delta de masa o brazo, aunque sigue siendo una validation tipica.',
    possibleKeywords: ['antenna', 'equipment', 'install', 'installation', 'kit', 'radome'],
    possibleReason: 'Si el hardware new queda confirmado, habra que revisar el delta de masa y brazo.',
    probableReason: 'La instalacion de hardware new suele arrastrar review de masa, brazo y weight and balance.',
  },
  {
    baselineAliases: ['ica', 'instructions', 'maintenance', 'manual'],
    directKeywords: ['amm', 'ica', 'instructions', 'ipc', 'manual', 'maintenance', 'supplement'],
    discipline: 'Instructions for Continued Airworthiness',
    notExpectedReason: 'No hay todavia evidencia directa de una actualizacion documental de mantenimiento concreta.',
    possibleKeywords: ['antenna', 'equipment', 'install', 'installation', 'radome', 'system'],
    possibleReason: 'Si el embodiment y el equipo quedan fijados, podria requerirse actualizacion de ICA o mantenimiento.',
    probableReason: 'Una instalacion de este type suele arrastrar ICA, instrucciones de mantenimiento o documentacion equivalente.',
  },
  {
    baselineAliases: ['afm', 'flight manual', 'operational', 'operations'],
    directKeywords: ['afm', 'dispatch', 'flight manual', 'limitations', 'mel', 'operational', 'supplement'],
    discipline: 'Flight Manual / Operational',
    notExpectedReason: 'No se ve aun una limitacion operacional o suplemento de manual claramente disparado.',
    possibleKeywords: ['antenna', 'communication', 'gps', 'nav', 'satcom', 'system'],
    possibleReason: 'Podria requerirse suplemento o limitacion operacional si la funcion instalada cambia el uso del avion.',
    probableReason: 'La evidencia actual ya sugiere una review operacional o de Flight Manual.',
  },
  {
    baselineAliases: ['certification', 'classification', 'compliance', 'part 21'],
    directKeywords: ['certification', 'classification', 'compliance', 'cri', 'means of compliance', 'part 21'],
    discipline: 'Certification / Compliance',
    notExpectedReason: 'No hay todavia base suficiente para close la path, pero la disciplina sigue siendo necesaria para cualquier alcance.',
    possibleKeywords: ['approval', 'basis', 'cs-25', 'regulacion'],
    possibleReason: 'La path existe, pero aun necesita closure formal de classification, base y medios de cumplimiento.',
    probableReason: 'La classification y el plan de compliance deben fijarse internamente desde el arranque del alcance preliminar.',
  },
  {
    baselineAliases: ['installation', 'production', 'shop', 'work instructions'],
    directKeywords: ['embodiment', 'install', 'installation', 'kit', 'production', 'shop', 'work instructions'],
    discipline: 'Production / Installation',
    notExpectedReason: 'Aun no hay detalle suficiente para asegurar data de embodiment o soporte a produccion.',
    possibleKeywords: ['antenna', 'equipment', 'mount', 'radome', 'retrofit'],
    possibleReason: 'Si la solucion queda confirmada como embodiment fisico, podria requerirse soporte a produccion o instalacion.',
    probableReason: 'La lectura preliminar apunta a embodiment, instrucciones de instalacion o coordinacion con produccion/MRO.',
  },
]

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function cleanText(value: MaybeString) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function compact<T>(items: Array<T | null | undefined | false>) {
  return items.filter(Boolean) as T[]
}

function dedupe(items: Array<string | null | undefined>) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const item of items) {
    const cleaned = cleanText(item)
    if (!cleaned) continue
    const key = normalizeText(cleaned)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(cleaned)
  }

  return result
}

function containsAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(normalizeText(keyword)))
}

function formatYesNo(value: MaybeString) {
  if (value === 'yes') return 'Si'
  if (value === 'no') return 'No'
  if (value === 'not_sure') return 'No seguro'
  if (value === 'not_applicable') return 'No aplica'
  return 'Sin confirmar'
}

function looselyMatches(left: MaybeString, right: MaybeString) {
  const a = cleanText(left)
  const b = cleanText(right)
  if (!a || !b) return false

  const normalizedA = normalizeText(a)
  const normalizedB = normalizeText(b)

  return (
    normalizedA === normalizedB ||
    normalizedA.includes(normalizedB) ||
    normalizedB.includes(normalizedA)
  )
}

function buildAircraftLabel(consultation: IncomingRequest) {
  return (
    cleanText([consultation.aircraft_manufacturer, consultation.aircraft_model].filter(Boolean).join(' ')) ??
    'Aircraft pending de confirmar'
  )
}

function buildReferenceLabel(reference: PreliminaryScopeReferenceProject | null | undefined) {
  if (!reference) return 'Sin precedente seleccionado'
  return (
    cleanText([reference.project_number, reference.title].filter(Boolean).join(' - ')) ??
    reference.project_number ??
    reference.title ??
    'Precedente sin identificar'
  )
}

function getChosenReference(referenceProjects: PreliminaryScopeReferenceProject[]) {
  return referenceProjects[0] ?? null
}

function buildRequestText(consultation: IncomingRequest) {
  return normalizeText(
    [
      consultation.subject,
      consultation.modification_summary,
      consultation.operational_goal,
      consultation.equipment_details,
      consultation.additional_notes,
    ]
      .filter(Boolean)
      .join(' '),
  )
}

function buildBaselineText(chosenReference: PreliminaryScopeReferenceProject | null) {
  return normalizeText(
    [
      chosenReference?.baseline.scopeBaseline,
      chosenReference?.baseline.classificationBaseline,
      chosenReference?.baseline.certificationBasisBaseline,
      ...compact(chosenReference?.baseline.impactedDisciplines ?? []),
      ...compact(chosenReference?.baseline.impactAreas ?? []),
      ...compact(chosenReference?.baseline.documentPackageBaseline ?? []),
    ]
      .filter(Boolean)
      .join(' '),
  )
}

function buildImpactSignals(
  consultation: IncomingRequest,
  chosenReference: PreliminaryScopeReferenceProject | null,
  primaryAircraftVariant: PreliminaryScopeAircraftVariant | null | undefined,
  requestText: string,
  baselineText: string,
): PreliminaryScopeImpactSignals {
  const combinedText = `${requestText} ${baselineText}`

  return {
    hasCabinSignal:
      containsAny(combinedText, ['cabina', 'cabin', 'interior', 'liner', 'monument', 'seat', 'sidewall']) ||
      containsAny(baselineText, ['interiors']),
    hasCertificationContext:
      Boolean(
        cleanText(consultation.modification_summary) ||
          cleanText(consultation.subject) ||
          cleanText(chosenReference?.baseline.classificationBaseline) ||
          cleanText(chosenReference?.baseline.certificationBasisBaseline) ||
          cleanText(primaryAircraftVariant?.base_regulation) ||
          cleanText(primaryAircraftVariant?.tcds_code),
      ),
    hasEquipmentSignal:
      consultation.has_equipment === 'yes' ||
      containsAny(combinedText, ['antenna', 'avionics', 'equipment', 'kit', 'radome', 'satcom', 'system']),
    hasInstallationSignal:
      containsAny(combinedText, [
        'antenna',
        'embodiment',
        'install',
        'installation',
        'integrat',
        'kit',
        'mount',
        'radome',
        'retrofit',
        'support',
      ]),
    hasManualSignal: containsAny(combinedText, ['amm', 'ica', 'instructions', 'ipc', 'manual', 'maintenance', 'supplement']),
    hasNonMetallicSignal: containsAny(combinedText, ['close-out', 'composite', 'fairing', 'panel', 'radome']),
    hasOperationalChangeSignal:
      Boolean(cleanText(consultation.operational_goal)) ||
      containsAny(combinedText, ['dispatch', 'flight manual', 'limitations', 'mel', 'operational', 'supplement']),
    hasOperationalSystemSignal:
      containsAny(combinedText, [
        'antenna',
        'avionic',
        'avionics',
        'com',
        'communication',
        'efb',
        'fms',
        'gps',
        'ifec',
        'nav',
        'radome',
        'satcom',
        'transponder',
        'wifi',
      ]),
  }
}

function buildImpactMatch(
  definition: PreliminaryScopeImpactDefinition,
  requestText: string,
  baselineText: string,
): PreliminaryScopeImpactMatch {
  return {
    fromBaseline: containsAny(baselineText, [
      ...definition.directKeywords,
      ...definition.baselineAliases,
      ...definition.possibleKeywords,
    ]),
    fromRequest: containsAny(requestText, [
      ...definition.directKeywords,
      ...definition.possibleKeywords,
    ]),
  }
}

function buildImpactStatus(
  definition: PreliminaryScopeImpactDefinition,
  match: PreliminaryScopeImpactMatch,
  signals: PreliminaryScopeImpactSignals,
): PreliminaryScopeImpactStatus {
  if (match.fromRequest || match.fromBaseline) {
    return 'probable'
  }

  switch (definition.discipline) {
    case 'Structures':
      return signals.hasInstallationSignal && signals.hasOperationalSystemSignal
        ? 'probable'
        : signals.hasInstallationSignal
          ? 'possible'
          : 'not expected yet'
    case 'Avionics':
      return signals.hasOperationalSystemSignal
        ? 'probable'
        : signals.hasEquipmentSignal
          ? 'possible'
          : 'not expected yet'
    case 'Electrical':
      return signals.hasInstallationSignal && (signals.hasOperationalSystemSignal || signals.hasEquipmentSignal)
        ? 'probable'
        : signals.hasEquipmentSignal
          ? 'possible'
          : 'not expected yet'
    case 'Interiors':
      return signals.hasCabinSignal ? 'possible' : 'not expected yet'
    case 'Flammability':
      return signals.hasNonMetallicSignal || signals.hasCabinSignal ? 'possible' : 'not expected yet'
    case 'Weights and Balance':
      return signals.hasInstallationSignal || signals.hasEquipmentSignal
        ? 'probable'
        : signals.hasOperationalSystemSignal
          ? 'possible'
          : 'not expected yet'
    case 'Instructions for Continued Airworthiness':
      return signals.hasInstallationSignal || signals.hasManualSignal || signals.hasEquipmentSignal
        ? 'probable'
        : signals.hasOperationalSystemSignal
          ? 'possible'
          : 'not expected yet'
    case 'Flight Manual / Operational':
      return signals.hasOperationalChangeSignal
        ? 'probable'
        : signals.hasOperationalSystemSignal
          ? 'possible'
          : 'not expected yet'
    case 'Certification / Compliance':
      return signals.hasCertificationContext ? 'probable' : 'possible'
    case 'Production / Installation':
      return signals.hasInstallationSignal || signals.hasEquipmentSignal
        ? 'probable'
        : signals.hasCertificationContext
          ? 'possible'
          : 'not expected yet'
  }
}

function buildImpactRationale(
  definition: PreliminaryScopeImpactDefinition,
  status: PreliminaryScopeImpactStatus,
  match: PreliminaryScopeImpactMatch,
) {
  if (status === 'not expected yet') {
    return definition.notExpectedReason
  }

  const baseReason =
    status === 'probable' ? definition.probableReason : definition.possibleReason

  const sourceNote =
    match.fromRequest && match.fromBaseline
      ? 'La solicitud y el precedente apuntan en la misma address.'
      : match.fromRequest
        ? 'La inferencia nace de la solicitud actual.'
        : match.fromBaseline
          ? 'El precedente deja rastro util de esta disciplina.'
          : 'Se mantiene como inferencia conservadora por la naturaleza tipica de la integracion.'

  return `${baseReason} ${sourceNote}`
}

function detectImpacts(
  consultation: IncomingRequest,
  chosenReference: PreliminaryScopeReferenceProject | null,
  primaryAircraftVariant: PreliminaryScopeAircraftVariant | null | undefined,
) {
  const requestText = buildRequestText(consultation)
  const baselineText = buildBaselineText(chosenReference)
  const signals = buildImpactSignals(
    consultation,
    chosenReference,
    primaryAircraftVariant,
    requestText,
    baselineText,
  )

  return IMPACT_DEFINITIONS.map((definition) => {
    const match = buildImpactMatch(definition, requestText, baselineText)
    const status = buildImpactStatus(definition, match, signals)

    return {
      discipline: definition.discipline,
      rationale: buildImpactRationale(definition, status, match),
      status,
    } satisfies PreliminaryScopeImpact
  })
}

function buildClientProvidedFacts(
  consultation: IncomingRequest,
  aircraftLabel: string,
) {
  return [
    {
      label: 'Solicitud',
      value:
        cleanText(consultation.modification_summary) ??
        cleanText(consultation.subject) ??
        'Sin description technical suficiente',
    },
    {
      label: 'Objetivo operativo',
      value: cleanText(consultation.operational_goal) ?? 'No declarado',
    },
    {
      label: 'Aircraft reportada',
      value: aircraftLabel,
    },
    {
      label: 'MSN / effectivity',
      value: cleanText(consultation.aircraft_msn) ?? 'No indicado',
    },
    {
      label: 'TCDS aportado',
      value: cleanText(consultation.tcds_number) ?? 'No indicado',
    },
    {
      label: 'Tipo de trabajo solicitado',
      value:
        consultation.work_type === 'new_project'
          ? 'Project new'
          : consultation.work_type === 'existing_modification'
            ? `Modificacion sobre existente${consultation.existing_project_code ? ` (${consultation.existing_project_code})` : ''}`
            : 'No definido',
    },
    {
      label: 'Equipo / kit disponible',
      value:
        consultation.has_equipment === 'yes'
          ? cleanText(consultation.equipment_details) ?? 'Client indica que dispone de equipo'
          : formatYesNo(consultation.has_equipment),
    },
    {
      label: 'Planos y docs OEM',
      value: `Planos: ${formatYesNo(consultation.has_drawings)} | OEM: ${formatYesNo(consultation.has_manufacturer_docs)}`,
    },
    {
      label: 'Precedente que cita el client',
      value:
        consultation.has_previous_mod === 'yes'
          ? cleanText(consultation.previous_mod_ref) ?? 'Existe precedente, sin referencia concreta'
          : formatYesNo(consultation.has_previous_mod),
    },
    {
      label: 'Date / urgencia',
      value:
        dedupe([
          consultation.target_date ? `Date objetivo ${consultation.target_date}` : null,
          consultation.is_aog === 'yes' ? 'AOG' : consultation.is_aog === 'no' ? 'No AOG' : null,
        ]).join(' | ') || 'Sin date objetivo ni urgencia confirmadas',
    },
    {
      label: 'Ubicacion y notes',
      value:
        dedupe([consultation.aircraft_location, consultation.additional_notes]).join(' | ') ||
        'Sin notes adicionales del client',
    },
  ] satisfies PreliminaryScopeFact[]
}

function buildContinuityAssessment(
  consultation: IncomingRequest,
  chosenReference: PreliminaryScopeReferenceProject | null,
  primaryAircraftVariant: PreliminaryScopeAircraftVariant | null | undefined,
): PreliminaryScopeContinuityAssessment {
  if (!chosenReference) {
    return {
      detail:
        'No hay precedente base confirmado todavia, asi que no puede declararse continuidad de family ni de base de certificacion.',
      highlight: null,
    }
  }

  const sameAircraftFamily =
    looselyMatches(consultation.aircraft_model, chosenReference.aircraft) ||
    looselyMatches(consultation.aircraft_model, chosenReference.baseline.identification.join(' ')) ||
    looselyMatches(consultation.aircraft_manufacturer, chosenReference.aircraft)

  const sameCertificationBasis =
    looselyMatches(
      primaryAircraftVariant?.base_regulation,
      chosenReference.baseline.certificationBasisBaseline,
    ) ||
    looselyMatches(consultation.tcds_number, primaryAircraftVariant?.tcds_code) ||
    looselyMatches(consultation.tcds_number, primaryAircraftVariant?.tcds_code_short)

  const weakDocumentationNote = chosenReference.baseline.summaryAvailable
    ? null
    : 'El precedente esta pobremente documentado; eso limita la trazabilidad, pero no invalida por si solo la continuidad.'

  if (sameAircraftFamily && sameCertificationBasis) {
    return {
      detail: dedupe([
        'Se aprecia continuidad tanto de family/plataforma como de base de certificacion con el precedente seleccionado.',
        'DOA puede reutilizar el baseline como punto de partida y justificar solo los deltas tecnicos reales.',
        weakDocumentationNote,
      ]).join(' '),
      highlight: 'Continuidad de family y base visible',
    }
  }

  if (sameAircraftFamily) {
    return {
      detail: dedupe([
        'Se aprecia continuidad de family/plataforma con el precedente, pero la continuidad de base de certificacion aun debe cerrarse internamente.',
        weakDocumentationNote,
      ]).join(' '),
      highlight: 'Continuidad de family visible',
    }
  }

  if (sameCertificationBasis) {
    return {
      detail: dedupe([
        'Se aprecia continuidad aparente de base de certificacion, aunque la continuidad de family o configuracion no esta demostrada todavia.',
        weakDocumentationNote,
      ]).join(' '),
      highlight: 'Continuidad de base visible',
    }
  }

  return {
    detail: dedupe([
      'El precedente sirve como referencia estructural, pero no hay continuidad demostrada de family ni de base de certificacion.',
      weakDocumentationNote,
    ]).join(' '),
    highlight: null,
  }
}

function getProbableImpacts(impacts: PreliminaryScopeImpact[]) {
  return impacts.filter((impact) => impact.status === 'probable')
}

function getPossibleImpacts(impacts: PreliminaryScopeImpact[]) {
  return impacts.filter((impact) => impact.status === 'possible')
}

function buildBaseContribution(
  chosenReference: PreliminaryScopeReferenceProject | null,
  impacts: PreliminaryScopeImpact[],
) {
  if (!chosenReference) {
    return [
      'Aun no hay precedente base marcado. La propuesta se apoya solo en los data actuales del client y en la lectura TCDS disponible.',
    ]
  }

  const probableImpacts = getProbableImpacts(impacts)
  const baseline = chosenReference.baseline

  return compact<string>([
    baseline.scopeBaseline
      ? `El precedente aporta una narrativa de alcance reutilizable: ${baseline.scopeBaseline}.`
      : 'El precedente aporta continuidad nominal, pero el PROJECT_SUMMARY no deja una description de alcance suficientemente clara. No se interpreta como ausencia technical, sino como documentacion incompleta.',
    baseline.classificationBaseline || baseline.certificationBasisBaseline
      ? `Deja rastro de classification/base util como punto de partida: ${dedupe([baseline.classificationBaseline, baseline.certificationBasisBaseline]).join(' | ')}.`
      : 'La path de certificacion no queda bien documentada en el precedente; DOA debe inferirla aparte y no asumir que no existia.',
    baseline.documentPackageBaseline.length > 0
      ? `Sugiere paquete documental o analitico: ${baseline.documentPackageBaseline.slice(0, 4).join(' | ')}.`
      : 'No se ve paquete documental claro en el PROJECT_SUMMARY del precedente; habra que reconstruirlo desde ingenieria y documents fuente.',
    probableImpacts.length > 0
      ? `Refuerza disciplinas probables: ${probableImpacts.map((impact) => impact.discipline).join(' | ')}.`
      : null,
    baseline.limitations.length > 0
      ? `Tambien deja limitaciones o riesgos repetibles: ${baseline.limitations.slice(0, 3).join(' | ')}.`
      : null,
  ])
}

function buildEngineeringReading(
  chosenReference: PreliminaryScopeReferenceProject | null,
  impacts: PreliminaryScopeImpact[],
) {
  const probableImpacts = getProbableImpacts(impacts).map((impact) => impact.discipline)

  if (
    probableImpacts.includes('Avionics') &&
    probableImpacts.includes('Structures') &&
    probableImpacts.includes('Electrical')
  ) {
    return 'La lectura preliminar DOA encaja con una integracion de sistema/equipo sobre aircraft certificada, con analisis de instalacion e interfaces como eje inicial.'
  }

  if (probableImpacts.includes('Production / Installation')) {
    return 'La lectura preliminar DOA encaja con una modificacion de embodiment fisico sobre plataforma existente, pending de close profundidad por disciplina.'
  }

  if (chosenReference?.baseline.scopeBaseline) {
    return 'La lectura preliminar DOA apunta a continuidad parcial sobre un baseline conocido, sin close todavia todos los deltas tecnicos.'
  }

  return 'La informacion disponible permite una lectura preliminar internal, pero todavia no basta para close el alcance con mayor granularidad.'
}

function buildCertificationRoute(
  chosenReference: PreliminaryScopeReferenceProject | null,
  primaryAircraftVariant: PreliminaryScopeAircraftVariant | null | undefined,
  continuity: PreliminaryScopeContinuityAssessment,
) {
  const routeFragments = dedupe([
    chosenReference?.baseline.classificationBaseline,
    chosenReference?.baseline.certificationBasisBaseline,
    primaryAircraftVariant?.base_regulation,
  ])

  const routeText =
    routeFragments.length > 0
      ? routeFragments.join(' | ')
      : 'Classification y base pendientes de closure internal DOA'

  return [
    `Classification/base preliminar: ${routeText}.`,
    'Esta lectura pertenece a DOA/ingenieria y no se toma como input del client.',
    continuity.highlight ? `La continuidad visible ayuda a apoyar esta lectura inicial: ${continuity.highlight}.` : null,
  ]
    .filter(Boolean)
    .join(' ')
}

function buildScopeHypothesis(
  chosenReference: PreliminaryScopeReferenceProject | null,
  impacts: PreliminaryScopeImpact[],
) {
  const probableImpacts = getProbableImpacts(impacts)
  const focusText =
    probableImpacts.length > 0
      ? probableImpacts.slice(0, 4).map((impact) => impact.discipline).join(' | ')
      : 'cribado technical inicial'

  return chosenReference
    ? `Hipotesis de alcance: paquete preliminar centrado en ${focusText}, reutilizando el precedente solo donde exista continuidad trazable y dejando los deltas bajo validation internal.`
    : `Hipotesis de alcance: paquete preliminar centrado en ${focusText}, todavia sin baseline reutilizable suficientemente validated.`
}

function buildEngineeringFocus(impacts: PreliminaryScopeImpact[]) {
  const probableImpacts = getProbableImpacts(impacts)
  const possibleImpacts = getPossibleImpacts(impacts)

  if (probableImpacts.length === 0 && possibleImpacts.length === 0) {
    return 'No hay un foco disciplinar suficientemente estable; la siguiente iteracion debe close primero el cribado technical.'
  }

  return [
    probableImpacts.length > 0
      ? `Foco inicial en ${probableImpacts.map((impact) => impact.discipline).join(' | ')}.`
      : 'Todavia no hay areas probables cerradas.',
    possibleImpacts.length > 0
      ? `Vigilar tambien ${possibleImpacts.map((impact) => impact.discipline).join(' | ')}.`
      : null,
  ]
    .filter(Boolean)
    .join(' ')
}

function buildDoaInference(
  chosenReference: PreliminaryScopeReferenceProject | null,
  primaryAircraftVariant: PreliminaryScopeAircraftVariant | null | undefined,
  impacts: PreliminaryScopeImpact[],
  continuity: PreliminaryScopeContinuityAssessment,
  confidence: PreliminaryScopeModel['confidence'],
) {
  return [
    {
      key: 'preliminary-engineering-reading',
      label: 'Preliminary engineering reading',
      value: buildEngineeringReading(chosenReference, impacts),
    },
    {
      key: 'baseline-continuity',
      label: 'Baseline continuity',
      value: continuity.detail,
    },
    {
      key: 'preliminary-certification-route',
      label: 'Preliminary certification route',
      value: buildCertificationRoute(chosenReference, primaryAircraftVariant, continuity),
    },
    {
      key: 'preliminary-scope-hypothesis',
      label: 'Preliminary scope hypothesis',
      value: buildScopeHypothesis(chosenReference, impacts),
    },
    {
      key: 'expected-engineering-focus',
      label: 'Expected engineering focus',
      value: buildEngineeringFocus(impacts),
    },
    {
      key: 'confidence',
      label: 'Confidence',
      value: `${confidence.label} (${confidence.score}/100). ${confidence.reasons.slice(0, 2).join(' ') || 'Lectura preliminar sujeta a validation internal.'}`,
    },
  ] satisfies PreliminaryScopeInferenceItem[]
}

function buildMissingInfo(
  consultation: IncomingRequest,
  chosenReference: PreliminaryScopeReferenceProject | null,
  primaryAircraftVariant: PreliminaryScopeAircraftVariant | null | undefined,
  impacts: PreliminaryScopeImpact[],
) {
  const probableAndPossibleImpacts = impacts
    .filter((impact) => impact.status !== 'not expected yet')
    .map((impact) => impact.discipline)

  const askClient = dedupe([
    !consultation.aircraft_msn && chosenReference?.baseline.applicabilityBaseline
      ? 'Pedir MSN o effectivity exacta para contrastarla con la aplicabilidad del precedente.'
      : null,
    !consultation.equipment_details && consultation.has_equipment === 'yes'
      ? 'Pedir P/N, kit, pesos e interfaces del equipo a instalar.'
      : null,
    consultation.has_drawings !== 'yes'
      ? 'Confirmar si el client puede aportar drawings, fotos o data de instalacion existentes.'
      : null,
    consultation.has_manufacturer_docs !== 'yes'
      ? 'Confirmar disponibilidad de AMM, IPC, SRM u otra documentacion OEM aplicable.'
      : null,
    consultation.has_previous_mod === 'yes' && !consultation.previous_mod_ref
      ? 'Pedir referencia concreta de modificacion previa o expediente relacionado.'
      : null,
    !consultation.operational_goal
      ? 'Aclarar el objetivo operativo exacto para acotar interfaces, limitaciones y entregables.'
      : null,
  ])

  const internalValidation = dedupe([
    primaryAircraftVariant?.tcds_code
      ? `Validar aplicabilidad TCDS ${primaryAircraftVariant.tcds_code} y su base ${primaryAircraftVariant.base_regulation || 'no visible'}.`
      : 'Validar aircraft, TCDS aplicable y base de certificacion antes de close quotation.',
    'Definir la path de certificacion y el nivel de approval con criterio DOA; no tomarla como input del client.',
    probableAndPossibleImpacts.length > 0
      ? `Close disciplinas impactadas y su profundidad: ${probableAndPossibleImpacts.join(' | ')}.`
      : 'Realizar una criba de disciplinas impactadas con vocabulario controlado antes de fijar el alcance.',
    chosenReference
      ? 'Revisar cuanto del precedente es realmente reutilizable y cuanto esta pobremente documentado en PROJECT_SUMMARY.'
      : 'Seleccionar y validar un precedente base antes de fijar supuestos de alcance reutilizable.',
    impacts.some(
      (impact) => impact.discipline === 'Instructions for Continued Airworthiness' && impact.status !== 'not expected yet',
    )
      ? 'Validar desde el started_at si el cambio arrastra ICA o actualizacion documental de mantenimiento.'
      : null,
    impacts.some(
      (impact) => impact.discipline === 'Flight Manual / Operational' && impact.status !== 'not expected yet',
    )
      ? 'Confirmar si aparecen limitaciones operacionales o necesidad de suplemento de manual.'
      : null,
  ])

  return {
    askClient,
    internalValidation,
  }
}

function buildConfidence(
  consultation: IncomingRequest,
  chosenReference: PreliminaryScopeReferenceProject | null,
  primaryAircraftVariant: PreliminaryScopeAircraftVariant | null | undefined,
  impacts: PreliminaryScopeImpact[],
) {
  let score = 35
  const reasons: string[] = []

  if (cleanText(consultation.modification_summary) || cleanText(consultation.subject)) {
    score += 15
    reasons.push('Hay una solicitud technical base sobre la que estructurar el alcance.')
  }

  if (cleanText(consultation.aircraft_model) || cleanText(consultation.aircraft_manufacturer)) {
    score += 10
    reasons.push('La plataforma de aircraft esta al menos parcialmente identificada.')
  }

  if (primaryAircraftVariant?.tcds_code) {
    score += 10
    reasons.push('Existe lectura TCDS util para encuadrar aplicabilidad y base.')
  }

  if (chosenReference) {
    score += 10
    reasons.push('Hay precedente base seleccionado para orientar el alcance.')
    if (chosenReference.baseline.summaryAvailable) {
      score += 10
      reasons.push('El precedente tiene PROJECT_SUMMARY explotable, aunque no necesariamente completo.')
    } else {
      reasons.push('El precedente existe pero su summary documenta poco; no se le penaliza en exceso.')
    }
  }

  if (consultation.has_drawings === 'yes' || consultation.has_manufacturer_docs === 'yes') {
    score += 5
    reasons.push('El client declara al menos una parte del soporte documental.')
  }

  if (getProbableImpacts(impacts).length > 0) {
    score += 5
    reasons.push('Ya se pueden anticipar disciplinas de impact probables con un criterio conservador.')
  }

  score = Math.max(20, Math.min(95, score))

  return {
    label: score >= 75 ? 'Alta' : score >= 55 ? 'Media' : 'Baja',
    reasons,
    score,
  } as PreliminaryScopeModel['confidence']
}

function buildHeadline(
  consultation: IncomingRequest,
  chosenReference: PreliminaryScopeReferenceProject | null,
) {
  const summary =
    cleanText(consultation.modification_summary) ??
    cleanText(consultation.operational_goal) ??
    cleanText(consultation.subject) ??
    'solicitud sin description suficiente'

  if (chosenReference?.baseline.scopeBaseline) {
    return `Reutilizacion dirigida del precedente para ${summary}`
  }

  if (chosenReference) {
    return `Alcance preliminar apoyado en precedente parcial para ${summary}`
  }

  return `Alcance preliminar inicial para ${summary}`
}

function buildSummary(
  consultation: IncomingRequest,
  chosenReference: PreliminaryScopeReferenceProject | null,
  impacts: PreliminaryScopeImpact[],
  continuity: PreliminaryScopeContinuityAssessment,
) {
  const scopeSeed =
    cleanText(consultation.modification_summary) ??
    cleanText(consultation.operational_goal) ??
    cleanText(consultation.subject) ??
    'la request received'

  const probableImpacts = getProbableImpacts(impacts)

  const referenceChunk = chosenReference
    ? `Se toma ${buildReferenceLabel(chosenReference)} como precedente base para estructurar el alcance, sin asumir que sus vacios documentales equivalen a ausencia technical.`
    : 'Todavia no hay precedente base confirmado, asi que el alcance se apoya solo en los data actuales y en la lectura TCDS.'

  const impactChunk =
    probableImpacts.length > 0
      ? `Las disciplinas con lectura preliminar mas probable son ${probableImpacts.map((impact) => impact.discipline).join(', ')}.`
      : 'Las disciplinas de impact aun requieren una criba de ingenieria.'

  return [scopeSeed, referenceChunk, continuity.detail, impactChunk].filter(Boolean).join(' ')
}

function buildMetrics(
  confidence: PreliminaryScopeModel['confidence'],
  chosenReference: PreliminaryScopeReferenceProject | null,
  impacts: PreliminaryScopeImpact[],
  primaryAircraftVariant: PreliminaryScopeAircraftVariant | null | undefined,
) {
  const probableCount = getProbableImpacts(impacts).length
  const possibleCount = getPossibleImpacts(impacts).length

  return [
    {
      label: 'Confianza',
      value: `${confidence.label} (${confidence.score}/100)`,
    },
    {
      label: 'Precedente base',
      value: buildReferenceLabel(chosenReference),
    },
    {
      label: 'Impacto',
      value: `${probableCount} probable${probableCount === 1 ? '' : 's'} / ${possibleCount} posible${possibleCount === 1 ? '' : 's'}`,
    },
    {
      label: 'Lectura TCDS',
      value: primaryAircraftVariant?.tcds_code ?? 'Pending',
    },
  ]
}

function buildEvidence(
  chosenReference: PreliminaryScopeReferenceProject | null,
  primaryAircraftVariant: PreliminaryScopeAircraftVariant | null | undefined,
) {
  const rawSummaryMd = chosenReference?.summary_md ?? null
  const summaryExcerpt = rawSummaryMd ? rawSummaryMd.slice(0, 2200) : null

  return {
    precedentUnknowns: chosenReference?.baseline.unknowns ?? [],
    rawSummaryMd,
    summaryExcerpt,
    tcdsNotes: dedupe([
      primaryAircraftVariant?.tcds_code
        ? `TCDS base considerado: ${primaryAircraftVariant.tcds_code}`
        : null,
      primaryAircraftVariant?.base_regulation
        ? `Base visible en TCDS: ${primaryAircraftVariant.base_regulation}`
        : null,
      primaryAircraftVariant?.model
        ? `Variante usada para lectura: ${primaryAircraftVariant.model}`
        : null,
      primaryAircraftVariant?.eligible_msns
        ? `MSN elegibles segun TCDS: ${primaryAircraftVariant.eligible_msns}`
        : null,
    ]),
  }
}

export function buildPreliminaryScopeModel({
  clientLabel,
  consultation,
  primaryAircraftVariant,
  referenceProjects = [],
}: PreliminaryScopeModelInput): PreliminaryScopeModel {
  const chosenReference = getChosenReference(referenceProjects)
  const aircraftLabel = buildAircraftLabel(consultation)
  const impacts = detectImpacts(consultation, chosenReference, primaryAircraftVariant)
  const continuity = buildContinuityAssessment(
    consultation,
    chosenReference,
    primaryAircraftVariant,
  )
  const confidence = buildConfidence(
    consultation,
    chosenReference,
    primaryAircraftVariant,
    impacts,
  )

  return {
    baseContribution: buildBaseContribution(chosenReference, impacts),
    clientProvided: buildClientProvidedFacts(consultation, aircraftLabel),
    confidence,
    context: {
      aircraftLabel,
      chosenReferenceId: chosenReference?.id ?? null,
      chosenReferenceLabel: buildReferenceLabel(chosenReference),
      clientLabel: cleanText(clientLabel) ?? 'Client por confirmar',
      referenceCount: referenceProjects.length,
    },
    doaInference: buildDoaInference(
      chosenReference,
      primaryAircraftVariant,
      impacts,
      continuity,
      confidence,
    ),
    evidence: buildEvidence(chosenReference, primaryAircraftVariant),
    impacts,
    missingInfo: buildMissingInfo(
      consultation,
      chosenReference,
      primaryAircraftVariant,
      impacts,
    ),
    proposedScope: {
      continuity: continuity.highlight,
      headline: buildHeadline(consultation, chosenReference),
      metrics: buildMetrics(confidence, chosenReference, impacts, primaryAircraftVariant),
      summary: buildSummary(consultation, chosenReference, impacts, continuity),
    },
    suggestedQuestions: compact<string>([
      'Resume el alcance preliminar en tono internal DOA.',
      'Explica por que cada area de impact tiene el status actual.',
      chosenReference
        ? `Compara la solicitud actual con ${buildReferenceLabel(chosenReference)} sin asumir que sus vacios son negativos.`
        : 'Que precedente convendria buscar para reforzar esta quotation?',
      'Que informacion falta pedir al client antes de close alcance?',
    ]),
  }
}

export function formatPreliminaryScopeChatContext(model: PreliminaryScopeModel) {
  const sections = [
    `CLIENTE\n- ${model.context.clientLabel}\n- Aircraft actual: ${model.context.aircraftLabel}`,
    `ALCANCE PRELIMINAR PROPUESTO\n- ${model.proposedScope.headline}\n- ${model.proposedScope.summary}`,
    `CONFIANZA\n- ${model.confidence.label} (${model.confidence.score}/100)\n- ${model.confidence.reasons.join('\n- ')}`,
    `LO QUE DICE EL CLIENTE\n- ${model.clientProvided.map((fact) => `${fact.label}: ${fact.value}`).join('\n- ')}`,
    `LO QUE DOA / INGENIERIA PROPONE\n- ${model.doaInference.map((item) => `${item.label}: ${item.value}`).join('\n- ')}`,
    `LO QUE APORTA EL PROYECTO BASE\n- ${model.baseContribution.join('\n- ')}`,
    `AREAS DE IMPACTO\n- ${model.impacts.map((impact) => `${impact.discipline} [${impact.status}]: ${impact.rationale}`).join('\n- ')}`,
    `LO QUE FALTA\n- Pedir al client: ${model.missingInfo.askClient.join(' | ') || 'Sin items nuevos'}\n- Validation internal: ${model.missingInfo.internalValidation.join(' | ') || 'Sin items nuevos'}`,
  ]

  if (model.evidence.summaryExcerpt) {
    sections.push(`EVIDENCIA SECUNDARIA DEL PRECEDENTE\n${model.evidence.summaryExcerpt}`)
  }

  return sections.join('\n\n')
}
