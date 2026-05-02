/**
 * ============================================================================
 * REVIEW SUMMARY PANEL — Major/Minor classification wizard
 * ============================================================================
 * Lets the lead engineer answer the 7 generic GM 21.A.91 triggers (GT-A..G)
 * with Yes / No / Unknown and pick a final Major/Minor decision with a free
 * text justification. Persists via POST /api/incoming-requests/[id]/classification
 * which upserts a `doa_projects_v2` row + a `doa_project_classifications` row.
 *
 * Visual logic:
 *   - any trigger answered Yes  -> "Major change suggested" (terracotta)
 *   - all triggers No           -> "Minor change suggested" (emerald)
 *   - any Unknown left          -> "Pending classification" (amber)
 * ============================================================================
 */

"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2, HelpCircle, Loader2, Save } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import type {
  ClassificationTrigger,
  ProjectClassification,
  ProjectClassificationKind,
} from "@/types/database"

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type TriggerAnswer = "yes" | "no" | "unknown"

type TriggerKey =
  | "trigger_a_general_configuration"
  | "trigger_b_principles_construction"
  | "trigger_c_assumptions_invalidated"
  | "trigger_d_appreciable_effect"
  | "trigger_e_cert_basis_adjustment"
  | "trigger_f_compliance_not_accepted"
  | "trigger_g_agency_limitations_altered"

/** Map GT-A..G code -> column on `doa_project_classifications`. */
const TRIGGER_KEY_BY_CODE: Record<string, TriggerKey> = {
  "GT-A": "trigger_a_general_configuration",
  "GT-B": "trigger_b_principles_construction",
  "GT-C": "trigger_c_assumptions_invalidated",
  "GT-D": "trigger_d_appreciable_effect",
  "GT-E": "trigger_e_cert_basis_adjustment",
  "GT-F": "trigger_f_compliance_not_accepted",
  "GT-G": "trigger_g_agency_limitations_altered",
}

function answerFromBool(value: boolean | null | undefined): TriggerAnswer {
  if (value === true) return "yes"
  if (value === false) return "no"
  return "unknown"
}

function answerToBool(value: TriggerAnswer): boolean | null {
  if (value === "yes") return true
  if (value === "no") return false
  return null
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ReviewSummaryPanelProps = {
  incomingId: string
  triggers: ClassificationTrigger[]
  /** Existing classification, if there is already a v2 project for this incoming. */
  existingClassification: ProjectClassification | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewSummaryPanel({
  incomingId,
  triggers,
  existingClassification,
}: ReviewSummaryPanelProps) {
  const router = useRouter()

  const initialAnswers = useMemo<Record<string, TriggerAnswer>>(() => {
    const out: Record<string, TriggerAnswer> = {}
    for (const t of triggers) {
      const key = TRIGGER_KEY_BY_CODE[t.code]
      if (!key) {
        out[t.code] = "unknown"
        continue
      }
      out[t.code] = existingClassification
        ? answerFromBool(existingClassification[key])
        : "unknown"
    }
    return out
  }, [triggers, existingClassification])

  const [answers, setAnswers] = useState<Record<string, TriggerAnswer>>(initialAnswers)
  const [decision, setDecision] = useState<ProjectClassificationKind | "">(
    existingClassification?.decision ?? "",
  )
  const [justification, setJustification] = useState<string>(
    existingClassification?.final_statement ?? "",
  )
  const [saving, setSaving] = useState(false)

  // Compute suggested classification from current answers.
  const summary = useMemo(() => {
    const values = Object.values(answers)
    const anyYes = values.includes("yes")
    const anyUnknown = values.includes("unknown")
    if (anyYes) {
      const positive = triggers.find((t) => answers[t.code] === "yes")
      return {
        kind: "major" as const,
        reason: positive
          ? `Trigger ${positive.code} marked positive`
          : "At least one trigger marked positive",
      }
    }
    if (anyUnknown) {
      return { kind: "pending" as const, reason: "Some triggers still unknown" }
    }
    return {
      kind: "minor" as const,
      reason: "All generic triggers answered negative",
    }
  }, [answers, triggers])

  function setAnswer(code: string, value: TriggerAnswer) {
    setAnswers((prev) => ({ ...prev, [code]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload: {
        triggers: Record<string, boolean | null>
        decision: ProjectClassificationKind | null
        justification: string
      } = {
        triggers: {},
        decision: decision === "" ? null : decision,
        justification,
      }

      for (const t of triggers) {
        const key = TRIGGER_KEY_BY_CODE[t.code]
        if (!key) continue
        payload.triggers[key] = answerToBool(answers[t.code] ?? "unknown")
      }

      const res = await fetch(
        `/api/incoming-requests/${incomingId}/classification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
      }
      if (!res.ok || !json.ok) {
        toast.error(`Could not save classification: ${json.error ?? res.status}`)
        return
      }
      toast.success("Classification saved")
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error(`Could not save classification: ${message}`)
    } finally {
      setSaving(false)
    }
  }

  if (triggers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper)] px-5 py-8 text-center">
        <p className="text-sm font-medium text-[color:var(--ink-2)]">
          Classification triggers not yet available
        </p>
        <p className="mt-1.5 text-xs text-[color:var(--ink-3)]">
          The trigger catalog is empty. Seed `doa_classification_triggers` to enable this panel.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Suggested classification banner */}
      <SuggestionBadge kind={summary.kind} reason={summary.reason} />

      {/* Trigger questions list */}
      <div className="space-y-2">
        {triggers.map((trigger) => (
          <TriggerRow
            key={trigger.code}
            trigger={trigger}
            answer={answers[trigger.code] ?? "unknown"}
            onChange={(value) => setAnswer(trigger.code, value)}
          />
        ))}
      </div>

      {/* Final decision + justification */}
      <div className="rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
          Final decision
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]">
          <select
            value={decision}
            onChange={(event) =>
              setDecision(event.target.value as ProjectClassificationKind | "")
            }
            className="rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-2 text-sm text-[color:var(--ink)] outline-none transition-colors focus:border-[color:var(--cobalt)]"
          >
            <option value="">Pending</option>
            <option value="minor">Minor</option>
            <option value="major">Major</option>
          </select>

          <textarea
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            placeholder="Justification — short rationale for the chosen classification"
            rows={3}
            className="resize-y rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-2 text-sm text-[color:var(--ink-2)] outline-none transition-colors focus:border-[color:var(--cobalt)]"
          />
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--cobalt)] bg-[color:var(--cobalt)] px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-[color:var(--cobalt)]/90",
              saving && "cursor-not-allowed opacity-70",
            )}
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            {saving ? "Saving…" : "Save classification"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SuggestionBadge({
  kind,
  reason,
}: {
  kind: "major" | "minor" | "pending"
  reason: string
}) {
  const config = {
    major: {
      label: "Major change suggested",
      Icon: AlertTriangle,
      classes:
        "border-[color:var(--terracotta)]/40 bg-[color:var(--terracotta)]/10 text-[color:var(--terracotta)]",
    },
    minor: {
      label: "Minor change suggested",
      Icon: CheckCircle2,
      classes: "border-emerald-300 bg-emerald-50 text-emerald-700",
    },
    pending: {
      label: "Pending classification",
      Icon: HelpCircle,
      classes: "border-amber-300 bg-amber-50 text-amber-700",
    },
  }[kind]

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3",
        config.classes,
      )}
    >
      <config.Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{config.label}</p>
        <p className="mt-0.5 text-xs opacity-80">{reason}</p>
      </div>
    </div>
  )
}

function TriggerRow({
  trigger,
  answer,
  onChange,
}: {
  trigger: ClassificationTrigger
  answer: TriggerAnswer
  onChange: (value: TriggerAnswer) => void
}) {
  return (
    <div className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
            {trigger.code}
            {trigger.source_ref ? (
              <span className="ml-2 text-[color:var(--ink-3)]/70">
                {trigger.source_ref}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm font-medium text-[color:var(--ink)]">
            {trigger.label}
          </p>
          {trigger.short_explanation ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-[color:var(--ink-3)]">
              {trigger.short_explanation}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <AnswerButton
            label="Yes"
            active={answer === "yes"}
            tone="major"
            onClick={() => onChange("yes")}
          />
          <AnswerButton
            label="No"
            active={answer === "no"}
            tone="minor"
            onClick={() => onChange("no")}
          />
          <AnswerButton
            label="Unknown"
            active={answer === "unknown"}
            tone="neutral"
            onClick={() => onChange("unknown")}
          />
        </div>
      </div>
    </div>
  )
}

function AnswerButton({
  label,
  active,
  tone,
  onClick,
}: {
  label: string
  active: boolean
  tone: "major" | "minor" | "neutral"
  onClick: () => void
}) {
  const inactive =
    "border-[color:var(--ink-4)] bg-[color:var(--paper)] text-[color:var(--ink-3)] hover:bg-[color:var(--paper-3)]"
  const activeClass = {
    major:
      "border-[color:var(--terracotta)] bg-[color:var(--terracotta)]/10 text-[color:var(--terracotta)]",
    minor: "border-emerald-300 bg-emerald-50 text-emerald-700",
    neutral: "border-amber-300 bg-amber-50 text-amber-700",
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
        active ? activeClass : inactive,
      )}
    >
      {label}
    </button>
  )
}
