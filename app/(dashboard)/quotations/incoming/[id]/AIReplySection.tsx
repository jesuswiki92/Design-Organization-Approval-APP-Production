'use client'

/**
 * ============================================================================
 * AIReplySection — Cliente-side de la nueva sección "AI Reply"
 * ============================================================================
 *
 * Sub-Slice A. Renderiza dos estados:
 *   - sin reply: prompt visual con botón "Generar respuesta IA".
 *   - con reply: <pre> con el body generado y botón "Regenerar".
 *
 * El POST a `/api/incoming-requests/${incomingId}/draft-reply` decide el prompt
 * (known vs unknown) en server side; aquí solo mostramos el `kind` que ya viene
 * precomputado para que el usuario sepa qué plantilla se usará.
 * ============================================================================
 */

import { Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'

type Kind = 'known' | 'unknown'

type Props = {
  incomingId: string
  initialReply: string | null
  kind: Kind
}

export function AIReplySection({ incomingId, initialReply, kind }: Props) {
  const [reply, setReply] = useState<string | null>(initialReply)
  const [loading, setLoading] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/incoming-requests/${incomingId}/draft-reply`,
        { method: 'POST' },
      )

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        body?: string
        kind?: Kind
        error?: string
      }

      if (!res.ok || !json.ok || !json.body) {
        const message = json.error || `Error ${res.status}`
        toast.error(`No se pudo generar la respuesta: ${message}`)
        return
      }

      setReply(json.body)
      toast.success(`Respuesta generada (${json.kind ?? kind})`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      toast.error(`No se pudo generar la respuesta: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  const kindLabel = kind === 'known' ? 'Cliente conocido' : 'Cliente desconocido'

  if (!reply) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper)] px-5 py-10 text-center">
        <p className="font-[family-name:var(--font-heading)] text-lg text-[color:var(--ink)]">
          Aún no se ha generado respuesta IA
        </p>
        <p className="mt-2 text-xs text-[color:var(--ink-3)]">
          Se redactará un email distinto según el remitente.
        </p>

        <div className="mt-3 flex justify-center">
          <span className="inline-flex items-center rounded-full border border-[color:var(--line-strong)] bg-[color:var(--paper-2)] px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-2)]">
            {kindLabel}
          </span>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-4)] bg-[color:var(--ink)] px-5 py-2.5 text-sm font-medium text-[color:var(--paper)] transition-colors hover:bg-[color:var(--ink-2)]',
              loading && 'cursor-not-allowed opacity-70',
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? 'Generando…' : 'Generar respuesta IA'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <pre className="whitespace-pre-wrap break-words rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-5 font-mono text-[13px] leading-relaxed text-[color:var(--ink)]">
        {reply}
      </pre>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[color:var(--ink-3)]">
          El placeholder <code className="font-mono">{'{{FORM_LINK}}'}</code> se sustituirá por la URL real al enviar (próxima fase).
        </p>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className={cn(
            'inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-2 text-xs font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--paper)]',
            loading && 'cursor-not-allowed opacity-70',
          )}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {loading ? 'Regenerando…' : 'Regenerar'}
        </button>
      </div>
    </div>
  )
}
