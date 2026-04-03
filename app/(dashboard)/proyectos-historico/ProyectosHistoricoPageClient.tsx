'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { FolderOpen, Plus, Search } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'

interface ProyectoHistoricoRow {
  id: string
  numero_proyecto: string
  titulo: string
  descripcion: string | null
  cliente_nombre: string | null
  anio: number | null
  ruta_origen: string | null
  nombre_carpeta_origen: string | null
  created_at: string
  updated_at: string
}

function getBadgeLabel(code: string) {
  return code.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase()
}

export default function ProyectosHistoricoPageClient({
  projects,
}: {
  projects: ProyectoHistoricoRow[]
}) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return projects.filter((project) => {
      if (search === '') return true

      const q = search.toLowerCase()

      return (
        project.numero_proyecto.toLowerCase().includes(q) ||
        project.titulo.toLowerCase().includes(q) ||
        (project.cliente_nombre ?? '').toLowerCase().includes(q) ||
        (project.nombre_carpeta_origen ?? '').toLowerCase().includes(q) ||
        (project.ruta_origen ?? '').toLowerCase().includes(q) ||
        String(project.anio ?? '').includes(q) ||
        (project.descripcion ?? '').toLowerCase().includes(q)
      )
    })
  }, [projects, search])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Proyectos Historico" subtitle="Base historica de proyectos" />

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5 text-slate-900">
        <section className="rounded-[34px] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_52%,#f8fafc_100%)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                Proyectos Historico
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
                Listado historico base. Pulsa `+` en cada fila para abrir la ficha de entrada y
                empezar a completar la informacion del proyecto.
              </p>
            </div>

            <div className="rounded-[22px] border border-sky-200 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Proyectos
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{filtered.length}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="relative max-w-lg flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Buscar por codigo, titulo, cliente u origen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-950 shadow-sm transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:outline-none"
              />
            </div>

            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Usa el `+` para abrir la ficha
            </div>
          </div>
        </section>

        <div className="min-h-0 overflow-auto rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['Codigo', 'Titulo', 'Cliente', 'Origen', 'Accion'].map((col) => (
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
              {filtered.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-slate-200/60 transition-colors hover:bg-sky-50/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-[linear-gradient(135deg,#DBEAFE,#E0F2FE)] text-xs font-bold text-sky-700">
                        {getBadgeLabel(project.numero_proyecto)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-950">{project.numero_proyecto}</p>
                        <p className="font-mono text-xs text-slate-500">
                          {project.anio ?? '2021'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p className="font-medium text-slate-950">{project.titulo}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {project.nombre_carpeta_origen ?? 'Sin carpeta de origen'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{project.cliente_nombre ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex items-start gap-2">
                      <FolderOpen size={14} className="mt-0.5 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700">
                          {project.nombre_carpeta_origen ?? '-'}
                        </p>
                        <p className="mt-1 break-all font-mono text-[11px] leading-5 text-slate-400">
                          {project.ruta_origen ?? '-'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/proyectos-historico/${project.id}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition-colors hover:bg-sky-100"
                      title="Abrir ficha"
                      aria-label={`Abrir ficha de ${project.numero_proyecto}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
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
    </div>
  )
}
