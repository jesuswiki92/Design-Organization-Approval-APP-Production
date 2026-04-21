'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, PanelRightOpen, Send, Sparkles, User } from 'lucide-react'

import type { PreliminaryScopeModel } from '@/lib/quotations/build-preliminary-scope-model'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type ChatRole = 'assistant' | 'user'

type ChatMessage = {
  content: string
  id: string
  role: ChatRole
}

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4'

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

function buildWelcomeMessage(model: PreliminaryScopeModel) {
  return `Chat contextual para esta fase de alcance. Contexto activo: ${model.context.clientLabel}, ${model.context.aircraftLabel}, precedente base ${model.context.chosenReferenceLabel}.`
}

export function PreliminaryScopeChatPanel({
  consultaId,
  model,
}: {
  consultaId: string
  model: PreliminaryScopeModel
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      content: buildWelcomeMessage(model),
      id: 'welcome',
      role: 'assistant',
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentModel, setCurrentModel] = useState(DEFAULT_MODEL)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [messages, isLoading])

  async function sendQuestion(question: string) {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || isLoading) return

    const userMessage: ChatMessage = {
      content: trimmedQuestion,
      id: createId(),
      role: 'user',
    }
    const assistantMessage: ChatMessage = {
      content: '',
      id: createId(),
      role: 'assistant',
    }

    setMessages((current) => [...current, userMessage, assistantMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      const history = messages
        .filter((message) => message.id !== 'welcome')
        .map((message) => ({
          content: message.content,
          role: message.role,
        }))

      const response = await fetch(`/api/consultas/${consultaId}/preliminary-scope/chat`, {
        body: JSON.stringify({
          history,
          question: trimmedQuestion,
          selectedReferenceId: model.context.chosenReferenceId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || 'No se pudo obtener respuesta contextual.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        while (buffer.includes('\n\n')) {
          const separatorIndex = buffer.indexOf('\n\n')
          const rawEvent = buffer.slice(0, separatorIndex).trim()
          buffer = buffer.slice(separatorIndex + 2)

          if (!rawEvent) continue

          const { data, event } = parseSseChunk(rawEvent)
          const parsed = data
            ? (JSON.parse(data) as {
                answer?: string
                error?: string
                model?: string
                token?: string
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

          if (event === 'done' && parsed.answer) {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessage.id && !message.content
                  ? { ...message, content: parsed.answer as string }
                  : message,
              ),
            )
            continue
          }

          if (event === 'error') {
            throw new Error(parsed.error || 'Se produjo un error durante el streaming.')
          }
        }
      }
    } catch (streamError) {
      const message =
        streamError instanceof Error
          ? streamError.message
          : 'Error inesperado consultando el copiloto.'

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

  return (
    <aside className="flex min-h-[680px] flex-col overflow-hidden rounded-[28px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-[0_18px_40px_rgba(148,163,184,0.14)] xl:sticky xl:top-6">
      <div className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-5 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--ink-4)] bg-[#0B1220] text-[color:var(--ink-3)]">
            <PanelRightOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
              Copiloto de alcance
            </div>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">
              Chat contextual para esta quotation
            </h3>
            <p className="mt-2 text-sm leading-6 text-[color:var(--ink-3)]">
              Usa datos de la consulta actual, la lectura TCDS y el precedente base ya seleccionado.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-3 py-1 text-xs text-[color:var(--ink-2)]">
            {currentModel}
          </span>
          <span className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-1 text-xs text-[color:var(--ink-3)]">
            {model.context.chosenReferenceLabel}
          </span>
        </div>

        <div className="mt-4 rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
            <Sparkles className="h-3.5 w-3.5" />
            Contexto activo
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--ink-3)]">
            <li>{model.context.clientLabel}</li>
            <li>{model.context.aircraftLabel}</li>
            <li>{model.proposedScope.headline}</li>
            <li>PROJECT_SUMMARY como evidencia secundaria, no como verdad unica.</li>
          </ul>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {messages.length === 1 && (
          <div className="rounded-2xl border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/50 p-4">
            <p className="text-sm leading-6 text-[color:var(--ink-3)]">
              Pregunta por deltas contra el precedente, datos a pedir al cliente, disciplinas
              impactadas o framing interno de certificacion.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {model.suggestedQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => {
                    void sendQuestion(question)
                  }}
                  className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-2 text-xs text-[color:var(--ink-2)] transition hover:border-[color:var(--ink-4)] hover:bg-[color:var(--paper-3)] hover:text-[color:var(--ink-2)]"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const isAssistant = message.role === 'assistant'
          const showLoadingDots =
            isLoading && index === messages.length - 1 && !message.content.trim()

          return (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${isAssistant ? '' : 'justify-end'}`}
            >
              {isAssistant && (
                <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-[color:var(--ink-2)]">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-[92%] rounded-[22px] border px-4 py-3 ${
                  isAssistant
                    ? 'border-[color:var(--ink-4)] bg-[color:var(--paper)] text-[color:var(--ink)]'
                    : 'border-transparent bg-[linear-gradient(135deg,#0f766e,#38bdf8)] text-white'
                }`}
              >
                <div
                  className={`text-[11px] uppercase tracking-[0.18em] ${
                    isAssistant ? 'text-[color:var(--ink-3)]' : 'text-sky-100'
                  }`}
                >
                  {isAssistant ? 'Asistente' : 'Usuario'}
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-7">{message.content}</div>

                {showLoadingDots && (
                  <div className="mt-3 flex items-center gap-1 text-[color:var(--ink-3)]">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:-0.2s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:-0.1s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500" />
                  </div>
                )}
              </div>

              {!isAssistant && (
                <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] text-[color:var(--ink-3)]">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="border-t border-[color:var(--ink-4)] px-5 py-5">
        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

        <div className="rounded-[24px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)]/80 p-3">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void sendQuestion(input)
              }
            }}
            placeholder="Pregunta por deltas, ruta de certificacion, faltantes o alcance propuesto..."
            className="min-h-[110px] resize-none border-0 bg-transparent px-1 text-sm leading-6 text-[color:var(--ink)] shadow-none focus-visible:ring-0"
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-[color:var(--ink-3)]">
              Contexto servidor: consulta actual + precedente base + lectura TCDS.
            </p>
            <Button
              type="button"
              size="sm"
              className="rounded-full bg-slate-950 px-4 text-white hover:bg-slate-800"
              disabled={isLoading || !input.trim()}
              onClick={() => {
                void sendQuestion(input)
              }}
            >
              <Send className="mr-2 h-4 w-4" />
              Enviar
            </Button>
          </div>
        </div>
      </div>
    </aside>
  )
}
