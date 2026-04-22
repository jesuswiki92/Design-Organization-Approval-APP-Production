"use client"

import { useState } from "react"
import { Check, Copy, ExternalLink, Link2 } from "lucide-react"

import { Button } from "@/components/ui/button"

type PublicFormLinkCardProps = {
  url: string
  expiresAt: string | null
}

function formatExpiresAt(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function PublicFormLinkCard({ url, expiresAt }: PublicFormLinkCardProps) {
  const [copied, setCopied] = useState(false)
  const expiresLabel = formatExpiresAt(expiresAt)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch (err) {
      console.error("No se pudo copiar el enlace del formulario:", err)
    }
  }

  return (
    <section className="rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-5 shadow-[0_12px_28px_rgba(74,60,36,0.12)]">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] text-[color:var(--ink-2)]">
          <Link2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[color:var(--ink)]">
            Enlace del formulario publico
          </h2>
          <p className="mt-0.5 text-xs text-[color:var(--ink-3)]">
            URL que recibira el cliente para completar el formulario.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-2 font-mono text-xs text-[color:var(--ink-2)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ink-4)]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copiar
                </>
              )}
            </Button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-2 text-xs font-medium text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir
            </a>
          </div>

          {expiresLabel ? (
            <p className="mt-2 text-[11px] text-[color:var(--ink-3)]">
              Expira el {expiresLabel}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
