'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { cn } from '@/lib/utils'
import type { ClienteWithContactos } from '@/types/database'

import { ClientDetailPanel, EmptyClientDetail } from './ClientDetailPanel'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function formatAddress(client: ClienteWithContactos) {
  return [client.direccion, client.ciudad, client.pais].filter(Boolean).join(', ')
}

export default function ClientsPageClient({ clients }: { clients: ClienteWithContactos[] }) {
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClienteWithContactos | null>(null)

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

      <div className="flex min-h-0 flex-1 gap-5 p-5 text-slate-900">
        <div className="flex min-h-0 basis-2/3 flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="relative max-w-lg flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Buscar por nombre, dirección o teléfono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-950 shadow-sm transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
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

          <div className="min-h-0 overflow-auto rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Nombre', 'Dirección', 'Teléfono', 'Estado'].map((col) => (
                    <th
                      key={col}
                      className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
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
                        'cursor-pointer border-b border-slate-200/60 transition-colors',
                        isSelected ? 'bg-sky-50/70' : 'hover:bg-sky-50/40'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-[linear-gradient(135deg,#DBEAFE,#E0F2FE)] text-xs font-bold text-sky-700">
                            {getInitials(client.nombre)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-950">{client.nombre}</p>
                            {client.cif_vat ? (
                              <p className="font-mono text-xs text-slate-500">{client.cif_vat}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{address || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {client.telefono ?? '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                            client.activo
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
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
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">
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
