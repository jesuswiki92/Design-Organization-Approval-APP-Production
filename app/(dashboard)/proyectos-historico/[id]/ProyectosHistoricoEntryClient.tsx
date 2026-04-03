'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  FolderOpen,
  Hash,
  NotebookTabs,
} from 'lucide-react'
import { type ReactNode } from 'react'

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

interface ProyectoHistoricoDocumentoRow {
  id: string
  familia_documental: string
  carpeta_origen: string
  ruta_origen: string
  archivo_referencia: string | null
  total_archivos: number
  formatos_disponibles: string[]
  orden_documental: number | null
}

function DataField({
  label,
  icon,
  value,
  wide,
}: {
  label: string
  icon: ReactNode
  value: string | null | undefined
  wide?: boolean
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 ${wide ? 'md:col-span-2' : ''}`}>
      <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {icon}
        {label}
      </span>
      <p className="mt-1.5 text-sm leading-6 text-slate-900">
        {value || <span className="italic text-slate-400">-</span>}
      </p>
    </div>
  )
}

function ShortcutButton({ label, targetId }: { label: string; targetId: string }) {
  return (
    <button
      type="button"
      onClick={() =>
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-sky-200 hover:text-sky-600"
    >
      {label}
    </button>
  )
}

export default function ProyectosHistoricoEntryClient({
  project,
  documentos,
}: {
  project: ProyectoHistoricoRow
  documentos: ProyectoHistoricoDocumentoRow[]
}) {
  const anio = project.anio ? String(project.anio) : null
  const fechaCreacion = project.created_at
    ? new Date(project.created_at).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null
  const fechaActualizacion = project.updated_at
    ? new Date(project.updated_at).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null

  const documentosPorFamilia = documentos.reduce<Record<string, ProyectoHistoricoDocumentoRow[]>>(
    (acc, documento) => {
      const key = documento.familia_documental
      acc[key] ??= []
      acc[key].push(documento)
      return acc
    },
    {},
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 pb-8 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/proyectos-historico"
          className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(37,99,235,0.22)] transition-colors hover:bg-sky-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Proyectos Historico
        </Link>

        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
          Ficha de proyecto
        </div>
      </div>

      <section className="rounded-[34px] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_52%,#f8fafc_100%)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
        <span className="inline-block rounded-lg border border-slate-200 bg-white/90 px-3 py-1 font-mono text-xs font-medium text-slate-500">
          {project.numero_proyecto}
        </span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{project.titulo}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          Ficha de consulta del proyecto historico. Toda la informacion mostrada proviene de la base de datos.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            {project.cliente_nombre || 'Sin cliente'}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            {anio || 'Sin anio'}
          </span>
          {project.nombre_carpeta_origen && (
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
              {project.nombre_carpeta_origen}
            </span>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-[0_12px_28px_rgba(148,163,184,0.10)]">
        <div className="flex flex-wrap gap-2">
          <ShortcutButton label="Datos basicos" targetId="datos-basicos" />
          <ShortcutButton label="Origen" targetId="origen" />
          <ShortcutButton label="Descripcion" targetId="descripcion" />
          <ShortcutButton label="Documentacion DOA" targetId="documentacion-doa" />
          <ShortcutButton label="Metadata" targetId="metadata" />
          <ShortcutButton label="Siguiente paso" targetId="siguiente-paso" />
        </div>
      </section>

      <div className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        <div className="space-y-5">
          <section
            id="datos-basicos"
            className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Bloque 01
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Datos del proyecto</h2>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <DataField label="Codigo" icon={<Hash className="h-3.5 w-3.5" />} value={project.numero_proyecto} />
              <DataField label="Cliente" icon={<NotebookTabs className="h-3.5 w-3.5" />} value={project.cliente_nombre} />
              <DataField label="Titulo" icon={<FileText className="h-3.5 w-3.5" />} value={project.titulo} wide />
              <DataField label="Anio" icon={<CalendarDays className="h-3.5 w-3.5" />} value={anio} />
            </div>
          </section>

          <section
            id="origen"
            className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Bloque 02
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Origen</h2>

            <div className="mt-5 grid gap-3">
              <DataField
                label="Carpeta de origen"
                icon={<FolderOpen className="h-3.5 w-3.5" />}
                value={project.nombre_carpeta_origen}
              />
              <DataField
                label="Ruta de origen"
                icon={<FileText className="h-3.5 w-3.5" />}
                value={project.ruta_origen}
              />
            </div>
          </section>

          <section
            id="descripcion"
            className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Bloque 03
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Descripcion</h2>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-900">
                {project.descripcion || <span className="italic text-slate-400">Sin descripcion registrada.</span>}
              </p>
            </div>
          </section>

          <section
            id="documentacion-doa"
            className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Bloque 04
            </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">Documentacion DOA</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Inventario resumido de familias documentales DOA del proyecto. Excluye planos, imagenes y diseno tecnico.
            </p>

            <div className="mt-5 space-y-4">
              {Object.keys(documentosPorFamilia).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-500">
                  No hay documentacion DOA registrada todavia.
                </div>
              ) : (
                Object.entries(documentosPorFamilia).map(([familia, documentosFamilia]) => (
                  <section key={familia} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">{familia}</h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500">
                          {documentosFamilia.length} familia(s)
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500">
                          {documentosFamilia[0]?.total_archivos ?? 0} archivo(s)
                        </span>
                      </div>
                    </div>

                    <ul className="mt-3 space-y-3">
                      {documentosFamilia.map((documento) => (
                        <li key={documento.id} className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-slate-900">{documento.familia_documental}</p>
                            {documento.orden_documental !== null && (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
                                Orden {documento.orden_documental}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 space-y-1 text-xs leading-6 text-slate-500">
                            <p>Carpeta: {documento.carpeta_origen}</p>
                            <p>Ruta: {documento.ruta_origen}</p>
                            {documento.archivo_referencia && <p>Referencia: {documento.archivo_referencia}</p>}
                            {documento.formatos_disponibles.length > 0 && (
                              <p>Formatos: {documento.formatos_disponibles.join(', ')}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section
            id="metadata"
            className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Metadata
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Informacion del registro</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Fecha de creacion
                </span>
                <p className="mt-1.5 text-sm text-slate-900">{fechaCreacion || '-'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Ultima actualizacion
                </span>
                <p className="mt-1.5 text-sm text-slate-900">{fechaActualizacion || '-'}</p>
              </div>
            </div>
          </section>

          <section
            id="siguiente-paso"
            className="rounded-[28px] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_46%,#f8fafc_100%)] p-6 shadow-[0_18px_40px_rgba(14,165,233,0.08)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-500">
              Siguiente paso
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Bloques pendientes</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li className="rounded-2xl border border-sky-100 bg-white/80 px-4 py-3">
                Aeronave, familia y variante.
              </li>
              <li className="rounded-2xl border border-sky-100 bg-white/80 px-4 py-3">
                Tipo de trabajo y clasificacion tecnica.
              </li>
              <li className="rounded-2xl border border-sky-100 bg-white/80 px-4 py-3">
                Notas y trazabilidad adicional.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
