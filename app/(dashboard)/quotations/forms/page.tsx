/**
 * ============================================================================
 * PAGINA DEL CATALOGO DE FORMULARIOS DE QUOTATIONS
 * ============================================================================
 *
 * Esta page muestra un listado de todas las requests que ya tienen un
 * form generado por n8n (automatizacion). Permite al equipo commercial
 * ver y acceder a las URLs publicas de los forms que se envian a
 * los clients como parte del process de intake.
 *
 * QUE CARGA:
 *   1. Consultas entrantes que tienen URL de form (no archivadas)
 *   2. Lista de clients para emparejar con las requests
 *   3. Contactos de los clients
 *
 * QUE MUESTRA:
 *   - Boton "Volver a quotations" para regresar
 *   - Cabecera con title y description
 *   - Table con columnas: Request, Client, Status, Creado, URL, Accion
 *   - En cada fila, un boton "Abrir" que abre la URL del form
 *
 * NOTA TECNICA: Es un Server Component que carga data en paralelo
 * desde Supabase. Solo muestra requests que tienen form_url
 * (no es null) y no estan archivadas.
 * ============================================================================
 */

// Navegacion y iconos
import Link from 'next/link'
import { ArrowLeft, ExternalLink, FileText } from 'lucide-react'

// Barra superior de la page
import { TopBar } from '@/components/layout/TopBar'
// Conexion a Supabase desde el servidor
import { createClient } from '@/lib/supabase/server'
// Constantes de statuses (para excluir archivados)
import { INCOMING_REQUEST_STATUSES } from '@/lib/workflow-states'
// Tipos de data
import type { Client, ClientContact, IncomingRequest } from '@/types/database'
// Funciones para emparejar requests con clients
import {
  buildIncomingClientLookup,
  resolveIncomingClientIdentity,
} from '../incoming-queries'

// Forzar regeneracion en cada visita (sin cache)
export const dynamic = 'force-dynamic'

/**
 * Funcion auxiliar para formatear dates en formato espanol corto.
 * Ejemplo: "03/04/2026 14:30"
 * Si la date es invalida o no existe, devuelve "-".
 */
function formatDate(value: string | null | undefined) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

/**
 * Funcion primary de la page del catalogo de forms.
 * Se ejecuta en el servidor cuando alguien visita /quotations/forms.
 */
export default async function QuotationsFormsCatalogPage() {
  const supabase = await createClient()

  // Cargar data en paralelo: requests con form, clients y contacts
  const [consultasResult, clientsResult, contactsResult] = await Promise.all([
    // Solo requests no archivadas que tienen URL de form
    supabase
      .from('doa_incoming_requests')
      .select('*')
      .neq('status', INCOMING_REQUEST_STATUSES.ARCHIVED)
      .not('form_url', 'is', null)
      .order('created_at', { ascending: false }),
    // Todos los clients ordenados alfabeticamente
    supabase
      .from('doa_clients')
      .select('*')
      .order('name', { ascending: true }),
    // Contactos de clients
    supabase
      .from('doa_client_contacts')
      .select('*')
      .order('is_primary', { ascending: false })
      .order('active', { ascending: false })
      .order('created_at', { ascending: true }),
  ])

  // Prepare data con tipos correctos
  const requests = (consultasResult.data ?? []) as IncomingRequest[]
  const clients = (clientsResult.data ?? []) as Client[]
  const contacts = (contactsResult.data ?? []) as ClientContact[]
  // Mapa de search para emparejar requests con clients por email
  const clientLookup = buildIncomingClientLookup(clients, contacts)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar title="Forms" subtitle="Catalogo internal de forms de quotations" />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 pb-8 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/quotations"
            className="inline-flex items-center rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] px-4 py-2 text-sm font-medium text-[color:var(--ink)] shadow-sm transition-colors hover:bg-[color:var(--paper-3)]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a quotations
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-2)] shadow-sm">
            <FileText className="h-3.5 w-3.5" />
            n8n generated URLs
          </div>
        </div>

        <section className="rounded-[34px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Forms disponibles
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[color:var(--ink-3)]">
              Aqui puedes ver las requests que ya tienen `form_url`
              generada por n8n y abrir exactamente la URL publica que recibiria el client.
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-[0_18px_42px_rgba(148,163,184,0.12)]">
          <div className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">Table de forms</h2>
            <p className="mt-1 text-sm text-[color:var(--ink-3)]">
              Cada fila corresponde a una request con URL de form persistida en
              `doa_incoming_requests`.
            </p>
          </div>

          <div className="overflow-auto">
            <table className="min-w-[1040px] w-full border-separate border-spacing-0 text-left">
              <thead className="sticky top-0 z-10 bg-[color:var(--paper)]">
                <tr className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)]">
                  {['Request', 'Client', 'Status', 'Creado', 'URL', 'Accion'].map((label) => (
                    <th
                      key={label}
                      className="whitespace-nowrap border-b border-[color:var(--ink-4)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-10 text-center text-sm text-[color:var(--ink-3)]"
                    >
                      Todavia no hay forms generados.
                    </td>
                  </tr>
                ) : (
                  requests.map((request) => {
                    const clientIdentity = resolveIncomingClientIdentity(
                      request.sender,
                      clientLookup,
                    )
                    const formHref = request.form_url?.trim() ?? ''

                    return (
                      <tr
                        key={request.id}
                        className="border-b border-[color:var(--ink-4)]/70 bg-[color:var(--paper)] transition-colors hover:bg-[color:var(--paper-3)]/50"
                      >
                        <td className="px-4 py-3 align-top">
                          <p className="font-medium text-slate-950">
                            {request.subject ?? 'Request sin subject'}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-[color:var(--ink-3)]">
                            {request.id}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="font-medium text-[color:var(--ink)]">
                            {clientIdentity.kind === 'known'
                              ? `${clientIdentity.companyName} · ${clientIdentity.contactName}`
                              : 'client desconocido'}
                          </p>
                          <p className="mt-1 text-xs text-[color:var(--ink-3)]">{request.sender}</p>
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-[color:var(--ink-3)]">
                          {request.status}
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-[color:var(--ink-3)]">
                          {formatDate(request.created_at)}
                        </td>
                        <td className="max-w-[320px] px-4 py-3 align-top text-sm text-[color:var(--ink-3)]">
                          <p className="break-all">{formHref || '-'}</p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {formHref ? (
                            <a
                              href={formHref}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-9 items-center rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-3 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)]"
                            >
                              <ExternalLink className="mr-2 h-3.5 w-3.5" />
                              Abrir
                            </a>
                          ) : (
                            <span className="text-xs text-[color:var(--ink-3)]">Sin URL</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
