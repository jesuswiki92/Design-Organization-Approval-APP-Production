/**
 * ============================================================================
 * SECCION DE EMAILS — Layout lado a lado (entrante izquierda, saliente derecha)
 * ============================================================================
 *
 * Componente client que organiza los emails de la request en un layout
 * de dos columnas:
 *   - IZQUIERDA: emails entrantes del client (tarjetas azules)
 *   - DERECHA: responses enviadas (tarjetas verdes)
 *
 * Fuente de data (priority):
 *   1. Table doa_emails — si el array emails[] tiene elementos, se usa como
 *      fuente primary. Los emails se separan por address ('entrante' / 'saliente')
 *      y se muestran en sort_order cronologico por date en cada columna.
 *   2. Campos legacy de la request (sender, subject, original_body, etc.) —
 *      se usan como fallback cuando el array emails[] esta vacio, para mantener
 *      compatibilidad con requests antiguas que no tienen filas en doa_emails.
 *
 * Incluye una suscripcion Supabase Realtime para INSERTs en doa_emails
 * filtrados por incoming_request_id, de modo que nuevos emails aparecen automaticamente.
 *
 * Debajo de los emails se muestra el compositor de new response.
 * ============================================================================
 */

"use client"

import { useState, useMemo, useEffect } from "react"
import { ChevronDown, Inbox, Send, Mail, PenLine, Trash2 } from "lucide-react"
import DOMPurify from "isomorphic-dompurify"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { ClientReplyComposer } from "./ClientReplyComposer"
import type { DoaEmail } from "@/types/database"

// ---------------------------------------------------------------------------
// Sanitizacion de HTML de emails (XSS guard — audit C4)
// ---------------------------------------------------------------------------

/**
 * Tags permitidos al renderizar cuerpos de email como HTML.
 * Lista conservadora: formato basico, listas, tablas, imagenes y cabeceras.
 * NO se permiten: script, style, iframe, object, embed, form, input, etc.
 */
const EMAIL_ALLOWED_TAGS = [
  "a", "b", "i", "em", "strong", "u", "s", "br", "p", "div", "span",
  "ul", "ol", "li", "blockquote", "pre", "code",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th",
  "img", "hr", "sub", "sup",
] as const

/**
 * Atributos permitidos. Se mantiene `style` porque los emails externos
 * frecuentemente llevan estilos inline para tablas/firmas; DOMPurify los
 * sanea internamente bloqueando expresiones peligrosas.
 */
const EMAIL_ALLOWED_ATTR = [
  "href", "src", "alt", "title", "target", "rel",
  "class", "style", "colspan", "rowspan",
  "width", "height", "align", "valign",
] as const

/** Esquemas permitidos en href/src. Bloquea javascript:, data:, vbscript:, etc. */
const EMAIL_ALLOWED_URI_REGEXP = /^(https?:|mailto:|tel:|cid:|#)/i

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Data necesarios para renderizar la seccion de emails */
type CenterColumnCollapsibleProps = {
  /** Emails de la table doa_emails ordenados cronologicamente por date */
  emails?: DoaEmail[]
  query: {
    id: string
    codigo: string
    subject: string
    sender: string
    urlFormulario: string | null
    classification: string | null
    cuerpoOriginal: string
    respuestaIa: string | null
    creadoEn: string
    correoClienteEnviadoAt: string | null
    correoClienteEnviadoBy: string | null
    ultimoBorradorCliente: string | null
    replyBody: string | null
    replySentAt: string | null
  }
  /** Si true, no muestra el compositor de new response (usado cuando ya se send) */
  hideComposer?: boolean
}

/** Address del email */
type EmailDirection = "incoming" | "outgoing"

/** Un mensaje individual */
type ThreadEmail = {
  id: string
  direction: EmailDirection
  label: string
  contactLabel: string
  contactValue: string
  date: string | null
  body: string
  subject?: string
  /** Si true, el body es HTML y se renderiza como tal */
  isHtml?: boolean
  /** Si true, se puede eliminar (solo emails de doa_emails, no legacy) */
  isDeletable?: boolean
}

// ---------------------------------------------------------------------------
// Utilidades de formato
// ---------------------------------------------------------------------------

function formatDateSpanish(isoDate: string | null | undefined): string {
  if (!isoDate) return "Date no disponible"
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return "Date no disponible"
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

/** Extrae text drawing de HTML para mostrar como snippet colapsado */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
}

function buildSnippet(body: string, isHtml = false, maxLength = 100): string {
  const text = isHtml ? stripHtml(body) : body
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + "..."
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

/**
 * Tarjeta de email individual (colapsable).
 * Se adapta al lado en que esta (entrante = azul, saliente = verde).
 */
function EmailCard({
  email,
  isOpen,
  onToggle,
  onDelete,
}: {
  email: ThreadEmail
  isOpen: boolean
  onToggle: () => void
  onDelete?: (id: string) => void
}) {
  const isIncoming = email.direction === "incoming"

  // Sanitizar el body HTML del email antes de renderizarlo. Los emails
  // entrantes vienen de origen externo (Outlook/n8n), por lo que podrian
  // contener scripts maliciosos. DOMPurify limpia cualquier tag/atributo
  // no incluido en las listas blancas. Se memoiza por `email.body` para
  // evitar re-sanitizar en cada render.
  const looksLikeHtml = useMemo(
    () => /<\/?[a-z][\s\S]*?>/i.test(email.body ?? ""),
    [email.body],
  )

  const shouldRenderAsHtml = email.isHtml || looksLikeHtml

  const sanitizedBody = useMemo(() => {
    const raw = email.body ?? ""
    if (!raw) return ""
    const html = shouldRenderAsHtml ? raw : raw.replace(/\r?\n/g, "<br>")
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [...EMAIL_ALLOWED_TAGS],
      ALLOWED_ATTR: [...EMAIL_ALLOWED_ATTR],
      ALLOWED_URI_REGEXP: EMAIL_ALLOWED_URI_REGEXP,
    })
  }, [email.body, shouldRenderAsHtml])

  return (
    <div className="flex flex-col">
      {/* Cabecera clicable */}
      <div
        className={cn(
          "flex w-full items-start gap-3 rounded-2xl border bg-[color:var(--paper-2)] px-4 py-3 shadow-sm transition-colors hover:bg-[color:var(--paper-3)]/80",
          isIncoming
            ? "border-l-[3px] border-l-sky-400 border-t-slate-200 border-r-slate-200 border-b-slate-200"
            : "border-r-[3px] border-r-emerald-400 border-t-slate-200 border-l-slate-200 border-b-slate-200",
        )}
      >
        {/* Icono de address */}
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "mt-0.5 shrink-0 rounded-lg p-1.5",
            isIncoming ? "bg-[color:var(--paper)] text-[color:var(--ink-2)]" : "bg-emerald-100 text-emerald-600",
          )}
        >
          {isIncoming ? (
            <Inbox className="h-3.5 w-3.5" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Contenido textual */}
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
              {buildSnippet(email.body, email.isHtml)}
            </p>
          )}
        </button>

        {/* Acciones: papelera + chevron */}
        <div className="flex shrink-0 items-center gap-1">
          {email.isDeletable && onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(email.id)
              }}
              className="rounded-lg p-1.5 text-[color:var(--ink-3)] transition-colors hover:bg-red-50 hover:text-red-600"
              title="Eliminar email"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
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

      {/* Cuerpo expandido */}
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
          <div
            className="prose prose-sm max-w-none text-[color:var(--ink-2)] [overflow-wrap:break-word] [word-break:break-word] [&_a]:text-[color:var(--ink-3)] [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: sanitizedBody }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Placeholder para el lado derecho cuando no hay response sent todavia.
 */
function EmptyResponsePlaceholder() {
  return (
    <div className="flex h-full min-h-[100px] items-center justify-center rounded-2xl border-2 border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper)]/80 px-4 py-6">
      <div className="text-center">
        <Send className="mx-auto h-5 w-5 text-[color:var(--ink-3)]" />
        <p className="mt-2 text-xs font-medium text-[color:var(--ink-2)]">
          Sin response sent
        </p>
        <p className="mt-0.5 text-[10px] text-[color:var(--ink-3)]">
          Usa el compositor de abajo para responder
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente primary
// ---------------------------------------------------------------------------

export function CenterColumnCollapsible({ emails: initialEmails = [], query, hideComposer = false }: CenterColumnCollapsibleProps) {
  // --- Status local de emails para poder actualizar via Realtime ---
  const [liveEmails, setLiveEmails] = useState<DoaEmail[]>(initialEmails)

  // Sincronizar si las props cambian (navegacion, etc.)
  useEffect(() => {
    setLiveEmails(initialEmails)
  }, [initialEmails])

  // --- Suscripcion Realtime a INSERTs y DELETEs de emails de esta request ---
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`doa-emails-${query.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'doa_emails',
          filter: `incoming_request_id=eq.${query.id}`,
        },
        (payload) => {
          const newEmail = payload.new as DoaEmail
          setLiveEmails((prev) => {
            if (prev.some((e) => e.id === newEmail.id)) return prev
            const updated = [...prev, newEmail]
            updated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            return updated
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'doa_emails',
          filter: `incoming_request_id=eq.${query.id}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id?: string }).id
          if (deletedId) {
            setLiveEmails((prev) => prev.filter((e) => e.id !== deletedId))
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [query.id])

  // --- Eliminar email de doa_emails (optimista) ---
  async function handleDeleteEmail(emailId: string) {
    // Eliminacion optimista
    setLiveEmails((prev) => prev.filter((e) => e.id !== emailId))

    const supabase = createClient()
    const { error } = await supabase
      .from('doa_emails')
      .delete()
      .eq('id', emailId)

    if (error) {
      console.error('Error eliminando email:', {
        message: error.message,
        code: (error as { code?: string }).code,
        details: (error as { details?: string }).details,
        hint: (error as { hint?: string }).hint,
      })
      // Revertir: volver a cargar desde server
      // Nota: aliasear `from_addr`/`to_addr`/`sent_at` a los name del tipo DoaEmail.
      const { data } = await supabase
        .from('doa_emails')
        .select(
          'id, incoming_request_id, direction, from_email:from_addr, to_email:to_addr, subject, body, date:sent_at, message_id, in_reply_to, created_at',
        )
        .eq('incoming_request_id', query.id)
        .order('sent_at', { ascending: true })
      if (data) setLiveEmails(data as typeof liveEmails)
    }
  }

  // --- Determinar si usamos emails de doa_emails o fallback a campos legacy ---
  const useDoaEmails = liveEmails.length > 0

  // --- Construir listas de emails entrantes y salientes ---
  const { entrantes, salientes, totalEmails } = useMemo(() => {
    if (useDoaEmails) {
      // Usar emails de doa_emails
      const inc: ThreadEmail[] = liveEmails
        .filter((e) => e.direction === "entrante")
        .map((e) => ({
          id: e.id,
          direction: "incoming" as EmailDirection,
          label: "Incoming email",
          contactLabel: "From",
          contactValue: e.from_email,
          date: e.date,
          body: e.body,
          subject: e.subject,
          isDeletable: true,
        }))

      const out: ThreadEmail[] = liveEmails
        .filter((e) => e.direction === "saliente")
        .map((e) => ({
          id: e.id,
          direction: "outgoing" as EmailDirection,
          label: "Sent response",
          contactLabel: "To",
          contactValue: e.to_email ?? e.from_email,
          date: e.date,
          body: e.body,
          subject: e.subject,
          isHtml: true,
          isDeletable: true,
        }))

      return {
        entrantes: inc,
        salientes: out,
        totalEmails: inc.length + out.length,
      }
    }

    // Fallback: construir desde campos legacy de la request
    const legacyIncoming: ThreadEmail[] = [
      {
        id: "original",
        direction: "incoming" as EmailDirection,
        label: "Incoming email",
        contactLabel: "From",
        contactValue: query.sender,
        date: query.creadoEn,
        body: query.cuerpoOriginal,
        subject: query.subject,
      },
    ]

    const legacyOutgoing: ThreadEmail[] = []
    if (query.replyBody && query.replySentAt) {
      legacyOutgoing.push({
        id: "reply-saved",
        direction: "outgoing" as EmailDirection,
        label: "Sent response",
        contactLabel: "To",
        contactValue: query.sender,
        date: query.replySentAt,
        body: query.replyBody,
        isHtml: true,
      })
    } else if (query.correoClienteEnviadoAt && query.ultimoBorradorCliente) {
      legacyOutgoing.push({
        id: "response-sent",
        direction: "outgoing" as EmailDirection,
        label: "Sent response",
        contactLabel: "To",
        contactValue: query.sender,
        date: query.correoClienteEnviadoAt,
        body: query.ultimoBorradorCliente,
        isHtml: true,
      })
    }

    return {
      entrantes: legacyIncoming,
      salientes: legacyOutgoing,
      totalEmails: legacyIncoming.length + legacyOutgoing.length,
    }
  }, [useDoaEmails, liveEmails, query])

  // --- Status de apertura/closure de cada email ---
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({})
  const [composeOpen, setComposeOpen] = useState(true)

  function toggleEmail(id: string) {
    setOpenStates((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-4">
      {/* ================================================================
          CABECERA DE LA SECCION
          ================================================================ */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--paper-2)]">
          <Mail className="h-3 w-3 text-[color:var(--ink-3)]" />
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
          Hilo de comunicacion
        </h3>
        <span className="rounded-full bg-[color:var(--paper-2)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--ink-3)]">
          {totalEmails} {totalEmails === 1 ? "email" : "emails"}
        </span>
      </div>

      {/* ================================================================
          LEYENDA DE COLUMNAS
          ================================================================ */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-sky-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
            Emails del client
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">
            Nuestras responses
          </span>
        </div>
      </div>

      {/* ================================================================
          EMAILS — GRID 2 COLUMNAS (izquierda entrantes, derecha salientes)
          ================================================================ */}
      <div className="grid grid-cols-2 gap-4 items-start">
        {/* Columna izquierda: emails entrantes */}
        <div className="space-y-3">
          {entrantes.length > 0 ? (
            entrantes.map((email) => (
              <EmailCard
                key={email.id}
                email={email}
                isOpen={openStates[email.id] ?? false}
                onToggle={() => toggleEmail(email.id)}
                onDelete={handleDeleteEmail}
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

        {/* Columna derecha: responses salientes */}
        <div className="space-y-3">
          {salientes.length > 0 ? (
            salientes.map((email) => (
              <EmailCard
                key={email.id}
                email={email}
                isOpen={openStates[email.id] ?? false}
                onToggle={() => toggleEmail(email.id)}
                onDelete={handleDeleteEmail}
              />
            ))
          ) : (
            <EmptyResponsePlaceholder />
          )}
        </div>
      </div>

      {/* ================================================================
          COMPOSITOR DE NUEVA RESPUESTA
          ================================================================ */}
      {!hideComposer && (
        <div>
          <button
            type="button"
            onClick={() => setComposeOpen((prev) => !prev)}
            className="flex w-full items-start gap-3 rounded-2xl border border-l-[3px] border-l-amber-400 border-t-slate-200 border-r-slate-200 border-b-slate-200 bg-[color:var(--paper)] px-4 py-3 text-left shadow-sm transition-colors hover:bg-[color:var(--paper-3)]/80"
          >
            <div className="mt-0.5 shrink-0 rounded-lg bg-amber-50 p-1.5 text-amber-500">
              <PenLine className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-500">
                New response
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-950">
                Redactar y send response
              </p>
              {!composeOpen && (
                <p className="mt-1 text-xs leading-5 text-[color:var(--ink-3)] italic">
                  Pulsa para abrir el editor de response y send al client.
                </p>
              )}
            </div>
            <ChevronDown
              className={cn(
                "mt-1 h-4 w-4 shrink-0 text-[color:var(--ink-3)] transition-transform duration-200",
                composeOpen && "rotate-180",
              )}
            />
          </button>

          {composeOpen && (
            <div className="mt-2">
              <ClientReplyComposer
                compact
                query={{
                  id: query.id,
                  codigo: query.codigo,
                  subject: query.subject,
                  sender: query.sender,
                  urlFormulario: query.urlFormulario,
                  classification: query.classification,
                  cuerpoOriginal: query.cuerpoOriginal,
                  respuestaIa: query.respuestaIa,
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
