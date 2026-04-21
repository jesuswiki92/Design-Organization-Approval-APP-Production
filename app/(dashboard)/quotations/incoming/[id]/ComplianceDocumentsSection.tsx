'use client'

/**
 * Seccion "Definir documentacion" — checkboxes nativos de templates de compliance.
 * Guardado: API route → webhook n8n → Supabase (44 columnas booleanas doc_g12_xx).
 * Lectura: server component lee las columnas y pasa savedCodes.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, Sparkles } from 'lucide-react'

import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  codeToColumn,
  type ComplianceTemplate,
} from '@/lib/compliance-templates'

type AiSuggestion = {
  code: string
  justification: string
  confidence: string
}

type Props = {
  consultaId: string
  templates: ComplianceTemplate[]
  preselectedCodes: string[]
  savedCodes: string[]
  blocked?: boolean
  referenceProjectId?: string | null
}

export function ComplianceDocumentsSection({
  consultaId,
  templates,
  preselectedCodes,
  savedCodes,
  blocked = false,
  referenceProjectId = null,
}: Props) {
  const router = useRouter()
  const initialCodes = savedCodes.length > 0 ? savedCodes : preselectedCodes
  const [selected, setSelected] = useState<Set<string>>(new Set(initialCodes))
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([])
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)

  useEffect(() => {
    if (status === 'idle') return
    const t = setTimeout(() => setStatus('idle'), 3000)
    return () => clearTimeout(t)
  }, [status])

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function toggleAll(category: string) {
    const codes = templates.filter((t) => t.category === category).map((t) => t.code)
    const allOn = codes.every((c) => selected.has(c))
    setSelected((prev) => {
      const next = new Set(prev)
      for (const c of codes) {
        if (allOn) next.delete(c)
        else next.add(c)
      }
      return next
    })
  }

  async function handleSuggestWithAI() {
    setAiLoading(true)
    setAiError(null)

    try {
      const res = await fetch(`/api/incoming-requests/${consultaId}/compliance-documents/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceProjectId }),
      })

      const data = (await res.json().catch(() => ({}))) as {
        recommendations?: AiSuggestion[]
        error?: string
      }

      if (!res.ok) {
        throw new Error(data.error || 'Error al sugerir documents')
      }

      const recs = Array.isArray(data.recommendations) ? data.recommendations : []
      setAiSuggestions(recs)
      setAiPanelOpen(true)
      setSelected((prev) => {
        const next = new Set(prev)
        for (const r of recs) next.add(r.code)
        return next
      })
    } catch (err) {
      console.error('Error sugiriendo documents con IA:', err)
      setAiError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setStatus('idle')

    try {
      // Construir objeto con 44 columnas booleanas
      const docs: Record<string, boolean> = {}
      for (const t of templates) {
        docs[codeToColumn(t.code)] = selected.has(t.code)
      }

      const res = await fetch(`/api/incoming-requests/${consultaId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docs }),
      })

      if (!res.ok) throw new Error('Error al guardar')

      setStatus('saved')
      router.refresh()
    } catch (err) {
      console.error('Error guardando documents compliance:', err)
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const preselectedSet = new Set(preselectedCodes)
  const aiByCode = new Map(aiSuggestions.map((s) => [s.code, s]))

  if (blocked) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/40 px-5 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)]">
            <FileText className="h-4 w-4 text-[color:var(--ink-3)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--ink)]">Definir documentacion blocked en esta fase</p>
            <p className="mt-1 text-sm leading-6 text-[color:var(--ink-3)]">
              Esta vista permanece visible como placeholder, pero la edicion de quote sigue desactivada
              mientras la request esta en modo review y decision.
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
              La configuracion de compliance se activara cuando la request salga de review.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[color:var(--ink-3)]">
          <span className="font-semibold text-[color:var(--ink-2)]">{selected.size}</span>/{templates.length} seleccionados
          {preselectedCodes.length > 0 && (
            <span className="ml-1 text-emerald-600">
              ({preselectedCodes.length} sugeridos)
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {status === 'saved' && <span className="text-[11px] text-emerald-600">Guardado</span>}
          {status === 'error' && <span className="text-[11px] text-rose-500">Error al guardar</span>}
          <button
            type="button"
            onClick={handleSuggestWithAI}
            disabled={aiLoading || !referenceProjectId}
            title={!referenceProjectId ? 'Selecciona un project de referencia primero' : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {aiLoading ? 'Analizando...' : 'Proponer con IA'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)] disabled:cursor-wait disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {saving ? 'Guardando...' : 'Guardar seleccion'}
          </button>
        </div>
      </div>

      {aiError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {aiError}
        </div>
      )}

      {aiSuggestions.length > 0 && (
        <details
          open={aiPanelOpen}
          onToggle={(e) => setAiPanelOpen((e.target as HTMLDetailsElement).open)}
          className="group rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/50"
        >
          <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-semibold text-[color:var(--ink-2)]">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              {aiSuggestions.length} sugerencias de IA
            </span>
            <svg
              className="h-3 w-3 transition-transform group-open:rotate-180"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="space-y-1.5 px-3 pb-3">
            {aiSuggestions.map((s) => (
              <div
                key={s.code}
                className="flex items-start gap-2 rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-2.5 py-2"
              >
                <span className="font-mono text-[10px] font-semibold text-[color:var(--ink-3)] w-[52px] shrink-0 pt-0.5">
                  {s.code}
                </span>
                <p className="flex-1 text-[11px] leading-snug text-[color:var(--ink-3)]">{s.justification}</p>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                    s.confidence === 'high'
                      ? 'bg-emerald-100 text-emerald-700'
                      : s.confidence === 'medium'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)]'
                  }`}
                >
                  {s.confidence}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {CATEGORY_ORDER.map((category) => {
          const items = templates.filter((t) => t.category === category)
          if (items.length === 0) return null

          const count = items.filter((t) => selected.has(t.code)).length
          const allOn = count === items.length

          return (
            <div key={category} className="rounded-xl border border-[color:var(--ink-4)]">
              <div className="flex items-center justify-between border-b border-[color:var(--ink-4)] px-3 py-2">
                <label className="flex items-center gap-2 text-left cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={() => toggleAll(category)}
                    className="h-3.5 w-3.5 rounded border-[color:var(--ink-4)] accent-violet-600"
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                    {CATEGORY_LABELS[category as ComplianceTemplate['category']]}
                  </span>
                </label>
                <span className="text-[10px] text-[color:var(--ink-3)]">{count}/{items.length}</span>
              </div>

              <div className="px-2 py-1">
                {items.map((t) => {
                  const suggestion = aiByCode.get(t.code)
                  return (
                    <label
                      key={t.code}
                      className={`flex items-start gap-2 rounded px-1 py-1 cursor-pointer hover:bg-[color:var(--paper-3)] ${
                        suggestion ? 'bg-[color:var(--paper-2)]/40' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(t.code)}
                        onChange={() => toggle(t.code)}
                        className="h-3.5 w-3.5 mt-0.5 rounded border-[color:var(--ink-4)] accent-violet-600"
                      />
                      <span className="font-mono text-[10px] text-[color:var(--ink-3)] w-[50px] shrink-0 pt-0.5">{t.code}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[color:var(--ink-2)]">{t.name}</span>
                          {preselectedSet.has(t.code) && (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                              REF
                            </span>
                          )}
                          {suggestion && (
                            <span
                              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                                suggestion.confidence === 'high'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : suggestion.confidence === 'medium'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)]'
                              }`}
                            >
                              <Sparkles className="h-2.5 w-2.5" />
                              IA
                            </span>
                          )}
                        </div>
                        {suggestion && (
                          <p className="mt-0.5 text-[10.5px] leading-snug text-[color:var(--ink-2)]/80 italic">
                            {suggestion.justification}
                          </p>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
