'use client'

/**
 * ============================================================================
 * MODAL "CREAR PROYECTO NEW"
 * ============================================================================
 *
 * Form para creacion MANUAL de projects (sin request origen).
 * Llama a POST /api/projects/create-manual que a su vez:
 *   - calcula project_number,
 *   - crea carpetas,
 *   - inserta fila en doa_projects,
 *   - genera un .docx por cada template G12-xx seleccionada.
 *
 * Se renderiza como un overlay nativo (no usamos una libreria de Dialog
 * porque el project no tiene shadcn/dialog instalado — ver components/ui).
 * ============================================================================
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'

import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  COMPLIANCE_TEMPLATES,
  type ComplianceTemplate,
} from '@/lib/compliance-templates'

type ClienteOption = { id: string; name: string }
type ModeloOption = {
  id: string
  manufacturer: string
  family: string
  model: string
  tcds_code: string
  tcds_code_short: string
  tcds_issue: string
  tcds_date: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewProjectModal({ open, onOpenChange }: Props) {
  const router = useRouter()

  // --- Form state ---
  const [title, setTitulo] = useState('')
  const [description, setDescripcion] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [manufacturer, setFabricante] = useState('')
  const [model, setModelo] = useState('')
  const [msn, setMsn] = useState('')
  const [tcdsCode, setTcdsCode] = useState('')
  const [tcdsCodeShort, setTcdsCodeShort] = useState('')
  const [owner, setOwner] = useState('')
  const [checker, setChecker] = useState('')
  const [approval, setApproval] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [priority, setPrioridad] = useState<'high' | 'medium' | 'low' | ''>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // --- Data sources ---
  const [clients, setClientes] = useState<ClienteOption[]>([])
  const [manufacturers, setFabricantes] = useState<string[]>([])
  const [models, setModelos] = useState<ModeloOption[]>([])

  // --- UI state ---
  const [loadingClientes, setLoadingClientes] = useState(false)
  const [loadingModelos, setLoadingModelos] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Cargar clients y manufacturers al abrir
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingClientes(true)
    void fetch('/api/clients')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setClientes(Array.isArray(data.clients) ? data.clients : [])
      })
      .catch((err) => console.error('[NewProjectModal] clients:', err))
      .finally(() => !cancelled && setLoadingClientes(false))

    void fetch('/api/aircraft/manufacturers')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setFabricantes(Array.isArray(data.manufacturers) ? data.manufacturers : [])
      })
      .catch((err) => console.error('[NewProjectModal] manufacturers:', err))

    return () => {
      cancelled = true
    }
  }, [open])

  // Cargar models al cambiar manufacturer
  useEffect(() => {
    if (!manufacturer) {
      setModelos([])
      setModelo('')
      return
    }
    let cancelled = false
    setLoadingModelos(true)
    void fetch(`/api/aircraft/models?manufacturer=${encodeURIComponent(manufacturer)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setModelos(Array.isArray(data.models) ? data.models : [])
      })
      .catch((err) => console.error('[NewProjectModal] models:', err))
      .finally(() => !cancelled && setLoadingModelos(false))
    return () => {
      cancelled = true
    }
  }, [manufacturer])

  // Reset al close
  useEffect(() => {
    if (open) return
    setTitulo('')
    setDescripcion('')
    setClienteId('')
    setFabricante('')
    setModelo('')
    setMsn('')
    setTcdsCode('')
    setTcdsCodeShort('')
    setOwner('')
    setChecker('')
    setApproval('')
    setFechaEntrega('')
    setPrioridad('')
    setSelected(new Set())
    setErrorMsg(null)
  }, [open])

  const templatesByCategory = useMemo(() => {
    const map = new Map<string, ComplianceTemplate[]>()
    for (const cat of CATEGORY_ORDER) map.set(cat, [])
    for (const tpl of COMPLIANCE_TEMPLATES) {
      map.get(tpl.category)?.push(tpl)
    }
    return map
  }, [])

  const clienteSeleccionado = clients.find((c) => c.id === clienteId) ?? null

  function toggleTemplate(code: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function toggleAllInCategory(category: string) {
    const codes = (templatesByCategory.get(category) ?? []).map((t) => t.code)
    setSelected((prev) => {
      const next = new Set(prev)
      const allOn = codes.every((c) => next.has(c))
      for (const c of codes) {
        if (allOn) next.delete(c)
        else next.add(c)
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)

    if (!title.trim()) {
      setErrorMsg('El title es obligatorio.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        client_id: clienteId || null,
        client_name: clienteSeleccionado?.name ?? null,
        manufacturer: manufacturer || null,
        model: model || null,
        msn: msn.trim() || null,
        tcds_code: tcdsCode.trim() || null,
        tcds_code_short: tcdsCodeShort.trim() || null,
        owner: owner.trim() || null,
        checker: checker.trim() || null,
        approval: approval.trim() || null,
        estimated_delivery_date: fechaEntrega || null,
        priority: priority || null,
        plantilla_codes: Array.from(selected),
      }

      const res = await fetch('/api/projects/create-manual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data?.ok) {
        setErrorMsg(
          typeof data?.error === 'string'
            ? data.error
            : `Error ${res.status} creando el project.`,
        )
        setSubmitting(false)
        return
      }

      const projectId = data?.project?.id
      if (typeof projectId === 'string' && projectId) {
        router.push(`/engineering/projects/${projectId}`)
      } else {
        onOpenChange(false)
      }
    } catch (err) {
      console.error('[NewProjectModal] submit:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Error de red.')
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onClick={() => !submitting && onOpenChange(false)}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Crear project new</h2>
            <p className="text-xs text-slate-500">
              Alta manual. Se generaran automaticamente las templates compliance
              seleccionadas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onOpenChange(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body (scrollable) */}
        <form
          id="new-project-form"
          onSubmit={handleSubmit}
          className="flex-1 space-y-5 overflow-y-auto px-6 py-5 text-sm text-slate-900"
        >
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Titulo / description */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">
              Titulo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitulo(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
            />
          </div>

          {/* Client */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Client</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
              disabled={loadingClientes}
            >
              <option value="">
                {loadingClientes ? 'Cargando clients…' : 'Seleccionar client...'}
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Manufacturer / Model */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Manufacturer</label>
              <select
                value={manufacturer}
                onChange={(e) => setFabricante(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
              >
                <option value="">Seleccionar manufacturer...</option>
                {manufacturers.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Model</label>
              <select
                value={model}
                onChange={(e) => {
                  const nextModelo = e.target.value
                  setModelo(nextModelo)
                  // Auto-rellenar TCDS desde la fila del catalogo doa_aircraft.
                  const match = models.find((m) => m.model === nextModelo)
                  setTcdsCode(match?.tcds_code ?? '')
                  setTcdsCodeShort(match?.tcds_code_short ?? '')
                }}
                disabled={!manufacturer || loadingModelos}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {!manufacturer
                    ? 'Elige manufacturer primero'
                    : loadingModelos
                      ? 'Cargando…'
                      : 'Seleccionar model...'}
                </option>
                {models.map((m) => (
                  <option key={m.id} value={m.model}>
                    {m.model}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* MSN */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">MSN</label>
            <input
              type="text"
              value={msn}
              onChange={(e) => setMsn(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
            />
          </div>

          {/* TCDS */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                TCDS code
                {model ? (
                  <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-emerald-600">
                    auto
                  </span>
                ) : null}
              </label>
              <input
                type="text"
                value={tcdsCode}
                onChange={(e) => setTcdsCode(e.target.value)}
                placeholder="Se rellena al elegir model"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                TCDS short
                {model ? (
                  <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-emerald-600">
                    auto
                  </span>
                ) : null}
              </label>
              <input
                type="text"
                value={tcdsCodeShort}
                onChange={(e) => setTcdsCodeShort(e.target.value)}
                placeholder="Se rellena al elegir model"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
              />
            </div>
          </div>

          {/* Equipo */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Owner</label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Checker</label>
              <input
                type="text"
                value={checker}
                onChange={(e) => setChecker(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Approval</label>
              <input
                type="text"
                value={approval}
                onChange={(e) => setApproval(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
              />
            </div>
          </div>

          {/* Date / priority */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Date delivery estimada
              </label>
              <input
                type="date"
                value={fechaEntrega}
                onChange={(e) => setFechaEntrega(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Prioridad</label>
              <select
                value={priority}
                onChange={(e) =>
                  setPrioridad(e.target.value as 'high' | 'medium' | 'low' | '')
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
              >
                <option value="">Sin definir</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>
          </div>

          {/* Plantillas compliance */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Plantillas compliance
              </h3>
              <p className="text-xs text-slate-500">
                Las templates seleccionadas se generaran como .docx en la folder
                &quot;01. Compliance documents&quot; del project.
              </p>
            </div>
            {CATEGORY_ORDER.map((cat) => {
              const templates = templatesByCategory.get(cat) ?? []
              if (templates.length === 0) return null
              const allOn = templates.every((t) => selected.has(t.code))
              return (
                <div
                  key={cat}
                  className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {CATEGORY_LABELS[cat]}
                    </h4>
                    <button
                      type="button"
                      onClick={() => toggleAllInCategory(cat)}
                      className="text-[11px] font-medium text-sky-600 hover:text-sky-700"
                    >
                      {allOn ? 'Quitar todo' : 'Marcar todo'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                    {templates.map((t) => (
                      <label
                        key={t.code}
                        className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 text-xs hover:bg-white"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(t.code)}
                          onChange={() => toggleTemplate(t.code)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-sky-600"
                        />
                        <span>
                          <span className="font-semibold text-slate-700">{t.code}</span>{' '}
                          <span className="text-slate-600">{t.name}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            type="button"
            onClick={() => !submitting && onOpenChange(false)}
            disabled={submitting}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="new-project-form"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-[linear-gradient(135deg,#2563EB,#38BDF8)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? 'Creando…' : 'Crear project'}
          </button>
        </div>
      </div>
    </div>
  )
}
