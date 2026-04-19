'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Home page error:', error)
  }, [error])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)] text-[color:var(--ink)]">
      <div className="flex flex-col items-center gap-3 rounded-[22px] border border-amber-200 bg-[color:var(--paper)] p-8 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <h2 className="text-base font-semibold text-slate-950">No se pudo cargar la portada</h2>
        <p className="max-w-xs text-center text-sm text-[color:var(--ink-3)]">
          Hubo un error al conectar con la base de datos. Verifica tu sesión y vuelve a intentarlo.
        </p>
        <button
          onClick={reset}
          className="mt-2 flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
      </div>
    </div>
  )
}
