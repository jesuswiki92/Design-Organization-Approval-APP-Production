/**
 * ============================================================================
 * COMPONENTE VISUAL DEL LISTADO DE PROYECTOS HISTORICOS
 * ============================================================================
 *
 * Este componente muestra en pantalla la tabla de proyectos historicos con
 * un buscador en tiempo real. Recibe los datos ya cargados desde el servidor
 * (page.tsx) y se encarga de:
 *
 *   - Mostrar una cabecera con titulo, descripcion y contador de resultados
 *   - Un campo de busqueda que filtra proyectos mientras el usuario escribe
 *   - Una tabla con columnas: Codigo, Titulo, Cliente, Origen, Accion
 *   - Un boton "+" en cada fila que abre la ficha detallada del proyecto
 *
 * NOTA TECNICA: 'use client' indica que este componente se ejecuta en el
 * navegador del usuario, no en el servidor. Esto es necesario porque usa
 * funciones interactivas como el buscador (useState, useMemo).
 * ============================================================================
 */

'use client'

// Link: permite navegar a otras paginas sin recargar toda la web
import Link from 'next/link'
// useCallback: memoriza funciones para evitar re-creaciones innecesarias
// useMemo: recalcula datos solo cuando cambian las dependencias (optimizacion)
// useState: permite que el componente "recuerde" datos, como el texto de busqueda
import { useCallback, useMemo, useState } from 'react'
// Iconos decorativos para la interfaz
import { Check, FolderOpen, Plus, Search, Trash2 } from 'lucide-react'

// Accion de servidor para eliminar un proyecto historico de la base de datos
import { deleteProyectoHistorico } from './actions'

// Barra superior de la pagina con titulo y subtitulo
import { TopBar } from '@/components/layout/TopBar'

/**
 * Estructura de datos de un proyecto historico.
 * Replica exacta de la estructura del servidor para que los datos
 * se transfieran correctamente.
 */
interface ProyectoHistoricoRow {
  id: string                          // Identificador unico
  numero_proyecto: string             // Codigo del proyecto
  titulo: string                      // Nombre del proyecto
  descripcion: string | null          // Descripcion (puede estar vacia)
  cliente_nombre: string | null       // Nombre del cliente
  anio: number | null                 // Anio del proyecto
  aeronave: string | null             // Aeronave asociada al proyecto
  msn: string | null                  // MSN asociado al proyecto
  ruta_origen: string | null          // Ruta completa de la carpeta original
  nombre_carpeta_origen: string | null // Nombre corto de la carpeta
  created_at: string                  // Fecha de creacion
  updated_at: string                  // Fecha de ultima actualizacion
}

/**
 * Genera una etiqueta corta (badge) a partir del codigo del proyecto.
 * Ejemplo: "PRJ-2024-001" -> "PRJ" (toma las 3 primeras letras/numeros)
 * Se usa para el circulito que aparece junto al codigo en la tabla.
 */
function getBadgeLabel(code: string) {
  return code.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase()
}

/**
 * Componente principal de la pagina de listado de proyectos historicos.
 * Recibe la lista completa de proyectos desde el servidor.
 */
export default function ProyectosHistoricoPageClient({
  projects,
}: {
  projects: ProyectoHistoricoRow[]
}) {
  // Estado para guardar lo que el usuario escribe en el campo de busqueda
  const [search, setSearch] = useState('')

  // Estado para rastrear que fila acaba de copiar su ruta al portapapeles
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Estado local de proyectos para poder eliminar filas sin recargar la pagina
  const [localProjects, setLocalProjects] = useState(projects)

  // Estado para rastrear que proyecto se esta eliminando (muestra feedback visual)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  /**
   * Copia la ruta de origen al portapapeles y muestra feedback visual
   * cambiando el icono de carpeta a un checkmark durante 1.5 segundos.
   */
  const handleCopyRuta = (id: string, ruta: string) => {
    navigator.clipboard.writeText(ruta)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  /**
   * Elimina un proyecto historico de la base de datos tras confirmar con el usuario.
   * Muestra un dialogo de confirmacion y, si acepta, llama a la server action.
   * Al completarse, elimina la fila de la UI sin recargar la pagina.
   */
  const handleDelete = useCallback(async (id: string, numeroProyecto: string) => {
    // Dialogo de confirmacion antes de eliminar
    const confirmed = window.confirm(
      `¿Eliminar proyecto ${numeroProyecto}? Se borrarán todos los registros asociados (documentos y archivos). Esta acción no se puede deshacer.`
    )
    if (!confirmed) return

    setDeletingId(id)
    try {
      await deleteProyectoHistorico(id)
      // Eliminar la fila del estado local para actualizar la UI sin recarga
      setLocalProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (error) {
      console.error('Error eliminando proyecto historico:', error)
      alert('Error al eliminar el proyecto. Intenta de nuevo.')
    } finally {
      setDeletingId(null)
    }
  }, [])

  /**
   * Lista filtrada de proyectos.
   * Se recalcula automaticamente cada vez que cambia el texto de busqueda
   * o la lista original de proyectos.
   * Busca coincidencias en: codigo, titulo, cliente, carpeta, ruta, anio y descripcion.
   */
  const filtered = useMemo(() => {
    return localProjects.filter((project) => {
      // Si no hay texto de busqueda, mostrar todos los proyectos
      if (search === '') return true

      const q = search.toLowerCase()

      // Devolver true si alguno de los campos del proyecto contiene el texto buscado
      return (
        project.numero_proyecto.toLowerCase().includes(q) ||
        project.titulo.toLowerCase().includes(q) ||
        (project.cliente_nombre ?? '').toLowerCase().includes(q) ||
        (project.aeronave ?? '').toLowerCase().includes(q) ||
        (project.msn ?? '').toLowerCase().includes(q) ||
        (project.nombre_carpeta_origen ?? '').toLowerCase().includes(q) ||
        (project.ruta_origen ?? '').toLowerCase().includes(q) ||
        String(project.anio ?? '').includes(q) ||
        (project.descripcion ?? '').toLowerCase().includes(q)
      )
    })
  }, [localProjects, search])

  return (
    /* Contenedor principal de la pagina con fondo degradado azul claro */
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      {/* Barra superior con titulo y subtitulo de la pagina */}
      <TopBar title="Proyectos Historico" subtitle="Base historica de proyectos" />

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5 text-slate-900">
        {/* === SECCION CABECERA: titulo, descripcion, contador y buscador === */}
        <section className="rounded-[34px] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_52%,#f8fafc_100%)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Titulo y texto explicativo */}
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                Proyectos Historico
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
                Listado historico base. Pulsa `+` en cada fila para abrir la ficha de entrada y
                empezar a completar la informacion del proyecto.
              </p>
            </div>

            {/* Contador: muestra cuantos proyectos hay visibles (segun la busqueda) */}
            <div className="rounded-[22px] border border-sky-200 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Proyectos
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{filtered.length}</p>
            </div>
          </div>

          {/* Barra de busqueda y etiqueta de ayuda */}
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

        {/* === TABLA DE PROYECTOS: muestra cada proyecto en una fila === */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
          <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            {/* Cabecera de la tabla con los nombres de las columnas */}
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
            {/* Cuerpo de la tabla: una fila por cada proyecto filtrado */}
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
                    <div className="space-y-1">
                      <p className="font-medium text-slate-950">{project.titulo}</p>
                      {(project.aeronave || project.msn) ? (
                        <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                          {project.aeronave ? (
                            <span
                              title={project.aeronave}
                              className="inline-block max-w-[180px] truncate rounded-full bg-sky-50 px-2 py-0.5 text-sky-700"
                            >
                              {project.aeronave}
                            </span>
                          ) : null}
                          {project.msn ? (
                            <span
                              title={project.msn}
                              className="inline-block max-w-[260px] truncate rounded-full bg-slate-100 px-2 py-0.5 text-slate-600"
                            >
                              MSN {project.msn}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{project.cliente_nombre ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex items-center gap-2">
                      {/* Boton para copiar la ruta de origen al portapapeles */}
                      <button
                        type="button"
                        title="Copiar ruta"
                        disabled={!project.ruta_origen}
                        onClick={() => project.ruta_origen && handleCopyRuta(project.id, project.ruta_origen)}
                        className={`shrink-0 cursor-pointer rounded-lg p-1.5 transition-colors disabled:cursor-default disabled:opacity-40 ${
                          copiedId === project.id
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-sky-100 text-sky-600 hover:bg-sky-200'
                        }`}
                      >
                        {copiedId === project.id ? (
                          <Check size={14} />
                        ) : (
                          <FolderOpen size={14} />
                        )}
                      </button>
                      {/* Nombre corto de la carpeta de origen (sin mostrar la ruta completa) */}
                      <span className="text-sm text-slate-700">
                        {project.nombre_carpeta_origen ?? '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {/* Boton para abrir la ficha detallada del proyecto */}
                      <Link
                        href={`/proyectos-historico/${project.id}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition-colors hover:bg-sky-100"
                        title="Abrir ficha"
                        aria-label={`Abrir ficha de ${project.numero_proyecto}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Link>
                      {/* Boton para eliminar el proyecto de la base de datos */}
                      <button
                        type="button"
                        title="Eliminar proyecto"
                        aria-label={`Eliminar proyecto ${project.numero_proyecto}`}
                        disabled={deletingId === project.id}
                        onClick={() => handleDelete(project.id, project.numero_proyecto)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Mensaje cuando no hay resultados (tabla vacia o busqueda sin coincidencias) */}
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
    </div>
  )
}
