/**
 * ============================================================================
 * DOCUMENTATION PANEL — Master Document List preview
 * ============================================================================
 * Auto-populated MDL based on the project classification (or a Minor / non-
 * repair default when no classification is saved yet) joined against
 * `doa_document_templates`. Templates that belong to the suggested
 * archetype's `typical_documents` list are highlighted with a star.
 * ============================================================================
 */

"use client"

import { FileText, Star } from "lucide-react"

import { cn } from "@/lib/utils"
import type {
  DocumentRequiredEntry,
  ProjectClassificationKind,
} from "@/types/database"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type DocumentationPanelProps = {
  /** Joined matrix + template rows already filtered to applicable documents. */
  entries: DocumentRequiredEntry[]
  /** Total number of templates in the catalog (used in the header). */
  totalCatalog: number
  /** Resolved classification — null when defaulting to Minor + non-repair. */
  classification: ProjectClassificationKind | null
  /** True when the resolved classification is repair. */
  isRepair: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentationPanel({
  entries,
  totalCatalog,
  classification,
  isRepair,
}: DocumentationPanelProps) {
  const requiredCount = entries.filter((entry) => entry.requirement === "required").length
  const conditionalCount = entries.filter(
    (entry) => entry.requirement === "conditional",
  ).length

  // Build a friendly label for the resolved classification, e.g. "Minor change",
  // "Major repair", or the conservative default.
  const classificationLabel = (() => {
    if (!classification) return "Minor change (default — no classification saved yet)"
    const kind = classification === "major" ? "Major" : "Minor"
    const type = isRepair ? "repair" : "change"
    return `${kind} ${type}`
  })()

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper)] px-5 py-8 text-center">
        <p className="text-sm font-medium text-[color:var(--ink-2)]">
          Document matrix not yet available
        </p>
        <p className="mt-1.5 text-xs text-[color:var(--ink-3)]">
          Seed `doa_documents_required_matrix` and `doa_document_templates` to enable this
          panel.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header — counts and classification context */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
            Master Document List
          </p>
          <p className="mt-0.5 text-sm font-medium text-[color:var(--ink)]">
            {classificationLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
            {requiredCount} required
          </span>
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-700">
            {conditionalCount} conditional
          </span>
          <span className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2.5 py-0.5 font-semibold text-[color:var(--ink-3)]">
            {totalCatalog} in catalog
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[color:var(--paper)] text-[10px] uppercase tracking-[0.12em] text-[color:var(--ink-3)]">
            <tr>
              <th className="px-4 py-2 font-semibold">Code</th>
              <th className="px-4 py-2 font-semibold">Title</th>
              <th className="px-4 py-2 font-semibold">Category</th>
              <th className="px-4 py-2 font-semibold text-right">Required</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--ink-4)]/60">
            {entries.map((entry) => (
              <tr key={entry.template_code} className="hover:bg-[color:var(--paper)]/40">
                <td className="whitespace-nowrap px-4 py-2 font-mono text-[12px] text-[color:var(--ink-2)]">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3 w-3 text-[color:var(--ink-3)]" />
                    {entry.template_code}
                    {entry.is_typical_for_archetype ? (
                      <Star
                        className="h-3 w-3 fill-amber-400 text-amber-400"
                        aria-label="Typical for detected archetype"
                      />
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-2 text-[color:var(--ink)]">{entry.title}</td>
                <td className="px-4 py-2 text-[11px] uppercase tracking-[0.1em] text-[color:var(--ink-3)]">
                  {entry.doc_category}
                </td>
                <td className="px-4 py-2 text-right">
                  <RequirementBadge requirement={entry.requirement} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RequirementBadge({
  requirement,
}: {
  requirement: DocumentRequiredEntry["requirement"]
}) {
  if (requirement === "required") {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-700">
        Required
      </span>
    )
  }
  if (requirement === "conditional") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-700">
        Conditional
      </span>
    )
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2 py-0.5",
        "text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--ink-3)]",
      )}
    >
      n/a
    </span>
  )
}
