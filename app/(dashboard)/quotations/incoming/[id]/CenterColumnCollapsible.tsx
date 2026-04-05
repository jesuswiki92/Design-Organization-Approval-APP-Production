/**
 * ============================================================================
 * COLUMNA CENTRAL — Hilo de comunicacion con el cliente
 * ============================================================================
 *
 * Componente cliente que organiza la columna central de la vista de detalle
 * de consulta como un HILO DE COMUNICACION (timeline vertical de emails).
 *
 * Estructura del hilo:
 *   1. Correo entrante — el email original del cliente (colapsado por defecto)
 *   2. Respuesta enviada — si ya se envio una respuesta (colapsado, solo si existe)
 *   3. Nueva respuesta — el compositor para redactar y enviar (expandido)
 *
 * Cada email del hilo es una tarjeta colapsable con:
 *   - Icono de direccion (entrante/saliente)
 *   - Fecha y hora formateada en espanol
 *   - Remitente o destinatario
 *   - Snippet del cuerpo cuando esta colapsado
 *   - Texto completo cuando esta expandido
 *   - Borde lateral coloreado (azul = entrante, verde = saliente)
 *
 * Una linea vertical conecta las tarjetas como timeline.
 *
 * Disenado con estructura de array para facilitar la adicion de mas
 * mensajes en el futuro (threading completo).
 * ============================================================================
 */

"use client"

import { useState, useMemo } from "react"
import { ChevronDown, Inbox, Send, Mail, PenLine } from "lucide-react"
import { cn } from "@/lib/utils"
import { ClientReplyComposer } from "./ClientReplyComposer"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Datos necesarios para renderizar el hilo completo */
type CenterColumnCollapsibleProps = {
  query: {
    id: string
    codigo: string
    asunto: string
    remitente: string
    urlFormulario: string | null
    clasificacion: string | null
    cuerpoOriginal: string
    respuestaIa: string | null
    // Campos de fecha y respuesta para el hilo de comunicacion
    creadoEn: string
    correoClienteEnviadoAt: string | null
    correoClienteEnviadoBy: string | null
    ultimoBorradorCliente: string | null
  }
}

/** Direccion del email en el hilo */
type EmailDirection = "incoming" | "outgoing"

/** Un mensaje individual dentro del hilo de comunicacion */
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
// Utilidades de formato
// ---------------------------------------------------------------------------

/**
 * Formatea un ISO timestamp a un formato legible en espanol.
 * Ejemplo: "05 abr 2026, 11:01"
 */
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

/**
 * Genera un snippet del cuerpo del email (primeros ~80 caracteres).
 */
function buildSnippet(body: string, maxLength = 80): string {
  if (body.length <= maxLength) return body
  return body.slice(0, maxLength).trimEnd() + "..."
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

/**
 * Cabecera clicable de un email en el hilo.
 * Muestra icono, etiqueta de direccion, fecha, contacto, snippet y chevron.
 */
function ThreadEmailHeader({
  email,
  isOpen,
  onToggle,
}: {
  email: ThreadEmail
  isOpen: boolean
  onToggle: () => void
}) {
  const isIncoming = email.direction === "incoming"

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition-colors hover:bg-slate-50/80",
        // Borde lateral coloreado segun la direccion
        isIncoming
          ? "border-l-[3px] border-l-sky-400 border-t-slate-200 border-r-slate-200 border-b-slate-200"
          : "border-l-[3px] border-l-emerald-400 border-t-slate-200 border-r-slate-200 border-b-slate-200",
      )}
    >
      {/* Icono de direccion */}
      <div
        className={cn(
          "mt-0.5 shrink-0 rounded-lg p-1.5",
          isIncoming ? "bg-sky-50 text-sky-500" : "bg-emerald-50 text-emerald-500",
        )}
      >
        {isIncoming ? (
          <Inbox className="h-3.5 w-3.5" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
      </div>

      {/* Contenido textual */}
      <div className="min-w-0 flex-1">
        {/* Etiqueta de direccion + fecha en la misma fila */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-[0.16em]",
              isIncoming ? "text-sky-500" : "text-emerald-500",
            )}
          >
            {email.label}
          </p>
          {email.date && (
            <p className="text-[10px] text-slate-400">
              {formatDateSpanish(email.date)}
            </p>
          )}
        </div>

        {/* Asunto (solo para el correo original) */}
        {email.subject && (
          <p className="mt-0.5 text-sm font-semibold text-slate-950">
            {email.subject}
          </p>
        )}

        {/* Contacto: De / A */}
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <Mail className="h-3 w-3 shrink-0" />
          <span className="font-medium text-slate-400">{email.contactLabel}:</span>
          {email.contactValue}
        </p>

        {/* Snippet visible solo cuando esta colapsado */}
        {!isOpen && (
          <p className="mt-1.5 line-clamp-1 text-xs leading-5 text-slate-400 italic">
            {buildSnippet(email.body)}
          </p>
        )}
      </div>

      {/* Chevron animado */}
      <ChevronDown
        className={cn(
          "mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
          isOpen && "rotate-180",
        )}
      />
    </button>
  )
}

/**
 * Cuerpo expandido de un email en el hilo.
 */
function ThreadEmailBody({
  email,
}: {
  email: ThreadEmail
}) {
  const isIncoming = email.direction === "incoming"

  return (
    <div
      className={cn(
        "mt-2 rounded-2xl border p-4",
        isIncoming
          ? "border-sky-100 bg-sky-50/30"
          : "border-emerald-100 bg-emerald-50/30",
      )}
    >
      {/* Fecha repetida en el cuerpo expandido para referencia rapida */}
      {email.date && (
        <p className="mb-3 text-[11px] font-medium text-slate-400">
          {formatDateSpanish(email.date)}
        </p>
      )}
      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
        {email.body}
      </p>
    </div>
  )
}

/**
 * Indicador de timeline: una linea vertical con un punto conector.
 * Se muestra entre los items del hilo.
 */
function TimelineConnector() {
  return (
    <div className="flex justify-start pl-[26px]">
      <div className="h-4 w-px bg-slate-200" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Columna central con hilo de comunicacion tipo timeline.
 */
export function CenterColumnCollapsible({ query }: CenterColumnCollapsibleProps) {
  // --- Construir el array de emails del hilo ---
  const threadEmails = useMemo(() => {
    const emails: ThreadEmail[] = []

    // 1. Correo entrante original (siempre presente)
    emails.push({
      id: "original",
      direction: "incoming",
      label: "Correo entrante",
      contactLabel: "De",
      contactValue: query.remitente,
      date: query.creadoEn,
      body: query.cuerpoOriginal,
      subject: query.asunto,
    })

    // 2. Respuesta enviada (solo si se envio una respuesta)
    if (query.correoClienteEnviadoAt && query.ultimoBorradorCliente) {
      emails.push({
        id: "response-sent",
        direction: "outgoing",
        label: "Respuesta enviada",
        contactLabel: "A",
        contactValue: query.remitente,
        date: query.correoClienteEnviadoAt,
        body: query.ultimoBorradorCliente,
      })
    }

    return emails
  }, [query])

  // --- Estado de apertura/cierre de cada email del hilo ---
  // Todos colapsados por defecto
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({})

  // El compositor de respuesta siempre esta abierto por defecto
  const [composeOpen, setComposeOpen] = useState(true)

  /** Alterna el estado de apertura de un email por su id */
  function toggleEmail(id: string) {
    setOpenStates((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Calcular el total de emails para la cabecera del hilo
  const emailCount = threadEmails.length

  return (
    <div className="space-y-0">
      {/* ================================================================
          CABECERA DEL HILO
          ================================================================ */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
          <Mail className="h-3 w-3 text-slate-500" />
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Hilo de comunicación
        </h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {emailCount} {emailCount === 1 ? "email" : "emails"}
        </span>
      </div>

      {/* ================================================================
          TIMELINE DE EMAILS
          ================================================================ */}
      <div className="relative">
        {/* Linea vertical del timeline (posicionada detras de las tarjetas) */}
        <div className="absolute left-[26px] top-0 bottom-0 w-px bg-slate-200" />

        <div className="relative space-y-0">
          {threadEmails.map((email, index) => {
            const isOpen = openStates[email.id] ?? false

            return (
              <div key={email.id}>
                {/* Conector entre items (no antes del primero) */}
                {index > 0 && <TimelineConnector />}

                {/* Tarjeta del email */}
                <div className="relative">
                  <ThreadEmailHeader
                    email={email}
                    isOpen={isOpen}
                    onToggle={() => toggleEmail(email.id)}
                  />
                  {isOpen && <ThreadEmailBody email={email} />}
                </div>
              </div>
            )
          })}

          {/* ================================================================
              CONECTOR + SECCION DE NUEVA RESPUESTA (compositor)
              ================================================================ */}
          <TimelineConnector />

          <div className="relative">
            {/* Cabecera colapsable del compositor */}
            <button
              type="button"
              onClick={() => setComposeOpen((prev) => !prev)}
              className="flex w-full items-start gap-3 rounded-2xl border border-l-[3px] border-l-amber-400 border-t-slate-200 border-r-slate-200 border-b-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:bg-slate-50/80"
            >
              {/* Icono de composicion */}
              <div className="mt-0.5 shrink-0 rounded-lg bg-amber-50 p-1.5 text-amber-500">
                <PenLine className="h-3.5 w-3.5" />
              </div>

              {/* Texto */}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-500">
                  Nueva respuesta
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-950">
                  Redactar y enviar respuesta
                </p>
                {!composeOpen && (
                  <p className="mt-1 text-xs leading-5 text-slate-400 italic">
                    Pulsa para abrir el editor de respuesta y enviar al cliente.
                  </p>
                )}
              </div>

              {/* Chevron */}
              <ChevronDown
                className={cn(
                  "mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
                  composeOpen && "rotate-180",
                )}
              />
            </button>

            {/* Contenido expandido: el compositor de respuesta */}
            {composeOpen && (
              <div className="mt-2">
                <ClientReplyComposer
                  compact
                  query={{
                    id: query.id,
                    codigo: query.codigo,
                    asunto: query.asunto,
                    remitente: query.remitente,
                    urlFormulario: query.urlFormulario,
                    clasificacion: query.clasificacion,
                    cuerpoOriginal: query.cuerpoOriginal,
                    respuestaIa: query.respuestaIa,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
