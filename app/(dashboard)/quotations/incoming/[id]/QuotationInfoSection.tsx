'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Receipt, Trash2 } from 'lucide-react'

type LineItem = {
  id: string
  description: string
  quantity: number
  unitPrice: number
}

type Props = {
  consultaId: string
  clientName?: string
  clientContact?: string
  aircraftModel?: string
  aircraftManufacturer?: string
  aircraftMsn?: string
  modificationSummary?: string
}

export function QuotationInfoSection({
  consultaId,
  clientName,
  clientContact,
  aircraftModel,
  aircraftManufacturer,
  aircraftMsn,
  modificationSummary,
}: Props) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [quotationNumber, setQuotationNumber] = useState('')
  const [quotationDate, setQuotationDate] = useState(today)
  const [validityDays, setValidityDays] = useState('90')
  const [leadTimeDays, setLeadTimeDays] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [requiredDocs, setRequiredDocs] = useState('')
  const [assumptions, setAssumptions] = useState('')
  const [taxCode, setTaxCode] = useState('IVA 21%')

  // --- Dos categorias de lineas ---
  const [engineeringItems, setEngineeringItems] = useState<LineItem[]>([
    { id: 'eng-1', description: '', quantity: 1, unitPrice: 0 },
  ])
  const [deliverableItems, setDeliverableItems] = useState<LineItem[]>([
    { id: 'del-1', description: '', quantity: 1, unitPrice: 0 },
  ])

  // --- Helpers para ambas categorias ---
  function addItem(setter: React.Dispatch<React.SetStateAction<LineItem[]>>, prefix: string) {
    setter((prev) => [...prev, { id: `${prefix}-${Date.now()}`, description: '', quantity: 1, unitPrice: 0 }])
  }

  function removeItem(setter: React.Dispatch<React.SetStateAction<LineItem[]>>, id: string) {
    setter((prev) => prev.filter((item) => item.id !== id))
  }

  function updateItem(setter: React.Dispatch<React.SetStateAction<LineItem[]>>, id: string, field: keyof LineItem, value: string | number) {
    setter((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  // --- Calculos ---
  const engineeringSubtotal = engineeringItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const deliverablesSubtotal = deliverableItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const subtotal = engineeringSubtotal + deliverablesSubtotal
  const taxRate = taxCode === 'IVA 21%' ? 0.21 : taxCode === 'IVA 10%' ? 0.10 : 0
  const taxAmount = subtotal * taxRate
  const total = subtotal + taxAmount

  async function handleSave() {
    setSaving(true)
    setStatus('idle')
    try {
      const payload = {
        quotation_date: quotationDate,
        validity_days: validityDays,
        lead_time_days: leadTimeDays,
        tax_code: taxCode,
        subtotal,
        tax_amount: taxAmount,
        total,
        payment_terms: paymentTerms,
        required_docs: requiredDocs,
        assumptions,
        items: [
          ...engineeringItems.map((item) => ({
            category: 'engineering',
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          })),
          ...deliverableItems.map((item) => ({
            category: 'deliverables',
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          })),
        ],
      }
      const res = await fetch(`/api/consultas/${consultaId}/quotation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Error al guardar')
      const data = await res.json()
      if (data.quotation_number) {
        setQuotationNumber(data.quotation_number)
      }
      setStatus('saved')
      router.refresh()
    } catch (err) {
      console.error('Error guardando quotation:', err)
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-300'
  const labelClass = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1'
  const readOnlyClass = 'w-full rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-sm text-slate-700'

  // --- Componente reutilizable para tabla de lineas ---
  function renderLineItems(
    items: LineItem[],
    setter: React.Dispatch<React.SetStateAction<LineItem[]>>,
    prefix: string,
    placeholder: string,
  ) {
    return (
      <>
        {/* Column headers */}
        <div className="mb-1 flex items-center gap-2 px-1">
          <span className="w-4" />
          <span className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Descripcion</span>
          <span className="w-16 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">Cant.</span>
          <span className="w-24 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Precio ud.</span>
          <span className="w-24 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Importe</span>
          <span className="w-8" />
        </div>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="w-4 text-center text-[10px] font-semibold text-slate-400">{idx + 1}</span>
              <input
                type="text"
                value={item.description}
                onChange={(e) => updateItem(setter, item.id, 'description', e.target.value)}
                placeholder={placeholder}
                className={`flex-1 ${inputClass}`}
              />
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => updateItem(setter, item.id, 'quantity', parseFloat(e.target.value) || 0)}
                className={`w-16 text-center ${inputClass}`}
              />
              <input
                type="number"
                value={item.unitPrice || ''}
                onChange={(e) => updateItem(setter, item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className={`w-24 text-right ${inputClass}`}
              />
              <span className="w-24 text-right font-mono text-sm text-slate-600">
                {(item.quantity * item.unitPrice).toFixed(2)}
              </span>
              {items.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeItem(setter, item.id)}
                  className="inline-flex h-7 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  title="Eliminar linea"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span className="w-8" />
              )}
            </div>
          ))}
        </div>
        {/* Subtotal de la seccion */}
        <div className="mt-2 flex justify-end pr-10">
          <span className="text-xs text-slate-500">Subtotal:</span>
          <span className="ml-2 w-24 text-right font-mono text-xs font-semibold text-slate-700">
            {items.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)} EUR
          </span>
        </div>
      </>
    )
  }

  return (
    <div className="space-y-5">
      {/* --- Datos del cliente (auto) --- */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-600/70">Datos del cliente</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Empresa</label>
            <div className={readOnlyClass}>{clientName || '—'}</div>
          </div>
          <div>
            <label className={labelClass}>Contacto</label>
            <div className={readOnlyClass}>{clientContact || '—'}</div>
          </div>
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* --- Aeronave (auto) --- */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-600/70">Aeronave</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Fabricante</label>
            <div className={readOnlyClass}>{aircraftManufacturer || '—'}</div>
          </div>
          <div>
            <label className={labelClass}>Modelo</label>
            <div className={readOnlyClass}>{aircraftModel || '—'}</div>
          </div>
          <div>
            <label className={labelClass}>MSN</label>
            <div className={readOnlyClass}>{aircraftMsn || '—'}</div>
          </div>
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* --- Metadata quotation --- */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-600/70">Referencia oferta</p>
        {quotationNumber && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase text-orange-500">N Oferta</span>
            <span className="font-mono text-sm font-bold text-orange-700">{quotationNumber}</span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Fecha</label>
            <input
              type="date"
              value={quotationDate}
              onChange={(e) => setQuotationDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Validez (dias)</label>
            <input
              type="number"
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
              placeholder="90"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Lead time (dias)</label>
            <input
              type="number"
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(e.target.value)}
              placeholder="30"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* --- Descripcion del alcance --- */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-600/70">Alcance de trabajo</p>

        {modificationSummary && (
          <div className="mb-3 rounded-lg border border-orange-100 bg-orange-50/50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase text-orange-500">Descripcion de la consulta</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-700">{modificationSummary}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Documentacion requerida</label>
            <textarea
              value={requiredDocs}
              onChange={(e) => setRequiredDocs(e.target.value)}
              placeholder="Ej: (1) Job description (2) Planos actualizados"
              rows={2}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Informacion pendiente / Supuestos</label>
            <textarea
              value={assumptions}
              onChange={(e) => setAssumptions(e.target.value)}
              placeholder="Ej: Cualquier informacion adicional relevante"
              rows={2}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* --- ENGINEERING TASKS --- */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600/70">Tareas de ingenieria</p>
            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-sky-700">Engineering Tasks</span>
          </div>
          <button
            type="button"
            onClick={() => addItem(setEngineeringItems, 'eng')}
            className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-medium text-orange-600 transition-colors hover:bg-orange-100"
          >
            <Plus className="h-3 w-3" />
            Anadir linea
          </button>
        </div>
        {renderLineItems(engineeringItems, setEngineeringItems, 'eng', 'Ej: Project modification / Engineering service')}
      </div>

      <hr className="border-slate-100" />

      {/* --- DELIVERABLES --- */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600/70">Entregables</p>
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-violet-700">Deliverables</span>
          </div>
          <button
            type="button"
            onClick={() => addItem(setDeliverableItems, 'del')}
            className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-medium text-orange-600 transition-colors hover:bg-orange-100"
          >
            <Plus className="h-3 w-3" />
            Anadir linea
          </button>
        </div>
        {renderLineItems(deliverableItems, setDeliverableItems, 'del', 'Ej: Updated documentation / Deliverable package')}
      </div>

      <hr className="border-slate-100" />

      {/* --- Tarifas y totales --- */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-600/70">Costes y condiciones</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Codigo impuesto</label>
            <select
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
              className={inputClass}
            >
              <option value="IVA 21%">IVA 21%</option>
              <option value="IVA 10%">IVA 10%</option>
              <option value="IVA 0%">IVA 0% (Exento)</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Condiciones de pago</label>
            <input
              type="text"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="Ej: Full Advanced Payment"
              className={inputClass}
            />
          </div>
        </div>

        {/* Totals summary */}
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Tareas de ingenieria ({engineeringItems.length} lineas)</span>
              <span className="font-mono">{engineeringSubtotal.toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Entregables ({deliverableItems.length} lineas)</span>
              <span className="font-mono">{deliverablesSubtotal.toFixed(2)} EUR</span>
            </div>
            <hr className="border-slate-200" />
            <div className="flex justify-between text-xs text-slate-700">
              <span>Subtotal</span>
              <span className="font-mono font-semibold">{subtotal.toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>{taxCode} sobre {subtotal.toFixed(2)}</span>
              <span className="font-mono">{taxAmount.toFixed(2)} EUR</span>
            </div>
            <hr className="border-slate-200" />
            <div className="flex justify-between text-sm font-semibold text-slate-900">
              <span>Total</span>
              <span className="font-mono">{total.toFixed(2)} EUR</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- Save button + status --- */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-5 py-2 text-sm font-semibold text-orange-700 shadow-sm transition-colors hover:bg-orange-100 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Receipt className="h-4 w-4" />
          )}
          {saving ? 'Guardando...' : 'Guardar oferta'}
        </button>
        {status === 'saved' && (
          <span className="text-xs font-medium text-emerald-600">&#10003; Guardado</span>
        )}
        {status === 'error' && (
          <span className="text-xs font-medium text-red-600">Error al guardar</span>
        )}
        {quotationNumber && (
          <span className="rounded-full bg-orange-100 px-3 py-1 font-mono text-xs font-semibold text-orange-700">
            {quotationNumber}
          </span>
        )}
      </div>
    </div>
  )
}
