'use client'

/**
 * ============================================================================
 * MODAL "CREAR PROYECTO NUEVO"
 * ============================================================================
 *
 * Formulario para creacion MANUAL de proyectos (sin consulta origen).
 * Llama a POST /api/proyectos/crear-manual que a su vez:
 *   - calcula numero_proyecto,
 *   - crea carpetas,
 *   - inserta fila en proyectos,
 *   - genera un .docx por cada plantilla G12-xx seleccionada.
 *
 * Se renderiza como un overlay nativo (no usamos una libreria de Dialog
 * porque el proyecto no tiene shadcn/dialog instalado — ver components/ui).
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

type ClienteOption = { id: string; nombre: string }
type ModeloOption = {
  id: string
  fabricante: string
  familia: string
  modelo: string
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
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [fabricante, setFabricante] = useState('')
  const [modelo, setModelo] = useState('')
  const [msn, setMsn] = useState('')
  const [tcdsCode, setTcdsCode] = useState('')
  const [tcdsCodeShort, setTcdsCodeShort] = useState('')
  const [owner, setOwner] = useState('')
  const [checker, setChecker] = useState('')
  const [approval, setApproval] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [prioridad, setPrioridad] = useState<'alta' | 'media' | 'baja' | ''>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // --- Data sources ---
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [fabricantes, setFabricantes] = useState<string[]>([])
  const [modelos, setModelos] = useState<ModeloOption[]>([])

  // --- UI state ---
  const [loadingClientes, setLoadingClientes] = useState(false)
  const [loadingModelos, setLoadingModelos] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Cargar clientes y fabricantes al abrir
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingClientes(true)
    void fetch('/api/clientes')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setClientes(Array.isArray(data.clientes) ? data.clientes : [])
      })
      .catch((err) => console.error('[NewProjectModal] clientes:', err))
      .finally(() => !cancelled && setLoadingClientes(false))

    void fetch('/api/aeronaves/fabricantes')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setFabricantes(Array.isArray(data.fabricantes) ? data.fabricantes : [])
      })
      .catch((err) => console.error('[NewProjectModal] fabricantes:', err))

    return () => {
      cancelled = true
    }
  }, [open])

  // Cargar modelos al cambiar fabricante
  useEffect(() => {
    if (!fabricante) {
      setModelos([])
      setModelo('')
      return
    }
    let cancelled = false
    setLoadingModelos(true)
    void fetch(`/api/aeronaves/modelos?fabricante=${encodeURIComponent(fabricante)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setModelos(Array.isArray(data.modelos) ? data.modelos : [])
      })
      .catch((err) => console.error('[NewProjectModal] modelos:', err))
      .finally(() => !cancelled && setLoadingModelos(false))
    return () => {
      cancelled = true
    }
  }, [fabricante])

  // Reset al cerrar
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

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId) ?? null

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

    if (!titulo.trim()) {
      setErrorMsg('El titulo es obligatorio.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        cliente_id: clienteId || null,
        cliente_nombre: clienteSeleccionado?.nombre ?? null,
        fabricante: fabricante || null,
        modelo: modelo || null,
        msn: msn.trim() || null,
        tcds_code: tcdsCode.trim() || null,
        tcds_code_short: tcdsCodeShort.trim() || null,
        owner: owner.trim() || null,
        checker: checker.trim() || null,
        approval: approval.trim() || null,
        fecha_entrega_estimada: fechaEntrega || null,
        prioridad: prioridad || null,
        plantilla_codes: Array.from(selected),
      }

      const res = await fetch('/api/proyectos/crear-manual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data?.ok) {
        setErrorMsg(
          typeof data?.error === 'string'
            ? data.error
            : `Error ${res.status} creando el proyecto.`,
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
            <h2 className="text-lg font-semibold text-slate-950">Crear proyecto nuevo</h2>
            <p className="text-xs text-slate-500">
              Alta manual. Se generaran automaticamente las plantillas compliance
              seleccionadas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onOpenChange(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
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

          {/* Titulo / descripcion */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">
              Titulo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Descripcion</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
            />
          </div>

          {/* Cliente */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Cliente</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
              disabled={loadingClientes}
            >
              <option value="">
                {loadingClientes ? 'Cargando clientes…' : 'Seleccionar cliente...'}
              </option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Fabricante / Modelo */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Fabricante</label>
              <select
                value={fabricante}
                onChange={(e) => setFabricante(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
              >
                <option value="">Seleccionar fabricante...</option>
                {fabricantes.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Modelo</label>
              <select
                value={modelo}
                onChange={(e) => {
                  const nextModelo = e.target.value
                  setModelo(nextModelo)
                  // Auto-rellenar TCDS desde la fila del catalogo aeronaves.
                  const match = modelos.find((m) => m.modelo === nextModelo)
                  setTcdsCode(match?.tcds_code ?? '')
                  setTcdsCodeShort(match?.tcds_code_short ?? '')
                }}
                disabled={!fabricante || loadingModelos}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {!fabricante
                    ? 'Elige fabricante primero'
                    : loadingModelos
                      ? 'Cargando…'
                      : 'Seleccionar modelo...'}
                </option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.modelo}>
                    {m.modelo}
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
                {modelo ? (
                  <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-emerald-600">
                    auto
                  </span>
                ) : null}
              </label>
              <input
                type="text"
                value={tcdsCode}
                onChange={(e) => setTcdsCode(e.target.value)}
                placeholder="Se rellena al elegir modelo"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                TCDS short
                {modelo ? (
                  <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-emerald-600">
                    auto
                  </span>
                ) : null}
              </label>
              <input
                type="text"
                value={tcdsCodeShort}
                onChange={(e) => setTcdsCodeShort(e.target.value)}
                placeholder="Se rellena al elegir modelo"
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

          {/* Fecha / prioridad */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Fecha entrega estimada
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
                value={prioridad}
                onChange={(e) =>
                  setPrioridad(e.target.value as 'alta' | 'media' | 'baja' | '')
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-300 focus:outline-none"
              >
                <option value="">Sin definir</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
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
                Las plantillas seleccionadas se generaran como .docx en la carpeta
                &quot;01. Compliance documents&quot; del proyecto.
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
            {submitting ? 'Creando…' : 'Crear proyecto'}
          </button>
        </div>
      </div>
    </div>
  )
}
