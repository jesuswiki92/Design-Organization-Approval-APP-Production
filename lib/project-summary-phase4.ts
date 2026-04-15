type BaselineFallback = {
  aircraftLabel?: string | null
  projectCode?: string | null
  projectTitle?: string | null
}

export type Phase4ProjectBaseline = {
  applicabilityBaseline: string | null
  baselineTitle: string | null
  certificationBasisBaseline: string | null
  classificationBaseline: string | null
  documentPackageBaseline: string[]
  formQuestionCandidates: string[]
  identification: string[]
  impactedDisciplines: string[]
  impactAreas: string[]
  limitations: string[]
  scopeBaseline: string | null
  specialConditions: string[]
  summaryAvailable: boolean
  unknowns: string[]
}

const UNKNOWN_VALUE_RE =
  /\b(pendiente|por confirmar|unknown|n\/a|not (?:visible|available|identified)|sin (?:dato|identificar)|no visible|to be confirmed)\b/i

const SECTION_HEADER_RE = /^(#{1,6}\s+.+|\d+\.\s+[A-Z0-9_ /&()-]+|[A-Z][A-Z0-9_ /&()-]{5,})$/

const IMPACT_LABELS: Record<string, string> = {
  electrical_impact: 'Electrico',
  ewis_impact: 'EWIS',
  flammability_impact: 'Flammability',
  manual_impact: 'Documentacion de mantenimiento',
  osd_impact: 'OSD',
  structural_impact: 'Estructural',
  weight_balance_impact: 'Weight & Balance',
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizeKey(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function cleanInlineValue(value: string | null | undefined) {
  if (!value) return null
  const cleaned = value
    .replace(/^[-*]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned || UNKNOWN_VALUE_RE.test(cleaned)) {
    return null
  }

  return cleaned
}

function dedupeList(values: Array<string | null | undefined>) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const cleaned = cleanInlineValue(value)
    if (!cleaned) continue
    const key = normalizeText(cleaned)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(cleaned)
  }

  return result
}

function parseLines(markdown: string | null) {
  return (markdown ?? '').split(/\r?\n/)
}

function isKeyValueLine(line: string) {
  return /^[A-Za-z0-9_ /&().-]{2,80}:\s*/.test(line.trim())
}

function isSectionHeader(line: string) {
  return SECTION_HEADER_RE.test(line.trim())
}

function getKeyValue(lines: string[], aliases: string[]) {
  const aliasSet = new Set(aliases.map((alias) => normalizeKey(alias)))

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const match = line.match(/^([A-Za-z0-9_ /&().-]{2,80}):\s*(.+)$/)
    if (!match) continue

    if (aliasSet.has(normalizeKey(match[1]))) {
      return cleanInlineValue(match[2])
    }
  }

  return null
}

function getListBlock(lines: string[], aliases: string[]) {
  const aliasSet = new Set(aliases.map((alias) => normalizeKey(alias)))

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index]
    const line = rawLine.trim()
    const match = line.match(/^([A-Za-z0-9_ /&().-]{2,80}):\s*(.*)$/)
    if (!match) continue
    if (!aliasSet.has(normalizeKey(match[1]))) continue

    const values: string[] = []
    const inlineValue = cleanInlineValue(match[2])
    if (inlineValue) {
      values.push(inlineValue)
    }

    let cursor = index + 1
    while (cursor < lines.length) {
      const candidateRaw = lines[cursor]
      const candidate = candidateRaw.trim()

      if (!candidate) {
        cursor += 1
        if (values.length > 0) break
        continue
      }

      if (/^[-*]\s+/.test(candidate)) {
        values.push(candidate.replace(/^[-*]\s+/, '').trim())
        cursor += 1
        continue
      }

      if (/^\s{2,}\S/.test(candidateRaw) && values.length > 0) {
        values[values.length - 1] = `${values[values.length - 1]} ${candidate}`.trim()
        cursor += 1
        continue
      }

      if (isKeyValueLine(candidate) || isSectionHeader(candidate)) {
        break
      }

      if (values.length === 0) {
        values.push(candidate)
        cursor += 1
        continue
      }

      break
    }

    return dedupeList(values)
  }

  return []
}

function extractImpactData(lines: string[]) {
  const impactAreas: string[] = []
  const impactedDisciplines: string[] = []

  for (const [key, label] of Object.entries(IMPACT_LABELS)) {
    const inlineValue = getKeyValue(lines, [key])
    const listValue = getListBlock(lines, [key])

    const combined = dedupeList([inlineValue, ...listValue])
    if (combined.length === 0) continue

    impactedDisciplines.push(label)
    combined.forEach((value) => {
      impactAreas.push(`${label}: ${value}`)
    })
  }

  return {
    impactAreas: dedupeList(impactAreas),
    impactedDisciplines: dedupeList(impactedDisciplines),
  }
}

function getFallbackBaselineTitle(fallback: BaselineFallback) {
  return cleanInlineValue(fallback.projectTitle) ?? cleanInlineValue(fallback.projectCode)
}

export function extractPhase4BaselineFromSummary(
  summaryMd: string | null,
  fallback: BaselineFallback = {},
): Phase4ProjectBaseline {
  const lines = parseLines(summaryMd)
  const summaryAvailable = Boolean(summaryMd && summaryMd.trim())

  if (!summaryAvailable) {
    return {
      applicabilityBaseline: null,
      baselineTitle: getFallbackBaselineTitle(fallback),
      certificationBasisBaseline: null,
      classificationBaseline: null,
      documentPackageBaseline: [],
      formQuestionCandidates: [],
      identification: dedupeList([
        fallback.projectCode,
        fallback.projectTitle,
        fallback.aircraftLabel,
      ]),
      impactedDisciplines: [],
      impactAreas: [],
      limitations: [],
      scopeBaseline: null,
      specialConditions: [],
      summaryAvailable: false,
      unknowns: [
        'PROJECT_SUMMARY no disponible para extraer baseline reutilizable.',
      ],
    }
  }

  const baselineTitle =
    getKeyValue(lines, ['project_title', 'title']) ??
    getFallbackBaselineTitle(fallback)

  const projectCode = getKeyValue(lines, ['project_code'])
  const aircraftManufacturer = getKeyValue(lines, ['aircraft_manufacturer'])
  const aircraftModel = getKeyValue(lines, ['aircraft_model'])
  const aircraftVariant = getKeyValue(lines, ['aircraft_variant'])
  const applicabilityBaseline = getKeyValue(lines, ['applicability'])
  const scopeBaseline =
    getKeyValue(lines, ['high_level_description', 'modification_description']) ??
    (dedupeList(getListBlock(lines, ['technical_scope'])).join('; ') || null)

  const classificationBaseline = getKeyValue(lines, [
    'change_classification',
    'classification',
  ])
  const certificationBasisBaseline = getKeyValue(lines, [
    'certification_basis',
    'certification_basis_baseline',
    'cert_basis',
  ])

  const impactData = extractImpactData(lines)
  const documentPackageBaseline = dedupeList([
    ...getListBlock(lines, ['predicted_or_detected_required_analyses']),
    ...getListBlock(lines, ['fuentes_especialmente_relevantes_detectadas']),
  ])
  const limitations = dedupeList([
    ...getListBlock(lines, ['repeatable_risks_for_future_quotations']),
    ...getListBlock(lines, ['lagunas_detectadas_en_control_documental']),
    ...getListBlock(lines, ['limitations', 'known_limitations']),
  ])
  const specialConditions = dedupeList([
    applicabilityBaseline,
    ...getListBlock(lines, ['special_conditions', 'special_condition']),
  ])
  const formQuestionCandidates = dedupeList([
    classificationBaseline || certificationBasisBaseline
      ? 'Confirmar clasificacion preliminar esperada y ruta de aprobacion.'
      : null,
    applicabilityBaseline
      ? 'Confirmar effectivity exacta: MSN, configuracion y restricciones de aplicabilidad.'
      : null,
    impactData.impactedDisciplines.includes('Estructural')
      ? 'Aclarar si existe impacto estructural o necesidad de analisis estructural.'
      : null,
    impactData.impactedDisciplines.includes('Electrico') ||
    impactData.impactedDisciplines.includes('EWIS')
      ? 'Aclarar alcance electrico, interfaces, carga y posible impacto EWIS.'
      : null,
    impactData.impactedDisciplines.includes('Weight & Balance')
      ? 'Confirmar efecto esperado en Weight & Balance.'
      : null,
    documentPackageBaseline.some((item) => normalizeText(item).includes('manual'))
      ? 'Confirmar si habra impacto en ICA, manuals o supplements.'
      : null,
    documentPackageBaseline.length > 0
      ? 'Confirmar que documentacion base aporta el cliente y cual habra que generar.'
      : null,
    limitations.length > 0 || specialConditions.length > 0
      ? 'Capturar limitaciones especiales, configuraciones previas o condiciones de instalacion.'
      : null,
  ])

  const identification = dedupeList([
    projectCode,
    baselineTitle,
    [aircraftManufacturer, aircraftModel, aircraftVariant].filter(Boolean).join(' '),
    fallback.aircraftLabel,
  ])

  const unknowns = dedupeList([
    !scopeBaseline ? 'Alcance base no visible en PROJECT_SUMMARY.' : null,
    !classificationBaseline ? 'Clasificacion base no visible en PROJECT_SUMMARY.' : null,
    !certificationBasisBaseline ? 'Base de certificacion no visible en PROJECT_SUMMARY.' : null,
    impactData.impactedDisciplines.length === 0
      ? 'Impactos tecnicos no explicitados en PROJECT_SUMMARY.'
      : null,
    documentPackageBaseline.length === 0
      ? 'Paquete documental base no explicitado en PROJECT_SUMMARY.'
      : null,
    !applicabilityBaseline ? 'Aplicabilidad o configuracion no visibles en PROJECT_SUMMARY.' : null,
  ])

  return {
    applicabilityBaseline,
    baselineTitle,
    certificationBasisBaseline,
    classificationBaseline,
    documentPackageBaseline,
    formQuestionCandidates,
    identification,
    impactedDisciplines: impactData.impactedDisciplines,
    impactAreas: impactData.impactAreas,
    limitations,
    scopeBaseline,
    specialConditions,
    summaryAvailable: true,
    unknowns,
  }
}
