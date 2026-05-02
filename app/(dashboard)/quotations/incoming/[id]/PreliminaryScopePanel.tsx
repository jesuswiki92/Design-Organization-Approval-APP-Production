/**
 * ============================================================================
 * PRELIMINARY SCOPE PANEL — Similar reference projects
 * ============================================================================
 * Displays the suggested project archetype (heuristic match against
 * `incoming.subject`) and up to 3 reference projects from `doa_projects_v2`
 * with `metadata.reference_template = true`.
 *
 * The "Use as template" action is a stub for now: it shows a toast. Cloning
 * a reference project is phase 2 work.
 * ============================================================================
 */

"use client"

import { ExternalLink, FileText, Plane, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import type { ProjectArchetype, ProjectV2 } from "@/types/database"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type PreliminaryScopePanelProps = {
  /** Archetype matched against the subject; null when nothing matched. */
  detectedArchetype: ProjectArchetype | null
  /** Up to 3 reference projects to show as candidate templates. */
  referenceProjects: ProjectV2[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PreliminaryScopePanel({
  detectedArchetype,
  referenceProjects,
}: PreliminaryScopePanelProps) {
  return (
    <div className="space-y-4">
      {/* Header banner — detected archetype */}
      <div
        className={cn(
          "flex items-start gap-3 rounded-2xl border px-4 py-3",
          detectedArchetype
            ? "border-[color:var(--cobalt)]/40 bg-[color:var(--cobalt)]/5 text-[color:var(--ink)]"
            : "border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-[color:var(--ink-2)]",
        )}
      >
        <Sparkles
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            detectedArchetype ? "text-[color:var(--cobalt)]" : "text-[color:var(--ink-3)]",
          )}
        />
        <div className="min-w-0">
          {detectedArchetype ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                Detected archetype
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[color:var(--ink)]">
                {detectedArchetype.title}
              </p>
              {detectedArchetype.description ? (
                <p className="mt-0.5 text-xs text-[color:var(--ink-3)]">
                  {detectedArchetype.description}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">No archetype detected</p>
              <p className="mt-0.5 text-xs text-[color:var(--ink-3)]">
                Showing all reference templates as fallback.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Reference projects grid */}
      {referenceProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper)] px-5 py-8 text-center">
          <p className="text-sm font-medium text-[color:var(--ink-2)]">
            No reference projects available
          </p>
          <p className="mt-1.5 text-xs text-[color:var(--ink-3)]">
            Mark some projects with `metadata.reference_template = true` to use them as
            templates.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {referenceProjects.map((project) => (
            <ReferenceProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReferenceProjectCard({ project }: { project: ProjectV2 }) {
  const aircraftType = metadataString(project.metadata, "aircraft_type")
  const certBasis = metadataString(project.metadata, "cert_basis")
  const scope = metadataString(project.metadata, "scope")
  const tcds = metadataString(project.metadata, "tcds")

  const isMajor = project.classification === "major"

  function handleUseAsTemplate() {
    toast.info(
      `Template clone is not yet implemented. Selected: ${project.project_code}`,
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
            {project.project_code}
          </p>
          <h4 className="mt-0.5 line-clamp-2 font-[family-name:var(--font-heading)] text-sm font-semibold text-[color:var(--ink)]">
            {project.title}
          </h4>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
            isMajor
              ? "border-[color:var(--terracotta)]/40 bg-[color:var(--terracotta)]/10 text-[color:var(--terracotta)]"
              : "border-emerald-300 bg-emerald-50 text-emerald-700",
          )}
        >
          {project.classification ?? "—"}
        </span>
      </div>

      {/* Body data */}
      <div className="space-y-1.5 text-xs text-[color:var(--ink-2)]">
        {aircraftType ? (
          <p className="flex items-center gap-1.5">
            <Plane className="h-3 w-3 shrink-0 text-[color:var(--ink-3)]" />
            <span>{aircraftType}</span>
          </p>
        ) : null}
        {tcds ? (
          <p className="flex items-center gap-1.5">
            <FileText className="h-3 w-3 shrink-0 text-[color:var(--ink-3)]" />
            <span className="font-mono">{tcds}</span>
          </p>
        ) : null}
        {certBasis ? (
          <p className="text-[color:var(--ink-3)]">
            <span className="font-semibold uppercase tracking-[0.1em]">Cert basis: </span>
            {certBasis}
          </p>
        ) : null}
        {scope ? (
          <p className="line-clamp-2 text-[color:var(--ink-3)] italic">{scope}</p>
        ) : null}
      </div>

      {/* Action */}
      <button
        type="button"
        onClick={handleUseAsTemplate}
        className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--paper-3)]"
      >
        <ExternalLink className="h-3 w-3" />
        Use as template
      </button>
    </div>
  )
}
