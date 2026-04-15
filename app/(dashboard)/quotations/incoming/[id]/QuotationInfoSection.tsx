import { Receipt } from 'lucide-react'

export function QuotationInfoSection() {
  return (
    <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 px-5 py-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-orange-200 bg-white">
          <Receipt className="h-4 w-4 text-orange-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Quotation pendiente en esta fase</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Esta vista permanece visible como placeholder, pero la edicion de oferta
            sigue desactivada mientras la consulta esta en modo revision y decision.
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">
            La preparacion de quotation se activara en la siguiente iteracion.
          </p>
        </div>
      </div>
    </div>
  )
}
