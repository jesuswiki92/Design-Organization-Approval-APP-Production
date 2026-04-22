/**
 * ============================================================================
 * COMPOSITOR DE RESPUESTAS AL CLIENTE
 * ============================================================================
 *
 * Este componente permite al equipo commercial redactar y send una response
 * a un client que ha sent una request. Es como un editor de mensajes
 * de email electronico integrado en la aplicacion.
 *
 * QUE HACE:
 *   - Muestra un campo de text con un borrador de response pre-generado
 *     (puede venir de la IA o se genera uno por defecto)
 *   - El user_label puede modificar el text libremente antes de enviarlo
 *   - Muestra a quien se enviara el mensaje (email del destinatario)
 *   - Si hay form asociado, muestra un enlace para revisarlo
 *   - Al pulsar "Send", envia el mensaje al webhook commercial via API
 *   - Muestra statuses: sending, sent con exito, o error
 *
 * FLUJO:
 *   1. Se genera un mensaje inicial (de la IA o template por defecto)
 *   2. El user_label lo revisa y edita si quiere
 *   3. Pulsa "Reviewed. Send to client"
 *   4. La app envia los data a la API (/api/incoming-requests/[id]/send-client)
 *   5. Si todo va bien, redirige a la lista de quotations
 *
 * NOTA TECNICA: 'use client' porque necesita interactividad del navegador
 * (form, statuses, llamada a API desde el navegador).
 * ============================================================================
 */

"use client"

// Funciones de React para manejar statuses e interactividad
import { useMemo, useState } from "react"
// Funcion de Next.js para navegar entre paginas y refrescar data
import { useRouter } from "next/navigation"
// Iconos decorativos para los botones y mensajes de status
import { CheckCircle2, ExternalLink, LoaderCircle, Mail, Send, Trash2, Undo2 } from "lucide-react"

// Componentes visuales reutilizables de la libreria shadcn/ui
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
// Utilidad para combinar clases CSS condicionalmente
import { cn } from "@/lib/utils"

/** Propiedades que recibe este componente */
type ClientReplyComposerProps = {
  query: {
    id: string                    // ID de la request en la base de data
    codigo: string                // Codigo visible de la request
    subject: string                // Subject del mensaje original
    sender: string             // Email del sender/client
    urlFormulario: string | null  // URL del form del project (si existe)
    classification: string | null  // Tipo de request (puede estar vacia)
    cuerpoOriginal: string        // Texto original que send el client
    respuestaIa: string | null    // Borrador de response generado por IA (puede estar vacio)
  }
  compact?: boolean               // Si es true, usa un diseno mas compacto
}

/** Texto que la IA pone donde iria el enlace al form */
const FORM_INTAKE_PLACEHOLDER = '(Form intake here)'
/** Marcador que reemplaza al placeholder con text legible para el client */
const FORM_LINK_MARKER = '[Acceder al formulario del proyecto]'

/**
 * Genera el mensaje inicial que se muestra en el campo de text.
 * Si la IA ya genero un borrador (respuestaIa), lo usa como base.
 * Si no hay borrador de IA, genera una template generica en ingles.
 * En ambos casos, reemplaza el placeholder del form por un enlace legible.
 */
function buildInitialMessage(query: ClientReplyComposerProps["query"]) {
  const aiDraft = query.respuestaIa?.trim()

  // Si hay borrador de IA, usarlo (reemplazando el placeholder si existe)
  if (aiDraft) {
    if (aiDraft.includes(FORM_INTAKE_PLACEHOLDER)) {
      return aiDraft.replace(FORM_INTAKE_PLACEHOLDER, FORM_LINK_MARKER)
    }
    return aiDraft
  }

  // Si el email no pudo ser catalogado por la IA ("Classification pending"),
  // devolvemos una caja vacía para que el user_label escriba libremente,
  // ya que no procede enviarles el form de avión por defecto.
  if (query.classification === 'Classification pending') {
    return ""
  }

  // Si no hay borrador de IA pero SÍ es una solicitud de project,
  // generamos una template por defecto pidiendo el form.
  const formMarker = query.urlFormulario ? FORM_LINK_MARKER : ''
  return [
    "Hello,",
    "",
    `Thank you for your inquiry regarding "${query.subject}".`,
    "",
    `To proceed, please complete our project intake form: ${formMarker}`,
    "",
    "Once submitted, our team will review the information and get back to you with the next steps.",
    "",
    "Kind regards,",
    "DOA Operations Hub",
  ].join("\n")
}

/**
 * Componente primary del compositor de responses al client.
 * Muestra el editor de text, el boton de send y los mensajes de status.
 */
export function ClientReplyComposer({
  query,
  compact = false,
}: ClientReplyComposerProps) {
  // Navegador de Next.js para redirigir y refrescar data
  const router = useRouter()
  // Status del mensaje: se inicializa con el borrador generado
  const [message, setMessage] = useState(() => buildInitialMessage(query))
  // Status del send: "idle" (en reposo), "submitting" (sending), "success" o "error"
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  )
  // Mensaje de retroalimentacion que se muestra al user_label (exito o error)
  const [feedback, setFeedback] = useState<string | null>(null)
  // Status para controlar si el form ha sido eliminado del email
  const [formRemoved, setFormRemoved] = useState(false)
  // Respaldo del mensaje antes de quitar el form (para deshacer)
  const [messageBeforeRemoval, setMessageBeforeRemoval] = useState<string | null>(null)

  // Mensaje limpio sin espacios extra al started_at y al final
  const trimmedMessage = useMemo(() => message.trim(), [message])

  /**
   * Elimina el marcador del form del body del mensaje y oculta
   * el boton "Ver form". Guarda una copia del mensaje original
   * para poder deshacer la accion.
   */
  function handleRemoveForm() {
    setMessageBeforeRemoval(message)
    // Eliminar el marcador del form y limpiar lineas vacias sobrantes
    const cleaned = message
      .replace(FORM_LINK_MARKER, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    setMessage(cleaned)
    setFormRemoved(true)
  }

  /**
   * Deshace la eliminacion del form restaurando el mensaje original
   * y volviendo a mostrar el boton "Ver form".
   */
  function handleUndoRemoveForm() {
    if (messageBeforeRemoval !== null) {
      setMessage(messageBeforeRemoval)
    }
    setMessageBeforeRemoval(null)
    setFormRemoved(false)
  }

  /**
   * Funcion que se ejecuta al pulsar el boton "Send".
   * Envia el mensaje al webhook commercial a traves de la API de la app.
   */
  async function handleSubmit() {
    if (!trimmedMessage) {
      setStatus("error")
      setFeedback("El mensaje al client no puede enviarse vacío.")
      return
    }

    setStatus("submitting")
    setFeedback(null)

    try {
      const response = await fetch(`/api/incoming-requests/${query.id}/send-client`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedMessage,
          query: {
            codigo: query.codigo,
            subject: query.subject,
            sender: query.sender,
            // Si el user_label quito el form, send null para que la API no lo incluya
            urlFormulario: formRemoved ? null : query.urlFormulario,
            classification: query.classification,
            cuerpoOriginal: query.cuerpoOriginal,
            respuestaIa: query.respuestaIa,
          },
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; warning?: string | null }
        | null

      if (!response.ok) {
        throw new Error(payload?.error || "Could not send the message to the client.")
      }

      setStatus("success")
      setFeedback(
        payload?.message ||
          `Request ${query.codigo} sent correctamente al webhook de client.`,
      )
      router.push("/quotations")
      router.refresh()
    } catch (error) {
      setStatus("error")
      setFeedback(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while sending the message.",
      )
    }
  }

  return (
    <section className={compact ? "space-y-4" : "rounded-[28px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-6 shadow-[0_18px_40px_rgba(74,60,36,0.08)]"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--umber)]">
            Response al client
          </p>
          <h2 className={cn("font-semibold text-[color:var(--ink)]", compact ? "text-base" : "text-lg")}>
            Reviewed. Send to client
          </h2>
          <p className={cn("text-[color:var(--ink-3)]", compact ? "text-sm leading-6" : "text-sm leading-7")}>
            You can freely edit the content before sending it to the client.
            El mensaje se mandará al webhook commercial y no se guardará todavía como
            acción persistente dentro de la app.
          </p>
        </div>

        <div
          className={cn(
            "rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-sm shadow-sm",
            compact ? "min-w-[200px] px-3 py-2.5" : "min-w-[220px] px-4 py-3",
          )}
        >
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 text-[color:var(--umber)]" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                Destinatario
              </p>
              <p className="mt-1 break-all font-medium text-[color:var(--ink)]">
                {query.sender}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <Textarea
          value={message}
          onChange={(event) => {
            setMessage(event.target.value)
            if (status !== "idle") {
              setStatus("idle")
              setFeedback(null)
            }
          }}
          className={cn(
            "resize-y rounded-2xl border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/40 px-4 py-3 text-[color:var(--ink-2)]",
            compact ? "min-h-[180px] leading-6" : "min-h-[240px] leading-7",
          )}
          placeholder="Escribe aquí el mensaje final para el client..."
        />
      </div>

      {/* Boton para ver el form + boton para eliminarlo del email */}
      {query.urlFormulario && !formRemoved ? (
        <div className="mt-3 flex items-center gap-2">
          <a
            href={query.urlFormulario}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-2.5 text-xs font-semibold text-[color:var(--ink-2)] transition-colors hover:border-[color:var(--ink-4)] hover:bg-[color:var(--paper-3)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View form before sending
          </a>
          <button
            type="button"
            onClick={handleRemoveForm}
            title="Quitar form del email"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition-colors hover:border-red-300 hover:bg-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {/* Aviso y opcion de deshacer tras quitar el form */}
      {query.urlFormulario && formRemoved ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <span className="font-medium">Form removed from the email.</span>
          <button
            type="button"
            onClick={handleUndoRemoveForm}
            className="ml-1 inline-flex items-center gap-1 font-semibold text-amber-700 underline underline-offset-2 transition-colors hover:text-amber-900"
          >
            <Undo2 className="h-3 w-3" />
            Deshacer
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">

        <Button onClick={handleSubmit} disabled={status === "submitting" || !trimmedMessage}>
          {status === "submitting" ? (
            <>
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Reviewed. Send to client
            </>
          )}
        </Button>
      </div>

      {feedback ? (
        <div
          className={`mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
            status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {status === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p>{feedback}</p>
        </div>
      ) : null}
    </section>
  )
}
