'use client'

import { useState } from 'react'
import { Loader2, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react'

type ReferenceProject = {
  id: string
  project_number: string | null
  title: string | null
  aircraft: string | null
  baseline: {
    classificationBaseline: string | null
    certificationBasisBaseline: string | null
    impactedDisciplines: string[]
    summaryAvailable: boolean
  }
}

type ImpactArea = {
  discipline: string
  detected: boolean
  rationale: string
  from_reference: boolean
}

type AnalysisResult = {
  classification: 'major' | 'minor' | 'unknown'
  classification_rationale: string
  certification_basis: string | null
  impact_areas: ImpactArea[]
}

type AnalysisResponse = {
  analysis: AnalysisResult
  model: string
  referenceProject: {
    project_number: string
    title: string
    aircraft: string
  }
}

type Props = {
  consultaId: string
  referenceProjects: ReferenceProject[]
}

export default function PreliminaryScopeAnalyzer({ consultaId, referenceProjects }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analyzedWithId, setAnalyzedWithId] = useState<string | null>(null)

  // Use the first reference project (primary)
  const primaryRef = referenceProjects[0] ?? null

  async function handleAnalyze() {
    if (!primaryRef) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/incoming-requests/${consultaId}/preliminary-scope/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceProjectId: primaryRef.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al analizar')
      }

      const data: AnalysisResponse = await response.json()
      setResult(data)
      setAnalyzedWithId(primaryRef.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // No reference projects selected
  if (!primaryRef) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-[color:var(--ink-4)] text-sm text-[color:var(--ink-3)]">
        Marca un project de referencia en &quot;Projects similares&quot; para analizar el alcance
      </div>
    )
  }

  // Reference project has no summary
  if (!primaryRef.baseline.summaryAvailable) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            El project de referencia <strong>{primaryRef.project_number}</strong> no tiene PROJECT_SUMMARY.
            No se puede analizar sin precedente.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Contexto: qué project de referencia se usa */}
      <div className="flex items-center justify-between rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-4 py-3">
        <div className="text-sm">
          <span className="text-[color:var(--ink-3)]">Precedente: </span>
          <span className="rounded bg-[color:var(--paper-2)] px-1.5 py-0.5 font-mono text-xs font-medium text-[color:var(--ink-3)]">
            {primaryRef.project_number}
          </span>
          <span className="ml-1.5 text-[color:var(--ink-2)]">{primaryRef.title}</span>
          {primaryRef.aircraft && (
            <span className="ml-1.5 text-[color:var(--ink-3)]">({primaryRef.aircraft})</span>
          )}
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md bg-[color:var(--paper-2)] px-3 py-1.5 text-xs font-medium text-[color:var(--ink-3)] transition-colors hover:bg-[color:var(--paper-3)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analizando...
            </>
          ) : result ? (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Volver a analizar
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Analizar con IA
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Resultado del análisis */}
      {result && (
        <div className="space-y-4 rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-5">
          {/* Classification + Base de certificación */}
          <div>
            <div className="flex items-center gap-3">
              <div className={`inline-flex items-center rounded-full px-3.5 py-1 text-sm font-bold tracking-wide ${
                result.analysis.classification === 'major'
                  ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                  : result.analysis.classification === 'minor'
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                    : 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)] ring-1 ring-[color:var(--ink-4)]'
              }`}>
                {result.analysis.classification === 'major' ? 'MAJOR' : result.analysis.classification === 'minor' ? 'MINOR' : 'NO DETERMINADO'}
              </div>
              {result.analysis.certification_basis && (
                <span className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--ink-3)]">
                  {result.analysis.certification_basis}
                </span>
              )}
            </div>

            {result.analysis.classification_rationale && (
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-3)]">
                {result.analysis.classification_rationale}
              </p>
            )}
          </div>

          {/* Áreas de impact */}
          {result.analysis.impact_areas && result.analysis.impact_areas.length > 0 && (
            <div className="border-t border-[color:var(--ink-4)] pt-4">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-[color:var(--ink-3)]">
                Áreas de impact estimadas
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {result.analysis.impact_areas
                  .filter((a) => a.detected)
                  .map((area) => (
                    <div
                      key={area.discipline}
                      className="flex items-start gap-2 rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/50 px-3 py-2.5"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-[color:var(--ink-2)]">{area.discipline}</span>
                          {area.from_reference && (
                            <span className="rounded bg-[color:var(--paper-2)] px-1 py-0.5 text-[10px] font-medium text-[color:var(--ink-3)]">
                              ref
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--ink-3)]">{area.rationale}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Model usado */}
          <div className="border-t border-[color:var(--ink-4)] pt-3 text-right">
            <span className="text-[10px] text-[color:var(--ink-4)]">
              Analizado con {result.model} · Basado en {result.referenceProject.project_number}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
