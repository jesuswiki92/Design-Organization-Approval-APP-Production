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

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Inbox, Loader2, Mail, Send, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { DoaEmail } from "@/types/database"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type ClientKind = "known" | "unknown"

type CenterColumnCollapsibleProps = {
  /** Emails de la tabla doa_emails_v2 ya ordenados cronologicamente. */
  emails?: DoaEmail[]
  query: {
    id: string
    codigo: string
    subject: string
    sender: string
  }
  /** Si true, no muestra el compositor (siempre true en esta version). Legacy, ignorado. */
  hideComposer?: boolean
  /** Borrador IA persistido en `doa_incoming_requests_v2.respuesta_ia`. */
  aiReply: string | null
  /** UUID de la request en `doa_incoming_requests_v2`. */
  incomingId: string
  /** Tipo de cliente — controla el copy del badge y la plantilla del POST. */
  clientKind: ClientKind
  /** Estado actual de la request. El bloque IA solo se muestra cuando es 'new'. */
  incomingStatus: string
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

/**
 * Bloque de borrador IA que vive DENTRO de la columna de "EMAILS DEL CLIENTE",
 * justo debajo del último email entrante. Visualmente es DISTINTO a una tarjeta
 * de email real (borde dasheado, paper más claro, pill cobalt) para que nadie lo
 * confunda con un correo recibido — es nuestra futura respuesta, todavía no
 * enviada. Cuando el envío esté implementado en sub-slice B, este bloque
 * desaparecerá y el email pasará a la columna de la derecha como outbound.
 */
function AIDraftBlock({
  incomingId,
  initialAiReply,
  clientKind,
}: {
  incomingId: string
  initialAiReply: string | null
  clientKind: ClientKind
}) {
  const router = useRouter()
  const [reply, setReply] = useState<string | null>(initialAiReply)
  const [editedBody, setEditedBody] = useState<string>(initialAiReply ?? "")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  // Si la prop cambia (regeneración server-side, refresh, etc.) sincronizamos
  // el textarea para reflejar el nuevo borrador. Si el usuario tiene cambios
  // locales sin guardar, esto los descarta — es coherente con la semántica de
  // "regenerar = reemplazar".
  useEffect(() => {
    setReply(initialAiReply)
    setEditedBody(initialAiReply ?? "")
  }, [initialAiReply])

  const kindLabel = clientKind === "known" ? "Cliente conocido" : "Cliente desconocido"

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/incoming-requests/${incomingId}/draft-reply`,
        { method: "POST" },
      )

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        body?: string
        kind?: ClientKind
        error?: string
      }

      if (!res.ok || !json.ok || !json.body) {
        const message = json.error || `Error ${res.status}`
        toast.error(`No se pudo generar la respuesta: ${message}`)
        return
      }

      setReply(json.body)
      setEditedBody(json.body)
      toast.success(
        `Respuesta generada (Cliente ${
          (json.kind ?? clientKind) === "known" ? "conocido" : "desconocido"
        })`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido"
      toast.error(`No se pudo generar la respuesta: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    if (!editedBody.trim()) {
      toast.error("El cuerpo del email está vacío.")
      return
    }
    setSending(true)
    try {
      const res = await fetch(
        `/api/incoming-requests/${incomingId}/send-reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: editedBody }),
        },
      )

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        persisted?: boolean
      }

      if (!res.ok || !json.ok) {
        const message = json.error || `Error ${res.status}`
        toast.error(`No se pudo enviar el correo: ${message}`)
        return
      }

      toast.success("Correo enviado al cliente")
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido"
      toast.error(`No se pudo enviar el correo: ${message}`)
    } finally {
      setSending(false)
    }
  }

  const busy = loading || sending

  return (
    <div className="flex flex-col rounded-2xl border border-dashed border-[color:var(--cobalt)]/50 bg-[color:var(--paper)] px-4 py-3 shadow-sm">
      {/* Header pill — deja claro que es borrador IA, no un email real */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--cobalt)]/40 bg-[color:var(--cobalt)]/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--cobalt)]">
          <Sparkles className="h-3 w-3" />
          Borrador IA — {kindLabel}
        </span>
      </div>

      {reply ? (
        <>
          <textarea
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            disabled={busy}
            rows={Math.min(20, Math.max(8, editedBody.split("\n").length + 1))}
            className={cn(
              "mt-3 w-full resize-y whitespace-pre-wrap break-words rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/60 p-3 font-sans text-[13px] leading-6 text-[color:var(--ink-2)] outline-none transition-colors focus:border-[color:var(--cobalt)] focus:bg-[color:var(--paper-2)]",
              busy && "cursor-not-allowed opacity-70",
            )}
            spellCheck
          />

          <p className="mt-2 text-[10px] text-[color:var(--ink-3)]">
            El placeholder <code className="font-mono">{"{{FORM_LINK}}"}</code> se sustituirá por la URL real al enviar.
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={busy}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--paper)]",
                busy && "cursor-not-allowed opacity-70",
              )}
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {loading ? "Regenerando…" : "Regenerar"}
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={busy || !editedBody.trim()}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--cobalt)] bg-[color:var(--cobalt)] px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-[color:var(--cobalt)]/90",
                (busy || !editedBody.trim()) && "cursor-not-allowed opacity-70",
              )}
            >
              {sending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              {sending ? "Enviando…" : "Mandar al cliente"}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/40 px-4 py-6 text-center">
          <p className="text-xs text-[color:var(--ink-3)]">
            Aún no se ha generado respuesta IA.
          </p>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-4)] bg-[color:var(--ink)] px-4 py-2 text-xs font-medium text-[color:var(--paper)] transition-colors hover:bg-[color:var(--ink-2)]",
              busy && "cursor-not-allowed opacity-70",
            )}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {loading ? "Generando…" : "Generar respuesta IA"}
          </button>

          <p className="text-[10px] text-[color:var(--ink-3)]">
            El placeholder <code className="font-mono">{"{{FORM_LINK}}"}</code> se sustituirá por la URL real al enviar.
          </p>
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
  aiReply,
  incomingId,
  clientKind,
  incomingStatus,
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
            <>
              {entrantes.map((email) => (
                <EmailCard
                  key={email.id}
                  email={email}
                  isOpen={openStates[email.id] ?? false}
                  onToggle={() => toggleEmail(email.id)}
                />
              ))}
              {/* Borrador IA: vive bajo el último email entrante porque ese email
                  es el contexto que está siendo respondido. Solo se renderiza si
                  hay al menos un entrante Y la request todavía está en 'new' —
                  cuando el envío al cliente sucede, el status pasa a
                  'awaiting_form' y el bloque desaparece (la respuesta enviada
                  aparece en la columna derecha como outbound). */}
              {incomingStatus === "new" ? (
                <AIDraftBlock
                  incomingId={incomingId}
                  initialAiReply={aiReply}
                  clientKind={clientKind}
                />
              ) : null}
            </>
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
