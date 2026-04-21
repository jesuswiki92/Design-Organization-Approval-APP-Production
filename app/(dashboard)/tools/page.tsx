'use client'

/**
 * Page de Tools
 *
 * Muestra las tools disponibles del DOA Operations Hub.
 * Contiene las tarjetas del TCDS RAG Engine y Part-21 Classification RAG.
 *
 * Es un Client Component porque necesita verificar la conexion
 * al backend RAG y el status de la table de embeddings en Supabase.
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
  /** Status de conexion al backend RAG: null = cargando, true/false = resultado */
  const [ragConnected, setRagConnected] = useState<boolean | null>(null)

  /** Status de la table Part-21 en Supabase: null = cargando, number = filas, false = error */
  const [part21Status, setPart21Status] = useState<
    { ok: true; count: number } | { ok: false } | null
  >(null)

  /** Verificar conexion al backend RAG al montar */
  useEffect(() => {
    ragHealth()
      .then(() => setRagConnected(true))
      .catch(() => setRagConnected(false))
  }, [])

  /** Verificar que la table doa_part21_embeddings tiene data */
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('doa_part21_embeddings')
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
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      {/* Barra superior */}
      <TopBar title="Tools" subtitle="Suite de tools DOA" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-6">
          {/* Tarjeta: TCDS RAG Engine */}
          <Link
            href="/tools/tcds-rag"
            className="group block rounded-[24px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-6 py-6 shadow-[0_18px_45px_rgba(148,163,184,0.16)] transition-all hover:border-[color:var(--ink-4)] hover:shadow-[0_20px_50px_rgba(148,163,184,0.22)]"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              {/* Icono, title y description */}
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--ink-4)] bg-[linear-gradient(135deg,#2563EB,#38BDF8)] shadow-sm">
                  <BrainCircuit className="h-7 w-7 text-white" />
                </div>

                <div className="max-w-2xl">
                  {/* Titulo + badge de status */}
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-slate-950">
                      TCDS RAG Engine
                    </h2>

                    {/* Badge dinamico segun status de conexion */}
                    {ragConnected === null ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Verificando
                      </span>
                    ) : ragConnected ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700">
                        <Wifi className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-700">
                        <WifiOff className="h-3 w-3" />
                        Sin configurar
                      </span>
                    )}
                  </div>

                  {/* Subtitulo descriptivo */}
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-3)]">
                    Motor de indexacion y search semantica para Type
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
            className="group block rounded-[24px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-6 py-6 shadow-[0_18px_45px_rgba(148,163,184,0.16)] transition-all hover:border-[color:var(--ink-4)] hover:shadow-[0_20px_50px_rgba(148,163,184,0.22)]"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              {/* Icono, title y description */}
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--ink-4)] bg-[linear-gradient(135deg,#7C3AED,#A78BFA)] shadow-sm">
                  <Scale className="h-7 w-7 text-white" />
                </div>

                <div className="max-w-2xl">
                  {/* Titulo + badge de status */}
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-slate-950">
                      Part-21 Classification RAG
                    </h2>

                    {/* Badge dinamico segun status de la table en Supabase */}
                    {part21Status === null ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Verificando
                      </span>
                    ) : part21Status.ok ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700">
                        <Wifi className="h-3 w-3" />
                        Active &middot; {part21Status.count} chunks
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-700">
                        <WifiOff className="h-3 w-3" />
                        Sin data
                      </span>
                    )}
                  </div>

                  {/* Subtitulo descriptivo */}
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-3)]">
                    Base de conocimiento para classification de cambios
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
