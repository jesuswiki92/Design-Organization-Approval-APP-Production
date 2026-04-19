'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  FileText,
  Send,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type ChatRole = 'user' | 'assistant'

type Message = {
  id: string
  role: ChatRole
  content: string
}

const SUGGESTED_QUESTIONS = [
  'Resume los pasos para preparar una quotation DOA para un cliente nuevo.',
  'Que estados de proyecto deberiamos usar para un expediente de certificacion?',
  'Ayudame a redactar una respuesta inicial para una solicitud tecnica de cliente.',
]

const WELCOME_MESSAGE =
  'Asistente DOA (via LiteLLM gateway). Puedo ayudarte con quotations, estados de proyecto, procedimientos y soporte operativo general.'

const DEFAULT_MODEL_LABEL = 'llm-default'

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function parseSseChunk(chunk: string) {
  const [eventLine, ...dataLines] = chunk.split('\n')
  const event = eventLine.startsWith('event:') ? eventLine.slice(6).trim() : 'message'
  const data = dataLines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n')

  return { event, data }
}

export default function CertificationExpertPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: WELCOME_MESSAGE,
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentModel, setCurrentModel] = useState(DEFAULT_MODEL_LABEL)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) {
      return
    }

    container.scrollTop = container.scrollHeight
  }, [messages, isLoading])

  async function sendQuestion(question: string) {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || isLoading) {
      return
    }

    const userMessage: Message = {
      id: createId(),
      role: 'user',
      content: trimmedQuestion,
    }
    const assistantMessage: Message = {
      id: createId(),
      role: 'assistant',
      content: '',
    }

    setMessages((current) => [...current, userMessage, assistantMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      const history = messages
        .filter((message) => message.id !== 'welcome')
        .map((message) => ({
          role: message.role,
          content: message.content,
        }))

      const response = await fetch('/api/tools/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          history,
        }),
      })

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || 'No se pudo obtener respuesta del asistente.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })

        while (buffer.includes('\n\n')) {
          const separatorIndex = buffer.indexOf('\n\n')
          const rawEvent = buffer.slice(0, separatorIndex).trim()
          buffer = buffer.slice(separatorIndex + 2)

          if (!rawEvent) {
            continue
          }

          const { event, data } = parseSseChunk(rawEvent)
          const parsed = data
            ? (JSON.parse(data) as {
                answer?: string
                token?: string
                error?: string
                model?: string
              })
            : {}

          if (event === 'meta' && parsed.model) {
            setCurrentModel(parsed.model)
            continue
          }

          if (event === 'token' && parsed.token) {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, content: `${message.content}${parsed.token}` }
                  : message,
              ),
            )
            continue
          }

          if (event === 'done') {
            const answer = parsed.answer

            if (answer) {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantMessage.id && !message.content
                    ? { ...message, content: answer }
                    : message,
                ),
              )
            }
            continue
          }

          if (event === 'error') {
            throw new Error(parsed.error || 'Se produjo un error durante el streaming.')
          }
        }
      }
    } catch (streamError) {
      const message =
        streamError instanceof Error ? streamError.message : 'Error inesperado consultando al asistente.'

      setMessages((current) =>
        current.map((entry) =>
          entry.id === assistantMessage.id
            ? {
                ...entry,
                content: entry.content || 'No he podido completar la respuesta en este momento.',
              }
            : entry,
        ),
      )
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleSubmit() {
    void sendQuestion(input)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Asistente DOA" subtitle="Chat operativo general con OpenRouter" />

      <div className="flex min-h-0 flex-1 flex-col gap-6 p-6 xl:grid xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-sky-200 bg-white shadow-[0_18px_45px_rgba(148,163,184,0.16)]">
          <div className="flex items-center justify-between border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_55%,#e0f2fe_100%)] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-950">
                  DOA AI Desk
                </h2>
                <p className="text-sm text-slate-500">
                  Chat directo para soporte operativo, quotations y estados de proyecto.
                </p>
              </div>
            </div>

            <div className="hidden rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-700 md:block">
              OpenRouter + Claude Sonnet 4
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            {messages.length === 1 && (
              <div className="rounded-[24px] border border-dashed border-sky-200 bg-sky-50/50 p-6">
                <p className="max-w-2xl text-sm leading-7 text-slate-600">
                  Formula una consulta operativa sobre quotations, estados de proyecto, procesos
                  DOA o ayuda de redaccion. Esta version es un chat directo con OpenRouter y no
                  consulta base de datos ni documentos internos.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => {
                        void sendQuestion(question)
                      }}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => {
              const isAssistant = message.role === 'assistant'
              const showLoadingDots = isLoading && message.id === messages[messages.length - 1]?.id && !message.content

              return (
                <div
                  key={message.id}
                  className={`flex items-start gap-4 ${isAssistant ? '' : 'justify-end'}`}
                >
                  {isAssistant && (
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-3xl rounded-[24px] border px-5 py-4 ${
                      isAssistant
                        ? 'border-slate-200 bg-white text-slate-900 shadow-sm'
                        : 'border-transparent bg-[linear-gradient(135deg,#2563EB,#38BDF8)] text-white'
                    }`}
                  >
                    <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      {isAssistant ? 'Asistente' : 'Usuario'}
                    </div>

                    <div className="whitespace-pre-wrap text-sm leading-7">{message.content}</div>

                    {showLoadingDots && (
                      <div className="mt-3 flex items-center gap-1 text-slate-400">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:-0.2s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:-0.1s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500" />
                      </div>
                    )}
                  </div>

                  {!isAssistant && (
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="border-t border-slate-200 px-6 py-5">
            {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-3 shadow-sm">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    handleSubmit()
                  }
                }}
                placeholder="Escribe tu consulta para el asistente DOA..."
                className="min-h-24 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-7 text-slate-950 placeholder:text-slate-400 focus-visible:ring-0"
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Enter para enviar. Shift + Enter para nueva linea.
                </p>

                <Button
                  onClick={handleSubmit}
                  disabled={isLoading || input.trim().length === 0}
                  className="h-11 rounded-2xl bg-[linear-gradient(135deg,#2563EB,#38BDF8)] px-5 text-sm font-medium text-white hover:opacity-90"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        </section>

        <aside className="flex min-h-[320px] flex-col overflow-hidden rounded-[28px] border border-sky-200 bg-white shadow-[0_18px_45px_rgba(148,163,184,0.16)]">
          <div className="flex items-center justify-between border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_100%)] px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Capacidades actuales</h3>
                <p className="text-xs text-slate-500">Lo que hace hoy este asistente</p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Modelo</div>
              <p className="mt-2 text-sm font-semibold text-slate-950">{currentModel}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Respuesta conversacional general para soporte DOA, quotations y proyectos.
              </p>
            </article>

            <article className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                Alcance
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>Soporte general en quotations y workflow operativo.</li>
                <li>Ayuda de redaccion y estructuracion inicial de respuestas.</li>
                <li>No consulta base de datos ni documentos internos todavia.</li>
              </ul>
            </article>

            <article className="rounded-[22px] border border-dashed border-sky-200 bg-sky-50/50 p-4 text-sm leading-6 text-slate-600">
              Si mas adelante conectamos RAG o contexto documental, ese bloque se incorporara aqui
              de forma explicita en lugar de simular “fuentes” inexistentes.
            </article>
          </div>
        </aside>
      </div>
    </div>
  )
}
