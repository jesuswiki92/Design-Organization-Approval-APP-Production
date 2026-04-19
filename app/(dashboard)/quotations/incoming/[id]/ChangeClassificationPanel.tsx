'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Loader2,
  MapPin,
  Scale,
  Shield,
  Sparkles,
  XCircle,
} from 'lucide-react'

export type Answer = {
  question_number: number
  answer: 'yes' | 'no' | null
  justification: string
  confidence?: 'high' | 'medium' | 'low'
}

type WeightItem = {
  item: string
  weight_added_kg: number
  weight_removed_kg: number
}

type ClassificationData = {
  items_weight_list?: WeightItem[] | null
  fuselage_position?: string | null
  sta_location?: string | null
  impact_location?: string | null
  affects_primary_structure?: string | null
  impact_structural_attachment?: string | null
  estimated_weight_kg?: string | null
  related_to_ad?: string | null
  ad_reference?: string | null
  mtow_kg?: number | null
}

export type LogEntry = {
  timestamp: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

type Props = {
  consultaId: string
  referenceProjectId: string | null
  classificationData?: ClassificationData
  onAnswersChange?: (answers: Answer[]) => void
  onLogEntry?: (message: string, type: LogEntry['type']) => void
  onAnalyzingChange?: (analyzing: boolean) => void
}

const QUESTIONS = [
  { n: 1, q: 'Is there a Change to the General Configuration?', group: 'critical' as const },
  { n: 2, q: 'Is there a Change to the principles of construction?', group: 'critical' as const },
  { n: 3, q: 'Have the assumptions used for Certification been invalidated?', group: 'critical' as const },
  { n: 4, q: 'Do the changes have appreciable effect on weight?', group: 'standard' as const },
  { n: 5, q: 'Do the changes have appreciable effect on balance?', group: 'standard' as const },
  { n: 6, q: 'Do the changes have appreciable effect on structural strength?', group: 'standard' as const },
  { n: 7, q: 'Do the changes have appreciable effect on reliability?', group: 'standard' as const },
  { n: 8, q: 'Do the changes have appreciable effect on operational characteristics?', group: 'standard' as const },
  { n: 9, q: 'Do the changes require an adjustment of certification basis?', group: 'standard' as const },
  { n: 10, q: 'Do the changes require a new interpretation of the requirements used for the TC basis?', group: 'standard' as const },
  { n: 11, q: 'Do the changes contain aspects of compliance demonstration not previously accepted?', group: 'standard' as const },
  { n: 12, q: 'Do the changes require considerable new substantiation data and reassessment?', group: 'standard' as const },
  { n: 13, q: 'Do the changes alter the limitations directly approved by the Agency?', group: 'standard' as const },
  { n: 14, q: 'Are the changes mandated by an Airworthiness Directive?', group: 'standard' as const },
  { n: 15, q: 'Do the changes introduce or affect function where failure condition is catastrophic or hazardous?', group: 'standard' as const },
  { n: 16, q: 'Do the changes affect significantly any other airworthiness characteristic?', group: 'standard' as const },
]

function emptyAnswers(): Answer[] {
  return QUESTIONS.map((q) => ({
    question_number: q.n,
    answer: null,
    justification: '',
  }))
}

function classifyResult(answers: Answer[]): 'major' | 'minor' | 'undetermined' {
  const hasYes = answers.some((a) => a.answer === 'yes')
  const allAnswered = answers.every((a) => a.answer !== null)
  if (hasYes) return 'major'
  if (allAnswered) return 'minor'
  return 'undetermined'
}

export default function ChangeClassificationPanel({
  consultaId,
  referenceProjectId,
  classificationData,
  onAnswersChange,
  onLogEntry,
  onAnalyzingChange,
}: Props) {
  const [answers, setAnswers] = useState<Answer[]>(emptyAnswers())
  const [isOpen, setIsOpen] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const addLogEntry = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    onLogEntry?.(message, type)
  }, [onLogEntry])

  // Load saved answers
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/consultas/${consultaId}/change-classification`)
        if (!res.ok) return
        const data = await res.json()
        if (data.classification && Array.isArray(data.classification)) {
          setAnswers((prev) => {
            const merged = [...prev]
            for (const saved of data.classification as Answer[]) {
              const idx = merged.findIndex((a) => a.question_number === saved.question_number)
              if (idx >= 0) {
                merged[idx] = { ...merged[idx], ...saved }
              }
            }
            return merged
          })
        }
      } catch {
        // Silent fail on load
      } finally {
        setLoaded(true)
      }
    }
    load()
  }, [consultaId])

  // Notify parent when answers change
  useEffect(() => {
    onAnswersChange?.(answers)
  }, [answers, onAnswersChange])

  // Save answers
  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch(`/api/consultas/${consultaId}/change-classification`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classification: answers }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }, [consultaId, answers])

  // AI analyze
  // Small delay to allow React to flush renders between log entries
  const tick = () => new Promise<void>((r) => setTimeout(r, 120))

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true)
    onAnalyzingChange?.(true)
    setError(null)

    await tick()
    addLogEntry('Iniciando analisis de clasificacion...', 'info')
    await tick()
    addLogEntry('Cargando datos de la consulta...', 'info')
    await tick()
    addLogEntry('Datos de consulta cargados', 'success')
    await tick()

    try {
      addLogEntry('Buscando contexto regulatorio (RAG)...', 'info')
      await tick()
      addLogEntry('Generando embeddings de la descripcion...', 'info')
      await tick()
      addLogEntry('Enviando al modelo IA (Claude Sonnet 4)...', 'info')
      await tick()

      const res = await fetch(`/api/consultas/${consultaId}/change-classification/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceProjectId }),
      })
      if (!res.ok) {
        const errData = await res.json()
        const errMsg = errData.error || 'Error al analizar'
        addLogEntry(`Error: ${errMsg}`, 'error')
        throw new Error(errMsg)
      }
      const data = await res.json()

      addLogEntry('Respuesta recibida del modelo IA', 'success')
      await tick()

      if (Array.isArray(data.answers)) {
        const yesCount = data.answers.filter((a: Answer) => a.answer === 'yes').length
        const noCount = data.answers.filter((a: Answer) => a.answer === 'no').length
        const nullCount = data.answers.filter((a: Answer) => a.answer === null).length
        const total = data.answers.length

        addLogEntry(`${total} preguntas evaluadas: ${yesCount} YES, ${noCount} NO, ${nullCount} sin determinar`, 'info')
        await tick()
        addLogEntry(
          `Clasificacion: ${yesCount > 0 ? 'MAJOR' : 'MINOR'} (${yesCount} YES, ${noCount} NO)`,
          yesCount > 0 ? 'warning' : 'success',
        )
        await tick()

        setAnswers((prev) => {
          const updated = [...prev]
          for (const ai of data.answers as Answer[]) {
            const idx = updated.findIndex((a) => a.question_number === ai.question_number)
            if (idx >= 0) {
              updated[idx] = {
                question_number: ai.question_number,
                answer: ai.answer,
                justification: ai.justification || '',
                confidence: ai.confidence,
              }
            }
          }
          return updated
        })

        addLogEntry('Preguntas pre-rellenadas correctamente', 'success')
        await tick()
      }

      addLogEntry('Analisis completado', 'success')
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Error desconocido'
      addLogEntry(`Error: ${errMsg}`, 'error')
      setError(errMsg)
    } finally {
      setAnalyzing(false)
      onAnalyzingChange?.(false)
    }
  }, [consultaId, referenceProjectId, addLogEntry, onAnalyzingChange])

  // Update single answer
  const setAnswer = (qNum: number, value: 'yes' | 'no' | null) => {
    setAnswers((prev) =>
      prev.map((a) => (a.question_number === qNum ? { ...a, answer: value } : a)),
    )
    setSaved(false)
  }

  const setJustification = (qNum: number, text: string) => {
    setAnswers((prev) =>
      prev.map((a) => (a.question_number === qNum ? { ...a, justification: text } : a)),
    )
    setSaved(false)
  }

  const result = classifyResult(answers)
  const answeredCount = answers.filter((a) => a.answer !== null).length
  const yesCount = answers.filter((a) => a.answer === 'yes').length
  const criticalYes = answers.filter((a) => a.question_number <= 3 && a.answer === 'yes').length

  return (
    <div className="doa-section doa-section--umber">
      {/* Header - clickable to toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="doa-section-icon">
            <Shield className="h-3.5 w-3.5" />
          </span>
          <h4 className="text-sm font-semibold text-[color:var(--ink)]">
            G12-01 Change Classification
          </h4>

          {/* Result badge */}
          {answeredCount > 0 && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                result === 'major'
                  ? 'bg-red-50 text-red-700'
                  : result === 'minor'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)]'
              }`}
            >
              {result === 'major' ? 'MAJOR' : result === 'minor' ? 'MINOR' : `${answeredCount}/16`}
            </span>
          )}

          {criticalYes > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              CONTACT EASA
            </span>
          )}
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
                  onClick={handleAnalyze}
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

                <div className="flex items-center gap-2">
                  {saved && (
                    <span className="text-xs text-emerald-600">Guardado</span>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Critical questions */}
              <div className="mb-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                    Critical -- If YES, contact EASA
                  </span>
                </div>
                <div className="space-y-2">
                  {QUESTIONS.filter((q) => q.group === 'critical').map((q) => {
                    const answer = answers.find((a) => a.question_number === q.n)!
                    return (
                      <QuestionRow
                        key={q.n}
                        question={q}
                        answer={answer}
                        onSetAnswer={setAnswer}
                        onSetJustification={setJustification}
                        isCritical
                      />
                    )
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="my-4 border-t border-[color:var(--ink-4)]" />

              {/* Standard questions */}
              <div>
                <div className="mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink-3)]">
                    Classification -- Any YES = Major
                  </span>
                </div>
                <div className="space-y-2">
                  {QUESTIONS.filter((q) => q.group === 'standard').map((q) => {
                    const answer = answers.find((a) => a.question_number === q.n)!
                    return (
                      <QuestionRow
                        key={q.n}
                        question={q}
                        answer={answer}
                        onSetAnswer={setAnswer}
                        onSetJustification={setJustification}
                      />
                    )
                  })}
                </div>
              </div>

              {/* Summary */}
              <div className="mt-5 flex items-center justify-between rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[color:var(--ink-3)]">
                    {answeredCount}/16 respondidas · {yesCount} YES · {answeredCount - yesCount} NO
                  </span>
                </div>
                <div
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    result === 'major'
                      ? 'bg-red-100 text-red-700'
                      : result === 'minor'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-[color:var(--paper-3)] text-[color:var(--ink-3)]'
                  }`}
                >
                  {result === 'major'
                    ? 'PROPOSED: MAJOR'
                    : result === 'minor'
                      ? 'PROPOSED: MINOR'
                      : 'UNDETERMINED'}
                </div>
              </div>
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------
// Classification Data info panel
// -----------------------------------------------------------

function formatYesNoUnknown(value: string | null | undefined): { label: string; color: string } {
  if (!value) return { label: '—', color: 'text-[color:var(--ink-3)]' }
  switch (value.toLowerCase()) {
    case 'si':
    case 'yes':
      return { label: 'Yes / Si', color: 'text-red-600' }
    case 'no':
      return { label: 'No', color: 'text-emerald-600' }
    case 'no_seguro':
    case 'unknown':
      return { label: 'Unknown / No seguro', color: 'text-amber-600' }
    default:
      return { label: value, color: 'text-[color:var(--ink-2)]' }
  }
}

function formatFuselagePosition(value: string | null | undefined): string {
  if (!value) return '—'
  switch (value.toLowerCase()) {
    case 'fwd':
      return 'Forward (Fwd)'
    case 'mid':
      return 'Mid'
    case 'aft':
      return 'Aft'
    default:
      return value
  }
}

function getWeightBadge(weightKg: number, mtowKg: number | null | undefined): {
  label: string
  className: string
} | null {
  if (mtowKg == null || mtowKg <= 0) return null
  const pct = (weightKg / mtowKg) * 100
  const pctStr = pct.toFixed(2)
  if (pct < 1) return { label: `${pctStr}% MTOW`, className: 'bg-emerald-50 text-emerald-700' }
  if (pct < 2) return { label: `${pctStr}% MTOW`, className: 'bg-yellow-50 text-yellow-700' }
  if (pct < 3) return { label: `${pctStr}% MTOW`, className: 'bg-orange-50 text-orange-700' }
  return { label: `${pctStr}% MTOW`, className: 'bg-red-50 text-red-700' }
}

function ClassificationDataPanel({ data }: { data: ClassificationData }) {
  const [weightItemsOpen, setWeightItemsOpen] = useState(false)

  const estimatedWeight = data.estimated_weight_kg ? parseFloat(data.estimated_weight_kg) : null
  const itemsList = Array.isArray(data.items_weight_list) ? data.items_weight_list : []
  const hasWeightData = estimatedWeight != null || itemsList.length > 0
  const hasLocationData = Boolean(data.impact_location || data.fuselage_position || data.sta_location)
  const hasStructuralData = Boolean(data.impact_structural_attachment || data.affects_primary_structure)
  const hasAdData = Boolean(data.related_to_ad)

  const pse = formatYesNoUnknown(data.affects_primary_structure)
  const ad = formatYesNoUnknown(data.related_to_ad)
  const structural = formatYesNoUnknown(data.impact_structural_attachment)

  // If no data at all, don't show the panel
  if (!hasWeightData && !hasLocationData && !hasStructuralData && !hasAdData) return null

  return (
    <div className="mb-4 rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/30">
      <div className="border-b border-[color:var(--ink-4)] px-3.5 py-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink-3)]">
          Datos para clasificacion / Classification Data
        </span>
      </div>

      <div className="space-y-0 divide-y divide-[color:var(--ink-4)]">
        {/* Row 1 — WEIGHT */}
        {hasWeightData && (
          <div className="px-3.5 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Scale className="h-3 w-3 text-[color:var(--ink-3)]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                Weight / Peso
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {estimatedWeight != null ? (
                <>
                  <span className="text-xs font-medium text-[color:var(--ink)]">
                    {estimatedWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
                  </span>
                  {data.mtow_kg != null ? (
                    (() => {
                      const badge = getWeightBadge(Math.abs(estimatedWeight), data.mtow_kg)
                      return badge ? (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      ) : null
                    })()
                  ) : (
                    <span className="text-[10px] text-[color:var(--ink-3)]">
                      MTOW no disponible para calculo de %
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs text-[color:var(--ink-3)]">Sin peso total estimado</span>
              )}
            </div>

            {/* Items list — collapsible */}
            {itemsList.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setWeightItemsOpen(!weightItemsOpen)}
                  className="flex items-center gap-1 text-[10px] font-medium text-[color:var(--ink-3)] hover:text-[color:var(--ink-2)]"
                >
                  {weightItemsOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  {itemsList.length} item{itemsList.length !== 1 ? 's' : ''} detallado{itemsList.length !== 1 ? 's' : ''}
                </button>
                {weightItemsOpen && (
                  <div className="mt-1.5 rounded border border-[color:var(--ink-4)] bg-[color:var(--paper)]">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-[color:var(--ink-4)] text-left text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                          <th className="px-2.5 py-1.5">Item</th>
                          <th className="px-2.5 py-1.5 text-right">Added (kg)</th>
                          <th className="px-2.5 py-1.5 text-right">Removed (kg)</th>
                          <th className="px-2.5 py-1.5 text-right">Net (kg)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {itemsList.map((item, idx) => {
                          const net = (item.weight_added_kg ?? 0) - (item.weight_removed_kg ?? 0)
                          return (
                            <tr key={idx} className="text-[color:var(--ink-2)]">
                              <td className="px-2.5 py-1.5">{item.item || '—'}</td>
                              <td className="px-2.5 py-1.5 text-right text-emerald-600">
                                +{(item.weight_added_kg ?? 0).toFixed(2)}
                              </td>
                              <td className="px-2.5 py-1.5 text-right text-red-500">
                                -{(item.weight_removed_kg ?? 0).toFixed(2)}
                              </td>
                              <td
                                className={`px-2.5 py-1.5 text-right font-medium ${
                                  net > 0 ? 'text-amber-600' : net < 0 ? 'text-emerald-600' : 'text-[color:var(--ink-3)]'
                                }`}
                              >
                                {net >= 0 ? '+' : ''}{net.toFixed(2)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Row 2 — LOCATION */}
        {hasLocationData && (
          <div className="px-3.5 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-[color:var(--ink-3)]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                Location / Ubicacion
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {data.impact_location && (
                <span className="text-[color:var(--ink-2)]">
                  <span className="text-[color:var(--ink-3)]">Zone: </span>
                  {data.impact_location}
                </span>
              )}
              {data.fuselage_position && (
                <span className="text-[color:var(--ink-2)]">
                  <span className="text-[color:var(--ink-3)]">Position: </span>
                  {formatFuselagePosition(data.fuselage_position)}
                </span>
              )}
              {data.sta_location && (
                <span className="text-[color:var(--ink-2)]">
                  <span className="text-[color:var(--ink-3)]">STA: </span>
                  {data.sta_location}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Row 3 — STRUCTURE */}
        {hasStructuralData && (
          <div className="px-3.5 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-[color:var(--ink-3)]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                Structure / Estructura
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {data.impact_structural_attachment && (
                <span className="text-[color:var(--ink-2)]">
                  <span className="text-[color:var(--ink-3)]">Structural attachment: </span>
                  <span className={structural.color}>{structural.label}</span>
                </span>
              )}
              {data.affects_primary_structure && (
                <span className="text-[color:var(--ink-2)]">
                  <span className="text-[color:var(--ink-3)]">PSE: </span>
                  <span className={pse.color}>{pse.label}</span>
                  {data.affects_primary_structure.toLowerCase() === 'si' && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      PSE
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Row 4 — AIRWORTHINESS DIRECTIVE */}
        {hasAdData && (
          <div className="px-3.5 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-[color:var(--ink-3)]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                Airworthiness Directive / AD
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-[color:var(--ink-2)]">
                <span className="text-[color:var(--ink-3)]">Motivated by AD: </span>
                <span className={ad.color}>{ad.label}</span>
                {data.related_to_ad?.toLowerCase() === 'si' && (
                  <span className="ml-1.5 inline-flex rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">
                    AD
                  </span>
                )}
              </span>
              {data.ad_reference && (
                <span className="text-[color:var(--ink-2)]">
                  <span className="text-[color:var(--ink-3)]">Reference: </span>
                  {data.ad_reference}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// -----------------------------------------------------------
// Question row sub-component
// -----------------------------------------------------------
type QuestionRowProps = {
  question: { n: number; q: string; group: 'critical' | 'standard' }
  answer: Answer
  onSetAnswer: (qNum: number, value: 'yes' | 'no' | null) => void
  onSetJustification: (qNum: number, text: string) => void
  isCritical?: boolean
}

function QuestionRow({ question, answer, onSetAnswer, onSetJustification, isCritical }: QuestionRowProps) {
  const [showJustification, setShowJustification] = useState(!!answer.justification)

  // Auto-show justification when AI fills it
  useEffect(() => {
    if (answer.justification) setShowJustification(true)
  }, [answer.justification])

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        answer.answer === 'yes'
          ? isCritical
            ? 'border-amber-200 bg-amber-50/50'
            : 'border-red-200 bg-red-50/30'
          : answer.answer === 'no'
            ? 'border-emerald-200 bg-emerald-50/30'
            : 'border-slate-150 bg-[color:var(--paper)]'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Question number */}
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--paper-2)] text-[10px] font-bold text-[color:var(--ink-3)]">
          {question.n}
        </span>

        {/* Question text */}
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-relaxed text-[color:var(--ink-2)]">{question.q}</p>

          {/* Justification */}
          {showJustification && (
            <textarea
              value={answer.justification}
              onChange={(e) => onSetJustification(question.n, e.target.value)}
              placeholder="Justification..."
              rows={2}
              className="mt-1.5 w-full resize-none rounded border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-2 py-1.5 text-xs text-[color:var(--ink-2)] placeholder-slate-300 focus:border-[color:var(--ink-4)] focus:outline-none focus:ring-1 focus:ring-[color:var(--ink-4)]"
            />
          )}

          {/* Confidence badge */}
          {answer.confidence && (
            <span
              className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                answer.confidence === 'high'
                  ? 'bg-emerald-50 text-emerald-600'
                  : answer.confidence === 'medium'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)]'
              }`}
            >
              {answer.confidence} confidence
            </span>
          )}
        </div>

        {/* Answer buttons */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => {
              onSetAnswer(question.n, answer.answer === 'yes' ? null : 'yes')
              setShowJustification(true)
            }}
            className={`flex items-center gap-0.5 rounded px-2 py-1 text-[10px] font-semibold transition-colors ${
              answer.answer === 'yes'
                ? isCritical
                  ? 'bg-amber-500 text-white'
                  : 'bg-red-500 text-white'
                : 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)] hover:bg-red-50 hover:text-red-500'
            }`}
          >
            <XCircle className="h-3 w-3" />
            YES
          </button>

          <button
            onClick={() => {
              onSetAnswer(question.n, answer.answer === 'no' ? null : 'no')
              setShowJustification(true)
            }}
            className={`flex items-center gap-0.5 rounded px-2 py-1 text-[10px] font-semibold transition-colors ${
              answer.answer === 'no'
                ? 'bg-emerald-500 text-white'
                : 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)] hover:bg-emerald-50 hover:text-emerald-500'
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            NO
          </button>

          {!showJustification && (
            <button
              onClick={() => setShowJustification(true)}
              className="ml-1 rounded p-1 text-[color:var(--ink-4)] hover:text-[color:var(--ink-2)]"
              title="Add justification"
            >
              <HelpCircle className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
