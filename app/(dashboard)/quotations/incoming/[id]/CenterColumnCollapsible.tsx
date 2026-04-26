/**
 * ============================================================================
 * SECCION DE EMAILS — Layout lado a lado (entrante izquierda, saliente derecha)
 * ============================================================================
 *
 * Componente client que organiza los emails de la request en un layout
 * de dos columnas:
 *   - IZQUIERDA: emails entrantes del cliente (tarjetas azules)
 *   - DERECHA: respuestas enviadas (tarjetas verdes)
 *
 * VERSION SIMPLIFICADA (rama feature/reconnect-clients):
 *   - Solo lectura desde `doa_emails_v2`. No hay realtime, no hay borrado,
 *     no hay fallback a campos legacy de la request.
 *   - El compositor de respuestas (`ClientReplyComposer`) se ha eliminado:
 *     dependía de un webhook que ya no existe en este slice.
 *   - El cuerpo del email se renderiza como TEXTO PLANO (strip de HTML).
 *     En el pasado se usaba DOMPurify para mostrar HTML; aquí evitamos esa
 *     dependencia hasta que volvamos a tener un sanitizer instalado.
 * ============================================================================
 */

"use client"

import { useMemo, useState } from "react"
import { ChevronDown, Inbox, Send, Mail } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DoaEmail } from "@/types/database"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type CenterColumnCollapsibleProps = {
  /** Emails de la tabla doa_emails_v2 ya ordenados cronologicamente. */
  emails?: DoaEmail[]
  query: {
    id: string
    codigo: string
    subject: string
    sender: string
  }
  /** Si true, no muestra el compositor (siempre true en esta version). */
  hideComposer?: boolean
}

type EmailDirection = "incoming" | "outgoing"

type ThreadEmail = {
  id: string
  direction: EmailDirection
  label: string
  contactLabel: string
  contactValue: string
  date: string | null
  body: string
  subject?: string
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function formatDateSpanish(isoDate: string | null | undefined): string {
  if (!isoDate) return "Fecha no disponible"
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return "Fecha no disponible"
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

/** Strip de tags y entidades comunes para mostrar HTML como texto plano. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function buildSnippet(body: string, maxLength = 100): string {
  const text = stripHtml(body)
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + "..."
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function EmailCard({
  email,
  isOpen,
  onToggle,
}: {
  email: ThreadEmail
  isOpen: boolean
  onToggle: () => void
}) {
  const isIncoming = email.direction === "incoming"

  // Texto plano sanitizado del body. No usamos dangerouslySetInnerHTML porque
  // no tenemos sanitizer y los emails entrantes son de origen externo.
  const plainBody = useMemo(() => stripHtml(email.body ?? ""), [email.body])

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "flex w-full items-start gap-3 rounded-2xl border bg-[color:var(--paper-2)] px-4 py-3 shadow-sm transition-colors hover:bg-[color:var(--paper-3)]/80",
          isIncoming
            ? "border-l-[3px] border-l-sky-400 border-t-slate-200 border-r-slate-200 border-b-slate-200"
            : "border-r-[3px] border-r-emerald-400 border-t-slate-200 border-l-slate-200 border-b-slate-200",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "mt-0.5 shrink-0 rounded-lg p-1.5",
            isIncoming
              ? "bg-[color:var(--paper)] text-[color:var(--ink-2)]"
              : "bg-emerald-100 text-emerald-600",
          )}
        >
          {isIncoming ? (
            <Inbox className="h-3.5 w-3.5" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </button>

        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.16em]",
                isIncoming ? "text-[color:var(--ink-2)]" : "text-emerald-600",
              )}
            >
              {email.label}
            </p>
            {email.date && (
              <p className="text-[10px] text-[color:var(--ink-3)]">
                {formatDateSpanish(email.date)}
              </p>
            )}
          </div>

          {email.subject && (
            <p className="mt-0.5 text-sm font-semibold text-[color:var(--ink)]">
              {email.subject}
            </p>
          )}

          <p className="mt-1 flex items-center gap-1.5 text-xs text-[color:var(--ink-3)]">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="font-medium text-[color:var(--ink-3)]">{email.contactLabel}:</span>
            {email.contactValue}
          </p>

          {!isOpen && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[color:var(--ink-3)] italic">
              {buildSnippet(email.body)}
            </p>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onToggle} className="p-1">
            <ChevronDown
              className={cn(
                "h-4 w-4 text-[color:var(--ink-3)] transition-transform duration-200",
                isOpen && "rotate-180",
              )}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          className={cn(
            "mt-2 rounded-2xl border p-4",
            isIncoming
              ? "border-[color:var(--ink-4)] bg-[color:var(--paper)]/80"
              : "border-emerald-100 bg-emerald-50/40",
          )}
        >
          {email.date && (
            <p className="mb-3 text-[11px] font-medium text-[color:var(--ink-3)]">
              {formatDateSpanish(email.date)}
            </p>
          )}
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-[color:var(--ink-2)]">
            {plainBody.length > 0 ? plainBody : "Sin contenido"}
          </pre>
        </div>
      )}
    </div>
  )
}

function EmptyResponsePlaceholder() {
  return (
    <div className="flex h-full min-h-[100px] items-center justify-center rounded-2xl border-2 border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper)]/80 px-4 py-6">
      <div className="text-center">
        <Send className="mx-auto h-5 w-5 text-[color:var(--ink-3)]" />
        <p className="mt-2 text-xs font-medium text-[color:var(--ink-2)]">
          Sin respuestas enviadas
        </p>
        <p className="mt-0.5 text-[10px] text-[color:var(--ink-3)]">
          (compositor desactivado en esta versión)
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function CenterColumnCollapsible({
  emails = [],
  query: _query,
}: CenterColumnCollapsibleProps) {
  // Marcamos `_query` como leído para evitar warning del linter cuando no se
  // usa: en esta versión no hace falta porque solo leemos `emails`.
  void _query

  const { entrantes, salientes, totalEmails } = useMemo(() => {
    const inc: ThreadEmail[] = emails
      .filter((e) => e.direction === "inbound")
      .map((e) => ({
        id: e.id,
        direction: "incoming" as EmailDirection,
        label: "Email entrante",
        contactLabel: "De",
        contactValue: e.from_email,
        date: e.date,
        body: e.body,
        subject: e.subject,
      }))

    const out: ThreadEmail[] = emails
      .filter((e) => e.direction === "outbound")
      .map((e) => ({
        id: e.id,
        direction: "outgoing" as EmailDirection,
        label: "Respuesta enviada",
        contactLabel: "Para",
        contactValue: e.to_email ?? e.from_email,
        date: e.date,
        body: e.body,
        subject: e.subject,
      }))

    return {
      entrantes: inc,
      salientes: out,
      totalEmails: inc.length + out.length,
    }
  }, [emails])

  const [openStates, setOpenStates] = useState<Record<string, boolean>>({})

  function toggleEmail(id: string) {
    setOpenStates((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-4">
      {/* Cabecera de la sección */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--paper-2)]">
          <Mail className="h-3 w-3 text-[color:var(--ink-3)]" />
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
          Hilo de comunicación
        </h3>
        <span className="rounded-full bg-[color:var(--paper-2)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--ink-3)]">
          {totalEmails} {totalEmails === 1 ? "email" : "emails"}
        </span>
      </div>

      {/* Leyenda de columnas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-sky-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
            Emails del cliente
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">
            Nuestras respuestas
          </span>
        </div>
      </div>

      {/* Grid 2 columnas: izquierda entrantes, derecha salientes */}
      <div className="grid grid-cols-2 gap-4 items-start">
        <div className="space-y-3">
          {entrantes.length > 0 ? (
            entrantes.map((email) => (
              <EmailCard
                key={email.id}
                email={email}
                isOpen={openStates[email.id] ?? false}
                onToggle={() => toggleEmail(email.id)}
              />
            ))
          ) : (
            <div className="flex h-full min-h-[100px] items-center justify-center rounded-2xl border-2 border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/50 px-4 py-6">
              <div className="text-center">
                <Inbox className="mx-auto h-5 w-5 text-[color:var(--ink-4)]" />
                <p className="mt-2 text-xs font-medium text-[color:var(--ink-3)]">
                  Sin emails entrantes
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {salientes.length > 0 ? (
            salientes.map((email) => (
              <EmailCard
                key={email.id}
                email={email}
                isOpen={openStates[email.id] ?? false}
                onToggle={() => toggleEmail(email.id)}
              />
            ))
          ) : (
            <EmptyResponsePlaceholder />
          )}
        </div>
      </div>
    </div>
  )
}
