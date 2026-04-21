/**
 * ============================================================================
 * PAGINA DE DETALLE: TCDS RAG ENGINE
 * ============================================================================
 *
 * Server component minimo que renderiza el componente client TcdsRagClient.
 * Incluye la barra superior con enlace de retorno a /tools.
 *
 * NOTA TECNICA: Separamos server/client para seguir la convencion del project
 * (page.tsx = servidor, *Client.tsx = client con interactividad).
 *
 * UBICACION ANTERIOR: app/(dashboard)/settings/tcds-rag/page.tsx
 * Se movio a /tools porque TCDS RAG es una herramienta operativa, no un ajuste.
 * ============================================================================
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { TcdsRagClient } from './TcdsRagClient'

export default function TcdsRagPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      {/* Barra superior */}
      <TopBar title="TCDS RAG Engine" subtitle="Motor de indexacion y search semantica" />

      <main className="flex-1 space-y-6 overflow-y-auto p-6 text-[color:var(--ink)]">
        {/* Enlace de retorno a Tools */}
        <Link
          href="/tools"
          className="inline-flex items-center gap-1.5 text-sm text-[color:var(--ink-3)] transition-colors hover:text-[color:var(--ink-2)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Tools
        </Link>

        {/* Componente client con toda la interactividad */}
        <Suspense fallback={<div className="text-[color:var(--ink-3)]">Cargando...</div>}>
          <TcdsRagClient />
        </Suspense>
      </main>
    </div>
  )
}
