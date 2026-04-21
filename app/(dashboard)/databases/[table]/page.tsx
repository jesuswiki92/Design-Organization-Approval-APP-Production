// ⏸️ BASE DE DATOS DESCONECTADA - ver BASES-DE-DATOS.md para reconectar
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { ALLOWED_TABLE_SET, TABLE_GROUPS, type AllowedTable } from '@/lib/databases'

export default async function DatabaseTablePage({
  params,
}: {
  params: Promise<{ table: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { table } = await params

  if (!ALLOWED_TABLE_SET.has(table)) {
    redirect('/databases')
  }

  const allowedTable = table as AllowedTable
  const tableEntries = TABLE_GROUPS.flatMap((group) => [...group.tables]) as ReadonlyArray<{
    table: AllowedTable
    description: string
  }>
  const tableDescription =
    tableEntries.find((entry) => entry.table === allowedTable)?.description ??
    'Vista detallada de la tabla'

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar title="Bases de datos" subtitle="Gestion de datos estructurados y vectoriales" />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 text-[color:var(--ink)]">
        <div className="mb-6 space-y-3">
          <Link
            href="/databases"
            className="inline-flex items-center gap-2 text-sm text-[color:var(--ink-3)] transition-colors hover:text-slate-950"
          >
            <ArrowLeft size={16} />
            Volver a Bases de datos
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="break-all font-mono text-2xl font-semibold text-slate-950">{table}</h1>
          </div>

          <p className="max-w-3xl text-sm text-[color:var(--ink-3)]">{tableDescription}</p>
        </div>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
          <div className="flex h-full min-h-64 items-center justify-center px-6 text-sm text-[color:var(--ink-3)]">
            Tabla desconectada durante reestructuracion. Consulta BASES-DE-DATOS.md para reconectar.
          </div>
        </section>
      </div>
    </div>
  )
}
