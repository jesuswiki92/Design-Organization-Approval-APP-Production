import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import {
  ALLOWED_TABLE_SET,
  RAG_TABLE_SET,
  TABLE_GROUPS,
  TABLE_PAGE_SIZE,
  type AllowedTable,
} from '@/lib/databases'

type RowRecord = Record<string, unknown>

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

export default async function DatabaseTablePage({
  params,
  searchParams,
}: {
  params: Promise<{ table: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { table } = await params
  const { page: pageParam } = await searchParams

  if (!ALLOWED_TABLE_SET.has(table)) {
    redirect('/databases')
  }

  const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : 0
  const page = Number.isNaN(parsedPage) || parsedPage < 0 ? 0 : parsedPage
  const allowedTable = table as AllowedTable

  const supabase = await createClient()
  const selectedColumns = RAG_TABLE_SET.has(allowedTable) ? 'id,content,metadata,created_at' : '*'

  const { data, error, count } = await supabase
    .from(allowedTable)
    .select(selectedColumns, { count: 'exact' })
    .range(page * TABLE_PAGE_SIZE, page * TABLE_PAGE_SIZE + TABLE_PAGE_SIZE - 1)

  if (error) {
    console.error(`Error fetching rows for ${allowedTable}:`, error)
    redirect('/databases')
  }

  const rows = (data ?? []) as unknown as RowRecord[]
  const totalRows = count ?? 0
  const columns = rows.length > 0 ? Object.keys(rows[0]) : []
  const currentRangeStart = totalRows === 0 ? 0 : page * TABLE_PAGE_SIZE + 1
  const currentRangeEnd = Math.min((page + 1) * TABLE_PAGE_SIZE, totalRows)
  const hasPreviousPage = page > 0
  const hasNextPage = currentRangeEnd < totalRows
  const previousPageHref = `/databases/${encodeURIComponent(allowedTable)}?page=${page - 1}`
  const nextPageHref = `/databases/${encodeURIComponent(allowedTable)}?page=${page + 1}`
  const tableEntries = TABLE_GROUPS.flatMap((group) => [...group.tables]) as ReadonlyArray<{
    table: AllowedTable
    description: string
  }>
  const tableDescription =
    tableEntries.find((entry) => entry.table === allowedTable)?.description ??
    'Vista detallada de la tabla'

  return (
    <div className="flex h-full flex-col bg-[#0F1117]">
      <TopBar title="Bases de datos" subtitle="Gestion de datos estructurados y vectoriales" />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <Link
              href="/databases"
              className="inline-flex items-center gap-2 text-sm text-[#6B7280] transition-colors hover:text-[#E8E9F0]"
            >
              <ArrowLeft size={16} />
              Volver a Bases de datos
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-all font-mono text-2xl font-semibold text-[#E8E9F0]">{table}</h1>
              <span className="rounded-full border border-[#2A2D3E] bg-[#1A1D27] px-3 py-1 text-sm text-[#E8E9F0]">
                {totalRows} filas
              </span>
            </div>

            <p className="max-w-3xl text-sm text-[#6B7280]">{tableDescription}</p>
          </div>

          <div className="flex items-center gap-2">
            {hasPreviousPage && (
              <Link
                href={previousPageHref}
                className="rounded-lg border border-[#2A2D3E] bg-[#1A1D27] px-3 py-2 text-sm text-[#E8E9F0] transition-colors hover:border-[#6366F1]/40"
              >
                Anterior
              </Link>
            )}

            <span className="rounded-lg border border-[#2A2D3E] bg-[#1A1D27] px-3 py-2 text-sm text-[#E8E9F0]">
              Pagina {page + 1}
            </span>

            {hasNextPage && (
              <Link
                href={nextPageHref}
                className="rounded-lg border border-[#2A2D3E] bg-[#1A1D27] px-3 py-2 text-sm text-[#E8E9F0] transition-colors hover:border-[#6366F1]/40"
              >
                Siguiente
              </Link>
            )}
          </div>
        </div>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#2A2D3E] bg-[#1A1D27]">
          <div className="border-b border-[#2A2D3E] px-5 py-3 text-sm text-[#6B7280]">
            <span className="font-semibold text-[#E8E9F0]">{totalRows}</span> registros
            {totalRows > 0 && ` | Mostrando ${currentRangeStart}-${currentRangeEnd}`}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {rows.length === 0 ? (
              <div className="flex h-full min-h-64 items-center justify-center px-6 text-sm text-[#6B7280]">
                No hay datos para mostrar en esta pagina.
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[#1A1D27]">
                  <tr className="border-b border-[#2A2D3E]">
                    {columns.map((column) => (
                      <th
                        key={column}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280]"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={String(row.id ?? `${page}-${index}`)}
                      className="border-b border-[#2A2D3E]/60"
                    >
                      {columns.map((column) => (
                        <td
                          key={column}
                          className="max-w-64 whitespace-pre-wrap break-words px-4 py-3 align-top text-[#E8E9F0]"
                        >
                          {formatValue(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
