'use client'

import Link from 'next/link'
import { Database, TableProperties } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { type TableGroup } from '@/lib/databases'

export default function DatabasesClient({ tableGroups }: { tableGroups: TableGroup[] }) {
  const totalTables = tableGroups.reduce((sum, group) => sum + group.tables.length, 0)
  const totalRecords = tableGroups.reduce(
    (sum, group) => sum + group.tables.reduce((groupSum, table) => groupSum + table.count, 0),
    0
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Bases de datos" subtitle="Gestion de datos estructurados y vectoriales" />

      <div className="flex-1 overflow-y-auto p-6 text-slate-900">
        <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-2 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
            <span className="font-semibold text-slate-950">{totalTables}</span> tablas conectadas
          </div>
          <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-2 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
            <span className="font-semibold text-slate-950">{totalRecords}</span> registros totales
          </div>
        </div>

        <div className="space-y-8">
          {tableGroups.map((group) => (
            <section key={group.name} className="space-y-3">
              <div className="flex items-center gap-2">
                <TableProperties size={18} className="text-sky-700" />
                <h2 className="text-base font-semibold text-slate-900">{group.name}</h2>
              </div>

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {group.tables.map((table) => (
                  <article
                    key={table.table}
                    className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)] transition-colors hover:border-sky-300"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">
                        <Database size={12} />
                        tabla
                      </span>
                      <span className="text-xs text-slate-500">{table.count} filas</span>
                    </div>

                    <p className="mb-2 break-all font-mono text-sm font-semibold text-slate-950">
                      {table.table}
                    </p>
                    <p className="mb-4 text-sm leading-relaxed text-slate-500">
                      {table.description}
                    </p>

                    <Link
                      href={`/databases/${encodeURIComponent(table.table)}`}
                      className="block w-full rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-center text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100 hover:border-sky-300"
                    >
                      Ver datos
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
