'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, Clock3, FileText, Hash, Search, X } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { cn } from '@/lib/utils'

interface ProyectoHistoricoRow {
  id: string
  numero_proyecto: string
  titulo: string
  descripcion: string | null
  cliente_nombre: string | null
  created_at: string
  updated_at: string
}

function getBadgeLabel(code: string) {
  return code.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase()
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function ProjectDetailPanel({
  project,
  onClose,
}: {
  project: ProyectoHistoricoRow
  onClose?: () => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_100%)] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{project.titulo}</h2>
          <p className="mt-0.5 font-mono text-xs text-slate-500">{project.numero_proyecto}</p>
        </div>
        {onClose ? (
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-950"
          >
            <X size={15} />
          </button>
        ) : null}
      </div>

      <div className="px-5 py-3">
        <details className="group" open>
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-sky-600 hover:text-sky-700 [&::-webkit-details-marker]:hidden">
            <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
            <span>Ver ficha completa</span>
          </summary>

          <div className="flex flex-col gap-5 pt-4">
            <div className="grid gap-3">
              {[
                { icon: <Hash size={13} />, label: 'Codigo', value: project.numero_proyecto },
                { icon: <FileText size={13} />, label: 'Titulo', value: project.titulo },
                {
                  icon: <Clock3 size={13} />,
                  label: 'Creado',
                  value: formatDate(project.created_at),
                },
                {
                  icon: <CalendarDays size={13} />,
                  label: 'Actualizado',
                  value: formatDate(project.updated_at),
                },
                project.cliente_nombre
                  ? {
                      icon: <FileText size={13} />,
                      label: 'Cliente',
                      value: project.cliente_nombre,
                    }
                  : null,
              ]
                .filter(Boolean)
                .map((item) => (
                  <div key={item!.label} className="rounded-[18px] border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 text-slate-400">{item!.icon}</span>
                      <div>
                        <span className="text-xs text-slate-500">{item!.label}</span>
                        <p className="text-sm text-slate-950">{item!.value}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex flex-col gap-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Descripcion
              </h3>
              {project.descripcion ? (
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {project.descripcion}
                </p>
              ) : (
                <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Este proyecto historico no tiene descripcion registrada.
                </div>
              )}
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}

function EmptyProjectDetail() {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_100%)] px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">Detalle del proyecto historico</h2>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full rounded-[26px] border border-dashed border-sky-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] p-6 text-center">
          <p className="text-sm font-semibold text-slate-950">Selecciona un proyecto</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            La zona izquierda muestra codigo, titulo y cliente. Al pulsar una fila, aqui veras el
            resto de la ficha historica.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ProyectosHistoricoPageClient({
  projects,
}: {
  projects: ProyectoHistoricoRow[]
}) {
  const [search, setSearch] = useState('')
  const [selectedProject, setSelectedProject] = useState<ProyectoHistoricoRow | null>(null)

  const filtered = useMemo(() => {
    return projects.filter((project) => {
      if (search === '') return true

      const q = search.toLowerCase()

      return (
        project.numero_proyecto.toLowerCase().includes(q) ||
        project.titulo.toLowerCase().includes(q) ||
        (project.cliente_nombre ?? '').toLowerCase().includes(q) ||
        (project.descripcion ?? '').toLowerCase().includes(q)
      )
    })
  }, [projects, search])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Proyectos Historico" subtitle="Base historica de proyectos" />

      <div className="flex min-h-0 flex-1 gap-5 p-5 text-slate-900">
        <div className="flex min-h-0 basis-2/3 flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="relative max-w-lg flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Buscar por codigo, titulo o cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-950 shadow-sm transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>
              <span className="font-semibold text-slate-950">{filtered.length}</span> proyectos
            </span>
          </div>

          <div className="min-h-0 overflow-auto rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Codigo', 'Titulo', 'Cliente'].map((col) => (
                    <th
                      key={col}
                      className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => {
                  const isSelected = selectedProject?.id === project.id

                  return (
                    <tr
                      key={project.id}
                      onClick={() => setSelectedProject(isSelected ? null : project)}
                      className={cn(
                        'cursor-pointer border-b border-slate-200/60 transition-colors',
                        isSelected ? 'bg-sky-50/70' : 'hover:bg-sky-50/40'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-[linear-gradient(135deg,#DBEAFE,#E0F2FE)] text-xs font-bold text-sky-700">
                            {getBadgeLabel(project.numero_proyecto)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-950">{project.numero_proyecto}</p>
                            <p className="font-mono text-xs text-slate-500">
                              {project.updated_at.slice(0, 10)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{project.titulo}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {project.cliente_nombre ?? '-'}
                      </td>
                    </tr>
                  )
                })}

                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">
                      {search
                        ? `No se encontraron proyectos historicos para "${search}"`
                        : 'No hay proyectos historicos registrados.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-h-0 basis-1/3">
          {selectedProject ? (
            <ProjectDetailPanel
              project={selectedProject}
              onClose={() => setSelectedProject(null)}
            />
          ) : (
            <EmptyProjectDetail />
          )}
        </div>
      </div>
    </div>
  )
}
