'use client'

/**
 * ============================================================================
 * BANNER DE ESTADO DE TCDS — Vista enriquecida con datos tecnicos de aeronave
 * ============================================================================
 *
 * Componente cliente que muestra el estado de verificacion de un TCDS
 * contra la base de datos interna de aeronaves (doa_aeronaves).
 *
 * Tres modos de visualizacion cuando hay variantes:
 * - VARIANTE EXACTA: Si aircraftModel coincide con un modelo, muestra solo
 *   esa variante en formato tarjeta limpia, con tabla colapsable del resto.
 * - SIN COINCIDENCIA: Si aircraftModel no coincide con ninguna, muestra
 *   todas las variantes con un aviso.
 * - SIN MODELO: Si no se proporciona aircraftModel, muestra todas como antes.
 *
 * Estado cuando no hay variantes:
 * - NO ENCONTRADO (ambar): Banner de advertencia con el codigo buscado y un
 *   boton placeholder para futura funcionalidad de ingesta de TCDS.
 *
 * Este componente es necesario como componente cliente porque contiene
 * interactividad (collapsible, boton con onClick).
 * ============================================================================
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, ChevronDown, Plane } from 'lucide-react'

/** Tipo para cada variante de aeronave encontrada en doa_aeronaves */
interface AeronaveVariant {
  tcds_code: string
  tcds_code_short: string
  tcds_issue: string
  tcds_date: string
  fabricante: string
  pais: string
  tipo: string
  modelo: string
  motor: string
  mtow_kg: number | null
  mlw_kg: number | null
  regulacion_base: string
  categoria: string
  msn_elegibles: string
  notas: string
}

interface TcdsStatusBannerProps {
  /** Si se encontraron variantes en doa_aeronaves */
  found: boolean
  /** El numero de TCDS que se busco */
  tcdsNumber: string | null
  /** URL del PDF del TCDS (contexto adicional si no se encontro) */
  tcdsPdfUrl?: string | null
  /** Todas las variantes encontradas bajo el mismo TCDS */
  variants: AeronaveVariant[]
  /** Si se uso la busqueda de fallback (por modelo/fabricante en vez de TCDS) */
  fallbackUsed?: boolean
  /** Modelo de aeronave de la consulta para filtrar variantes (ej: "PC-12/45") */
  aircraftModel?: string | null
}

/**
 * Tabla reutilizable que muestra todas las variantes en formato tabla
 */
function VariantsTable({ variants }: { variants: AeronaveVariant[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-[color:var(--ink-4)] text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
            <th className="pb-1.5 pr-3">Modelo</th>
            <th className="pb-1.5 pr-3">Motor</th>
            <th className="pb-1.5 pr-3 text-right">MTOW (kg)</th>
            <th className="pb-1.5 pr-3 text-right">MLW (kg)</th>
            <th className="pb-1.5 pr-3">Regulacion Base</th>
            <th className="pb-1.5 pr-3">Categoria</th>
            <th className="pb-1.5">MSN Elegibles</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--ink-4)]">
          {variants.map((v, idx) => (
            <tr key={`${v.modelo}-${idx}`} className="hover:bg-[color:var(--paper-3)]">
              <td className="py-1.5 pr-3 font-medium text-[color:var(--ink)]">
                {v.modelo || '—'}
              </td>
              <td className="py-1.5 pr-3 text-[color:var(--ink-2)]">
                {v.motor || '—'}
              </td>
              <td className="py-1.5 pr-3 text-right font-mono text-[color:var(--ink-2)]">
                {v.mtow_kg != null ? v.mtow_kg.toLocaleString() : '—'}
              </td>
              <td className="py-1.5 pr-3 text-right font-mono text-[color:var(--ink-2)]">
                {v.mlw_kg != null ? v.mlw_kg.toLocaleString() : '—'}
              </td>
              <td className="py-1.5 pr-3">
                {v.regulacion_base ? (
                  <span className="inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                    {v.regulacion_base}
                  </span>
                ) : (
                  <span className="text-[color:var(--ink-3)]">—</span>
                )}
              </td>
              <td className="py-1.5 pr-3 text-[color:var(--ink-2)]">
                {v.categoria || '—'}
              </td>
              <td className="max-w-[140px] truncate py-1.5 text-[color:var(--ink-3)]" title={v.msn_elegibles || ''}>
                {v.msn_elegibles || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Tarjeta limpia que muestra los datos de una variante identificada
 */
function MatchedVariantCard({ variant }: { variant: AeronaveVariant }) {
  return (
    <div className="space-y-2 rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-2.5 shadow-[0_4px_10px_rgba(74,60,36,0.06)]">
      {/* Motor */}
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">Motor</span>
        <span className="text-sm font-medium text-[color:var(--ink)]">{variant.motor || '—'}</span>
      </div>

      {/* MTOW y MLW en la misma fila */}
      <div className="flex items-baseline gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">MTOW</span>
          <span className="font-mono text-sm font-medium text-[color:var(--ink)]">
            {variant.mtow_kg != null ? `${variant.mtow_kg.toLocaleString()} kg` : '—'}
          </span>
        </div>
        <span className="text-[color:var(--ink-4)]">|</span>
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">MLW</span>
          <span className="font-mono text-sm font-medium text-[color:var(--ink)]">
            {variant.mlw_kg != null ? `${variant.mlw_kg.toLocaleString()} kg` : '—'}
          </span>
        </div>
      </div>

      {/* Regulacion base — resaltada en ambar porque es critica */}
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">Regulacion Base</span>
        {variant.regulacion_base ? (
          <span className="inline-flex rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">
            {variant.regulacion_base}
          </span>
        ) : (
          <span className="text-sm text-[color:var(--ink-3)]">—</span>
        )}
      </div>

      {/* Categoria */}
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">Categoria</span>
        <span className="text-sm font-medium text-[color:var(--ink-2)]">{variant.categoria || '—'}</span>
      </div>

      {/* MSN Elegibles */}
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">MSN Elegibles</span>
        <span className="text-sm text-[color:var(--ink-3)]">{variant.msn_elegibles || '—'}</span>
      </div>
    </div>
  )
}

export function TcdsStatusBanner({
  found,
  tcdsNumber,
  tcdsPdfUrl,
  variants,
  fallbackUsed,
  aircraftModel,
}: TcdsStatusBannerProps) {
  // Router para navegacion programatica
  const router = useRouter()
  // Estado para controlar la expansion de la tabla completa de variantes
  const [allVariantsExpanded, setAllVariantsExpanded] = useState(false)
  // Estado para el modo sin coincidencia exacta (mostrar todas expandidas por defecto)
  const [noMatchExpanded, setNoMatchExpanded] = useState(true)

  // --- CASO 1: Variantes encontradas en la base de datos ---
  if (found && variants.length > 0) {
    // Se toman los datos del primer registro para la cabecera (el TCDS es comun a todas)
    const first = variants[0]

    // Intentar encontrar la variante que coincide con el modelo de la consulta
    const matchedVariant = aircraftModel
      ? variants.find(
          (v) => v.modelo.toLowerCase() === aircraftModel.toLowerCase()
        )
      : null

    // Determinar el modo de visualizacion
    const hasModelFilter = aircraftModel != null && aircraftModel.trim() !== ''
    const hasExactMatch = matchedVariant != null

    return (
      <div className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-[0_8px_18px_rgba(74,60,36,0.08)]">
        {/* === CABECERA: Badge de verificado + codigo TCDS + issue/fecha === */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />

          {/* Badge verde: TCDS verificado */}
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            TCDS verificado
          </span>

          {/* Codigo TCDS completo (ej: EASA.A.089) */}
          <span className="font-mono text-sm font-semibold text-[color:var(--ink)]">
            {first.tcds_code}
          </span>

          {/* Badge celeste: codigo corto (ej: A.089), mismo estilo que en la tab de extraccion */}
          {first.tcds_code_short && (
            <span className="inline-flex items-center rounded-full bg-[color:var(--paper-2)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--ink-2)]">
              {first.tcds_code_short}
            </span>
          )}

          {/* Issue y fecha del TCDS */}
          {(first.tcds_issue || first.tcds_date) && (
            <span className="text-xs text-emerald-600">
              {first.tcds_issue ? `Issue ${first.tcds_issue}` : ''}
              {first.tcds_issue && first.tcds_date ? ' — ' : ''}
              {first.tcds_date ?? ''}
            </span>
          )}

          {/* Fabricante y pais */}
          {first.fabricante && (
            <span className="ml-auto flex items-center gap-1 text-xs text-[color:var(--ink-3)]">
              <Plane className="h-3 w-3" />
              {first.fabricante}
              {first.pais ? ` (${first.pais})` : ''}
            </span>
          )}
        </div>

        {/* Indicador de fallback si se uso busqueda alternativa */}
        {fallbackUsed && (
          <div className="border-t border-[color:var(--ink-4)] px-3 py-1.5">
            <p className="text-[10px] italic text-emerald-600">
              {tcdsNumber
                ? 'Coincidencia encontrada por modelo/fabricante porque el TCDS reportado no estaba registrado'
                : 'Coincidencia encontrada por modelo/fabricante aunque la consulta no incluia un TCDS'}
            </p>
          </div>
        )}

        {/* === MODO A: Variante exacta identificada === */}
        {hasModelFilter && hasExactMatch && (
          <div className="border-t border-[color:var(--ink-4)]">
            {/* Cabecera de variante identificada */}
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-xs font-semibold text-emerald-700">
                Variante identificada: {matchedVariant.modelo}
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                TCDS
              </span>
            </div>

            {/* Tarjeta con datos de la variante */}
            <div className="px-3 pb-3">
              <MatchedVariantCard variant={matchedVariant} />
            </div>

            {/* Seccion colapsable con todas las variantes */}
            {variants.length > 1 && (
              <div className="border-t border-[color:var(--ink-4)]">
                <button
                  type="button"
                  onClick={() => setAllVariantsExpanded(!allVariantsExpanded)}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)]"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${allVariantsExpanded ? 'rotate-180' : ''}`}
                  />
                  Ver todas las variantes del TCDS ({variants.length})
                </button>

                {allVariantsExpanded && (
                  <div className="px-3 pb-3">
                    <VariantsTable variants={variants} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* === MODO B: Modelo proporcionado pero sin coincidencia exacta === */}
        {hasModelFilter && !hasExactMatch && (
          <div className="border-t border-[color:var(--ink-4)]">
            {/* Aviso de que no se encontro coincidencia exacta */}
            <div className="flex items-center gap-2 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="text-xs text-amber-700">
                No se encontro coincidencia exacta para &lsquo;{aircraftModel}&rsquo;. Mostrando todas las variantes.
              </span>
            </div>

            {/* Tabla expandible con todas las variantes */}
            <div className="border-t border-[color:var(--ink-4)]">
              <button
                type="button"
                onClick={() => setNoMatchExpanded(!noMatchExpanded)}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)]"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${noMatchExpanded ? 'rotate-180' : ''}`}
                />
                {variants.length} {variants.length === 1 ? 'variante' : 'variantes'} encontrada{variants.length !== 1 ? 's' : ''}
              </button>

              {noMatchExpanded && (
                <div className="px-3 pb-3">
                  <VariantsTable variants={variants} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* === MODO C: Sin modelo proporcionado — comportamiento original === */}
        {!hasModelFilter && (
          <div className="border-t border-[color:var(--ink-4)]">
            <button
              type="button"
              onClick={() => setNoMatchExpanded(!noMatchExpanded)}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)]"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${noMatchExpanded ? 'rotate-180' : ''}`}
              />
              {variants.length} {variants.length === 1 ? 'variante' : 'variantes'} encontrada{variants.length !== 1 ? 's' : ''}
            </button>

            {noMatchExpanded && (
              <div className="overflow-x-auto px-3 pb-3">
                <VariantsTable variants={variants} />
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // --- CASO 2: TCDS NO encontrado en la base de datos ---
  return (
    <div className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-3 py-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[color:var(--ink)]">
            {tcdsNumber ? 'Este TCDS no esta en la base de datos' : 'Revision TCDS pendiente'}
          </p>
          <p className="mt-1 text-xs text-[color:var(--ink-3)]">
            {tcdsNumber ? (
              <>
                El codigo <span className="font-mono font-medium text-[color:var(--ink-2)]">{tcdsNumber}</span> no
                se encontro en <span className="font-medium">doa_aeronaves</span>.
              </>
            ) : (
              <>
                No se dispone de codigo TCDS para esta consulta.
              </>
            )}
          </p>

          {/* Indicar si se intento fallback por modelo/fabricante */}
          {fallbackUsed && (
            <p className="mt-1 text-[10px] italic text-amber-600">
              Tambien se busco por modelo/fabricante sin resultados.
            </p>
          )}

          {/* Mostrar URL del PDF como contexto adicional si esta disponible */}
          {tcdsPdfUrl && (
            <p className="mt-1.5 text-xs text-[color:var(--ink-3)]">
              PDF disponible:{' '}
              <a
                href={tcdsPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[color:var(--ink-3)] underline hover:text-[color:var(--ink-2)]"
              >
                Ver TCDS PDF
              </a>
            </p>
          )}

          {/* Boton que navega al TCDS RAG Engine con la pestana de ingesta preseleccionada */}
          <button
            type="button"
            onClick={() => router.push('/tools/tcds-rag?tab=ingest')}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 active:bg-sky-800"
          >
            Ingestar y tramitar TCDS
          </button>
        </div>
      </div>
    </div>
  )
}
