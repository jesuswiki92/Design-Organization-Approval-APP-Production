'use client'

/**
 * ============================================================================
 * BANNER DE ESTADO DE TCDS
 * ============================================================================
 *
 * Componente cliente que muestra el estado de verificacion de un TCDS
 * contra la base de datos interna de aeronaves (doa_aeronaves).
 *
 * Dos estados posibles:
 * - ENCONTRADO: Muestra una insignia verde indicando que el TCDS esta verificado
 *   y opcionalmente el tipo/modelo registrado en la base de datos.
 * - NO ENCONTRADO: Muestra un banner de advertencia amarillo/ambar con un boton
 *   placeholder para futura funcionalidad de ingesta de TCDS.
 *
 * Este componente es necesario como componente cliente porque contiene
 * un boton con onClick (interactividad), y la pagina padre es un
 * server component.
 * ============================================================================
 */

import { AlertTriangle, CheckCircle2 } from 'lucide-react'

interface TcdsStatusBannerProps {
  /** Si el TCDS fue encontrado en doa_aeronaves */
  found: boolean
  /** El numero de TCDS que se busco */
  tcdsNumber: string
  /** URL del PDF del TCDS (contexto adicional si no se encontro) */
  tcdsPdfUrl?: string | null
  /** Tipo de aeronave segun doa_aeronaves (solo si found=true) */
  matchedTipo?: string | null
  /** Modelo de aeronave segun doa_aeronaves (solo si found=true) */
  matchedModelo?: string | null
}

export function TcdsStatusBanner({
  found,
  tcdsNumber,
  tcdsPdfUrl,
  matchedTipo,
  matchedModelo,
}: TcdsStatusBannerProps) {
  // --- CASO 1: TCDS encontrado en la base de datos ---
  if (found) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-emerald-800">
            TCDS verificado ✓
          </p>
          {/* Mostrar tipo y modelo si estan disponibles */}
          {(matchedTipo || matchedModelo) && (
            <p className="mt-0.5 text-xs text-emerald-600">
              {[matchedTipo, matchedModelo].filter(Boolean).join(' — ')}
            </p>
          )}
        </div>
      </div>
    )
  }

  // --- CASO 2: TCDS NO encontrado en la base de datos ---
  return (
    <div className="rounded-xl border border-amber-200 bg-[linear-gradient(180deg,#fffaf0_0%,#fff7ed_100%)] px-3 py-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            Este TCDS no está en la base de datos
          </p>
          <p className="mt-1 text-xs text-slate-500">
            El código <span className="font-mono font-medium text-slate-700">{tcdsNumber}</span> no
            se encontró en <span className="font-medium">doa_aeronaves</span>.
          </p>

          {/* Mostrar URL del PDF como contexto adicional si esta disponible */}
          {tcdsPdfUrl && (
            <p className="mt-1.5 text-xs text-slate-400">
              PDF disponible:{' '}
              <a
                href={tcdsPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-sky-600 underline hover:text-sky-700"
              >
                Ver TCDS PDF
              </a>
            </p>
          )}

          {/* Boton placeholder para futura ingesta de TCDS */}
          {/* TODO: Conectar con pipeline de ingesta de TCDS */}
          <button
            type="button"
            onClick={() => {}}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 active:bg-sky-800"
          >
            Ingestar y tramitar TCDS
          </button>
        </div>
      </div>
    </div>
  )
}
