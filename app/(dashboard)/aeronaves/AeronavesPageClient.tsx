/**
 * ============================================================================
 * COMPONENTE VISUAL DEL LISTADO DE AERONAVES
 * ============================================================================
 *
 * Este componente muestra en pantalla la tabla de aeronaves registradas con
 * un buscador en tiempo real. Recibe los datos ya cargados desde el servidor
 * (page.tsx) y se encarga de:
 *
 *   - Mostrar una cabecera con titulo, descripcion y contador de resultados
 *   - Un campo de busqueda que filtra aeronaves mientras el usuario escribe
 *   - Una tabla con columnas: TCDS, Modelo, Fabricante, Pais, Motor, MTOW,
 *     MLW, Regulacion Base, Categoria, MSN Elegibles
 *   - Agrupacion visual por codigo TCDS (filas con mismo tcds_code_short juntas)
 *   - TCDS como badge azul cielo, Regulacion Base resaltada en amber
 *
 * NOTA TECNICA: 'use client' indica que este componente se ejecuta en el
 * navegador del usuario, no en el servidor. Esto es necesario porque usa
 * funciones interactivas como el buscador (useState, useMemo).
 * ============================================================================
 */

'use client'

// useMemo: recalcula datos solo cuando cambian las dependencias (optimizacion)
// useState: permite que el componente "recuerde" datos, como el texto de busqueda
import { useMemo, useState } from 'react'
// Iconos decorativos para la interfaz
import { Search } from 'lucide-react'

// Barra superior de la pagina con titulo y subtitulo
import { TopBar } from '@/components/layout/TopBar'
import type { AeronaveRow } from '@/types/database'

/**
 * Componente principal de la pagina de listado de aeronaves.
 * Recibe la lista completa de aeronaves desde el servidor.
 */
export default function AeronavesPageClient({
  aeronaves,
}: {
  aeronaves: AeronaveRow[]
}) {
  // Estado para guardar lo que el usuario escribe en el campo de busqueda
  const [search, setSearch] = useState('')

  /**
   * Lista filtrada de aeronaves.
   * Se recalcula automaticamente cada vez que cambia el texto de busqueda
   * o la lista original de aeronaves.
   * Busca coincidencias en: TCDS, modelo, fabricante, pais, motor,
   * regulacion, categoria y MSN elegibles.
   */
  const filtered = useMemo(() => {
    return aeronaves.filter((a) => {
      // Si no hay texto de busqueda, mostrar todas las aeronaves
      if (search === '') return true

      const q = search.toLowerCase()

      // Devolver true si alguno de los campos contiene el texto buscado
      return (
        (a.tcds_code ?? '').toLowerCase().includes(q) ||
        (a.tcds_code_short ?? '').toLowerCase().includes(q) ||
        (a.modelo ?? '').toLowerCase().includes(q) ||
        (a.fabricante ?? '').toLowerCase().includes(q) ||
        (a.pais ?? '').toLowerCase().includes(q) ||
        (a.motor ?? '').toLowerCase().includes(q) ||
        (a.regulacion_base ?? '').toLowerCase().includes(q) ||
        (a.categoria ?? '').toLowerCase().includes(q) ||
        (a.msn_elegibles ?? '').toLowerCase().includes(q)
      )
    })
  }, [aeronaves, search])

  /**
   * Determina si una fila es la primera de su grupo TCDS.
   * Se usa para separar visualmente los grupos de aeronaves con el mismo TCDS.
   */
  const isFirstInGroup = (index: number): boolean => {
    if (index === 0) return true
    return filtered[index].tcds_code_short !== filtered[index - 1].tcds_code_short
  }

  return (
    /* Contenedor principal de la pagina con fondo degradado azul claro */
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      {/* Barra superior con titulo y subtitulo de la pagina */}
      <TopBar title="Aeronaves" subtitle="Base de datos de aeronaves registradas" />

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5 text-[color:var(--ink)]">
        {/* === SECCION CABECERA: titulo, descripcion, contador y buscador === */}
        <section className="rounded-[34px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Titulo y texto explicativo */}
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                Aeronaves
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--ink-3)]">
                Catalogo completo de aeronaves registradas en la base de datos DOA,
                agrupadas por codigo TCDS. Ingesta nuevos TCDS desde Herramientas.
              </p>
            </div>

            {/* Contador: muestra cuantas aeronaves hay visibles (segun la busqueda) */}
            <div className="rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
                Aeronaves
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{filtered.length}</p>
            </div>
          </div>

          {/* Barra de busqueda y etiqueta de informacion */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="relative max-w-lg flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-3)]"
              />
              <input
                type="text"
                placeholder="Buscar por TCDS, modelo, fabricante, motor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] py-2 pl-9 pr-3 text-sm text-slate-950 shadow-sm transition-colors placeholder:text-[color:var(--ink-3)] focus:border-[color:var(--ink-4)] focus:outline-none"
              />
            </div>

            <div className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
              {filtered.length} aeronaves registradas
            </div>
          </div>
        </section>

        {/* === TABLA DE AERONAVES: muestra cada aeronave en una fila === */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
          <div className="overflow-x-auto">
            <table className="min-w-[1400px] w-full text-sm">
              {/* Cabecera de la tabla con los nombres de las columnas */}
              <thead>
                <tr className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)]">
                  {/* Columnas de la tabla en el orden especificado */}
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                    TCDS
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                    Modelo
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                    Fabricante
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                    Pais
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                    Motor
                  </th>
                  {/* Columnas numericas alineadas a la derecha */}
                  <th className="whitespace-nowrap px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                    MTOW (kg)
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                    MLW (kg)
                  </th>
                  {/* Regulacion Base destacada en amber */}
                  <th className="whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 rounded-t-lg">
                    Regulacion Base
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                    Categoria
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                    MSN Elegibles
                  </th>
                </tr>
              </thead>

              {/* Cuerpo de la tabla: una fila por cada aeronave filtrada */}
              <tbody>
                {filtered.map((aeronave, index) => (
                  <tr
                    key={aeronave.id}
                    className={`border-b border-[color:var(--ink-4)]/60 transition-colors hover:bg-[color:var(--paper-3)]/40 ${
                      isFirstInGroup(index) && index !== 0
                        ? 'border-t-2 border-t-sky-100'
                        : ''
                    }`}
                  >
                    {/* Columna TCDS: badge azul cielo con codigo */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-3)] px-2.5 py-0.5 text-xs font-bold text-[color:var(--ink-2)]">
                          {aeronave.tcds_code_short}
                        </span>
                      </div>
                    </td>

                    {/* Columna Modelo */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-950">
                        {aeronave.modelo ?? '--'}
                      </p>
                    </td>

                    {/* Columna Fabricante */}
                    <td className="px-4 py-3 text-[color:var(--ink-3)]">
                      {aeronave.fabricante ?? '--'}
                    </td>

                    {/* Columna Pais */}
                    <td className="px-4 py-3 text-[color:var(--ink-3)]">
                      {aeronave.pais ?? '--'}
                    </td>

                    {/* Columna Motor */}
                    <td className="px-4 py-3 text-[color:var(--ink-3)]">
                      {aeronave.motor ?? '--'}
                    </td>

                    {/* Columna MTOW alineada a la derecha */}
                    <td className="px-4 py-3 text-right font-mono text-[color:var(--ink-3)]">
                      {aeronave.mtow_kg != null
                        ? aeronave.mtow_kg.toLocaleString('es-ES')
                        : '--'}
                    </td>

                    {/* Columna MLW alineada a la derecha */}
                    <td className="px-4 py-3 text-right font-mono text-[color:var(--ink-3)]">
                      {aeronave.mlw_kg != null
                        ? aeronave.mlw_kg.toLocaleString('es-ES')
                        : '--'}
                    </td>

                    {/* Columna Regulacion Base destacada en amber */}
                    <td className="px-3 py-2.5 bg-amber-50">
                      <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        {aeronave.regulacion_base || '--'}
                      </span>
                    </td>

                    {/* Columna Categoria */}
                    <td className="px-4 py-3 text-[color:var(--ink-3)]">
                      {aeronave.categoria ?? '--'}
                    </td>

                    {/* Columna MSN Elegibles: truncada con tooltip en hover */}
                    <td className="px-4 py-3">
                      <span
                        title={aeronave.msn_elegibles ?? ''}
                        className="inline-block max-w-[200px] truncate text-sm text-[color:var(--ink-3)]"
                      >
                        {aeronave.msn_elegibles ?? '--'}
                      </span>
                    </td>
                  </tr>
                ))}

                {/* Mensaje cuando no hay resultados (tabla vacia o busqueda sin coincidencias) */}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-sm text-[color:var(--ink-3)]">
                      {search
                        ? `No se encontraron aeronaves para "${search}"`
                        : 'No hay aeronaves registradas. Ingesta un TCDS desde Herramientas para empezar.'}
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
