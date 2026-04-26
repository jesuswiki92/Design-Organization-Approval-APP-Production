/**
 * ============================================================================
 * DETALLE DE CONSULTA ENTRANTE — UI cliente
 * ============================================================================
 * Componente de presentacion. Recibe el `IncomingQuery` ya mapeado, el
 * `ClientWithContacts | null` resuelto por email y la fila cruda (`rawRow`)
 * solo para el bloque de debug (campos crudos).
 *
 * Layout: una columna scrollable bajo el `<TopBar />` con bloques discretos:
 *   A. Header: codigo, classification, recibido, estado backend
 *   B. Cliente: known/unknown segun clientIdentity.kind
 *   C. Asunto y cuerpo: con strip de HTML simple para el body original
 *   D. IA: respuesta sugerida (si la hay)
 *   E. Acciones: placeholders no funcionales (toast.info('Próximamente'))
 *   F. Datos crudos: <details> con el JSON entero de la fila
 * ============================================================================
 */

'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { TopBar } from '@/components/layout/TopBar'
import { cn } from '@/lib/utils'
import type { ClientWithContacts } from '@/types/database'

import type { IncomingQuery } from '../../incoming-queries'

// Mismas clases tipograficas reutilizadas del board para no inventar primitivas.
const pillBaseClass =
  'inline-flex items-center rounded-full border border-[color:var(--line-strong)] bg-[color:var(--paper-2)] px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink)] shadow-[0_1px_0_rgba(255,255,255,0.65)_inset]'

const labelMonoClass =
  'font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-3)]'

const cardClass =
  'rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper-2)] p-5 shadow-[0_12px_28px_-18px_rgba(74,60,36,0.15)]'

type Props = {
  query: IncomingQuery
  fullClient: ClientWithContacts | null
  rawRow: Record<string, unknown>
}

/** Strip simple de etiquetas HTML para mostrar emails que llegan en HTML como texto plano. */
function stripHtml(input: string | null | undefined) {
  if (!input) return ''
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Extrae el email entre `<...>` o el primer email inline del sender. */
function extractEmailFromSender(sender: string | null | undefined): string | null {
  if (!sender) return null
  const angle = sender.match(/<\s*([^>]+?)\s*>/)
  if (angle?.[1]) return angle[1].trim().toLowerCase()
  const inline = sender.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)
  if (inline?.[0]) return inline[0].toLowerCase()
  return null
}

function ClientKnownBlock({
  query,
  fullClient,
}: {
  query: IncomingQuery
  fullClient: ClientWithContacts | null
}) {
  if (query.clientIdentity.kind !== 'known') return null

  const senderEmail = extractEmailFromSender(query.sender)
  const companyName = fullClient?.name ?? query.clientIdentity.companyName
  const contacts = fullClient?.contacts ?? []

  return (
    <section className={cardClass}>
      <div className="flex items-center justify-between gap-3">
        <p className={labelMonoClass}>Cliente</p>
        <span
          className={cn(
            pillBaseClass,
            'border-emerald-300 bg-emerald-50 text-[color:var(--ok)]',
          )}
        >
          Cliente conocido
        </span>
      </div>

      <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl text-[color:var(--ink)]">
        {companyName}
      </h3>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {fullClient?.vat_tax_id ? (
          <div>
            <dt className={labelMonoClass}>VAT</dt>
            <dd className="mt-1 text-[color:var(--ink)]">{fullClient.vat_tax_id}</dd>
          </div>
        ) : null}
        {fullClient?.country ? (
          <div>
            <dt className={labelMonoClass}>País</dt>
            <dd className="mt-1 text-[color:var(--ink)]">{fullClient.country}</dd>
          </div>
        ) : null}
        {fullClient?.city ? (
          <div>
            <dt className={labelMonoClass}>Ciudad</dt>
            <dd className="mt-1 text-[color:var(--ink)]">{fullClient.city}</dd>
          </div>
        ) : null}
        {fullClient?.website ? (
          <div>
            <dt className={labelMonoClass}>Web</dt>
            <dd className="mt-1 break-all text-[color:var(--ink)]">{fullClient.website}</dd>
          </div>
        ) : null}
      </dl>

      {contacts.length > 0 ? (
        <div className="mt-5">
          <p className={labelMonoClass}>Contactos ({contacts.length})</p>
          <ul className="mt-2 space-y-2">
            {contacts.map((contact) => {
              const fullName =
                [contact.name?.trim(), contact.last_name?.trim()]
                  .filter(Boolean)
                  .join(' ') || contact.email

              const isSender =
                senderEmail !== null &&
                contact.email.trim().toLowerCase() === senderEmail

              return (
                <li
                  key={contact.id}
                  className="rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[color:var(--ink)]">
                      {fullName}
                    </p>
                    {isSender ? (
                      <span
                        className={cn(
                          pillBaseClass,
                          'border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[color:var(--ok)]',
                        )}
                      >
                        remitente
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--ink-3)]">
                    {contact.email}
                  </p>
                  {contact.job_title ? (
                    <p className="mt-0.5 text-xs text-[color:var(--ink-3)]">
                      {contact.job_title}
                    </p>
                  ) : null}
                  {contact.phone ? (
                    <p className="mt-0.5 text-xs text-[color:var(--ink-3)]">
                      {contact.phone}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function ClientUnknownBlock({ query }: { query: IncomingQuery }) {
  if (query.clientIdentity.kind !== 'unknown') return null

  const senderEmail =
    query.clientIdentity.senderEmail ?? extractEmailFromSender(query.sender)

  return (
    <section className={cardClass}>
      <div className="flex items-center justify-between gap-3">
        <p className={labelMonoClass}>Cliente</p>
        <span className={cn(pillBaseClass, 'text-[color:var(--umber)]')}>
          Cliente desconocido
        </span>
      </div>

      <h3 className="mt-3 font-[family-name:var(--font-heading)] text-2xl text-[color:var(--ink)]">
        Cliente desconocido
      </h3>

      {senderEmail ? (
        <p className="mt-1 text-sm text-[color:var(--ink-2)]">{senderEmail}</p>
      ) : null}

      <p className="mt-3 text-sm text-[color:var(--ink-3)]">
        Este remitente no coincide con ningún contacto registrado en {' '}
        <span className="font-mono">doa_clients_v2</span>.
      </p>
    </section>
  )
}

export function IncomingRequestDetailClient({ query, fullClient, rawRow }: Props) {
  const cleanBody = stripHtml(query.cuerpoOriginal)

  function handlePlaceholder(action: string) {
    toast.info(`Próximamente: ${action}`)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar title={query.codigo} subtitle={query.subject} />

      <div className="flex-1 space-y-6 overflow-y-auto p-6 text-[color:var(--ink)]">
        <Link
          href="/quotations"
          className="inline-flex items-center gap-1.5 text-sm text-[color:var(--ink-3)] transition-colors hover:text-[color:var(--ink-2)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Quotations
        </Link>

        {/* Bloque A — Header */}
        <section className={cardClass}>
          <p className={labelMonoClass}>Solicitud entrante</p>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-3xl tracking-tight text-[color:var(--ink)]">
            {query.codigo}
          </h2>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {query.classification ? (
              <span className={cn(pillBaseClass, 'text-[color:var(--ink-3)]')}>
                {query.classification}
              </span>
            ) : null}
          </div>

          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className={labelMonoClass}>Recibido</dt>
              <dd className="mt-1 text-[color:var(--ink)]">{query.recibidoEn}</dd>
            </div>
            <div>
              <dt className={labelMonoClass}>Estado</dt>
              <dd className="mt-1 text-[color:var(--ink)]">{query.estadoBackend}</dd>
            </div>
          </dl>
        </section>

        {/* Cuadricula de bloques principales */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Bloque B — Cliente */}
          {query.clientIdentity.kind === 'known' ? (
            <ClientKnownBlock query={query} fullClient={fullClient} />
          ) : (
            <ClientUnknownBlock query={query} />
          )}

          {/* Bloque C — Asunto y cuerpo */}
          <section className={cardClass}>
            <p className={labelMonoClass}>Asunto y cuerpo</p>

            <div className="mt-3 space-y-3">
              <div>
                <p className={labelMonoClass}>Asunto</p>
                <p className="mt-1 text-sm text-[color:var(--ink)]">{query.subject}</p>
              </div>
              <div>
                <p className={labelMonoClass}>Remitente</p>
                <p className="mt-1 break-all text-sm text-[color:var(--ink)]">
                  {query.sender}
                </p>
              </div>
              <div>
                <p className={labelMonoClass}>Cuerpo</p>
                <div className="mt-1 whitespace-pre-wrap rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-3 text-sm leading-6 text-[color:var(--ink-2)]">
                  {cleanBody.length > 0 ? cleanBody : 'Sin contenido'}
                </div>
              </div>
            </div>
          </section>

          {/* Bloque D — IA */}
          <section className={cardClass}>
            <p className={labelMonoClass}>Respuesta IA</p>
            {query.respuestaIa ? (
              <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-3 font-sans text-sm leading-6 text-[color:var(--ink-2)]">
                {query.respuestaIa}
              </pre>
            ) : (
              <p className="mt-3 text-sm text-[color:var(--ink-3)]">
                Sin respuesta IA generada todavía
              </p>
            )}
          </section>

          {/* Bloque E — Acciones */}
          <section className={cardClass}>
            <p className={labelMonoClass}>Acciones</p>
            <p className="mt-2 text-xs text-[color:var(--ink-3)]">
              Placeholders no funcionales todavía.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handlePlaceholder('Generar respuesta IA')}
                className="inline-flex h-10 items-center rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 text-sm font-semibold text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)]"
              >
                Generar respuesta IA
              </button>
              <button
                type="button"
                onClick={() => handlePlaceholder('Enviar al cliente')}
                className="inline-flex h-10 items-center rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 text-sm font-semibold text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)]"
              >
                Enviar al cliente
              </button>
              <button
                type="button"
                onClick={() => handlePlaceholder('Crear cotización')}
                className="inline-flex h-10 items-center rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 text-sm font-semibold text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)]"
              >
                Crear cotización
              </button>
            </div>
          </section>
        </div>

        {/* Bloque F — Datos crudos */}
        <details className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper-2)] p-5">
          <summary className={cn(labelMonoClass, 'cursor-pointer select-none')}>
            Ver todos los campos (raw)
          </summary>
          <pre className="mt-4 max-h-[480px] overflow-auto rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-3 text-xs leading-5 text-[color:var(--ink-2)]">
            {JSON.stringify(rawRow, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  )
}
