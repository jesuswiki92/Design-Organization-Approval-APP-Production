'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bot,
  Check,
  Loader2,
  Mail,
  MessageSquare,
  Send,
  Sparkles,
  Terminal,
  Trash2,
  User,
} from 'lucide-react'

export type Answer = {
  question_number: number
  answer: 'yes' | 'no' | null
  justification: string
  confidence?: 'high' | 'medium' | 'low'
}

export type LogEntry = {
  timestamp: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type EmailDraft = {
  subject: string
  body: string
}

type Props = {
  consultaId: string
  currentAnswers: Answer[]
  logEntries: LogEntry[]
  onClearLog: () => void
  analyzing?: boolean
  clientEmail?: string
  clientName?: string
  numeroEntrada?: string
  remitente?: string
  asunto?: string
}

function createChatId() {
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

export default function ClassificationChatPanel({
  consultaId,
  currentAnswers,
  logEntries,
  onClearLog,
  analyzing = false,
  clientEmail,
  clientName,
  numeroEntrada,
  remitente,
  asunto,
}: Props) {
  const [activeTab, setActiveTab] = useState<'log' | 'chat'>('log')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null)
  const [generatingEmail, setGeneratingEmail] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  const logContainerRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logEntries])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages, chatSending])

  const handleChatSend = useCallback(async () => {
    const trimmed = chatInput.trim()
    if (!trimmed || chatSending) return

    const userMessage: ChatMessage = { id: createChatId(), role: 'user', content: trimmed }
    const assistantMessage: ChatMessage = { id: createChatId(), role: 'assistant', content: '' }

    setChatMessages((prev) => [...prev, userMessage, assistantMessage])
    setChatInput('')
    setChatSending(true)
    setChatError(null)

    try {
      const history = chatMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      const answersForApi = currentAnswers.map((a) => ({
        question_number: a.question_number,
        answer: a.answer,
        justification: a.justification,
      }))

      const res = await fetch(`/api/consultas/${consultaId}/change-classification/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          history,
          currentAnswers: answersForApi,
        }),
      })

      if (!res.ok || !res.body) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || 'No se pudo obtener respuesta del chat.')
      }

      const reader = res.body.getReader()
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

          if (event === 'meta') {
            continue
          }

          if (event === 'token' && parsed.token) {
            setChatMessages((current) =>
              current.map((msg) =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: `${msg.content}${parsed.token}` }
                  : msg,
              ),
            )
            continue
          }

          if (event === 'done' && parsed.answer) {
            setChatMessages((current) =>
              current.map((msg) =>
                msg.id === assistantMessage.id && !msg.content
                  ? { ...msg, content: parsed.answer as string }
                  : msg,
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
          : 'Error inesperado consultando el chat.'

      setChatMessages((current) =>
        current.map((entry) =>
          entry.id === assistantMessage.id
            ? {
                ...entry,
                content: entry.content || 'No he podido completar la respuesta en este momento.',
              }
            : entry,
        ),
      )
      setChatError(message)
    } finally {
      setChatSending(false)
    }
  }, [chatInput, chatSending, consultaId, currentAnswers, chatMessages])

  const handleGenerateEmail = useCallback(async () => {
    if (generatingEmail) return

    setGeneratingEmail(true)
    setEmailError(null)

    try {
      const history = chatMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      const answersForApi = currentAnswers.map((a) => ({
        question_number: a.question_number,
        answer: a.answer,
        justification: a.justification,
        confidence: a.confidence,
      }))

      const res = await fetch(`/api/consultas/${consultaId}/change-classification/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatHistory: history,
          currentAnswers: answersForApi,
        }),
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || 'No se pudo generar el borrador de email.')
      }

      const data = (await res.json()) as { subject: string; body: string }
      setEmailDraft({ subject: data.subject, body: data.body })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado generando el email.'
      setEmailError(message)
    } finally {
      setGeneratingEmail(false)
    }
  }, [generatingEmail, chatMessages, currentAnswers, consultaId])

  const handleSendEmail = useCallback(async () => {
    if (sendingEmail || !emailDraft) return

    setSendingEmail(true)
    setEmailError(null)

    try {
      const res = await fetch(`/api/consultas/${consultaId}/send-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: emailDraft.body,
          query: {
            remitente: remitente || clientEmail,
            asunto: emailDraft.subject || asunto,
            codigo: numeroEntrada,
          },
        }),
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || 'No se pudo enviar el email.')
      }

      setEmailSent(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado enviando el email.'
      setEmailError(message)
    } finally {
      setSendingEmail(false)
    }
  }, [sendingEmail, emailDraft, consultaId, remitente, clientEmail, asunto, numeroEntrada])

  return (
    <div className="rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)]">
      <div className="flex items-center gap-2 border-b border-[color:var(--ink-4)] px-4 py-3">
        <Sparkles className="h-4 w-4 text-[color:var(--ink-3)]" />
        <span className="text-sm font-semibold text-[color:var(--ink)]">AI Assistant</span>
      </div>

      <div className="flex border-b border-[color:var(--ink-4)]">
        <button
          onClick={() => setActiveTab('log')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${
            activeTab === 'log'
              ? 'border-b-2 border-sky-500 text-[color:var(--ink-3)]'
              : 'text-[color:var(--ink-3)] hover:text-[color:var(--ink-2)]'
          }`}
        >
          <Terminal className="h-3.5 w-3.5" />
          Log
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${
            activeTab === 'chat'
              ? 'border-b-2 border-sky-500 text-[color:var(--ink-3)]'
              : 'text-[color:var(--ink-3)] hover:text-[color:var(--ink-2)]'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chat IA
        </button>
      </div>

      <div className="flex min-h-0 flex-col" style={{ maxHeight: '280px' }}>
        {activeTab === 'log' ? (
          <div className="flex flex-1 flex-col">
            {logEntries.length > 0 && (
              <div className="flex justify-end px-3 pt-2">
                <button
                  onClick={onClearLog}
                  className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-[color:var(--ink-3)] transition-colors hover:bg-[color:var(--paper-3)] hover:text-[color:var(--ink-2)]"
                >
                  <Trash2 className="h-3 w-3" />
                  Limpiar log
                </button>
              </div>
            )}

            <div
              ref={logContainerRef}
              className="flex-1 overflow-y-auto rounded-b-xl bg-slate-950 p-3 font-mono"
              style={{ minHeight: '140px', maxHeight: '240px' }}
            >
              {logEntries.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-[color:var(--ink-3)]">
                    El log aparecera cuando ejecutes &quot;Pre-rellenar con IA&quot;
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {logEntries.map((entry, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <span className="shrink-0 text-[color:var(--ink-3)]">[{entry.timestamp}]</span>
                      <span
                        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full mt-1.5 ${
                          entry.type === 'success'
                            ? 'bg-emerald-400'
                            : entry.type === 'error'
                              ? 'bg-red-400'
                              : entry.type === 'warning'
                                ? 'bg-yellow-400'
                                : 'bg-sky-400'
                        }`}
                      />
                      <span
                        className={`${
                          entry.type === 'success'
                            ? 'text-emerald-300'
                            : entry.type === 'error'
                              ? 'text-red-300'
                              : entry.type === 'warning'
                                ? 'text-yellow-300'
                                : 'text-[color:var(--ink-4)]'
                        }`}
                      >
                        {entry.message}
                      </span>
                    </div>
                  ))}
                  {analyzing && (
                    <div className="flex items-center gap-2 text-xs text-[color:var(--ink-3)]">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Procesando...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            {emailDraft ? (
              <div className="flex flex-1 flex-col">
                <div className="flex items-center gap-2 border-b border-[color:var(--ink-4)] px-3 py-2">
                  <button
                    onClick={() => {
                      setEmailDraft(null)
                      setEmailSent(false)
                      setEmailError(null)
                    }}
                    className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium text-[color:var(--ink-3)] transition-colors hover:bg-[color:var(--paper-3)] hover:text-[color:var(--ink)]"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Volver
                  </button>
                  <span className="text-xs font-medium text-[color:var(--ink-2)]">Borrador de email</span>
                </div>

                {emailSent ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                      <Check className="h-6 w-6 text-emerald-600" />
                    </div>
                    <p className="text-sm font-medium text-[color:var(--ink-2)]">Email enviado correctamente</p>
                    <p className="text-xs text-[color:var(--ink-3)]">
                      El email ha sido enviado a {clientEmail || remitente || 'el cliente'}
                    </p>
                    <button
                      onClick={() => {
                        setEmailDraft(null)
                        setEmailSent(false)
                        setEmailError(null)
                      }}
                      className="mt-2 rounded-lg border border-[color:var(--ink-4)] px-4 py-2 text-xs font-medium text-[color:var(--ink-3)] transition-colors hover:bg-[color:var(--paper-3)]"
                    >
                      Volver al chat
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col overflow-y-auto" style={{ maxHeight: '360px' }}>
                    <div className="space-y-3 p-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-[color:var(--ink-3)]">
                          Destinatario
                        </label>
                        <input
                          type="text"
                          value={clientEmail || remitente || ''}
                          readOnly
                          className="w-full rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-3 py-2 text-xs text-[color:var(--ink-3)]"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-[color:var(--ink-3)]">
                          Asunto
                        </label>
                        <input
                          type="text"
                          value={emailDraft.subject}
                          onChange={(e) =>
                            setEmailDraft((prev) =>
                              prev ? { ...prev, subject: e.target.value } : prev,
                            )
                          }
                          className="w-full rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-2 text-xs text-[color:var(--ink-2)] focus:border-[color:var(--ink-4)] focus:outline-none focus:ring-1 focus:ring-[color:var(--ink-4)]"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-[color:var(--ink-3)]">
                          Cuerpo del email
                        </label>
                        <textarea
                          value={emailDraft.body}
                          onChange={(e) =>
                            setEmailDraft((prev) =>
                              prev ? { ...prev, body: e.target.value } : prev,
                            )
                          }
                          className="w-full rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-3 py-2 font-mono text-xs leading-relaxed text-[color:var(--ink-2)] focus:border-[color:var(--ink-4)] focus:outline-none focus:ring-1 focus:ring-[color:var(--ink-4)]"
                          style={{ minHeight: '200px' }}
                        />
                      </div>
                    </div>

                    <div className="border-t border-[color:var(--ink-4)] p-3">
                      {emailError && (
                        <p className="mb-2 text-[10px] text-rose-500">{emailError}</p>
                      )}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEmailDraft(null)
                            setEmailError(null)
                          }}
                          disabled={sendingEmail}
                          className="rounded-lg border border-[color:var(--ink-4)] px-3 py-2 text-xs font-medium text-[color:var(--ink-3)] transition-colors hover:bg-[color:var(--paper-3)] disabled:opacity-50"
                        >
                          Volver al chat
                        </button>
                        <button
                          onClick={handleSendEmail}
                          disabled={sendingEmail || !emailDraft.body.trim()}
                          className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-sky-600 disabled:opacity-50"
                        >
                          {sendingEmail ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Send className="h-3 w-3" />
                              Enviar email
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-[color:var(--ink-4)] px-3 py-2">
                  <p className="text-[10px] text-[color:var(--ink-3)]">
                    Pregunta a la IA sobre la clasificacion de este cambio
                  </p>
                  <button
                    onClick={handleGenerateEmail}
                    disabled={generatingEmail || chatSending}
                    className="flex items-center gap-1 rounded-md border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-2 py-1 text-[10px] font-medium text-[color:var(--ink-3)] transition-colors hover:bg-[color:var(--paper-3)] disabled:opacity-50"
                  >
                    {generatingEmail ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <Mail className="h-3 w-3" />
                        Generar email
                      </>
                    )}
                  </button>
                </div>
                {emailError && !emailDraft && (
                  <div className="px-3 py-1">
                    <p className="text-[10px] text-rose-500">{emailError}</p>
                  </div>
                )}

                <div
                  ref={chatContainerRef}
                  className="flex-1 space-y-3 overflow-y-auto p-3"
                  style={{ minHeight: '120px', maxHeight: '200px' }}
                >
                  {chatMessages.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-center text-xs text-[color:var(--ink-3)]">
                        Sin mensajes aun. Escribe tu pregunta abajo.
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => {
                      const isAssistant = msg.role === 'assistant'
                      const showLoadingDots =
                        chatSending && idx === chatMessages.length - 1 && isAssistant && !msg.content.trim()

                      return (
                        <div
                          key={msg.id}
                          className={`flex items-start gap-2 ${isAssistant ? '' : 'justify-end'}`}
                        >
                          {isAssistant && (
                            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] text-[color:var(--ink-3)]">
                              <Bot className="h-3 w-3" />
                            </div>
                          )}

                          <div
                            className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                              isAssistant
                                ? 'bg-[color:var(--paper-2)] text-[color:var(--ink-2)]'
                                : 'bg-sky-500 text-white'
                            }`}
                          >
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                            {showLoadingDots && (
                              <div className="mt-1.5 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-500 [animation-delay:-0.2s]" />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-500 [animation-delay:-0.1s]" />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-500" />
                              </div>
                            )}
                          </div>

                          {!isAssistant && (
                            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper)] text-[color:var(--ink-3)]">
                              <User className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="border-t border-[color:var(--ink-4)] p-3">
                  {chatError && (
                    <p className="mb-2 text-[10px] text-rose-500">{chatError}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleChatSend()
                        }
                      }}
                      placeholder="Pregunta sobre la clasificacion..."
                      disabled={chatSending}
                      className="flex-1 rounded-lg border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-3 py-2 text-xs text-[color:var(--ink-2)] placeholder-[color:var(--ink-4)] focus:border-[color:var(--ink-4)] focus:outline-none focus:ring-1 focus:ring-[color:var(--ink-4)] disabled:opacity-50"
                    />
                    <button
                      onClick={handleChatSend}
                      disabled={chatSending || !chatInput.trim()}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white transition-colors hover:bg-sky-600 disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
