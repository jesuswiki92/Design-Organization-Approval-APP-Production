import { Receipt } from 'lucide-react'

export function QuotationInfoSection() {
  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper)] px-5 py-5 shadow-[0_8px_18px_rgba(74,60,36,0.08)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]">
          <Receipt className="h-4 w-4 text-[color:var(--umber)]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[color:var(--ink)]">Quotation pendiente en esta fase</p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--ink-2)]">
            Esta vista permanece visible como placeholder, pero la edicion de oferta
            sigue desactivada mientras la consulta esta en modo revision y decision.
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[color:var(--ink-2)]">
            La preparacion de quotation se activara en la siguiente iteracion.
          </p>
        </div>
      </div>
    </div>
  )
}
