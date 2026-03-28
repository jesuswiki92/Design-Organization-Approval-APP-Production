'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, FileText, PanelRightOpen, Send, Sparkles, User } from 'lucide-react';

import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type ChatRole = 'user' | 'assistant';

type SourceItem = {
  id: string;
  title: string;
  section: string;
  score: number | null;
  content: string;
};

type Message = {
  id: string;
  role: ChatRole;
  content: string;
  sources: SourceItem[];
};

const SUGGESTED_QUESTIONS = [
  'Que es un Major Change segun EASA Part 21?',
  'Cuales son los requisitos para una STC?',
  'Que documentacion requiere un Minor Change?',
];

const WELCOME_MESSAGE =
  'Experto en Certificacion EASA - Puedo responder preguntas sobre normativa aeronautica basandome en la documentacion indexada.';

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatScore(score: number | null) {
  if (typeof score !== 'number') {
    return 'n/a';
  }

  return score.toFixed(3);
}

function parseSseChunk(chunk: string) {
  const [eventLine, ...dataLines] = chunk.split('\n');
  const event = eventLine.startsWith('event:') ? eventLine.slice(6).trim() : 'message';
  const data = dataLines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n');

  return { event, data };
}

export default function CertificationExpertPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: WELCOME_MESSAGE,
      sources: [],
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState('welcome');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const selectedMessage = useMemo(
    () => messages.find((message) => message.id === selectedMessageId) ?? messages[messages.length - 1],
    [messages, selectedMessageId],
  );

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages, isLoading]);

  async function sendQuestion(question: string) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isLoading) {
      return;
    }

    const userMessage: Message = {
      id: createId(),
      role: 'user',
      content: trimmedQuestion,
      sources: [],
    };
    const assistantMessage: Message = {
      id: createId(),
      role: 'assistant',
      content: '',
      sources: [],
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setSelectedMessageId(assistantMessage.id);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const history = messages
        .filter((message) => message.id !== 'welcome')
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));

      const response = await fetch('/api/experto/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          history,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || 'No se pudo obtener respuesta del experto.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        while (buffer.includes('\n\n')) {
          const separatorIndex = buffer.indexOf('\n\n');
          const rawEvent = buffer.slice(0, separatorIndex).trim();
          buffer = buffer.slice(separatorIndex + 2);

          if (!rawEvent) {
            continue;
          }

          const { event, data } = parseSseChunk(rawEvent);
          const parsed = data
            ? (JSON.parse(data) as {
                answer?: string;
                token?: string;
                sources?: SourceItem[];
                error?: string;
              })
            : {};

          if (event === 'sources') {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, sources: parsed.sources ?? [] }
                  : message,
              ),
            );
            continue;
          }

          if (event === 'token' && parsed.token) {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, content: `${message.content}${parsed.token}` }
                  : message,
              ),
            );
            continue;
          }

          if (event === 'done') {
            const answer = parsed.answer;

            if (answer) {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantMessage.id && !message.content
                    ? { ...message, content: answer }
                    : message,
                ),
              );
            }
            continue;
          }

          if (event === 'error') {
            throw new Error(parsed.error || 'Se produjo un error durante el streaming.');
          }
        }
      }
    } catch (streamError) {
      const message =
        streamError instanceof Error ? streamError.message : 'Error inesperado consultando al experto.';

      setMessages((current) =>
        current.map((entry) =>
          entry.id === assistantMessage.id
            ? {
                ...entry,
                content:
                  entry.content ||
                  'No he podido completar la respuesta con la documentacion disponible en este momento.',
              }
            : entry,
        ),
      );
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit() {
    void sendQuestion(input);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0F1117]">
      <TopBar title="Experto en Certificacion" subtitle="RAG sobre documentacion EASA indexada" />

      <div className="flex min-h-0 flex-1 flex-col gap-6 p-6 xl:grid xl:grid-cols-[minmax(0,1fr)_360px]">
        <section
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[#2A2D3E] bg-[#1A1D27]"
          style={{
            backgroundImage:
              'radial-gradient(circle at top left, rgba(99,102,241,0.16), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
          }}
        >
          <div className="flex items-center justify-between border-b border-[#2A2D3E] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6366F1]/15 text-[#6366F1]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#E8E9F0]">
                  Certification Desk
                </h2>
                <p className="text-sm text-[#9AA0B5]">
                  Respuestas trazables con recuperacion semantica sobre normativa certificada.
                </p>
              </div>
            </div>

            <div className="hidden rounded-full border border-[#2A2D3E] bg-[#0F1117]/80 px-4 py-2 text-xs text-[#9AA0B5] md:block">
              Documentacion indexada + Gemini + OpenRouter
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            {messages.length === 1 && (
              <div className="rounded-[24px] border border-dashed border-[#2A2D3E] bg-[#0F1117]/55 p-6">
                <p className="max-w-2xl text-sm leading-7 text-[#9AA0B5]">
                  Formula una consulta sobre Part 21, cambios menores o mayores, STC, AMC/GM o
                  procedimientos internos. El asistente respondera solo con apoyo en la documentacion
                  recuperada.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => {
                        void sendQuestion(question);
                      }}
                      className="rounded-full border border-[#2A2D3E] bg-[#1A1D27] px-4 py-2 text-sm text-[#E8E9F0] transition hover:border-[#6366F1]/60 hover:bg-[#6366F1]/10"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => {
              const isAssistant = message.role === 'assistant';
              const isSelected = selectedMessage?.id === message.id;
              const showLoadingDots = isLoading && message.id === selectedMessageId && !message.content;

              return (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => setSelectedMessageId(message.id)}
                  className={`flex w-full items-start gap-4 text-left ${isAssistant ? '' : 'justify-end'}`}
                >
                  {isAssistant && (
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-[#2A2D3E] bg-[#0F1117] text-[#6366F1]">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-3xl rounded-[24px] border px-5 py-4 transition ${
                      isAssistant ? 'bg-[#131720] text-[#E8E9F0]' : 'bg-[#6366F1] text-white'
                    } ${isSelected ? 'border-[#6366F1]/80 shadow-[0_0_0_1px_rgba(99,102,241,0.25)]' : 'border-[#2A2D3E]'}`}
                  >
                    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-inherit/70">
                      {isAssistant ? 'Asistente' : 'Usuario'}
                      {isAssistant && message.sources.length > 0 && (
                        <span className="rounded-full bg-[#6366F1]/12 px-2 py-1 text-[10px] tracking-[0.14em] text-[#A5B4FC]">
                          {message.sources.length} fuentes
                        </span>
                      )}
                    </div>

                    <div className="whitespace-pre-wrap text-sm leading-7">
                      {message.content}
                    </div>

                    {showLoadingDots && (
                      <div className="mt-3 flex items-center gap-1 text-[#9AA0B5]">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#6366F1] [animation-delay:-0.2s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#6366F1] [animation-delay:-0.1s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#6366F1]" />
                      </div>
                    )}
                  </div>

                  {!isAssistant && (
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-[#2A2D3E] bg-[#0F1117] text-[#E8E9F0]">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t border-[#2A2D3E] px-6 py-5">
            {error && <p className="mb-3 text-sm text-[#FCA5A5]">{error}</p>}

            <div className="rounded-[24px] border border-[#2A2D3E] bg-[#0F1117]/90 p-3 shadow-[0_20px_40px_rgba(0,0,0,0.18)]">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Escribe tu consulta de certificacion..."
                className="min-h-24 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-7 text-[#E8E9F0] placeholder:text-[#6B7280] focus-visible:ring-0"
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-[#6B7280]">
                  Enter para enviar. Shift + Enter para nueva linea.
                </p>

                <Button
                  onClick={handleSubmit}
                  disabled={isLoading || input.trim().length === 0}
                  className="h-11 rounded-2xl bg-[#6366F1] px-5 text-sm font-medium text-white hover:bg-[#7375F8]"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        </section>

        <aside
          className="flex min-h-[320px] flex-col overflow-hidden rounded-[28px] border border-[#2A2D3E] bg-[#1A1D27]"
          style={{
            backgroundImage:
              'linear-gradient(180deg, rgba(99,102,241,0.12), rgba(99,102,241,0) 20%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
          }}
        >
          <div className="flex items-center justify-between border-b border-[#2A2D3E] px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0F1117] text-[#6366F1]">
                <PanelRightOpen className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#E8E9F0]">Fuentes</h3>
                <p className="text-xs text-[#6B7280]">Chunks usados en la respuesta seleccionada</p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {selectedMessage?.sources.length ? (
              selectedMessage.sources.map((source, index) => (
                <article
                  key={`${selectedMessage.id}-${source.id}-${index}`}
                  className="rounded-[22px] border border-[#2A2D3E] bg-[#0F1117]/90 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#8187A2]">
                        <FileText className="h-3.5 w-3.5" />
                        Fuente {index + 1}
                      </div>
                      <h4 className="mt-2 text-sm font-semibold leading-6 text-[#E8E9F0]">
                        {source.title}
                      </h4>
                      <p className="text-xs text-[#9AA0B5]">{source.section}</p>
                    </div>

                    <div className="rounded-full border border-[#2A2D3E] px-2.5 py-1 text-[11px] text-[#A5B4FC]">
                      {formatScore(source.score)}
                    </div>
                  </div>

                  <p className="mt-4 line-clamp-6 text-sm leading-6 text-[#9AA0B5]">{source.content}</p>
                </article>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#2A2D3E] bg-[#0F1117]/60 p-5 text-sm leading-7 text-[#6B7280]">
                Selecciona una respuesta del asistente para inspeccionar los fragmentos recuperados.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
