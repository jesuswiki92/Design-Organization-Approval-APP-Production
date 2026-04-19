'use client'

/**
 * Pagina de Herramientas
 *
 * Muestra las herramientas disponibles del DOA Operations Hub.
 * Contiene las tarjetas del TCDS RAG Engine y Part-21 Classification RAG.
 *
 * Es un Client Component porque necesita verificar la conexion
 * al backend RAG y el estado de la tabla de embeddings en Supabase.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BrainCircuit,
  Scale,
  Wifi,
  WifiOff,
  Loader2,
  ArrowRight,
} from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { ragHealth } from '@/lib/rag-api'
import { createClient } from '@/lib/supabase/client'

export default function ToolsPage() {
  /** Estado de conexion al backend RAG: null = cargando, true/false = resultado */
  const [ragConnected, setRagConnected] = useState<boolean | null>(null)

  /** Estado de la tabla Part-21 en Supabase: null = cargando, number = filas, false = error */
  const [part21Status, setPart21Status] = useState<
    { ok: true; count: number } | { ok: false } | null
  >(null)

  /** Verificar conexion al backend RAG al montar */
  useEffect(() => {
    ragHealth()
      .then(() => setRagConnected(true))
      .catch(() => setRagConnected(false))
  }, [])

  /** Verificar que la tabla part21_embeddings tiene datos */
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('part21_embeddings')
      .select('id', { count: 'exact', head: true })
      .then(({ count, error }) => {
        if (error || count === null) {
          setPart21Status({ ok: false })
        } else {
          setPart21Status({ ok: true, count })
        }
      })
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      {/* Barra superior */}
      <TopBar title="Herramientas" subtitle="Suite de herramientas DOA" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-6">
          {/* Tarjeta: TCDS RAG Engine */}
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
                    Motor de indexacion y busqueda semantica para Type
                    Certificate Data Sheets
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

          {/* Tarjeta: Part-21 Classification RAG */}
          <Link
            href="/tools/part21-rag"
            className="group block rounded-[24px] border border-violet-200 bg-[linear-gradient(135deg,#ffffff_0%,#f3eeff_55%,#ede9fe_100%)] px-6 py-6 shadow-[0_18px_45px_rgba(148,163,184,0.16)] transition-all hover:border-violet-300 hover:shadow-[0_20px_50px_rgba(148,163,184,0.22)]"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              {/* Icono, titulo y descripcion */}
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-violet-200 bg-[linear-gradient(135deg,#7C3AED,#A78BFA)] shadow-sm">
                  <Scale className="h-7 w-7 text-white" />
                </div>

                <div className="max-w-2xl">
                  {/* Titulo + badge de estado */}
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-slate-950">
                      Part-21 Classification RAG
                    </h2>

                    {/* Badge dinamico segun estado de la tabla en Supabase */}
                    {part21Status === null ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Verificando
                      </span>
                    ) : part21Status.ok ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700">
                        <Wifi className="h-3 w-3" />
                        Activo &middot; {part21Status.count} chunks
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-700">
                        <WifiOff className="h-3 w-3" />
                        Sin datos
                      </span>
                    )}
                  </div>

                  {/* Subtitulo descriptivo */}
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Base de conocimiento para clasificacion de cambios
                    aeronauticos (AMC-GM Part-21, G12-01)
                  </p>
                </div>
              </div>

              {/* Boton de acceso */}
              <div className="flex shrink-0 items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#7C3AED,#A78BFA)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity group-hover:opacity-90">
                Abrir herramienta
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
