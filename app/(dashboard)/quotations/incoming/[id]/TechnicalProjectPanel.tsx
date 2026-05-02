/**
 * ============================================================================
 * TECHNICAL PROJECT PANEL — sección "Datos técnicos del proyecto"
 * ============================================================================
 * Lee los campos denormalizados del formulario público desde
 * `doa_incoming_requests_v2`. Los flags has_*, is_aog, impact_*,
 * affects_primary_structure y related_to_ad están persistidos como TEXT
 * legacy ('true'/'false', 'yes'/'no', 'not_sure', strings libres). Este
 * componente normaliza la presentación.
 * ============================================================================
 */

import {
  AlertTriangle,
  Calendar,
  Check,
  ExternalLink,
  FileText,
  HelpCircle,
  Minus,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { IncomingItemWeightEntry, IncomingRequest } from '@/types/database'

import { FormPendingEmptyState } from './AircraftPanel'

type TechnicalProjectPanelProps = {
  incoming: Pick<
    IncomingRequest,
    | 'work_type'
    | 'target_date'
    | 'is_aog'
    | 'modification_summary'
    | 'operational_goal'
    | 'equipment_details'
    | 'has_drawings'
    | 'has_equipment'
    | 'has_manufacturer_docs'
    | 'has_previous_mod'
    | 'previous_mod_ref'
    | 'installation_drawings_urls'
    | 'installation_weight_kg'
    | 'items_weight_list'
    | 'fuselage_position'
    | 'sta_location'
    | 'affects_primary_structure'
    | 'ad_reference'
    | 'related_to_ad'
    | 'additional_notes'
    | 'existing_project_code'
    | 'impact_location'
    | 'impact_structural_attachment'
    | 'impact_structural_interface'
    | 'impact_electrical'
    | 'impact_avionics'
    | 'impact_cabin_layout'
    | 'impact_pressurized'
    | 'impact_operational_change'
  >
}

// ---------------------------------------------------------------------------
// Helpers de normalización (text legacy → semántica de UI)
// ---------------------------------------------------------------------------

type Trinary = 'yes' | 'no' | 'unknown'

function normalizeTrinary(value: string | null | undefined): Trinary {
  if (value === null || value === undefined) return 'unknown'
  const v = value.trim().toLowerCase()
  if (v === 'true' || v === 'yes' || v === '1') return 'yes'
  if (v === 'false' || v === 'no' || v === '0') return 'no'
  return 'unknown'
}

function isText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

const WORK_TYPE_LABEL: Record<string, string> = {
  new_project: 'New project',
  existing_modification: 'Existing modification',
}

const FUSELAGE_LABEL: Record<string, string> = {
  above_floor: 'Above floor',
  below_floor: 'Below floor',
  mid: 'Mid',
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date)
}

function formatWeight(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value.toLocaleString('en-GB', { maximumFractionDigits: 2 })} kg`
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function TechnicalProjectPanel({ incoming }: TechnicalProjectPanelProps) {
  const hasAnyData =
    isText(incoming.work_type) ||
    isText(incoming.target_date) ||
    isText(incoming.is_aog) ||
    isText(incoming.modification_summary) ||
    isText(incoming.operational_goal) ||
    isText(incoming.equipment_details) ||
    isText(incoming.has_drawings) ||
    isText(incoming.has_equipment) ||
    isText(incoming.has_manufacturer_docs) ||
    isText(incoming.has_previous_mod) ||
    isText(incoming.fuselage_position) ||
    isText(incoming.sta_location) ||
    isText(incoming.affects_primary_structure) ||
    isText(incoming.ad_reference) ||
    isText(incoming.related_to_ad) ||
    isText(incoming.additional_notes) ||
    isText(incoming.existing_project_code) ||
    (incoming.installation_drawings_urls?.length ?? 0) > 0 ||
    (incoming.items_weight_list?.length ?? 0) > 0 ||
    (incoming.installation_weight_kg !== null && incoming.installation_weight_kg !== undefined)

  if (!hasAnyData) {
    return <FormPendingEmptyState />
  }

  return (
    <div className="space-y-5">
      <SummaryBlock incoming={incoming} />
      <DocumentationBlock incoming={incoming} />
      <WeightAndPositionBlock incoming={incoming} />
      <ImpactBlock incoming={incoming} />
      <HistoryBlock incoming={incoming} />
      {isText(incoming.additional_notes) ? (
        <SubBlock title="Notes">
          <p className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--ink-2)]">
            {incoming.additional_notes!.trim()}
          </p>
        </SubBlock>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subbloques
// ---------------------------------------------------------------------------

function SummaryBlock({ incoming }: TechnicalProjectPanelProps) {
  const isAog = normalizeTrinary(incoming.is_aog) === 'yes'
  const formattedDate = formatDate(incoming.target_date)
  const workLabel = isText(incoming.work_type)
    ? WORK_TYPE_LABEL[incoming.work_type!] ?? incoming.work_type!
    : null

  return (
    <SubBlock title="Summary">
      <div className="flex flex-wrap items-center gap-2">
        {workLabel ? (
          <Pill tone="ink">{workLabel}</Pill>
        ) : null}
        {formattedDate ? (
          <Pill tone="ink">
            <Calendar className="h-3 w-3" />
            Target: {formattedDate}
          </Pill>
        ) : null}
        {isAog ? (
          <Pill tone="danger">
            <AlertTriangle className="h-3 w-3" />
            AOG
          </Pill>
        ) : null}
        {isText(incoming.existing_project_code) ? (
          <Pill tone="ink">Project: {incoming.existing_project_code}</Pill>
        ) : null}
      </div>

      {isText(incoming.modification_summary) ? (
        <Field label="Modification summary">
          <p className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--ink-2)]">
            {incoming.modification_summary!.trim()}
          </p>
        </Field>
      ) : null}

      {isText(incoming.operational_goal) ? (
        <Field label="Operational goal">
          <p className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--ink-2)]">
            {incoming.operational_goal!.trim()}
          </p>
        </Field>
      ) : null}
    </SubBlock>
  )
}

function DocumentationBlock({ incoming }: TechnicalProjectPanelProps) {
  const drawings = incoming.installation_drawings_urls ?? []
  const hasAny =
    isText(incoming.has_drawings) ||
    isText(incoming.has_equipment) ||
    isText(incoming.has_manufacturer_docs) ||
    isText(incoming.equipment_details) ||
    drawings.length > 0

  if (!hasAny) return null

  return (
    <SubBlock title="Documentation">
      <div className="grid gap-2 sm:grid-cols-3">
        <FlagRow label="Has drawings" value={incoming.has_drawings} />
        <FlagRow label="Has equipment" value={incoming.has_equipment} />
        <FlagRow label="Has manufacturer docs" value={incoming.has_manufacturer_docs} />
      </div>

      {isText(incoming.equipment_details) ? (
        <Field label="Equipment details">
          <p className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--ink-2)]">
            {incoming.equipment_details!.trim()}
          </p>
        </Field>
      ) : null}

      {drawings.length > 0 ? (
        <Field label={`Attached drawings (${drawings.length})`}>
          <ul className="flex flex-col gap-1.5">
            {drawings.map((url, index) => (
              <li key={`${url}-${index}`}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-sm text-[color:var(--cobalt)] hover:underline"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">PDF #{index + 1}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </Field>
      ) : null}
    </SubBlock>
  )
}

function WeightAndPositionBlock({ incoming }: TechnicalProjectPanelProps) {
  const items = incoming.items_weight_list ?? []
  const hasAny =
    incoming.installation_weight_kg !== null && incoming.installation_weight_kg !== undefined ||
    items.length > 0 ||
    isText(incoming.fuselage_position) ||
    isText(incoming.sta_location)

  if (!hasAny) return null

  const fuselageLabel = isText(incoming.fuselage_position)
    ? FUSELAGE_LABEL[incoming.fuselage_position!] ?? incoming.fuselage_position!
    : '—'

  return (
    <SubBlock title="Weight & position">
      <div className="grid gap-2 sm:grid-cols-3">
        <KeyValueCell label="Total installation weight" value={formatWeight(incoming.installation_weight_kg ?? null)} />
        <KeyValueCell label="Fuselage position" value={fuselageLabel} />
        <KeyValueCell label="STA" value={isText(incoming.sta_location) ? incoming.sta_location! : '—'} mono />
      </div>

      {items.length > 0 ? (
        <Field label={`Items (${items.length})`}>
          <ItemsWeightTable items={items} />
        </Field>
      ) : null}
    </SubBlock>
  )
}

function ImpactBlock({ incoming }: TechnicalProjectPanelProps) {
  const impacts: { label: string; value: string | null | undefined }[] = [
    { label: 'Location', value: incoming.impact_location },
    { label: 'Structural attachment', value: incoming.impact_structural_attachment },
    { label: 'Structural interface', value: incoming.impact_structural_interface },
    { label: 'Electrical', value: incoming.impact_electrical },
    { label: 'Avionics', value: incoming.impact_avionics },
    { label: 'Cabin layout', value: incoming.impact_cabin_layout },
    { label: 'Pressurized', value: incoming.impact_pressurized },
    { label: 'Operational change', value: incoming.impact_operational_change },
  ]

  const flagged = impacts.filter((entry) => {
    const trin = normalizeTrinary(entry.value)
    if (trin === 'yes') return true
    // also surface free-text impacts (e.g. "not_sure" o un string libre)
    return isText(entry.value) && trin !== 'no'
  })

  if (flagged.length === 0) {
    return (
      <SubBlock title="Impact">
        <p className="text-xs text-[color:var(--ink-3)]">No impacts reported.</p>
      </SubBlock>
    )
  }

  return (
    <SubBlock title="Impact">
      <div className="flex flex-wrap gap-2">
        {flagged.map((entry) => {
          const trin = normalizeTrinary(entry.value)
          const tone: PillTone = trin === 'yes' ? 'warn' : 'ink'
          const suffix =
            trin === 'yes' || trin === 'no'
              ? ''
              : isText(entry.value)
                ? `: ${entry.value!.trim()}`
                : ''
          return (
            <Pill key={entry.label} tone={tone}>
              {entry.label}
              {suffix}
            </Pill>
          )
        })}
      </div>
    </SubBlock>
  )
}

function HistoryBlock({ incoming }: TechnicalProjectPanelProps) {
  const hasAny =
    isText(incoming.has_previous_mod) ||
    isText(incoming.previous_mod_ref) ||
    isText(incoming.related_to_ad) ||
    isText(incoming.ad_reference) ||
    isText(incoming.affects_primary_structure)

  if (!hasAny) return null

  return (
    <SubBlock title="History & certification">
      <div className="grid gap-2 sm:grid-cols-2">
        <FlagRow label="Previous modification" value={incoming.has_previous_mod} />
        {isText(incoming.previous_mod_ref) ? (
          <KeyValueCell label="Previous reference" value={incoming.previous_mod_ref!} mono />
        ) : null}
        <FlagRow label="Related to AD" value={incoming.related_to_ad} />
        {isText(incoming.ad_reference) ? (
          <KeyValueCell label="AD reference" value={incoming.ad_reference!} mono />
        ) : null}
        <FlagRow
          label="Affects primary structure"
          value={incoming.affects_primary_structure}
        />
      </div>
    </SubBlock>
  )
}

// ---------------------------------------------------------------------------
// Primitivas visuales
// ---------------------------------------------------------------------------

function SubBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-4">
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
        {title}
      </h4>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
        {label}
      </p>
      {children}
    </div>
  )
}

function KeyValueCell({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 truncate text-sm text-[color:var(--ink)]',
          mono && 'font-mono',
          (value === '—' || value.length === 0) && 'text-[color:var(--ink-3)]',
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  )
}

function FlagRow({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  const trin = normalizeTrinary(value)
  let icon: React.ReactNode
  let toneClass: string
  let display: string

  if (trin === 'yes') {
    icon = <Check className="h-3.5 w-3.5" />
    toneClass = 'text-emerald-600'
    display = 'Yes'
  } else if (trin === 'no') {
    icon = <X className="h-3.5 w-3.5" />
    toneClass = 'text-[color:var(--ink-3)]'
    display = 'No'
  } else if (isText(value) && value!.trim().toLowerCase() === 'not_sure') {
    icon = <HelpCircle className="h-3.5 w-3.5" />
    toneClass = 'text-amber-600'
    display = 'Not sure'
  } else if (isText(value)) {
    icon = <HelpCircle className="h-3.5 w-3.5" />
    toneClass = 'text-amber-600'
    display = value!.trim()
  } else {
    icon = <Minus className="h-3.5 w-3.5" />
    toneClass = 'text-[color:var(--ink-3)]'
    display = 'No data'
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-2">
      <span className={cn('shrink-0', toneClass)}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
          {label}
        </p>
        <p className={cn('truncate text-sm', toneClass)} title={display}>
          {display}
        </p>
      </div>
    </div>
  )
}

type PillTone = 'ink' | 'warn' | 'danger'

function Pill({
  children,
  tone = 'ink',
}: {
  children: React.ReactNode
  tone?: PillTone
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-300 bg-red-50 text-red-600'
      : tone === 'warn'
        ? 'border-amber-300 bg-amber-50 text-amber-700'
        : 'border-[color:var(--ink-4)] bg-[color:var(--paper)] text-[color:var(--ink-2)]'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]',
        toneClass,
      )}
    >
      {children}
    </span>
  )
}

function ItemsWeightTable({ items }: { items: IncomingItemWeightEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-[color:var(--paper-2)] text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
          <tr>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2 text-right">Added (kg)</th>
            <th className="px-3 py-2 text-right">Removed (kg)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--ink-4)] text-[color:var(--ink-2)]">
          {items.map((item, index) => (
            <tr key={`${item.name ?? 'item'}-${index}`}>
              <td className="px-3 py-2">{item.name?.trim() || '—'}</td>
              <td className="px-3 py-2 text-right font-mono">
                {item.weight_added_kg !== null && item.weight_added_kg !== undefined
                  ? item.weight_added_kg.toLocaleString('en-GB', { maximumFractionDigits: 2 })
                  : '—'}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {item.weight_removed_kg !== null && item.weight_removed_kg !== undefined
                  ? item.weight_removed_kg.toLocaleString('en-GB', { maximumFractionDigits: 2 })
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
