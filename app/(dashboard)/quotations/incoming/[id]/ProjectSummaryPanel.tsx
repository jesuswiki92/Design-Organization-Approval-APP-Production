'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRightLeft,
  ChevronDown,
  ExternalLink,
  FileText,
  Loader2,
} from 'lucide-react'

import type { Phase4ProjectBaseline } from '@/lib/project-summary-phase4'

type CurrentRequestSnapshot = {
  additionalNotes: string | null
  aircraftManufacturer: string | null
  aircraftModel: string | null
  aircraftMsn: string | null
  hasDrawings: string | null
  hasManufacturerDocs: string | null
  hasPreviousMod: string | null
  modificationSummary: string | null
  operationalGoal: string | null
  previousModRef: string | null
  tcdsNumber: string | null
  workType: string | null
}

type Props = {
  baseline: Phase4ProjectBaseline
  currentRequest: CurrentRequestSnapshot
  projectId: string
  projectCode: string
  projectTitle: string
  referenceAircraft: string | null
}

type SummaryData = {
  summary_md: string | null
}

type DeltaStatus = 'igual' | 'delta' | 'desconocido' | 'no comparable'

type DeltaItem = {
  actual: string
  baseline: string
  label: string
  note?: string
  status: DeltaStatus
}

type DeltaGroup = {
  items: DeltaItem[]
  title: string
}

const STATUS_STYLES: Record<DeltaStatus, string> = {
  igual: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  delta: 'border-amber-200 bg-amber-50 text-amber-700',
  desconocido: 'border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-[color:var(--ink-3)]',
  'no comparable': 'border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-[color:var(--ink-2)]',
}

const STOPWORDS = new Set([
  'a',
  'aircraft',
  'all',
  'and',
  'base',
  'cabin',
  'cabina',
  'change',
  'con',
  'de',
  'del',
  'for',
  'installation',
  'instalacion',
  'la',
  'las',
  'los',
  'mod',
  'modificacion',
  'modification',
  'para',
  'por',
  'project',
  'proyecto',
  'requested',
  'several',
  'system',
  'systems',
  'technical',
  'the',
  'work',
  'y',
])

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function present(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : fallback
}

function dedupe(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const key = normalizeText(value)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }

  return result
}

function joinList(values: string[], fallback: string) {
  return values.length > 0 ? values.join(' | ') : fallback
}

function tokenize(value: string) {
  return new Set(
    normalizeText(value)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3 && !STOPWORDS.has(token)),
  )
}

function compareScope(actual: string | null, baseline: string | null): DeltaStatus {
  if (!actual || !baseline) return 'desconocido'

  const normalizedActual = normalizeText(actual)
  const normalizedBaseline = normalizeText(baseline)
  if (
    normalizedActual === normalizedBaseline ||
    normalizedActual.includes(normalizedBaseline) ||
    normalizedBaseline.includes(normalizedActual)
  ) {
    return 'igual'
  }

  const actualTokens = tokenize(actual)
  const baselineTokens = tokenize(baseline)
  const overlap = [...actualTokens].filter((token) => baselineTokens.has(token)).length

  if (overlap === 0) return 'delta'

  const minSize = Math.max(1, Math.min(actualTokens.size, baselineTokens.size))
  return overlap / minSize >= 0.5 ? 'igual' : 'delta'
}

function compareAircraft(
  currentAircraft: string,
  referenceAircraft: string,
  manufacturer: string | null,
  model: string | null,
): DeltaStatus {
  if (!manufacturer && !model) return 'desconocido'
  if (!referenceAircraft) return 'desconocido'

  const normalizedReference = normalizeText(referenceAircraft)
  if (model && normalizedReference.includes(normalizeText(model))) {
    return 'igual'
  }
  if (manufacturer && normalizedReference.includes(normalizeText(manufacturer))) {
    return 'delta'
  }
  if (currentAircraft !== 'Aeronave no definida en la consulta') {
    return 'delta'
  }
  return 'desconocido'
}

function compareApplicability(currentMsn: string | null, applicability: string | null): DeltaStatus {
  if (!currentMsn && !applicability) return 'desconocido'
  if (!applicability) return 'no comparable'
  if (!currentMsn) return 'desconocido'

  const normalizedApplicability = normalizeText(applicability)
  if (
    normalizedApplicability.includes('all msn') ||
    normalizedApplicability.includes(normalizeText(currentMsn))
  ) {
    return 'igual'
  }

  return 'delta'
}

function compareDocumentSupport(
  baselineDocs: string[],
  hasDrawings: string | null,
  hasManufacturerDocs: string | null,
  hasPreviousMod: string | null,
): DeltaStatus {
  if (baselineDocs.length === 0) return 'desconocido'

  const positives = [hasDrawings, hasManufacturerDocs, hasPreviousMod].filter((value) => value === 'si').length
  const answered = [hasDrawings, hasManufacturerDocs, hasPreviousMod].filter(Boolean).length

  if (positives >= 2) return 'igual'
  if (positives === 1 || answered > 0) return 'delta'
  return 'desconocido'
}

function comparePreviousReference(
  previousModRef: string | null,
  hasPreviousMod: string | null,
  projectCode: string,
): DeltaStatus {
  if (previousModRef && projectCode && normalizeText(previousModRef).includes(normalizeText(projectCode))) {
    return 'igual'
  }
  if (previousModRef || hasPreviousMod === 'si' || hasPreviousMod === 'no') {
    return 'delta'
  }
  return 'desconocido'
}

function formatWorkType(value: string | null) {
  if (value === 'proyecto_nuevo') return 'Proyecto nuevo'
  if (value === 'modificacion_existente') return 'Modificacion existente'
  return present(value, 'No definido')
}

function formatSupportSummary(currentRequest: CurrentRequestSnapshot) {
  const facts: string[] = []

  if (currentRequest.hasDrawings === 'si') facts.push('Drawings disponibles')
  if (currentRequest.hasManufacturerDocs === 'si') facts.push('Docs de fabricante disponibles')
  if (currentRequest.hasPreviousMod === 'si') facts.push('Existe modificacion previa')
  if (currentRequest.previousModRef) facts.push(`Ref. indicada: ${currentRequest.previousModRef}`)

  return facts.length > 0 ? facts.join(' | ') : 'Sin soporte documental confirmado todavia'
}

function summarizeCurrentUnknowns(
  currentRequest: CurrentRequestSnapshot,
  baseline: Phase4ProjectBaseline,
) {
  return [
    !currentRequest.aircraftModel && !currentRequest.aircraftManufacturer
      ? 'Confirmar plataforma o modelo de aeronave.'
      : null,
    !currentRequest.aircraftMsn && baseline.applicabilityBaseline
      ? 'Confirmar MSN o aplicabilidad frente al baseline del precedente.'
      : null,
    !currentRequest.tcdsNumber && baseline.certificationBasisBaseline
      ? 'Confirmar TCDS y base de certificacion de la consulta actual.'
      : null,
    !currentRequest.modificationSummary
      ? 'Aclarar la descripcion tecnica preliminar del cambio.'
      : null,
    !currentRequest.operationalGoal && baseline.impactAreas.length > 0
      ? 'Aclarar impactos esperados y objetivo operativo.'
      : null,
    currentRequest.hasDrawings !== 'si' &&
    currentRequest.hasManufacturerDocs !== 'si' &&
    baseline.documentPackageBaseline.length > 0
      ? 'Confirmar si el cliente aporta drawings o documentacion de fabricante.'
      : null,
  ].filter(Boolean) as string[]
}

function computeDeltaGroups(
  baseline: Phase4ProjectBaseline,
  currentRequest: CurrentRequestSnapshot,
  projectCode: string,
  referenceAircraft: string | null,
): DeltaGroup[] {
  const currentAircraft = [currentRequest.aircraftManufacturer, currentRequest.aircraftModel]
    .filter(Boolean)
    .join(' ')

  const baselineAircraft = joinList(
    [referenceAircraft ?? '', ...baseline.identification].filter(Boolean),
    'Aeronave o configuracion no visibles en el precedente',
  )

  return [
    {
      title: 'Aeronave / configuracion',
      items: [
        {
          label: 'Plataforma base',
          actual: present(currentAircraft, 'Aeronave no definida en la consulta'),
          baseline: baselineAircraft,
          status: compareAircraft(
            present(currentAircraft, 'Aeronave no definida en la consulta'),
            baselineAircraft,
            currentRequest.aircraftManufacturer,
            currentRequest.aircraftModel,
          ),
        },
        {
          label: 'MSN / aplicabilidad',
          actual: present(currentRequest.aircraftMsn, 'MSN no indicado'),
          baseline: present(
            baseline.applicabilityBaseline,
            'Aplicabilidad no visible en PROJECT_SUMMARY',
          ),
          status: compareApplicability(currentRequest.aircraftMsn, baseline.applicabilityBaseline),
        },
        {
          label: 'TCDS / base certificacion',
          actual: currentRequest.tcdsNumber
            ? `TCDS ${currentRequest.tcdsNumber}`
            : 'TCDS no indicado',
          baseline: present(
            baseline.certificationBasisBaseline,
            'Base de certificacion no visible',
          ),
          note:
            currentRequest.tcdsNumber && baseline.certificationBasisBaseline
              ? 'La consulta trae TCDS; el precedente aporta la base y ruta de referencia.'
              : undefined,
          status:
            currentRequest.tcdsNumber && baseline.certificationBasisBaseline
              ? 'no comparable'
              : 'desconocido',
        },
      ],
    },
    {
      title: 'Cambio tecnico',
      items: [
        {
          label: 'Alcance preliminar',
          actual: present(
            currentRequest.modificationSummary,
            'Sin descripcion tecnica clara en la consulta',
          ),
          baseline: present(
            baseline.scopeBaseline,
            'Alcance base no visible en PROJECT_SUMMARY',
          ),
          status: compareScope(currentRequest.modificationSummary, baseline.scopeBaseline),
        },
        {
          label: 'Tipo de trabajo / ruta',
          actual: formatWorkType(currentRequest.workType),
          baseline: baseline.classificationBaseline
            ? `Cambio ${baseline.classificationBaseline}`
            : 'Clasificacion base no visible',
          note: baseline.classificationBaseline
            ? 'El precedente sirve como ruta de aprobacion base, no como clasificacion cerrada para la consulta.'
            : undefined,
          status:
            baseline.classificationBaseline && currentRequest.workType
              ? 'no comparable'
              : 'desconocido',
        },
        {
          label: 'Clasificacion base reutilizable',
          actual: 'Sin clasificacion preliminar confirmada',
          baseline: present(
            baseline.classificationBaseline,
            'Clasificacion base no visible',
          ),
          status: 'desconocido',
        },
      ],
    },
    {
      title: 'Areas de impacto',
      items: [
        {
          label: 'Impactos previsibles',
          actual: present(
            currentRequest.operationalGoal ?? currentRequest.additionalNotes,
            'La consulta no enumera impactos todavia',
          ),
          baseline: joinList(
            baseline.impactAreas.length > 0 ? baseline.impactAreas : baseline.impactedDisciplines,
            'Impactos no explicitados en el precedente',
          ),
          note: baseline.impactedDisciplines.length > 0
            ? `Disciplinas vistas en el precedente: ${baseline.impactedDisciplines.join(', ')}.`
            : undefined,
          status:
            baseline.impactAreas.length > 0 || baseline.impactedDisciplines.length > 0
              ? currentRequest.operationalGoal || currentRequest.additionalNotes
                ? 'no comparable'
                : 'desconocido'
              : 'desconocido',
        },
        {
          label: 'Limitaciones / condiciones',
          actual: present(
            currentRequest.additionalNotes,
            'Sin condiciones especiales visibles en la consulta',
          ),
          baseline: joinList(
            dedupe([...baseline.specialConditions, ...baseline.limitations]),
            'Sin limitaciones visibles en PROJECT_SUMMARY',
          ),
          status:
            baseline.specialConditions.length > 0 || baseline.limitations.length > 0
              ? currentRequest.additionalNotes
                ? 'delta'
                : 'desconocido'
              : 'desconocido',
        },
      ],
    },
    {
      title: 'Document baseline',
      items: [
        {
          label: 'Paquete documental base',
          actual: formatSupportSummary(currentRequest),
          baseline: joinList(
            baseline.documentPackageBaseline,
            'Paquete documental base no explicitado',
          ),
          status: compareDocumentSupport(
            baseline.documentPackageBaseline,
            currentRequest.hasDrawings,
            currentRequest.hasManufacturerDocs,
            currentRequest.hasPreviousMod,
          ),
        },
        {
          label: 'Referencia previa enlazada',
          actual: currentRequest.previousModRef
            ? currentRequest.previousModRef
            : currentRequest.hasPreviousMod === 'si'
              ? 'El cliente indica precedente previo, sin codigo'
              : currentRequest.hasPreviousMod === 'no'
                ? 'El cliente indica que no hay precedente previo'
                : 'No confirmado',
          baseline: present(projectCode, 'Precedente sin codigo visible'),
          status: comparePreviousReference(
            currentRequest.previousModRef,
            currentRequest.hasPreviousMod,
            projectCode,
          ),
        },
      ],
    },
    {
      title: 'Unknowns',
      items: [
        {
          label: 'Huecos visibles en esta fase',
          actual: joinList(
            summarizeCurrentUnknowns(currentRequest, baseline),
            'Sin vacios adicionales detectados en la consulta actual',
          ),
          baseline: joinList(
            baseline.unknowns,
            'Sin huecos relevantes visibles en el precedente',
          ),
          status: 'desconocido',
        },
      ],
    },
  ]
}

function computeFit(groups: DeltaGroup[], baseline: Phase4ProjectBaseline) {
  const allItems = groups.flatMap((group) => group.items)
  const equals = allItems.filter((item) => item.status === 'igual').length
  const deltas = allItems.filter((item) => item.status === 'delta').length
  const unknowns = allItems.filter((item) => item.status === 'desconocido').length

  const score = equals * 2 + deltas
  const level = score >= 5 ? 'alto' : score >= 3 ? 'medio' : 'bajo'
  const label =
    level === 'alto'
      ? 'Buen encaje'
      : level === 'medio'
        ? 'Encaje parcial'
        : 'Encaje debil'

  const reasons = dedupe([
    equals > 0 ? 'Hay coincidencias visibles entre la consulta y el baseline del precedente.' : '',
    deltas > 0 ? 'Existen diferencias que piden validacion humana antes de reutilizar el alcance.' : '',
    unknowns > 0 ? 'Todavia hay campos no comparables o no confirmados en esta fase preliminar.' : '',
    baseline.documentPackageBaseline.length > 0
      ? `El precedente aporta ${baseline.documentPackageBaseline.length} referencias documentales reutilizables.`
      : '',
  ]).filter(Boolean)

  return { label, level, reasons }
}

function StatusBadge({ status }: { status: DeltaStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  )
}

function TagList({
  emptyLabel,
  tone,
  values,
}: {
  emptyLabel: string
  tone: 'amber' | 'emerald' | 'slate' | 'sky'
  values: string[]
}) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'sky'
          ? 'border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-[color:var(--ink-2)]'
          : 'border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-[color:var(--ink-3)]'

  if (values.length === 0) {
    return <p className="text-xs text-[color:var(--ink-3)]">{emptyLabel}</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          key={value}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass}`}
        >
          {value}
        </span>
      ))}
    </div>
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function parseInline(text: string): string {
  let result = escapeHtml(text)
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-[color:var(--ink)]">$1</strong>')
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>')
  result = result.replace(/`(.+?)`/g, '<code class="rounded bg-[color:var(--paper-2)] px-1 py-0.5 text-[11px] font-mono text-[color:var(--ink-2)]">$1</code>')
  return result
}

function renderTable(lines: string[]): string {
  if (lines.length < 2) {
    return lines.map((line) => `<p class="text-xs text-[color:var(--ink-2)]">${escapeHtml(line)}</p>`).join('')
  }

  const parseRow = (line: string) =>
    line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0)

  const headerCells = parseRow(lines[0])
  const isSeparator = (line: string) => /^\|[\s\-:|]+\|$/.test(line.trim())
  const dataStartIdx = isSeparator(lines[1]) ? 2 : 1
  const dataRows = lines.slice(dataStartIdx).map(parseRow)

  const ths = headerCells
    .map((cell) => `<th class="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">${parseInline(cell)}</th>`)
    .join('')

  const trs = dataRows
    .map((cells) => {
      const tds = cells
        .map((cell) => `<td class="px-2 py-1 text-xs text-[color:var(--ink-2)]">${parseInline(cell)}</td>`)
        .join('')
      return `<tr class="border-t border-[color:var(--ink-4)]">${tds}</tr>`
    })
    .join('')

  return `<div class="my-2 overflow-x-auto rounded-lg border border-[color:var(--ink-4)]"><table class="w-full text-left text-xs"><thead><tr class="bg-[color:var(--paper-2)]">${ths}</tr></thead><tbody>${trs}</tbody></table></div>`
}

function parseMarkdown(markdown: string): string {
  const lines = markdown.split('\n')
  const htmlParts: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (trimmed === '') {
      index += 1
      continue
    }

    if (trimmed.startsWith('###')) {
      htmlParts.push(`<h4 class="mb-1 mt-3 text-xs font-bold text-[color:var(--ink-2)]">${parseInline(trimmed.replace(/^###\s*/, ''))}</h4>`)
      index += 1
      continue
    }

    if (trimmed.startsWith('##') || trimmed.startsWith('#')) {
      htmlParts.push(`<h3 class="mb-1.5 mt-4 border-b border-[color:var(--ink-4)] pb-1 text-sm font-bold text-[color:var(--ink)]">${parseInline(trimmed.replace(/^#+\s*/, ''))}</h3>`)
      index += 1
      continue
    }

    if (trimmed.startsWith('|')) {
      const tableLines: string[] = []
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        tableLines.push(lines[index].trim())
        index += 1
      }
      htmlParts.push(renderTable(tableLines))
      continue
    }

    if (/^[-*]\s/.test(trimmed)) {
      const listItems: string[] = []
      while (index < lines.length && /^[-*]\s/.test(lines[index].trim())) {
        listItems.push(lines[index].trim().replace(/^[-*]\s/, ''))
        index += 1
      }
      htmlParts.push(
        `<ul class="my-1.5 ml-4 list-disc space-y-0.5">${listItems
          .map((item) => `<li class="text-xs leading-relaxed text-[color:var(--ink-2)]">${parseInline(item)}</li>`)
          .join('')}</ul>`,
      )
      continue
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const listItems: string[] = []
      while (index < lines.length && /^\d+\.\s/.test(lines[index].trim())) {
        listItems.push(lines[index].trim().replace(/^\d+\.\s/, ''))
        index += 1
      }
      htmlParts.push(
        `<ol class="my-1.5 ml-4 list-decimal space-y-0.5">${listItems
          .map((item) => `<li class="text-xs leading-relaxed text-[color:var(--ink-2)]">${parseInline(item)}</li>`)
          .join('')}</ol>`,
      )
      continue
    }

    htmlParts.push(`<p class="my-1 text-xs leading-relaxed text-[color:var(--ink-2)]">${parseInline(trimmed)}</p>`)
    index += 1
  }

  return htmlParts.join('\n')
}

export function ProjectSummaryPanel({
  baseline,
  currentRequest,
  projectId,
  projectCode,
  projectTitle,
  referenceAircraft,
}: Props) {
  const [expandedRaw, setExpandedRaw] = useState(false)
  const [loadingRaw, setLoadingRaw] = useState(false)
  const [rawFetched, setRawFetched] = useState(false)
  const [summaryHtml, setSummaryHtml] = useState<string | null>(null)
  const [rawError, setRawError] = useState<string | null>(null)

  const groups = computeDeltaGroups(baseline, currentRequest, projectCode, referenceAircraft)
  const fit = computeFit(groups, baseline)
  const vacios = dedupe([
    ...summarizeCurrentUnknowns(currentRequest, baseline),
    ...baseline.unknowns,
    ...groups
      .flatMap((group) => group.items)
      .filter((item) => item.status === 'delta')
      .map((item) => `Validar delta detectado en "${item.label.toLowerCase()}".`),
  ])

  async function handleToggleRaw() {
    const willExpand = !expandedRaw
    setExpandedRaw(willExpand)

    if (!willExpand || rawFetched) {
      return
    }

    setLoadingRaw(true)
    setRawError(null)

    try {
      const res = await fetch(`/api/proyectos-historico/${projectId}/summary`)
      if (!res.ok) {
        throw new Error(`Error ${res.status}`)
      }

      const data: SummaryData = await res.json()
      setSummaryHtml(data.summary_md ? parseMarkdown(data.summary_md) : null)
      setRawFetched(true)
    } catch (error) {
      console.error('Error fetching raw project summary:', error)
      setRawError('No se pudo cargar el PROJECT_SUMMARY completo.')
    } finally {
      setLoadingRaw(false)
    }
  }

  return (
    <div className="mt-3 rounded-[20px] border border-[color:var(--ink-4)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_10px_24px_rgba(148,163,184,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
            Preliminary Scope Baseline
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {projectCode ? (
              <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700">
                {projectCode}
              </span>
            ) : null}
            <h3 className="text-sm font-semibold text-slate-950">
              {baseline.baselineTitle ?? projectTitle ?? 'Precedente sin titulo visible'}
            </h3>
          </div>
          <p className="mt-1 text-xs text-[color:var(--ink-3)]">
            Vista resumida para fase 4: baseline reutilizable, deltas visibles y huecos por confirmar.
          </p>
        </div>

        <Link
          href={`/proyectos-historico/${projectId}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)]"
        >
          Abrir ficha historica
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <section className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-600" />
            <h4 className="text-sm font-semibold text-slate-950">Baseline reutilizable</h4>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                Identificacion
              </p>
              <p className="text-sm leading-6 text-[color:var(--ink)]">
                {joinList(baseline.identification, 'Identificacion no visible en PROJECT_SUMMARY')}
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                Clasificacion / base
              </p>
              <p className="text-sm leading-6 text-[color:var(--ink)]">
                {baseline.classificationBaseline ?? 'Clasificacion no visible'}
              </p>
              <p className="text-xs leading-5 text-[color:var(--ink-3)]">
                {baseline.certificationBasisBaseline ?? 'Base de certificacion no visible'}
              </p>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                Scope baseline
              </p>
              <p className="text-sm leading-6 text-[color:var(--ink)]">
                {baseline.scopeBaseline ?? 'No se ve una descripcion de alcance reutilizable en PROJECT_SUMMARY.'}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                Impact areas
              </p>
              <TagList
                emptyLabel="Sin impactos explicitados"
                tone="amber"
                values={baseline.impactAreas.length > 0 ? baseline.impactAreas : baseline.impactedDisciplines}
              />
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                Document package baseline
              </p>
              <TagList
                emptyLabel="Sin paquete documental explicitado"
                tone="sky"
                values={baseline.documentPackageBaseline}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                Limitaciones / condiciones visibles
              </p>
              <TagList
                emptyLabel="No se han detectado limitaciones claras en PROJECT_SUMMARY"
                tone="slate"
                values={dedupe([...baseline.specialConditions, ...baseline.limitations])}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-[color:var(--umber)]" />
            <h4 className="text-sm font-semibold text-[color:var(--ink)]">Encaje del precedente</h4>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                fit.level === 'alto'
                  ? 'bg-emerald-100 text-emerald-700'
                  : fit.level === 'medio'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-[color:var(--paper-3)] text-[color:var(--ink-2)]'
              }`}
            >
              {fit.label}
            </span>
            <p className="text-xs text-[color:var(--ink-3)]">
              Basado en coincidencias visibles y deltas detectados en esta fase preliminar.
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {fit.reasons.map((reason) => (
              <div
                key={reason}
                className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)]/80 px-3 py-2 text-xs leading-5 text-[color:var(--ink-2)]"
              >
                {reason}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {groups.map((group) => (
          <section key={group.title} className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-4">
            <h4 className="text-sm font-semibold text-[color:var(--ink)]">{group.title}</h4>
            <div className="mt-3 space-y-3">
              {group.items.map((item) => (
                <div
                  key={`${group.title}-${item.label}`}
                  className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/70 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
                      {item.label}
                    </p>
                    <StatusBadge status={item.status} />
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--umber)]">
                        Consulta actual
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--ink)]">{item.actual}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
                        Baseline precedente
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--ink)]">{item.baseline}</p>
                    </div>
                  </div>

                  {item.note ? (
                    <p className="mt-2 text-xs leading-5 text-[color:var(--ink-3)]">{item.note}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-4 rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h4 className="text-sm font-semibold text-[color:var(--ink)]">Vacios a confirmar</h4>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {vacios.length > 0 ? (
            vacios.map((item) => (
              <span
                key={item}
                className="rounded-full border border-amber-200 bg-[color:var(--paper)] px-3 py-1 text-xs font-medium text-amber-700"
              >
                {item}
              </span>
            ))
          ) : (
            <p className="text-xs text-[color:var(--ink-3)]">
              No se detectan vacios criticos adicionales para esta comparacion preliminar.
            </p>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
            Preguntas que este precedente sugiere cerrar
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {baseline.formQuestionCandidates.length > 0 ? (
              baseline.formQuestionCandidates.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-3 py-1 text-xs font-medium text-[color:var(--ink-2)]"
                >
                  {item}
                </span>
              ))
            ) : (
              <p className="text-xs text-[color:var(--ink-3)]">
                El precedente no fuerza preguntas extra claras mas alla del baseline visible.
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="mt-4 rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)]">
        <button
          type="button"
          onClick={handleToggleRaw}
          className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-[color:var(--paper-3)]"
        >
          <FileText className="h-4 w-4 text-[color:var(--ink-3)]" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[color:var(--ink)]">Ver PROJECT_SUMMARY completo</p>
            <p className="text-xs text-[color:var(--ink-3)]">
              Acceso secundario al markdown original del precedente.
            </p>
          </div>
          {loadingRaw ? <Loader2 className="h-4 w-4 animate-spin text-[color:var(--ink-3)]" /> : null}
          <ChevronDown
            className={`h-4 w-4 text-[color:var(--ink-3)] transition-transform ${expandedRaw ? 'rotate-180' : ''}`}
          />
        </button>

        {expandedRaw ? (
          <div className="border-t border-[color:var(--ink-4)] px-4 py-4">
            {loadingRaw ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-[color:var(--ink-3)]" />
                <span className="text-xs text-[color:var(--ink-3)]">Cargando PROJECT_SUMMARY...</span>
              </div>
            ) : null}

            {rawError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-xs text-red-600">{rawError}</p>
              </div>
            ) : null}

            {rawFetched && !rawError && summaryHtml === null ? (
              <div className="rounded-lg border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/50 px-3 py-3">
                <p className="text-xs italic text-[color:var(--ink-3)]">
                  No hay PROJECT_SUMMARY disponible para este precedente.
                </p>
              </div>
            ) : null}

            {rawFetched && !rawError && summaryHtml !== null ? (
              <div
                className="max-h-[500px] overflow-y-auto pr-1"
                dangerouslySetInnerHTML={{ __html: summaryHtml }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
