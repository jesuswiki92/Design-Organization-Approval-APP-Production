'use client'

/**
 * Pagina de Herramientas
 *
 * Muestra las herramientas disponibles del DOA Operations Hub.
 * Actualmente solo contiene la tarjeta del TCDS RAG Engine.
 *
 * Es un Client Component porque necesita verificar la conexion
 * al backend RAG para mostrar el badge de estado dinamicamente.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BrainCircuit, Wifi, WifiOff, Loader2, ArrowRight } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { ragHealth } from '@/lib/rag-api'

export default function ToolsPage() {
  /** Estado de conexion al backend RAG: null = cargando, true/false = resultado */
  const [ragConnected, setRagConnected] = useState<boolean | null>(null)

  /** Verificar conexion al backend RAG al montar */
  useEffect(() => {
    ragHealth()
      .then(() => setRagConnected(true))
      .catch(() => setRagConnected(false))
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      {/* Barra superior */}
      <TopBar title="Herramientas" subtitle="Suite de herramientas DOA" />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Tarjeta unica: TCDS RAG Engine */}
        <Link
          href="/tools/tcds-rag"
          className="group block rounded-[24px] border border-sky-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_55%,#e0f2fe_100%)] px-6 py-6 shadow-[0_18px_45px_rgba(148,163,184,0.16)] transition-all hover:border-sky-300 hover:shadow-[0_20px_50px_rgba(148,163,184,0.22)]"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            {/* Icono, titulo y descripcion */}
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-sky-200 bg-[linear-gradient(135deg,#2563EB,#38BDF8)] shadow-sm">
                <BrainCircuit className="h-7 w-7 text-white" />
              </div>

              <div className="max-w-2xl">
                {/* Titulo + badge de estado */}
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-slate-950">
                    TCDS RAG Engine
                  </h2>

                  {/* Badge dinamico segun estado de conexion */}
                  {ragConnected === null ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Verificando
                    </span>
                  ) : ragConnected ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700">
                      <Wifi className="h-3 w-3" />
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-700">
                      <WifiOff className="h-3 w-3" />
                      Sin configurar
                    </span>
                  )}
                </div>

                {/* Subtitulo descriptivo */}
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Motor de indexacion y busqueda semantica para Type Certificate
                  Data Sheets
                </p>
              </div>
            </div>

            {/* Boton de acceso */}
            <div className="flex shrink-0 items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#2563EB,#38BDF8)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity group-hover:opacity-90">
              Abrir herramienta
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
