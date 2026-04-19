/**
 * ============================================================================
 * PAGINA DEL CATALOGO DE FORMULARIOS DE QUOTATIONS
 * ============================================================================
 *
 * Esta pagina muestra un listado de todas las consultas que ya tienen un
 * formulario generado por n8n (automatizacion). Permite al equipo comercial
 * ver y acceder a las URLs publicas de los formularios que se envian a
 * los clientes como parte del proceso de intake.
 *
 * QUE CARGA:
 *   1. Consultas entrantes que tienen URL de formulario (no archivadas)
 *   2. Lista de clientes para emparejar con las consultas
 *   3. Contactos de los clientes
 *
 * QUE MUESTRA:
 *   - Boton "Volver a quotations" para regresar
 *   - Cabecera con titulo y descripcion
 *   - Tabla con columnas: Consulta, Cliente, Estado, Creado, URL, Accion
 *   - En cada fila, un boton "Abrir" que abre la URL del formulario
 *
 * NOTA TECNICA: Es un Server Component que carga datos en paralelo
 * desde Supabase. Solo muestra consultas que tienen url_formulario
 * (no es null) y no estan archivadas.
 * ============================================================================
 */

// Navegacion y iconos
import Link from 'next/link'
import { ArrowLeft, ExternalLink, FileText } from 'lucide-react'

// Barra superior de la pagina
import { TopBar } from '@/components/layout/TopBar'
// Conexion a Supabase desde el servidor
import { createClient } from '@/lib/supabase/server'
// Constantes de estados (para excluir archivados)
import { CONSULTA_ESTADOS } from '@/lib/workflow-states'
// Tipos de datos
import type { Cliente, ClienteContacto, ConsultaEntrante } from '@/types/database'
// Funciones para emparejar consultas con clientes
import {
  buildIncomingClientLookup,
  resolveIncomingClientIdentity,
} from '../incoming-queries'

// Forzar regeneracion en cada visita (sin cache)
export const dynamic = 'force-dynamic'

/**
 * Funcion auxiliar para formatear fechas en formato espanol corto.
 * Ejemplo: "03/04/2026 14:30"
 * Si la fecha es invalida o no existe, devuelve "-".
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
 * Funcion principal de la pagina del catalogo de formularios.
 * Se ejecuta en el servidor cuando alguien visita /quotations/forms.
 */
export default async function QuotationsFormsCatalogPage() {
  const supabase = await createClient()

  // Cargar datos en paralelo: consultas con formulario, clientes y contactos
  const [consultasResult, clientsResult, contactsResult] = await Promise.all([
    // Solo consultas no archivadas que tienen URL de formulario
    supabase
      .from('doa_consultas_entrantes')
      .select('*')
      .neq('estado', CONSULTA_ESTADOS.ARCHIVADO)
      .not('url_formulario', 'is', null)
      .order('created_at', { ascending: false }),
    // Todos los clientes ordenados alfabeticamente
    supabase
      .from('doa_clientes_datos_generales')
      .select('*')
      .order('nombre', { ascending: true }),
    // Contactos de clientes
    supabase
      .from('doa_clientes_contactos')
      .select('*')
      .order('es_principal', { ascending: false })
      .order('activo', { ascending: false })
      .order('created_at', { ascending: true }),
  ])

  // Preparar datos con tipos correctos
  const consultas = (consultasResult.data ?? []) as ConsultaEntrante[]
  const clients = (clientsResult.data ?? []) as Cliente[]
  const contacts = (contactsResult.data ?? []) as ClienteContacto[]
  // Mapa de busqueda para emparejar consultas con clientes por email
  const clientLookup = buildIncomingClientLookup(clients, contacts)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Formularios" subtitle="Catalogo interno de formularios de quotations" />

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

        <section className="rounded-[34px] border border-[color:var(--ink-4)] bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_52%,#f8fafc_100%)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Formularios disponibles
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[color:var(--ink-3)]">
              Aqui puedes ver las consultas que ya tienen `url_formulario`
              generada por n8n y abrir exactamente la URL publica que recibiria el cliente.
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-[0_18px_42px_rgba(148,163,184,0.12)]">
          <div className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">Tabla de formularios</h2>
            <p className="mt-1 text-sm text-[color:var(--ink-3)]">
              Cada fila corresponde a una consulta con URL de formulario persistida en
              `doa_consultas_entrantes`.
            </p>
          </div>

          <div className="overflow-auto">
            <table className="min-w-[1040px] w-full border-separate border-spacing-0 text-left">
              <thead className="sticky top-0 z-10 bg-[color:var(--paper)]">
                <tr className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)]">
                  {['Consulta', 'Cliente', 'Estado', 'Creado', 'URL', 'Accion'].map((label) => (
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
                {consultas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-10 text-center text-sm text-[color:var(--ink-3)]"
                    >
                      Todavia no hay formularios generados.
                    </td>
                  </tr>
                ) : (
                  consultas.map((consulta) => {
                    const clientIdentity = resolveIncomingClientIdentity(
                      consulta.remitente,
                      clientLookup,
                    )
                    const formHref = consulta.url_formulario?.trim() ?? ''

                    return (
                      <tr
                        key={consulta.id}
                        className="border-b border-[color:var(--ink-4)]/70 bg-[color:var(--paper)] transition-colors hover:bg-[color:var(--paper-3)]/50"
                      >
                        <td className="px-4 py-3 align-top">
                          <p className="font-medium text-slate-950">
                            {consulta.asunto ?? 'Consulta sin asunto'}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-[color:var(--ink-3)]">
                            {consulta.id}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="font-medium text-[color:var(--ink)]">
                            {clientIdentity.kind === 'known'
                              ? `${clientIdentity.companyName} · ${clientIdentity.contactName}`
                              : 'cliente desconocido'}
                          </p>
                          <p className="mt-1 text-xs text-[color:var(--ink-3)]">{consulta.remitente}</p>
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-[color:var(--ink-3)]">
                          {consulta.estado}
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-[color:var(--ink-3)]">
                          {formatDate(consulta.created_at)}
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
