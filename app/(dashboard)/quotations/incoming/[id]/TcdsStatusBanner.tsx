'use client'

/**
 * ============================================================================
 * BANNER DE ESTADO DE TCDS — Vista enriquecida con data tecnicos de aircraft
 * ============================================================================
 *
 * Componente client que muestra el status de verificacion de un TCDS
 * contra la base de data internal de aircraft (doa_aircraft).
 *
 * Tres modos de visualizacion cuando hay variantes:
 * - VARIANTE EXACTA: Si aircraftModel coincide con un model, muestra solo
 *   esa variante en formato tarjeta limpia, con table colapsable del resto.
 * - SIN COINCIDENCIA: Si aircraftModel no coincide con ninguna, muestra
 *   todas las variantes con un aviso.
 * - SIN MODELO: Si no se proporciona aircraftModel, muestra todas como antes.
 *
 * Status cuando no hay variantes:
 * - NO ENCONTRADO (ambar): Banner de advertencia con el codigo buscado y un
 *   boton placeholder para futura funcionalidad de ingesta de TCDS.
 *
 * Este componente es necesario como componente client porque contiene
 * interactividad (collapsible, boton con onClick).
 * ============================================================================
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, ChevronDown, Plane } from 'lucide-react'

/** Tipo para cada variante de aircraft encontrada en doa_aircraft */
interface AeronaveVariant {
  tcds_code: string
  tcds_code_short: string
  tcds_issue: string
  tcds_date: string
  manufacturer: string
  country: string
  type: string
  model: string
  engine: string
  mtow_kg: number | null
  mlw_kg: number | null
  base_regulation: string
  category: string
  eligible_msns: string
  notes: string
}

interface TcdsStatusBannerProps {
  /** Si se encontraron variantes en doa_aircraft */
  found: boolean
  /** El numero de TCDS que se busco */
  tcdsNumber: string | null
  /** URL del PDF del TCDS (contexto adicional si no se encontro) */
  tcdsPdfUrl?: string | null
  /** Todas las variantes encontradas bajo el mismo TCDS */
  variants: AeronaveVariant[]
  /** Si se uso la search de fallback (por model/manufacturer en vez de TCDS) */
  fallbackUsed?: boolean
  /** Model de aircraft de la request para filtrar variantes (ej: "PC-12/45") */
  aircraftModel?: string | null
}

/**
 * Table reutilizable que muestra todas las variantes en formato table
 */
function VariantsTable({ variants }: { variants: AeronaveVariant[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-[color:var(--ink-4)] text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
            <th className="pb-1.5 pr-3">Model</th>
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
            <tr key={`${v.model}-${idx}`} className="hover:bg-[color:var(--paper-3)]">
              <td className="py-1.5 pr-3 font-medium text-[color:var(--ink)]">
                {v.model || '—'}
              </td>
              <td className="py-1.5 pr-3 text-[color:var(--ink-2)]">
                {v.engine || '—'}
              </td>
              <td className="py-1.5 pr-3 text-right font-mono text-[color:var(--ink-2)]">
                {v.mtow_kg != null ? v.mtow_kg.toLocaleString() : '—'}
              </td>
              <td className="py-1.5 pr-3 text-right font-mono text-[color:var(--ink-2)]">
                {v.mlw_kg != null ? v.mlw_kg.toLocaleString() : '—'}
              </td>
              <td className="py-1.5 pr-3">
                {v.base_regulation ? (
                  <span className="inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                    {v.base_regulation}
                  </span>
                ) : (
                  <span className="text-[color:var(--ink-3)]">—</span>
                )}
              </td>
              <td className="py-1.5 pr-3 text-[color:var(--ink-2)]">
                {v.category || '—'}
              </td>
              <td className="max-w-[140px] truncate py-1.5 text-[color:var(--ink-3)]" title={v.eligible_msns || ''}>
                {v.eligible_msns || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Tarjeta limpia que muestra los data de una variante identificada
 */
function MatchedVariantCard({ variant }: { variant: AeronaveVariant }) {
  return (
    <div className="space-y-2 rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-2.5 shadow-[0_4px_10px_rgba(74,60,36,0.06)]">
      {/* Motor */}
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">Motor</span>
        <span className="text-sm font-medium text-[color:var(--ink)]">{variant.engine || '—'}</span>
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
        {variant.base_regulation ? (
          <span className="inline-flex rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">
            {variant.base_regulation}
          </span>
        ) : (
          <span className="text-sm text-[color:var(--ink-3)]">—</span>
        )}
      </div>

      {/* Categoria */}
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">Categoria</span>
        <span className="text-sm font-medium text-[color:var(--ink-2)]">{variant.category || '—'}</span>
      </div>

      {/* MSN Elegibles */}
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-2)]">MSN Elegibles</span>
        <span className="text-sm text-[color:var(--ink-3)]">{variant.eligible_msns || '—'}</span>
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
  // Status para controlar la expansion de la table completa de variantes
  const [allVariantsExpanded, setAllVariantsExpanded] = useState(false)
  // Status para el modo sin coincidencia exacta (mostrar todas expandidas por defecto)
  const [noMatchExpanded, setNoMatchExpanded] = useState(true)

  // --- CASO 1: Variantes encontradas en la base de data ---
  if (found && variants.length > 0) {
    // Se toman los data del primer registro para la cabecera (el TCDS es comun a todas)
    const first = variants[0]

    // Intentar encontrar la variante que coincide con el model de la request
    const matchedVariant = aircraftModel
      ? variants.find(
          (v) => v.model.toLowerCase() === aircraftModel.toLowerCase()
        )
      : null

    // Determinar el modo de visualizacion
    const hasModelFilter = aircraftModel != null && aircraftModel.trim() !== ''
    const hasExactMatch = matchedVariant != null

    return (
      <div className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-[0_8px_18px_rgba(74,60,36,0.08)]">
        {/* === CABECERA: Badge de verificado + codigo TCDS + issue/date === */}
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

          {/* Issue y date del TCDS */}
          {(first.tcds_issue || first.tcds_date) && (
            <span className="text-xs text-emerald-600">
              {first.tcds_issue ? `Issue ${first.tcds_issue}` : ''}
              {first.tcds_issue && first.tcds_date ? ' — ' : ''}
              {first.tcds_date ?? ''}
            </span>
          )}

          {/* Manufacturer y country */}
          {first.manufacturer && (
            <span className="ml-auto flex items-center gap-1 text-xs text-[color:var(--ink-3)]">
              <Plane className="h-3 w-3" />
              {first.manufacturer}
              {first.country ? ` (${first.country})` : ''}
            </span>
          )}
        </div>

        {/* Indicador de fallback si se uso search alternativa */}
        {fallbackUsed && (
          <div className="border-t border-[color:var(--ink-4)] px-3 py-1.5">
            <p className="text-[10px] italic text-emerald-600">
              {tcdsNumber
                ? 'Coincidencia encontrada por model/manufacturer porque el TCDS reportado no estaba registrado'
                : 'Coincidencia encontrada por model/manufacturer aunque la request no incluia un TCDS'}
            </p>
          </div>
        )}

        {/* === MODO A: Variante exacta identificada === */}
        {hasModelFilter && hasExactMatch && (
          <div className="border-t border-[color:var(--ink-4)]">
            {/* Cabecera de variante identificada */}
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-xs font-semibold text-emerald-700">
                Variante identificada: {matchedVariant.model}
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                TCDS
              </span>
            </div>

            {/* Tarjeta con data de la variante */}
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

        {/* === MODO B: Model proporcionado pero sin coincidencia exacta === */}
        {hasModelFilter && !hasExactMatch && (
          <div className="border-t border-[color:var(--ink-4)]">
            {/* Aviso de que no se encontro coincidencia exacta */}
            <div className="flex items-center gap-2 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="text-xs text-amber-700">
                No se encontro coincidencia exacta para &lsquo;{aircraftModel}&rsquo;. Mostrando todas las variantes.
              </span>
            </div>

            {/* Table expandible con todas las variantes */}
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

        {/* === MODO C: Sin model proporcionado — comportamiento original === */}
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

  // --- CASO 2: TCDS NO encontrado en la base de data ---
  return (
    <div className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-3 py-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[color:var(--ink)]">
            {tcdsNumber ? 'Este TCDS no esta en la base de data' : 'Review TCDS pending'}
          </p>
          <p className="mt-1 text-xs text-[color:var(--ink-3)]">
            {tcdsNumber ? (
              <>
                El codigo <span className="font-mono font-medium text-[color:var(--ink-2)]">{tcdsNumber}</span> no
                se encontro en <span className="font-medium">doa_aircraft</span>.
              </>
            ) : (
              <>
                No se dispone de codigo TCDS para esta request.
              </>
            )}
          </p>

          {/* Indicar si se intento fallback por model/manufacturer */}
          {fallbackUsed && (
            <p className="mt-1 text-[10px] italic text-amber-600">
              Tambien se busco por model/manufacturer sin resultados.
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
