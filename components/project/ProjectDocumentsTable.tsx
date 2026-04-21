'use client'

import { Bot, ExternalLink, FileText, Filter, Info, Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProjectDocument } from '@/types/database'

import { getDocumentStatusMeta } from './workspace-utils'

export function ProjectDocumentsTable({
  docs,
  selectedDocId,
  density,
  onDensityChange,
  onSelectDoc,
  onAskExpert,
}: {
  docs: ProjectDocument[]
  selectedDocId: string | null
  density: 'compact' | 'detailed'
  onDensityChange: (mode: 'compact' | 'detailed') => void
  onSelectDoc: (doc: ProjectDocument) => void
  onAskExpert: (doc: ProjectDocument) => void
}) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filteredDocs = useMemo(() => {
    return docs.filter((doc) => {
      const matchesQuery =
        query.trim() === '' ||
        `${doc.name} ${doc.document_type} ${doc.version}`
          .toLowerCase()
          .includes(query.toLowerCase())
      const matchesStatus = statusFilter === 'all' || doc.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [docs, query, statusFilter])

  return (
    <section className="overflow-hidden rounded-[24px] border border-sky-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Paquete documental
            </div>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              MDL digital refinada para review operativa
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              La table mantiene tono documental formal, pero permite lanzar acciones discretas,
              revisar status y activar contexto para el experto sin salir del expediente.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={density === 'compact' ? 'secondary' : 'outline'}
              size="sm"
              className={cn(
                'border-[#334155] bg-slate-50 text-slate-700',
                density === 'compact' ? 'bg-[#172033] text-white' : 'hover:bg-sky-50',
              )}
              onClick={() => onDensityChange('compact')}
            >
              Compacto
            </Button>
            <Button
              variant={density === 'detailed' ? 'secondary' : 'outline'}
              size="sm"
              className={cn(
                'border-[#334155] bg-slate-50 text-slate-700',
                density === 'detailed' ? 'bg-[#172033] text-white' : 'hover:bg-sky-50',
              )}
              onClick={() => onDensityChange('detailed')}
            >
              Detallado
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por document, type o review..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-sky-300 focus:outline-none"
              />
            </label>
            <label className="relative min-w-[220px]">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-950 focus:border-sky-300 focus:outline-none"
              >
                <option value="all">Todos los statuses</option>
                <option value="approved">Vigente</option>
                <option value="pending">Pending</option>
                <option value="in_review">En review</option>
                <option value="drafting">En redacción</option>
              </select>
            </label>
          </div>

          <div className="text-sm text-slate-500">
            {filteredDocs.length} documents visibles · {docs.length} total en expediente
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              {['Document', 'Tipo / paquete', 'Review', 'Status', 'Control', 'Acciones'].map(
                (heading) => (
                  <th
                    key={heading}
                    className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                  No hay documents que coincidan con los filtros actuales.
                </td>
              </tr>
            ) : (
              filteredDocs.map((doc) => {
                const status = getDocumentStatusMeta(doc.status)
                const isSelected = selectedDocId === doc.id

                return (
                  <tr
                    key={doc.id}
                    className={cn(
                      'border-b border-slate-200/80 transition-colors',
                      isSelected ? 'bg-sky-50' : 'hover:bg-sky-50/45',
                    )}
                  >
                    <td className="px-4 py-3 align-top">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => onSelectDoc(doc)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-950">
                              {doc.name}
                            </div>
                            {density === 'detailed' && (
                              <div className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                                Document asociado al paquete {doc.document_type}. Desde aquí se
                                puede lanzar análisis contextual sin abandonar el workspace.
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-slate-700">
                      <div>{doc.document_type}</div>
                      {density === 'detailed' && (
                        <div className="mt-1 text-xs text-slate-400">Estructura DOA / expediente</div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-mono text-sm text-slate-950">{doc.version}</div>
                      {doc.last_review_date && (
                        <div className="mt-1 text-xs text-slate-400">
                          Rev. {doc.last_review_date}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={cn(
                          'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
                          status.badge,
                        )}
                      >
                        <span className={cn('h-2 w-2 rounded-full', status.accent)} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-slate-500">
                      <div>{doc.last_review_date ?? 'Sin date'}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {doc.notes ? 'Con notes asociadas' : 'Sin notes registradas'}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        <ActionIcon
                          label="Ver metadata"
                          icon={<Info className="h-4 w-4" />}
                          onClick={() => onSelectDoc(doc)}
                        />
                        <ActionIcon
                          label="Preguntar al experto"
                          icon={<Bot className="h-4 w-4" />}
                          onClick={() => onAskExpert(doc)}
                        />
                        <ActionIcon
                          label={doc.url ? 'Abrir document' : 'Sin URL disponible'}
                          icon={<ExternalLink className="h-4 w-4" />}
                          onClick={() => {
                            if (doc.url) window.open(doc.url, '_blank', 'noopener,noreferrer')
                          }}
                          disabled={!doc.url}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ActionIcon({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="border-[#334155] bg-slate-50 text-slate-700 hover:bg-sky-50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      {icon}
    </Button>
  )
}
