/**
 * ============================================================================
 * COMPONENTE VISUAL DEL LISTADO DE AERONAVES
 * ============================================================================
 *
 * Este componente muestra en pantalla la table de aircraft registradas con
 * un buscador en tiempo real. Recibe los data ya cargados desde el servidor
 * (page.tsx) y se encarga de:
 *
 *   - Mostrar una cabecera con title, description y contador de resultados
 *   - Un campo de search que filtra aircraft mientras el user_label escribe
 *   - Una table con columnas: TCDS, Model, Manufacturer, Country, Motor, MTOW,
 *     MLW, Regulacion Base, Categoria, MSN Elegibles
 *   - Agrupacion visual por codigo TCDS (filas con mismo tcds_code_short juntas)
 *   - TCDS como badge azul cielo, Regulacion Base resaltada en amber
 *
 * NOTA TECNICA: 'use client' indica que este componente se ejecuta en el
 * navegador del user_label, no en el servidor. Esto es necesario porque usa
 * funciones interactivas como el buscador (useState, useMemo).
 * ============================================================================
 */

'use client'

// useMemo: recalcula data solo cuando cambian las dependencias (optimizacion)
// useState: permite que el componente "recuerde" data, como el text de search
import { useMemo, useState } from 'react'
// Iconos decorativos para la interfaz
import { Search } from 'lucide-react'

// Barra superior de la page con title y subtitulo
import { TopBar } from '@/components/layout/TopBar'
import type { AircraftRow } from '@/types/database'

/**
 * Componente primary de la page de listado de aircraft.
 * Recibe la lista completa de aircraft desde el servidor.
 */
export default function AircraftPageClient({
  aircraft,
}: {
  aircraft: AircraftRow[]
}) {
  // Status para guardar lo que el user_label escribe en el campo de search
  const [search, setSearch] = useState('')

  /**
   * Lista filtrada de aircraft.
   * Se recalcula automaticamente cada vez que cambia el text de search
   * o la lista original de aircraft.
   * Busca coincidencias en: TCDS, model, manufacturer, country, engine,
   * regulacion, category y MSN elegibles.
   */
  const filtered = useMemo(() => {
    return aircraft.filter((a) => {
      // Si no hay text de search, mostrar todas las aircraft
      if (search === '') return true

      const q = search.toLowerCase()

      // Devolver true si alguno de los campos contiene el text buscado
      return (
        (a.tcds_code ?? '').toLowerCase().includes(q) ||
        (a.tcds_code_short ?? '').toLowerCase().includes(q) ||
        (a.model ?? '').toLowerCase().includes(q) ||
        (a.manufacturer ?? '').toLowerCase().includes(q) ||
        (a.country ?? '').toLowerCase().includes(q) ||
        (a.engine ?? '').toLowerCase().includes(q) ||
        (a.base_regulation ?? '').toLowerCase().includes(q) ||
        (a.category ?? '').toLowerCase().includes(q) ||
        (a.eligible_msns ?? '').toLowerCase().includes(q)
      )
    })
  }, [aircraft, search])

  /**
   * Determina si una fila es la primera de su grupo TCDS.
   * Se usa para separar visualmente los grupos de aircraft con el mismo TCDS.
   */
  const isFirstInGroup = (index: number): boolean => {
    if (index === 0) return true
    return filtered[index].tcds_code_short !== filtered[index - 1].tcds_code_short
  }

  return (
    /* Contenedor primary de la page con fondo degradado azul claro */
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      {/* Barra superior con title y subtitulo de la page */}
      <TopBar title="Aircraft" subtitle="Base de data de aircraft registradas" />

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5 text-[color:var(--ink)]">
        {/* === SECCION CABECERA: title, description, contador y buscador === */}
        <section className="rounded-[34px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Titulo y text explicativo */}
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                Aircraft
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-[color:var(--ink-3)]">
                Catalogo completo de aircraft registradas en la base de data DOA,
                agrupadas por codigo TCDS. Ingesta nuevos TCDS desde Tools.
              </p>
            </div>

            {/* Contador: muestra cuantas aircraft hay visibles (segun la search) */}
            <div className="rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
                Aircraft
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{filtered.length}</p>
            </div>
          </div>

          {/* Barra de search y etiqueta de informacion */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="relative max-w-lg flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-3)]"
              />
              <input
                type="text"
                placeholder="Buscar por TCDS, model, manufacturer, engine..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] py-2 pl-9 pr-3 text-sm text-slate-950 shadow-sm transition-colors placeholder:text-[color:var(--ink-3)] focus:border-[color:var(--ink-4)] focus:outline-none"
              />
            </div>

            <div className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
              {filtered.length} aircraft registradas
            </div>
          </div>
        </section>

        {/* === TABLA DE AERONAVES: muestra cada aircraft en una fila === */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-[22px] border border-[color:var(--ink-4)]/70 bg-[color:var(--paper-2)] shadow-[0_14px_32px_rgba(74,60,36,0.08)] ring-1 ring-inset ring-[color:var(--ink-4)]/25">
          <div className="overflow-x-auto">
            <table className="min-w-[1400px] w-full text-sm">
              {/* Cabecera de la table con los nombres de las columnas */}
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[color:var(--ink-4)]/80 bg-[color:var(--paper-2)]/96 shadow-[inset_0_-1px_0_rgba(74,60,36,0.08)] backdrop-blur-sm">
                  {/* Columnas de la table en el sort_order especificado */}
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">
                    TCDS
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">
                    Model
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">
                    Manufacturer
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">
                    Country
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">
                    Motor
                  </th>
                  {/* Columnas numericas alineadas a la derecha */}
                  <th className="whitespace-nowrap px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">
                    MTOW (kg)
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">
                    MLW (kg)
                  </th>
                  {/* Regulacion Base destacada en amber */}
                  <th className="whitespace-nowrap rounded-t-lg bg-amber-100/90 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-amber-900">
                    Regulacion Base
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">
                    Categoria
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">
                    MSN Elegibles
                  </th>
                </tr>
              </thead>

              {/* Cuerpo de la table: una fila por cada aircraft filtrada */}
              <tbody className="divide-y divide-[color:var(--ink-4)]/55">
                {filtered.map((aircraft, index) => (
                  <tr
                    key={aircraft.id}
                    className={`transition-colors odd:bg-[color:var(--paper-2)] even:bg-[color:var(--paper)]/80 hover:bg-[color:var(--paper-3)]/45 ${
                      isFirstInGroup(index) && index !== 0
                        ? 'border-t-2 border-t-[color:var(--umber)]/18'
                        : ''
                    }`}
                  >
                    {/* Columna TCDS: badge azul cielo con codigo */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-[color:var(--ink-4)]/70 bg-white px-2.5 py-0.5 text-xs font-bold text-[color:var(--ink)] shadow-[0_1px_0_rgba(255,255,255,0.75)_inset]">
                          {aircraft.tcds_code_short}
                        </span>
                      </div>
                    </td>

                    {/* Columna Model */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-[color:var(--ink)]">
                        {aircraft.model ?? '--'}
                      </p>
                    </td>

                    {/* Columna Manufacturer */}
                    <td className="px-4 py-3 text-[color:var(--ink-2)]">
                      {aircraft.manufacturer ?? '--'}
                    </td>

                    {/* Columna Country */}
                    <td className="px-4 py-3 text-[color:var(--ink-2)]">
                      {aircraft.country ?? '--'}
                    </td>

                    {/* Columna Motor */}
                    <td className="px-4 py-3 text-[color:var(--ink-2)]">
                      {aircraft.engine ?? '--'}
                    </td>

                    {/* Columna MTOW alineada a la derecha */}
                    <td className="px-4 py-3 text-right font-mono text-[color:var(--ink-2)]">
                      {aircraft.mtow_kg != null
                        ? aircraft.mtow_kg.toLocaleString('es-ES')
                        : '--'}
                    </td>

                    {/* Columna MLW alineada a la derecha */}
                    <td className="px-4 py-3 text-right font-mono text-[color:var(--ink-2)]">
                      {aircraft.mlw_kg != null
                        ? aircraft.mlw_kg.toLocaleString('es-ES')
                        : '--'}
                    </td>

                    {/* Columna Regulacion Base destacada en amber */}
                    <td className="bg-amber-50/80 px-3 py-2.5">
                      <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 shadow-[0_1px_0_rgba(255,255,255,0.55)_inset]">
                        {aircraft.base_regulation || '--'}
                      </span>
                    </td>

                    {/* Columna Categoria */}
                    <td className="px-4 py-3 text-[color:var(--ink-2)]">
                      {aircraft.category ?? '--'}
                    </td>

                    {/* Columna MSN Elegibles: truncada con tooltip en hover */}
                    <td className="px-4 py-3">
                      <span
                        title={aircraft.eligible_msns ?? ''}
                        className="inline-block max-w-[200px] truncate text-sm text-[color:var(--ink-2)]"
                      >
                        {aircraft.eligible_msns ?? '--'}
                      </span>
                    </td>
                  </tr>
                ))}

                {/* Mensaje cuando no hay resultados (table vacia o search sin coincidencias) */}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-sm text-[color:var(--ink-2)]">
                      {search
                        ? `No se encontraron aircraft para "${search}"`
                        : 'No hay aircraft registradas. Ingesta un TCDS desde Tools para empezar.'}
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
