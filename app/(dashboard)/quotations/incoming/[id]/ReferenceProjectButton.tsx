'use client'

/**
 * Boton para marcar/desmarcar un project historical como referencia
 * para la request entrante actual. Puede haber 1 o mas referencias.
 * Llama a POST /api/incoming-requests/[id]/references para añadir
 * y DELETE para quitar.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'

type ReferenceProjectButtonProps = {
  consultaId: string
  proyectoId: string
  isReferenced: boolean
}

export function ReferenceProjectButton({
  consultaId,
  proyectoId,
  isReferenced: initialIsReferenced,
}: ReferenceProjectButtonProps) {
  const router = useRouter()
  const [isReferenced, setIsReferenced] = useState(initialIsReferenced)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)

    const method = isReferenced ? 'DELETE' : 'POST'
    const previousState = isReferenced
    setIsReferenced(!isReferenced)

    try {
      const response = await fetch(`/api/incoming-requests/${consultaId}/references`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: proyectoId }),
      })

      if (!response.ok) {
        setIsReferenced(previousState)
      } else {
        router.refresh()
      }
    } catch {
      setIsReferenced(previousState)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-[color:var(--ink-4)]"
        aria-label="Guardando..."
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </button>
    )
  }

  if (isReferenced) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-amber-300 bg-amber-50 text-amber-600 transition-colors hover:bg-amber-100"
        title="Quitar como referencia"
        aria-label="Quitar project como referencia"
      >
        <BookmarkCheck className="h-3.5 w-3.5" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-[color:var(--ink-3)] transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600"
      title="Usar como referencia"
      aria-label="Marcar project como referencia"
    >
      <Bookmark className="h-3.5 w-3.5" />
    </button>
  )
}
