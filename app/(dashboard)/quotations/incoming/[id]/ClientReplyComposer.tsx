"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, LoaderCircle, Mail, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type ClientReplyComposerProps = {
  query: {
    id: string
    codigo: string
    asunto: string
    remitente: string
    clasificacion: string | null
    cuerpoOriginal: string
    respuestaIa: string | null
  }
  compact?: boolean
}

function buildInitialMessage(query: ClientReplyComposerProps["query"]) {
  const aiDraft = query.respuestaIa?.trim()

  if (aiDraft) {
    return aiDraft
  }

  return [
    "Hola,",
    "",
    `Hemos revisado tu consulta sobre "${query.asunto}".`,
    "Gracias por compartir la información inicial.",
    "",
    "En una siguiente interacción te contactaremos con los datos necesarios para avanzar con el análisis comercial y técnico.",
    "",
    "Un saludo,",
    "DOA Operations Hub",
  ].join("\n")
}

export function ClientReplyComposer({
  query,
  compact = false,
}: ClientReplyComposerProps) {
  const router = useRouter()
  const [message, setMessage] = useState(() => buildInitialMessage(query))
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  )
  const [feedback, setFeedback] = useState<string | null>(null)

  const trimmedMessage = useMemo(() => message.trim(), [message])

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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className={cn("text-slate-500", compact ? "text-[11px]" : "text-xs")}>
          El payload incluirá la consulta, la clasificación, el mensaje final y el
          borrador IA si existe.
        </p>

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
