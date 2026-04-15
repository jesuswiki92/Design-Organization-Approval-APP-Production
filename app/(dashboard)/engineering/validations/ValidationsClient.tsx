'use client'

import Link from 'next/link'
import { ClipboardCheck, Clock, User } from 'lucide-react'

import { cn } from '@/lib/utils'

export type ValidationQueueItem = {
  id: string
  numero_proyecto: string
  titulo: string
  cliente_nombre: string | null
  received_at: string | null
  deliverables_total: number
  deliverables_completed: number
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatTimeInQueue(iso: string | null): string {
  if (!iso) return '-'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '-'
  const diffMs = Date.now() - then
  if (diffMs < 0) return 'Recien llegado'

  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  return `${days} d`
}

export function ValidationsClient({ items }: { items: ValidationQueueItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 pb-8 pt-5">
        <div className="max-w-md rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
          <ClipboardCheck className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-4 text-sm font-semibold text-slate-800">
            No hay proyectos pendientes de validacion
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Cuando un ingeniero envia un proyecto a validacion, aparecera aqui
            para que DOH/DOS lo revise y firme.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto px-5 pb-8 pt-5">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">
          Cola de validacion
        </h1>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
          {items.length} pendiente{items.length === 1 ? '' : 's'}
        </span>
      </header>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const pct =
            item.deliverables_total > 0
              ? Math.round(
                  (item.deliverables_completed / item.deliverables_total) * 100,
                )
              : 0

          return (
            <li key={item.id}>
              <Link
                href={`/engineering/projects/${item.id}?tab=validacion`}
                className={cn(
                  'flex h-full flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition',
                  'hover:border-amber-300 hover:shadow-md',
                )}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-slate-500">
                      {item.numero_proyecto}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      En validacion
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {item.titulo}
                  </h3>
                  {item.cliente_nombre && (
                    <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <User className="h-3 w-3" />
                      {item.cliente_nombre}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Deliverables</span>
                    <span className="font-medium">
                      {item.deliverables_completed}/{item.deliverables_total} listos
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                  <span>Recibido: {formatDateTime(item.received_at)}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    En cola: {formatTimeInQueue(item.received_at)}
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
