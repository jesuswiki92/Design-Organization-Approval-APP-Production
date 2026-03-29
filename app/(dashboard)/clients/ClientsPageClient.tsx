'use client'

import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import {
  Search,
  Plus,
  X,
  Building2,
  Globe,
  Phone,
  Mail,
  ChevronRight,
  MapPin,
  Hash,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClienteWithContactos } from '@/types/database'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  aerolinea: 'Aerolínea',
  mro: 'MRO',
  privado: 'Privado',
  fabricante: 'Fabricante',
  otro: 'Otro',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ClientDetailPanel({
  client,
  onClose,
}: {
  client: ClienteWithContactos
  onClose: () => void
}) {
  return (
    <div className="w-[400px] shrink-0 flex flex-col bg-white border-l border-sky-100 overflow-auto shadow-[-8px_0_24px_rgba(148,163,184,0.08)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_100%)]">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{client.nombre}</h2>
          {client.cif_vat && (
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{client.cif_vat}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-950 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex flex-col gap-5 px-5 py-4">
        {/* Basic info */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Información General
          </h3>
          <div className="flex flex-col gap-2">
            {[
              { icon: <Building2 size={13} />, label: 'Nombre', value: client.nombre },
              {
                icon: <MapPin size={13} />,
                label: 'Ubicación',
                value: [client.ciudad, client.pais].filter(Boolean).join(', '),
              },
              client.cif_vat
                ? { icon: <Hash size={13} />, label: 'NIF / VAT', value: client.cif_vat }
                : null,
              client.telefono
                ? { icon: <Phone size={13} />, label: 'Teléfono', value: client.telefono }
                : null,
              client.web
                ? { icon: <Globe size={13} />, label: 'Web', value: client.web }
                : null,
              client.tipo_cliente
                ? {
                    icon: <Building2 size={13} />,
                    label: 'Tipo',
                    value: TIPO_LABEL[client.tipo_cliente] ?? client.tipo_cliente,
                  }
                : null,
            ]
              .filter(Boolean)
              .map((item) => (
                <div key={item!.label} className="flex items-start gap-3">
                  <span className="text-slate-400 mt-0.5 shrink-0">{item!.icon}</span>
                  <div>
                    <span className="text-xs text-slate-500">{item!.label}</span>
                    <p className="text-sm text-slate-950">{item!.value}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Contacts */}
        {client.contactos.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Users size={12} />
              Contactos
            </h3>
            <div className="flex flex-col gap-3">
              {client.contactos.map((contact) => (
                <div
                  key={contact.id}
                  className="bg-slate-50 border border-slate-200 rounded-[18px] p-3"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-7 h-7 rounded-full bg-sky-100 border border-sky-200 flex items-center justify-center text-[10px] font-bold text-sky-700 shrink-0">
                      {getInitials(`${contact.nombre} ${contact.apellidos ?? ''}`)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-950">
                        {contact.nombre} {contact.apellidos ?? ''}
                      </p>
                      {contact.cargo && (
                        <p className="text-xs text-slate-500">{contact.cargo}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-2 text-xs text-slate-500 hover:text-sky-700 transition-colors"
                    >
                      <Mail size={11} />
                      {contact.email}
                    </a>
                    {contact.telefono && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Phone size={11} />
                        {contact.telefono}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {client.notas && (
          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Notas
            </h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{client.notas}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Client Component ─────────────────────────────────────────────────────

export default function ClientsPageClient({ clients }: { clients: ClienteWithContactos[] }) {
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClienteWithContactos | null>(null)

  const filtered = clients.filter((c) => {
    if (search === '') return true
    const q = search.toLowerCase()
    const location = [c.ciudad, c.pais].filter(Boolean).join(', ').toLowerCase()
    const principalContact = c.contactos.find((ct) => ct.es_principal) ?? c.contactos[0]
    const contactName = principalContact
      ? `${principalContact.nombre} ${principalContact.apellidos ?? ''}`.toLowerCase()
      : ''
    return (
      c.nombre.toLowerCase().includes(q) ||
      location.includes(q) ||
      contactName.includes(q) ||
      (c.cif_vat ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Clientes" subtitle="Base de datos de clientes" />

      <div className="flex flex-1 min-h-0 text-slate-900">
        {/* Main content */}
        <div className="flex flex-col flex-1 min-h-0 p-5 gap-4">
          {/* Toolbar */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Buscar clientes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-950 placeholder-slate-400 focus:outline-none focus:border-sky-300 transition-colors shadow-sm"
              />
            </div>

            <div className="flex-1" />

            <button className="flex items-center gap-2 bg-[linear-gradient(135deg,#2563EB,#38BDF8)] text-white px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-90 shadow-sm">
              <Plus size={16} />
              Nuevo cliente
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>
              <span className="text-slate-950 font-semibold">{filtered.length}</span> clientes
            </span>
            <span>
              <span className="text-blue-700 font-semibold">
                {filtered.filter((c) => c.activo).length}
              </span>{' '}
              activos
            </span>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {[
                    'Empresa',
                    'Tipo',
                    'Ubicación',
                    'Contacto principal',
                    'Teléfono',
                    'Estado',
                    'Acciones',
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => {
                  const principalContact =
                    client.contactos.find((c) => c.es_principal) ?? client.contactos[0] ?? null
                  const principalName = principalContact
                    ? `${principalContact.nombre}${principalContact.apellidos ? ' ' + principalContact.apellidos : ''}`
                    : '—'
                  const location = [client.ciudad, client.pais].filter(Boolean).join(', ') || '—'

                  return (
                    <tr
                      key={client.id}
                      onClick={() =>
                        setSelectedClient(selectedClient?.id === client.id ? null : client)
                      }
                      className={cn(
                        'border-b border-slate-200/60 cursor-pointer transition-colors',
                        selectedClient?.id === client.id
                          ? 'bg-sky-50/60 border-sky-200/40'
                          : 'hover:bg-sky-50/50',
                      )}
                    >
                      {/* Empresa */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0">
                            <Building2 size={14} className="text-sky-700" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-950">{client.nombre}</p>
                            {client.cif_vat && (
                              <p className="text-xs text-slate-500 font-mono">{client.cif_vat}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3">
                        {client.tipo_cliente ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                            {TIPO_LABEL[client.tipo_cliente] ?? client.tipo_cliente}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Ubicación */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span className="text-sm text-slate-600">{location}</span>
                        </div>
                      </td>

                      {/* Contacto principal */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-sky-100 border border-sky-200 flex items-center justify-center text-[10px] font-bold text-sky-700 shrink-0">
                            {principalContact ? getInitials(principalName) : '?'}
                          </div>
                          <span className="text-sm text-slate-600">{principalName}</span>
                        </div>
                      </td>

                      {/* Teléfono */}
                      <td className="px-4 py-3">
                        {client.telefono ? (
                          <div className="flex items-center gap-1.5">
                            <Phone size={12} className="text-slate-400" />
                            <span className="text-sm text-slate-600">{client.telefono}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border',
                            client.activo
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-slate-500 bg-slate-100 border-slate-200',
                          )}
                        >
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              client.activo ? 'bg-emerald-500' : 'bg-slate-400',
                            )}
                          />
                          {client.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedClient(selectedClient?.id === client.id ? null : client)
                          }}
                          className={cn(
                            'flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl border transition-colors',
                            selectedClient?.id === client.id
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-700 bg-white',
                          )}
                        >
                          Ver detalle
                          <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                      {search
                        ? `No se encontraron clientes para "${search}"`
                        : 'No hay clientes registrados.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side panel */}
        {selectedClient && (
          <ClientDetailPanel client={selectedClient} onClose={() => setSelectedClient(null)} />
        )}
      </div>
    </div>
  )
}
