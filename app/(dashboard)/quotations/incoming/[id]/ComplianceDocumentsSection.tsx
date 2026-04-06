'use client'

/**
 * Seccion "Definir documentacion" — checkboxes nativos de plantillas de compliance.
 * Guardado: API route → webhook n8n → Supabase (44 columnas booleanas doc_g12_xx).
 * Lectura: server component lee las columnas y pasa savedCodes.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  codeToColumn,
  type ComplianceTemplate,
} from '@/lib/compliance-templates'

type Props = {
  consultaId: string
  templates: ComplianceTemplate[]
  preselectedCodes: string[]
  savedCodes: string[]
}

export function ComplianceDocumentsSection({
  consultaId,
  templates,
  preselectedCodes,
  savedCodes,
}: Props) {
  const router = useRouter()
  const initialCodes = savedCodes.length > 0 ? savedCodes : preselectedCodes
  const [selected, setSelected] = useState<Set<string>>(new Set(initialCodes))
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')

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

  async function handleSave() {
    setSaving(true)
    setStatus('idle')

    try {
      // Construir objeto con 44 columnas booleanas
      const docs: Record<string, boolean> = {}
      for (const t of templates) {
        docs[codeToColumn(t.code)] = selected.has(t.code)
      }

      const res = await fetch(`/api/consultas/${consultaId}/documentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docs }),
      })

      if (!res.ok) throw new Error('Error al guardar')

      setStatus('saved')
      router.refresh()
    } catch (err) {
      console.error('Error guardando documentos compliance:', err)
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const preselectedSet = new Set(preselectedCodes)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{selected.size}</span>/{templates.length} seleccionados
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
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-wait disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {saving ? 'Guardando...' : 'Guardar seleccion'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {CATEGORY_ORDER.map((category) => {
          const items = templates.filter((t) => t.category === category)
          if (items.length === 0) return null

          const count = items.filter((t) => selected.has(t.code)).length
          const allOn = count === items.length

          return (
            <div key={category} className="rounded-xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <label className="flex items-center gap-2 text-left cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={() => toggleAll(category)}
                    className="h-3.5 w-3.5 rounded border-slate-300 accent-violet-600"
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {CATEGORY_LABELS[category as ComplianceTemplate['category']]}
                  </span>
                </label>
                <span className="text-[10px] text-slate-400">{count}/{items.length}</span>
              </div>

              <div className="px-2 py-1">
                {items.map((t) => (
                  <label
                    key={t.code}
                    className="flex items-center gap-2 rounded px-1 py-1 cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(t.code)}
                      onChange={() => toggle(t.code)}
                      className="h-3.5 w-3.5 rounded border-slate-300 accent-violet-600"
                    />
                    <span className="font-mono text-[10px] text-slate-400 w-[50px] shrink-0">{t.code}</span>
                    <span className="text-xs text-slate-700 flex-1">{t.name}</span>
                    {preselectedSet.has(t.code) && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                        REF
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
