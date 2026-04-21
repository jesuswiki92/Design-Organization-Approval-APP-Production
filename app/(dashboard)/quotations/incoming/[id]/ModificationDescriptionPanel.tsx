'use client'

import { useCallback, useState } from 'react'
import {
  ChevronDown,
  FileText,
  Loader2,
  Sparkles,
  Download,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WeightItem {
  item: string
  weight_added_kg: number
  weight_removed_kg: number
}

interface ModificationDescriptionPanelProps {
  consultationId: string
  consultationData: {
    aircraft_manufacturer?: string | null
    aircraft_model?: string | null
    aircraft_msn?: string | null
    tcds_number?: string | null
    work_type?: string | null
    modification_summary?: string | null
    operational_goal?: string | null
    impact_location?: string | null
    impact_structural_attachment?: string | null
    impact_structural_interface?: string | null
    impact_electrical?: string | null
    impact_avionics?: string | null
    impact_cabin_layout?: string | null
    impact_pressurized?: string | null
    impact_operational_change?: string | null
    estimated_weight_kg?: number | string | null
    items_weight_list?: WeightItem[] | null
    fuselage_position?: string | null
    sta_location?: string | null
    affects_primary_structure?: string | null
    related_to_ad?: string | null
    ad_reference?: string | null
    mtow_kg?: number | null
    additional_notes?: string | null
  }
}

// ---------------------------------------------------------------------------
// Section definition
// ---------------------------------------------------------------------------

type SectionStatus = 'filled' | 'partial' | 'empty'

interface DocumentSection {
  number: number
  sub?: string
  title: string
  getDefaultContent: (data: ModificationDescriptionPanelProps['consultationData']) => string
  getStatus: (data: ModificationDescriptionPanelProps['consultationData']) => SectionStatus
}

function str(val: string | number | null | undefined): string {
  if (val == null) return ''
  return String(val).trim()
}

function hasValue(val: string | number | null | undefined): boolean {
  return str(val).length > 0
}

// ---------------------------------------------------------------------------
// Infer affected manuals from impacts
// ---------------------------------------------------------------------------

function inferAffectedManuals(data: ModificationDescriptionPanelProps['consultationData']): string[] {
  const manuals: string[] = []
  const weight = data.estimated_weight_kg
    ? typeof data.estimated_weight_kg === 'string'
      ? parseFloat(data.estimated_weight_kg)
      : data.estimated_weight_kg
    : 0
  if (weight && weight !== 0) manuals.push('Weight & Balance Manual (WBM)')
  if (hasValue(data.impact_operational_change)) manuals.push('Aircraft Flight Manual (AFM)')
  if (hasValue(data.impact_electrical) || hasValue(data.impact_avionics)) manuals.push('Electrical Load Analysis (ELA)')
  if (hasValue(data.impact_cabin_layout)) manuals.push('Cabin Crew Operating Manual (CCOM)')
  if (hasValue(data.impact_structural_attachment) || hasValue(data.affects_primary_structure)) manuals.push('Structural Repair Manual (SRM)')
  return manuals
}

// ---------------------------------------------------------------------------
// Section definitions (3-13)
// ---------------------------------------------------------------------------

const SECTIONS: DocumentSection[] = [
  {
    number: 3,
    title: 'OBJECTIVE AND SCOPE',
    getDefaultContent: (d) => {
      if (!hasValue(d.modification_summary)) return ''
      const aircraft = [str(d.aircraft_manufacturer), str(d.aircraft_model)].filter(Boolean).join(' ')
      return `The purpose of this document is to describe the ${str(d.modification_summary)}${aircraft ? ` on ${aircraft}` : ''}.`
    },
    getStatus: (d) => hasValue(d.modification_summary) ? 'filled' : 'empty',
  },
  {
    number: 4,
    title: 'DEFINITIONS AND ACRONYMS',
    getDefaultContent: () => '',
    getStatus: () => 'empty',
  },
  {
    number: 5,
    title: 'APPLICABILITY',
    getDefaultContent: (d) => {
      const parts: string[] = []
      if (hasValue(d.aircraft_model)) parts.push(str(d.aircraft_model))
      if (hasValue(d.aircraft_msn)) parts.push(`MSN: ${str(d.aircraft_msn)}`)
      if (hasValue(d.tcds_number)) parts.push(`TCDS: ${str(d.tcds_number)}`)
      if (parts.length === 0) return ''
      return `This document is applicable to ${parts.join(', ')}.`
    },
    getStatus: (d) => {
      const count = [d.aircraft_model, d.aircraft_msn, d.tcds_number].filter(hasValue).length
      if (count >= 2) return 'filled'
      if (count >= 1) return 'partial'
      return 'empty'
    },
  },
  {
    number: 6,
    title: 'REFERENCE DOCUMENTS',
    getDefaultContent: (d) => {
      const lines: string[] = []
      if (hasValue(d.tcds_number)) lines.push(`- TCDS: ${str(d.tcds_number)} (Certification basis)`)
      if (hasValue(d.related_to_ad) && str(d.related_to_ad).toLowerCase() !== 'no') {
        lines.push(`- AD: ${str(d.ad_reference) || 'Reference pending'}`)
      }
      return lines.join('\n')
    },
    getStatus: (d) => hasValue(d.tcds_number) ? 'partial' : 'empty',
  },
  {
    number: 7,
    sub: '7.1',
    title: 'DESIGN CHANGE DESCRIPTION -- Initial Configuration',
    getDefaultContent: (d) => {
      const parts: string[] = []
      if (hasValue(d.aircraft_manufacturer)) parts.push(`Manufacturer: ${str(d.aircraft_manufacturer)}`)
      if (hasValue(d.aircraft_model)) parts.push(`Model: ${str(d.aircraft_model)}`)
      if (hasValue(d.aircraft_msn)) parts.push(`MSN: ${str(d.aircraft_msn)}`)
      return parts.join('\n')
    },
    getStatus: (d) => {
      const count = [d.aircraft_manufacturer, d.aircraft_model, d.aircraft_msn].filter(hasValue).length
      if (count >= 2) return 'filled'
      if (count >= 1) return 'partial'
      return 'empty'
    },
  },
  {
    number: 7,
    sub: '7.2',
    title: 'DESIGN CHANGE DESCRIPTION -- Final Configuration',
    getDefaultContent: (d) => {
      const lines: string[] = []
      if (hasValue(d.modification_summary)) lines.push(str(d.modification_summary))
      if (hasValue(d.operational_goal)) lines.push(`Operational goal: ${str(d.operational_goal)}`)
      return lines.join('\n\n')
    },
    getStatus: (d) => hasValue(d.modification_summary) ? 'filled' : 'empty',
  },
  {
    number: 7,
    sub: '7.3',
    title: 'DESIGN CHANGE DESCRIPTION -- Affected Areas',
    getDefaultContent: (d) => {
      const lines: string[] = []
      if (hasValue(d.impact_location)) lines.push(`- Location: ${str(d.impact_location)}`)
      if (hasValue(d.impact_structural_attachment)) lines.push(`- Structural attachment: ${str(d.impact_structural_attachment)}`)
      if (hasValue(d.impact_electrical)) lines.push(`- Electrical: ${str(d.impact_electrical)}`)
      if (hasValue(d.impact_avionics)) lines.push(`- Avionics: ${str(d.impact_avionics)}`)
      if (hasValue(d.impact_cabin_layout)) lines.push(`- Cabin layout: ${str(d.impact_cabin_layout)}`)
      if (hasValue(d.impact_pressurized)) lines.push(`- Pressurized area: ${str(d.impact_pressurized)}`)
      if (hasValue(d.impact_operational_change)) lines.push(`- Operational change: ${str(d.impact_operational_change)}`)
      return lines.join('\n')
    },
    getStatus: (d) => {
      const impacts = [
        d.impact_location, d.impact_structural_attachment, d.impact_electrical,
        d.impact_avionics, d.impact_cabin_layout, d.impact_pressurized, d.impact_operational_change,
      ]
      const count = impacts.filter(hasValue).length
      if (count >= 3) return 'filled'
      if (count >= 1) return 'partial'
      return 'empty'
    },
  },
  {
    number: 7,
    sub: '7.4',
    title: 'DESIGN CHANGE DESCRIPTION -- Affected Approved Manuals',
    getDefaultContent: (d) => {
      const manuals = inferAffectedManuals(d)
      if (manuals.length === 0) return ''
      return manuals.map((m) => `- ${m}`).join('\n')
    },
    getStatus: (d) => {
      const manuals = inferAffectedManuals(d)
      if (manuals.length >= 2) return 'filled'
      if (manuals.length >= 1) return 'partial'
      return 'empty'
    },
  },
  {
    number: 8,
    sub: '8.1',
    title: 'DEFINITION OF DESIGN -- Assembled Components',
    getDefaultContent: (d) => {
      const items = Array.isArray(d.items_weight_list) ? d.items_weight_list : []
      if (items.length === 0) return ''
      return items
        .filter((i) => i.weight_added_kg > 0)
        .map((i) => `- ${i.item}: +${i.weight_added_kg} kg`)
        .join('\n')
    },
    getStatus: (d) => {
      const items = Array.isArray(d.items_weight_list) ? d.items_weight_list : []
      return items.some((i) => i.weight_added_kg > 0) ? 'filled' : 'empty'
    },
  },
  {
    number: 8,
    sub: '8.2',
    title: 'DEFINITION OF DESIGN -- Disassembled Components',
    getDefaultContent: (d) => {
      const items = Array.isArray(d.items_weight_list) ? d.items_weight_list : []
      if (items.length === 0) return ''
      const removed = items.filter((i) => i.weight_removed_kg > 0)
      if (removed.length === 0) return 'No components removed.'
      return removed.map((i) => `- ${i.item}: -${i.weight_removed_kg} kg`).join('\n')
    },
    getStatus: (d) => {
      const items = Array.isArray(d.items_weight_list) ? d.items_weight_list : []
      return items.some((i) => i.weight_removed_kg > 0) ? 'filled' : 'empty'
    },
  },
  {
    number: 8,
    sub: '8.3',
    title: 'DEFINITION OF DESIGN -- Electrical Connections',
    getDefaultContent: (d) => hasValue(d.impact_electrical) ? str(d.impact_electrical) : '',
    getStatus: (d) => hasValue(d.impact_electrical) ? 'partial' : 'empty',
  },
  {
    number: 8,
    sub: '8.4',
    title: 'DEFINITION OF DESIGN -- Structural Provisions',
    getDefaultContent: (d) => {
      const lines: string[] = []
      if (hasValue(d.impact_structural_attachment)) lines.push(`Attachment: ${str(d.impact_structural_attachment)}`)
      if (hasValue(d.impact_structural_interface)) lines.push(`Interface: ${str(d.impact_structural_interface)}`)
      if (hasValue(d.affects_primary_structure)) lines.push(`Affects primary structure (PSE): ${str(d.affects_primary_structure)}`)
      if (hasValue(d.sta_location)) lines.push(`STA location: ${str(d.sta_location)}`)
      return lines.join('\n')
    },
    getStatus: (d) => {
      const count = [d.impact_structural_attachment, d.impact_structural_interface, d.affects_primary_structure, d.sta_location].filter(hasValue).length
      if (count >= 2) return 'filled'
      if (count >= 1) return 'partial'
      return 'empty'
    },
  },
  {
    number: 8,
    sub: '8.5',
    title: 'DEFINITION OF DESIGN -- Equipment Qualification',
    getDefaultContent: () => '',
    getStatus: () => 'empty',
  },
  {
    number: 9,
    title: 'SYSTEM OPERATION',
    getDefaultContent: (d) => {
      const lines: string[] = []
      if (hasValue(d.impact_operational_change)) lines.push(str(d.impact_operational_change))
      if (hasValue(d.operational_goal)) lines.push(`Operational goal: ${str(d.operational_goal)}`)
      return lines.join('\n\n')
    },
    getStatus: (d) => {
      if (hasValue(d.impact_operational_change) && hasValue(d.operational_goal)) return 'filled'
      if (hasValue(d.impact_operational_change) || hasValue(d.operational_goal)) return 'partial'
      return 'empty'
    },
  },
  {
    number: 10,
    title: 'ELECTRICAL BALANCE',
    getDefaultContent: () => '',
    getStatus: () => 'empty',
  },
  {
    number: 11,
    title: 'WEIGHT AND BALANCE',
    getDefaultContent: (d) => {
      const lines: string[] = []
      const weight = d.estimated_weight_kg
        ? typeof d.estimated_weight_kg === 'string'
          ? parseFloat(d.estimated_weight_kg)
          : d.estimated_weight_kg
        : null
      if (weight != null) lines.push(`Estimated net weight change: ${weight > 0 ? '+' : ''}${weight} kg`)
      if (d.mtow_kg) lines.push(`MTOW: ${d.mtow_kg.toLocaleString()} kg`)
      if (weight && d.mtow_kg) {
        const pct = ((Math.abs(weight) / d.mtow_kg) * 100).toFixed(2)
        lines.push(`Weight ratio: ${pct}% of MTOW`)
      }
      if (hasValue(d.fuselage_position)) lines.push(`Fuselage position: ${str(d.fuselage_position)}`)
      if (hasValue(d.sta_location)) lines.push(`STA: ${str(d.sta_location)}`)

      const items = Array.isArray(d.items_weight_list) ? d.items_weight_list : []
      if (items.length > 0) {
        lines.push('')
        lines.push('Items breakdown:')
        items.forEach((i) => {
          lines.push(`  - ${i.item}: +${i.weight_added_kg} kg / -${i.weight_removed_kg} kg`)
        })
      }
      return lines.join('\n')
    },
    getStatus: (d) => {
      const hasWeight = hasValue(d.estimated_weight_kg)
      const hasItems = Array.isArray(d.items_weight_list) && d.items_weight_list.length > 0
      if (hasWeight && hasItems) return 'filled'
      if (hasWeight || hasItems) return 'partial'
      return 'empty'
    },
  },
  {
    number: 12,
    title: 'VENTILATION AND DRAINAGE',
    getDefaultContent: (d) => hasValue(d.impact_pressurized) ? `Pressurized area: ${str(d.impact_pressurized)}` : '',
    getStatus: (d) => hasValue(d.impact_pressurized) ? 'partial' : 'empty',
  },
  {
    number: 13,
    title: 'MODIFICATION INTERFACE',
    getDefaultContent: (d) => {
      const lines: string[] = []
      if (hasValue(d.impact_structural_interface)) lines.push(`Structural interface: ${str(d.impact_structural_interface)}`)
      if (hasValue(d.impact_electrical)) lines.push(`Electrical interface: ${str(d.impact_electrical)}`)
      return lines.join('\n')
    },
    getStatus: (d) => {
      const count = [d.impact_structural_interface, d.impact_electrical].filter(hasValue).length
      if (count >= 2) return 'filled'
      if (count >= 1) return 'partial'
      return 'empty'
    },
  },
]

// ---------------------------------------------------------------------------
// Status indicator component
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: SectionStatus }) {
  const config = {
    filled: { bg: 'bg-emerald-400', label: 'Auto-filled' },
    partial: { bg: 'bg-amber-400', label: 'Partial' },
    empty: { bg: 'bg-[color:var(--paper-3)]', label: 'Empty' },
  }
  const { bg, label } = config[status]
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <span className={`inline-block h-2 w-2 rounded-full ${bg}`} />
      <span className="text-[10px] text-[color:var(--ink-3)]">{label}</span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ModificationDescriptionPanel({
  consultationId,
  consultationData,
}: ModificationDescriptionPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  // Initialize section contents from consultation data
  const [sectionContents, setSectionContents] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const section of SECTIONS) {
      const key = section.sub ?? String(section.number)
      initial[key] = section.getDefaultContent(consultationData)
    }
    return initial
  })

  const updateSection = useCallback((key: string, value: string) => {
    setSectionContents((prev) => ({ ...prev, [key]: value }))
  }, [])

  // Compute overall stats
  const filledCount = SECTIONS.filter((s) => {
    const key = s.sub ?? String(s.number)
    return sectionContents[key]?.trim()
  }).length
  const totalCount = SECTIONS.length

  // Compute actual statuses based on current content
  const sectionStatuses: Record<string, SectionStatus> = {}
  for (const section of SECTIONS) {
    const key = section.sub ?? String(section.number)
    const content = sectionContents[key] ?? ''
    if (content.trim()) {
      const dataStatus = section.getStatus(consultationData)
      sectionStatuses[key] = dataStatus === 'empty' ? 'filled' : dataStatus
    } else {
      sectionStatuses[key] = 'empty'
    }
  }

  // AI pre-fill handler (placeholder -- will call API in the future)
  const handleAIAnalyze = useCallback(async () => {
    setAnalyzing(true)
    try {
      const res = await fetch(`/api/incoming-requests/${consultationId}/modification-description/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultationData }),
      })

      if (!res.ok) {
        console.error('ModificationDescriptionPanel: AI analysis failed', await res.text())
        return
      }

      const data = await res.json()
      if (data.sections && typeof data.sections === 'object') {
        setSectionContents((prev) => {
          const updated = { ...prev }
          for (const [key, value] of Object.entries(data.sections as Record<string, string>)) {
            if (typeof value === 'string' && value.trim()) {
              updated[key] = value
            }
          }
          return updated
        })
      }
    } catch (error) {
      console.error('ModificationDescriptionPanel: AI analysis error', error)
    } finally {
      setAnalyzing(false)
    }
  }, [consultationId, consultationData])

  return (
    <div className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)]">
      {/* Header - clickable to toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-[color:var(--ink-3)]" />
          <h4 className="text-sm font-semibold text-[color:var(--ink)]">
            G12-17 Modification Description
          </h4>

          {/* Progress badge */}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              filledCount === totalCount
                ? 'bg-emerald-50 text-emerald-700'
                : filledCount > 0
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)]'
            }`}
          >
            {filledCount}/{totalCount} secciones
          </span>
        </div>

        <ChevronDown
          className={`h-4 w-4 text-[color:var(--ink-3)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div className="border-t border-[color:var(--ink-4)] px-5 pb-5 pt-4">
          {/* Actions bar */}
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={handleAIAnalyze}
              disabled={analyzing}
              className="flex items-center gap-1.5 rounded-md bg-[color:var(--paper-2)] px-3 py-1.5 text-xs font-medium text-[color:var(--ink-3)] transition-colors hover:bg-[color:var(--paper-3)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analizando con IA...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Pre-rellenar con IA
                </>
              )}
            </button>

            <button
              disabled
              className="flex items-center gap-1.5 rounded-md bg-[color:var(--paper-2)] px-3 py-1.5 text-xs font-medium text-[color:var(--ink-3)] cursor-not-allowed"
              title="Proximamente"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar borrador
            </button>
          </div>

          {/* Section cards */}
          <div className="space-y-3">
            {SECTIONS.map((section) => {
              const key = section.sub ?? String(section.number)
              return (
                <SectionCardWithStatus
                  key={key}
                  section={section}
                  content={sectionContents[key] ?? ''}
                  status={sectionStatuses[key] ?? 'empty'}
                  onChange={(value) => updateSection(key, value)}
                />
              )
            })}
          </div>

          {/* Summary */}
          <div className="mt-5 flex items-center justify-between rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-3">
            <span className="text-xs text-[color:var(--ink-3)]">
              {filledCount}/{totalCount} secciones con contenido
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] text-[color:var(--ink-3)]">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> Auto-filled
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-[color:var(--ink-3)]">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> Partial
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-[color:var(--ink-3)]">
                <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--paper-3)]" /> Empty
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section card with external status
// ---------------------------------------------------------------------------

function SectionCardWithStatus({
  section,
  content,
  status,
  onChange,
}: {
  section: DocumentSection
  content: string
  status: SectionStatus
  onChange: (value: string) => void
}) {
  const sectionLabel = section.sub ?? String(section.number)
  const titleClean = section.title
    .replace(/^DESIGN CHANGE DESCRIPTION -- /, '')
    .replace(/^DEFINITION OF DESIGN -- /, '')

  return (
    <div className="rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)]">
      <div className="flex items-center justify-between border-b border-[color:var(--ink-4)] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded bg-[color:var(--paper-2)] px-1.5 text-[10px] font-bold text-[color:var(--ink-2)]">
            {sectionLabel}
          </span>
          <span className="text-xs font-semibold text-[color:var(--ink-2)]">{titleClean}</span>
        </div>
        <StatusDot status={status} />
      </div>
      <div className="p-3">
        {content.trim() ? (
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            rows={Math.max(2, content.split('\n').length + 1)}
            className="w-full resize-y rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/50 px-3 py-2 text-xs leading-relaxed text-[color:var(--ink-2)] placeholder-[color:var(--ink-4)] focus:border-[color:var(--ink-4)] focus:outline-none focus:ring-1 focus:ring-[color:var(--ink-4)]"
          />
        ) : (
          <div className="flex items-center justify-center rounded-md border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/30 py-4">
            <p className="text-xs italic text-[color:var(--ink-3)]">
              Pending de data / Requires engineering input
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
