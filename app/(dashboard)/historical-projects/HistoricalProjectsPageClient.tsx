/**
 * ============================================================================
 * COMPONENTE VISUAL DEL LISTADO DE PROYECTOS HISTORICOS
 * ============================================================================
 *
 * Este componente muestra en pantalla la table de projects historicos con
 * un buscador en tiempo real. Recibe los data ya cargados desde el servidor
 * (page.tsx) y se encarga de:
 *
 *   - Mostrar una cabecera con title, description y contador de resultados
 *   - Un campo de search que filtra projects mientras el user_label escribe
 *   - Una table con columnas: Codigo, Titulo, Client, Accion
 *   - Un boton "+" en cada fila que abre la ficha detallada del project
 *
 * NOTA TECNICA: 'use client' indica que este componente se ejecuta en el
 * navegador del user_label, no en el servidor. Esto es necesario porque usa
 * funciones interactivas como el buscador (useState, useMemo).
 * ============================================================================
 */

'use client'

// Link: permite navegar a otras paginas sin recargar toda la website
import Link from 'next/link'
// useCallback: memoriza funciones para evitar re-creaciones innecesarias
// useMemo: recalcula data solo cuando cambian las dependencias (optimizacion)
// useState: permite que el componente "recuerde" data, como el text de search
import { useCallback, useMemo, useState } from 'react'
// Iconos decorativos para la interfaz
import { Plus, Search, Trash2 } from 'lucide-react'

// Accion de servidor para eliminar un project historical de la base de data
import { deleteProyectoHistorico } from './actions'

// Barra superior de la page con title y subtitulo
import { TopBar } from '@/components/layout/TopBar'
import type { HistoricalProjectRow } from '@/types/database'

/**
 * Genera una etiqueta corta (badge) a partir del codigo del project.
 * Ejemplo: "PRJ-2024-001" -> "PRJ" (toma las 3 primeras letras/numeros)
 * Se usa para el circulito que aparece junto al codigo en la table.
 */
function getBadgeLabel(code: string) {
  return code.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase()
}

/**
 * Componente primary de la page de listado de projects historicos.
 * Recibe la lista completa de projects desde el servidor.
 */
export default function HistoricalProjectsPageClient({
  projects,
}: {
  projects: HistoricalProjectRow[]
}) {
  // Status para guardar lo que el user_label escribe en el campo de search
  const [search, setSearch] = useState('')

  // Status local de projects para poder eliminar filas sin recargar la page
  const [localProjects, setLocalProjects] = useState(projects)

  // Status para rastrear que project se esta eliminando (muestra feedback visual)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  /**
   * Elimina un project historical de la base de data tras confirmar con el user_label.
   * Muestra un dialogo de confirmacion y, si acepta, llama a la server action.
   * Al completarse, elimina la fila de la UI sin recargar la page.
   */
  const handleDelete = useCallback(async (id: string, numeroProyecto: string) => {
    // Dialogo de confirmacion antes de eliminar
    const confirmed = window.confirm(
      `¿Eliminar project ${numeroProyecto}? Se borrarán todos los registros asociados (documents y archivos). Esta acción no se puede deshacer.`
    )
    if (!confirmed) return

    setDeletingId(id)
    try {
      await deleteProyectoHistorico(id)
      // Eliminar la fila del status local para actualizar la UI sin recarga
      setLocalProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (error) {
      console.error('Error eliminando project historical:', error)
      alert('Error al eliminar el project. Intenta de new.')
    } finally {
      setDeletingId(null)
    }
  }, [])

  /**
   * Lista filtrada de projects.
   * Se recalcula automaticamente cada vez que cambia el text de search
   * o la lista original de projects.
   * Busca coincidencias en: codigo, title, client, aircraft, msn, year y description.
   */
  const filtered = useMemo(() => {
    return localProjects.filter((project) => {
      // Si no hay text de search, mostrar todos los projects
      if (search === '') return true

      const q = search.toLowerCase()

      // Devolver true si alguno de los campos del project contiene el text buscado
      return (
        project.project_number.toLowerCase().includes(q) ||
        project.title.toLowerCase().includes(q) ||
        (project.client_name ?? '').toLowerCase().includes(q) ||
        (project.aircraft ?? '').toLowerCase().includes(q) ||
        (project.msn ?? '').toLowerCase().includes(q) ||
        (project.source_folder_name ?? '').toLowerCase().includes(q) ||
        (project.source_path ?? '').toLowerCase().includes(q) ||
        String(project.year ?? '').includes(q) ||
        (project.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [localProjects, search])

  return (
    /* Contenedor primary de la page con fondo degradado azul claro */
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      {/* Barra superior con title y subtitulo de la page */}
      <TopBar title="Projects Historical" subtitle="Base historica de projects" />

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5 text-[color:var(--ink)]">
        {/* === SECCION CABECERA: title, description, contador y buscador === */}
        <section className="rounded-[34px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Titulo y text explicativo */}
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                Projects Historical
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--ink-3)]">
                Listado historical base. Pulsa `+` en cada fila para abrir la ficha de entrada y
                empezar a completar la informacion del project.
              </p>
            </div>

            {/* Contador: muestra cuantos projects hay visibles (segun la search) */}
            <div className="rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
                Projects
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{filtered.length}</p>
            </div>
          </div>

          {/* Barra de search y etiqueta de ayuda */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="relative max-w-lg flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-3)]"
              />
              <input
                type="text"
                placeholder="Buscar por codigo, title o client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] py-2 pl-9 pr-3 text-sm text-slate-950 shadow-sm transition-colors placeholder:text-[color:var(--ink-3)] focus:border-[color:var(--ink-4)] focus:outline-none"
              />
            </div>

            <div className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
              Usa el `+` para abrir la ficha
            </div>
          </div>
        </section>

        {/* === TABLA DE PROYECTOS: muestra cada project en una fila === */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
          <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            {/* Cabecera de la table con los nombres de las columnas */}
            <thead>
              <tr className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)]">
                {['Codigo', 'Titulo', 'Client', 'Accion'].map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            {/* Cuerpo de la table: una fila por cada project filtrado */}
            <tbody>
              {filtered.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-[color:var(--ink-4)]/60 transition-colors hover:bg-[color:var(--paper-3)]/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-3)] text-xs font-bold text-[color:var(--ink-2)]">
                        {getBadgeLabel(project.project_number)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-950">{project.project_number}</p>
                        <p className="font-mono text-xs text-[color:var(--ink-3)]">
                          {project.year ?? '2021'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[color:var(--ink-3)]">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-950">{project.title}</p>
                      {(project.aircraft || project.msn) ? (
                        <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                          {project.aircraft ? (
                            <span
                              title={project.aircraft}
                              className="inline-block max-w-[180px] truncate rounded-full bg-[color:var(--paper-2)] px-2 py-0.5 text-[color:var(--ink-2)]"
                            >
                              {project.aircraft}
                            </span>
                          ) : null}
                          {project.msn ? (
                            <span
                              title={project.msn}
                              className="inline-block max-w-[260px] truncate rounded-full bg-[color:var(--paper-2)] px-2 py-0.5 text-[color:var(--ink-3)]"
                            >
                              MSN {project.msn}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[color:var(--ink-3)]">{project.client_name ?? '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {/* Boton para abrir la ficha detallada del project */}
                      <Link
                        href={`/historical-projects/${project.id}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)]"
                        title="Open record"
                        aria-label={`Open record de ${project.project_number}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Link>
                      {/* Boton para eliminar el project de la base de data */}
                      <button
                        type="button"
                        title="Eliminar project"
                        aria-label={`Eliminar project ${project.project_number}`}
                        disabled={deletingId === project.id}
                        onClick={() => handleDelete(project.id, project.project_number)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Mensaje cuando no hay resultados (table vacia o search sin coincidencias) */}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-[color:var(--ink-3)]">
                    {search
                      ? `No se encontraron projects historicos para "${search}"`
                      : 'No hay projects historicos registrados.'}
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
