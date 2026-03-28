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
    <div className="flex h-full flex-col bg-[#0F1117]">
      <TopBar title="Bases de datos" subtitle="Gestion de datos estructurados y vectoriales" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-[#6B7280]">
          <div className="rounded-lg border border-[#2A2D3E] bg-[#1A1D27] px-4 py-2">
            <span className="font-semibold text-[#E8E9F0]">{totalTables}</span> tablas conectadas
          </div>
          <div className="rounded-lg border border-[#2A2D3E] bg-[#1A1D27] px-4 py-2">
            <span className="font-semibold text-[#E8E9F0]">{totalRecords}</span> registros totales
          </div>
        </div>

        <div className="space-y-8">
          {tableGroups.map((group) => (
            <section key={group.name} className="space-y-3">
              <div className="flex items-center gap-2">
                <TableProperties size={18} className="text-[#6366F1]" />
                <h2 className="text-base font-semibold text-[#E8E9F0]">{group.name}</h2>
              </div>

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {group.tables.map((table) => (
                  <article
                    key={table.table}
                    className="rounded-xl border border-[#2A2D3E] bg-[#1A1D27] p-5"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1 rounded-md border border-[#6366F1]/30 bg-[#6366F1]/10 px-2 py-1 text-xs font-semibold text-[#6366F1]">
                        <Database size={12} />
                        tabla
                      </span>
                      <span className="text-xs text-[#6B7280]">{table.count} filas</span>
                    </div>

                    <p className="mb-2 break-all font-mono text-sm font-semibold text-[#E8E9F0]">
                      {table.table}
                    </p>
                    <p className="mb-4 text-sm leading-relaxed text-[#6B7280]">
                      {table.description}
                    </p>

                    <Link
                      href={`/databases/${encodeURIComponent(table.table)}`}
                      className="block w-full rounded-lg border border-[#6366F1]/30 bg-[#6366F1] px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-[#5558E3]"
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
