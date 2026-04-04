/**
 * ============================================================================
 * COMPOSITOR DE RESPUESTAS AL CLIENTE
 * ============================================================================
 *
 * Este componente permite al equipo comercial redactar y enviar una respuesta
 * a un cliente que ha enviado una consulta. Es como un editor de mensajes
 * de correo electronico integrado en la aplicacion.
 *
 * QUE HACE:
 *   - Muestra un campo de texto con un borrador de respuesta pre-generado
 *     (puede venir de la IA o se genera uno por defecto)
 *   - El usuario puede modificar el texto libremente antes de enviarlo
 *   - Muestra a quien se enviara el mensaje (email del destinatario)
 *   - Si hay formulario asociado, muestra un enlace para revisarlo
 *   - Al pulsar "Enviar", envia el mensaje al webhook comercial via API
 *   - Muestra estados: enviando, enviado con exito, o error
 *
 * FLUJO:
 *   1. Se genera un mensaje inicial (de la IA o plantilla por defecto)
 *   2. El usuario lo revisa y edita si quiere
 *   3. Pulsa "Revisado. Enviar a cliente"
 *   4. La app envia los datos a la API (/api/consultas/[id]/send-client)
 *   5. Si todo va bien, redirige a la lista de quotations
 *
 * NOTA TECNICA: 'use client' porque necesita interactividad del navegador
 * (formulario, estados, llamada a API desde el navegador).
 * ============================================================================
 */

"use client"

// Funciones de React para manejar estados e interactividad
import { useMemo, useState } from "react"
// Funcion de Next.js para navegar entre paginas y refrescar datos
import { useRouter } from "next/navigation"
// Iconos decorativos para los botones y mensajes de estado
import { CheckCircle2, ExternalLink, LoaderCircle, Mail, Send } from "lucide-react"

// Componentes visuales reutilizables de la libreria shadcn/ui
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
// Utilidad para combinar clases CSS condicionalmente
import { cn } from "@/lib/utils"

/** Propiedades que recibe este componente */
type ClientReplyComposerProps = {
  query: {
    id: string                    // ID de la consulta en la base de datos
    codigo: string                // Codigo visible de la consulta
    asunto: string                // Asunto del mensaje original
    remitente: string             // Email del remitente/cliente
    urlFormulario: string | null  // URL del formulario del proyecto (si existe)
    clasificacion: string | null  // Tipo de consulta (puede estar vacia)
    cuerpoOriginal: string        // Texto original que envio el cliente
    respuestaIa: string | null    // Borrador de respuesta generado por IA (puede estar vacio)
  }
  compact?: boolean               // Si es true, usa un diseno mas compacto
}

/** Texto que la IA pone donde iria el enlace al formulario */
const FORM_INTAKE_PLACEHOLDER = '(Form intake here)'
/** Marcador que reemplaza al placeholder con texto legible para el cliente */
const FORM_LINK_MARKER = '[Acceder al formulario del proyecto]'

/**
 * Genera el mensaje inicial que se muestra en el campo de texto.
 * Si la IA ya genero un borrador (respuestaIa), lo usa como base.
 * Si no hay borrador de IA, genera una plantilla generica en ingles.
 * En ambos casos, reemplaza el placeholder del formulario por un enlace legible.
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

  // Si el correo no pudo ser catalogado por la IA ("Clasificacion pendiente"),
  // devolvemos una caja vacía para que el usuario escriba libremente,
  // ya que no procede enviarles el formulario de avión por defecto.
  if (query.clasificacion === 'Clasificacion pendiente') {
    return ""
  }

  // Si no hay borrador de IA pero SÍ es una solicitud de proyecto, 
  // generamos una plantilla por defecto pidiendo el formulario.
  const formMarker = query.urlFormulario ? FORM_LINK_MARKER : ''
  return [
    "Hello,",
    "",
    `Thank you for your inquiry regarding "${query.asunto}".`,
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
 * Componente principal del compositor de respuestas al cliente.
 * Muestra el editor de texto, el boton de envio y los mensajes de estado.
 */
export function ClientReplyComposer({
  query,
  compact = false,
}: ClientReplyComposerProps) {
  // Navegador de Next.js para redirigir y refrescar datos
  const router = useRouter()
  // Estado del mensaje: se inicializa con el borrador generado
  const [message, setMessage] = useState(() => buildInitialMessage(query))
  // Estado del envio: "idle" (en reposo), "submitting" (enviando), "success" o "error"
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  )
  // Mensaje de retroalimentacion que se muestra al usuario (exito o error)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Mensaje limpio sin espacios extra al inicio y al final
  const trimmedMessage = useMemo(() => message.trim(), [message])

  /**
   * Funcion que se ejecuta al pulsar el boton "Enviar".
   * Envia el mensaje al webhook comercial a traves de la API de la app.
   */
  async function handleSubmit() {
    if (!trimmedMessage) {
      setStatus("error")
      setFeedback("El mensaje al cliente no puede enviarse vacío.")
      return
    }

    setStatus("submitting")
    setFeedback(null)

    try {
      const response = await fetch(`/api/consultas/${query.id}/send-client`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedMessage,
          query: {
            codigo: query.codigo,
            asunto: query.asunto,
            remitente: query.remitente,
            urlFormulario: query.urlFormulario,
            clasificacion: query.clasificacion,
            cuerpoOriginal: query.cuerpoOriginal,
            respuestaIa: query.respuestaIa,
          },
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; warning?: string | null }
        | null

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo enviar el mensaje al cliente.")
      }

      setStatus("success")
      setFeedback(
        payload?.message ||
          `Consulta ${query.codigo} enviada correctamente al webhook de cliente.`,
      )
      router.push("/quotations")
      router.refresh()
    } catch (error) {
      setStatus("error")
      setFeedback(
        error instanceof Error
          ? error.message
          : "Se produjo un error inesperado al enviar el mensaje.",
      )
    }
  }

  return (
    <section className={compact ? "space-y-4" : "rounded-[28px] border border-emerald-200 bg-white p-6 shadow-[0_18px_40px_rgba(16,185,129,0.10)]"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
            Respuesta al cliente
          </p>
          <h2 className={cn("font-semibold text-slate-950", compact ? "text-base" : "text-lg")}>
            Revisado. Enviar a cliente
          </h2>
          <p className={cn("text-slate-600", compact ? "text-sm leading-6" : "text-sm leading-7")}>
            Puedes modificar libremente el contenido antes de enviarlo al cliente.
            El mensaje se mandará al webhook comercial y no se guardará todavía como
            acción persistente dentro de la app.
          </p>
        </div>

        <div
          className={cn(
            "rounded-2xl border border-emerald-100 bg-emerald-50/70 text-sm shadow-sm",
            compact ? "min-w-[200px] px-3 py-2.5" : "min-w-[220px] px-4 py-3",
          )}
        >
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 text-emerald-700" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700/80">
                Destinatario
              </p>
              <p className="mt-1 break-all font-medium text-slate-900">
                {query.remitente}
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
            "resize-y rounded-2xl border-slate-200 bg-slate-50/40 px-4 py-3 text-slate-800",
            compact ? "min-h-[180px] leading-6" : "min-h-[240px] leading-7",
          )}
          placeholder="Escribe aquí el mensaje final para el cliente..."
        />
      </div>

      {query.urlFormulario ? (
        <a
          href={query.urlFormulario}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-semibold text-sky-700 transition-colors hover:border-sky-300 hover:bg-sky-100"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ver formulario antes de enviar
        </a>
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
              Revisado. Enviar a cliente
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
