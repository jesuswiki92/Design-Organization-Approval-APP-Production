/**
 * ============================================================================
 * COMPONENTE VISUAL DE LA PAGINA DE CLIENTES
 * ============================================================================
 *
 * Este componente muestra la interfaz completa de la seccion de Clientes
 * con dos paneles principales:
 *
 *   PANEL IZQUIERDO (2/3 de la pantalla):
 *     - Campo de busqueda para filtrar clientes
 *     - Contadores (total de clientes y activos)
 *     - Tabla con columnas: Nombre, Direccion, Telefono, Estado
 *     - Al hacer clic en una fila, se selecciona el cliente
 *
 *   PANEL DERECHO (1/3 de la pantalla):
 *     - Si hay un cliente seleccionado: muestra su ficha detallada
 *       (datos generales, contactos, etc.)
 *     - Si no hay seleccion: muestra un mensaje invitando a seleccionar
 *
 * FUNCIONALIDADES:
 *   - Busqueda en tiempo real por nombre, direccion, telefono o CIF/VAT
 *   - Seleccion/deseleccion de clientes al hacer clic
 *   - Indicador visual de cliente activo/inactivo
 *   - Iniciales del nombre en el avatar circular
 *
 * NOTA TECNICA: 'use client' porque necesita interactividad (busqueda,
 * seleccion de cliente, estados locales).
 * ============================================================================
 */

'use client'

// Hooks de React para estados y calculos optimizados
import { useMemo, useState } from 'react'
// Icono de lupa para el campo de busqueda
import { Search } from 'lucide-react'

// Barra superior de la pagina
import { TopBar } from '@/components/layout/TopBar'
// Utilidad para combinar clases CSS condicionalmente
import { cn } from '@/lib/utils'
// Tipo de datos de un cliente con sus contactos
import type { ClienteWithContactos } from '@/types/database'

// Panel de detalle del cliente (derecha) y estado vacio
import { ClientDetailPanel, EmptyClientDetail } from './ClientDetailPanel'

/**
 * Genera las iniciales de un nombre.
 * Ejemplo: "Airbus Defence" -> "AD"
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/**
 * Formatea la direccion completa de un cliente.
 * Combina: direccion, ciudad y pais separados por comas.
 */
function formatAddress(client: ClienteWithContactos) {
  return [client.direccion, client.ciudad, client.pais].filter(Boolean).join(', ')
}

/**
 * Componente principal de la pagina de Clientes.
 * Recibe la lista completa de clientes con sus contactos.
 */
export default function ClientsPageClient({ clients }: { clients: ClienteWithContactos[] }) {
  // Estado del texto de busqueda
  const [search, setSearch] = useState('')
  // Cliente actualmente seleccionado (null si no hay ninguno)
  const [selectedClient, setSelectedClient] = useState<ClienteWithContactos | null>(null)

  /**
   * Lista filtrada de clientes segun el texto de busqueda.
   * Busca en: nombre, direccion, telefono y CIF/VAT.
   */
  const filtered = useMemo(() => {
    return clients.filter((client) => {
      if (search === '') return true
      const q = search.toLowerCase()
      const address = formatAddress(client).toLowerCase()

      return (
        client.nombre.toLowerCase().includes(q) ||
        address.includes(q) ||
        (client.telefono ?? '').toLowerCase().includes(q) ||
        (client.cif_vat ?? '').toLowerCase().includes(q)
      )
    })
  }, [clients, search])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Clientes" subtitle="Base de datos de clientes" />

      <div className="flex min-h-0 flex-1 gap-5 p-5 text-[color:var(--ink)]">
        <div className="flex min-h-0 basis-2/3 flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="relative max-w-lg flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-3)]"
              />
              <input
                type="text"
                placeholder="Buscar por nombre, dirección o teléfono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[color:var(--ink-4)] bg-[color:var(--paper)] py-2 pl-9 pr-3 text-sm text-slate-950 shadow-sm transition-colors placeholder:text-[color:var(--ink-3)] focus:border-[color:var(--ink-4)] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-[color:var(--ink-3)]">
            <span>
              <span className="font-semibold text-slate-950">{filtered.length}</span> clientes
            </span>
            <span>
              <span className="font-semibold text-emerald-700">
                {filtered.filter((client) => client.activo).length}
              </span>{' '}
              activos
            </span>
          </div>

          <div className="min-h-0 overflow-auto rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)]">
                  {['Nombre', 'Dirección', 'Teléfono', 'Estado'].map((col) => (
                    <th
                      key={col}
                      className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => {
                  const address = formatAddress(client)
                  const isSelected = selectedClient?.id === client.id

                  return (
                    <tr
                      key={client.id}
                      onClick={() => setSelectedClient(isSelected ? null : client)}
                      className={cn(
                        'cursor-pointer border-b border-[color:var(--ink-4)]/60 transition-colors',
                        isSelected ? 'bg-[color:var(--paper-2)]/70' : 'hover:bg-[color:var(--paper-3)]/40'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--ink-4)] bg-[linear-gradient(135deg,#DBEAFE,#E0F2FE)] text-xs font-bold text-[color:var(--ink-2)]">
                            {getInitials(client.nombre)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-950">{client.nombre}</p>
                            {client.cif_vat ? (
                              <p className="font-mono text-xs text-[color:var(--ink-3)]">{client.cif_vat}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[color:var(--ink-3)]">{address || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[color:var(--ink-3)]">
                        {client.telefono ?? '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                            client.activo
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-[color:var(--paper-2)] text-[color:var(--ink-3)]'
                          )}
                        >
                          {client.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  )
                })}

                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-[color:var(--ink-3)]">
                      {search
                        ? `No se encontraron clientes para "${search}"`
                        : 'No hay clientes registrados.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-h-0 basis-1/3">
          {selectedClient ? (
            <ClientDetailPanel client={selectedClient} onClose={() => setSelectedClient(null)} />
          ) : (
            <EmptyClientDetail />
          )}
        </div>
      </div>
    </div>
  )
}
