'use client'

import {
  BadgeCheck,
  Building2,
  ChevronDown,
  Globe,
  Hash,
  Mail,
  MapPin,
  Phone,
  UserRound,
  X,
} from 'lucide-react'

import type { ClienteContacto, ClienteWithContactos } from '@/types/database'

const TIPO_LABEL: Record<string, string> = {
  aerolinea: 'Aerolínea',
  mro: 'MRO',
  privado: 'Privado',
  fabricante: 'Fabricante',
  otro: 'Otro',
}

function formatAddress(client: ClienteWithContactos) {
  return [client.direccion, client.ciudad, client.pais].filter(Boolean).join(', ')
}

function formatContactName(contact: ClienteContacto) {
  return [contact.nombre, contact.apellidos].filter(Boolean).join(' ')
}

export function ClientDetailPanel({
  client,
  onClose,
}: {
  client: ClienteWithContactos
  onClose?: () => void
}) {
  const address = formatAddress(client)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_100%)] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{client.nombre}</h2>
          {client.cif_vat ? (
            <p className="mt-0.5 font-mono text-xs text-slate-500">{client.cif_vat}</p>
          ) : null}
        </div>
        {onClose ? (
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-950"
          >
            <X size={15} />
          </button>
        ) : null}
      </div>

      <div className="px-5 py-3">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-sky-600 hover:text-sky-700 [&::-webkit-details-marker]:hidden">
            <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
            <span>Ver ficha completa</span>
          </summary>

          <div className="flex flex-col gap-5 pt-4">
            <div className="flex flex-col gap-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Ficha completa
              </h3>
              <div className="grid gap-3">
                {[
                  { icon: <Building2 size={13} />, label: 'Nombre', value: client.nombre },
                  address
                    ? {
                        icon: <MapPin size={13} />,
                        label: 'Dirección / ubicación',
                        value: address,
                      }
                    : null,
                  client.telefono
                    ? { icon: <Phone size={13} />, label: 'Teléfono', value: client.telefono }
                    : null,
                  client.cif_vat
                    ? { icon: <Hash size={13} />, label: 'NIF / VAT', value: client.cif_vat }
                    : null,
                  client.web
                    ? { icon: <Globe size={13} />, label: 'Web', value: client.web }
                    : null,
                  client.dominio_email
                    ? {
                        icon: <Globe size={13} />,
                        label: 'Dominio email',
                        value: client.dominio_email,
                      }
                    : null,
                  client.tipo_cliente
                    ? {
                        icon: <Building2 size={13} />,
                        label: 'Tipo de cliente',
                        value: TIPO_LABEL[client.tipo_cliente] ?? client.tipo_cliente,
                      }
                    : null,
                  {
                    icon: <BadgeCheck size={13} />,
                    label: 'Estado',
                    value: client.activo ? 'Activo' : 'Inactivo',
                  },
                  client.created_at
                    ? {
                        icon: <Hash size={13} />,
                        label: 'Creado',
                        value: new Date(client.created_at).toLocaleDateString('es-ES'),
                      }
                    : null,
                ]
                  .filter(Boolean)
                  .map((item) => (
                    <div key={item!.label} className="rounded-[18px] border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 shrink-0 text-slate-400">{item!.icon}</span>
                        <div>
                          <span className="text-xs text-slate-500">{item!.label}</span>
                          <p className="text-sm text-slate-950">{item!.value}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {client.notas ? (
              <div className="flex flex-col gap-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Notas
                </h3>
                <p className="whitespace-pre-wrap text-sm text-slate-600">{client.notas}</p>
              </div>
            ) : null}

            <div className="flex flex-col gap-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Contactos
              </h3>

              {client.contactos.length > 0 ? (
                <div className="grid gap-3">
                  {client.contactos.map((contact) => (
                    <div
                      key={contact.id}
                      className="rounded-[18px] border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <UserRound size={13} className="shrink-0 text-slate-400" />
                            <p className="truncate text-sm font-medium text-slate-950">
                              {formatContactName(contact)}
                            </p>
                            {contact.es_principal ? (
                              <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                                Principal
                              </span>
                            ) : null}
                            {!contact.activo ? (
                              <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                Inactivo
                              </span>
                            ) : null}
                          </div>
                          {contact.cargo ? (
                            <p className="mt-1 text-xs text-slate-500">{contact.cargo}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Mail size={13} className="shrink-0 text-slate-400" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                        {contact.telefono ? (
                          <div className="flex items-center gap-2">
                            <Phone size={13} className="shrink-0 text-slate-400" />
                            <span>{contact.telefono}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Este cliente no tiene contactos registrados todavía.
                </div>
              )}
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}

export function EmptyClientDetail() {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_100%)] px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">Detalle del cliente</h2>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full rounded-[26px] border border-dashed border-sky-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] p-6 text-center">
          <p className="text-sm font-semibold text-slate-950">Selecciona un cliente</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            La zona izquierda muestra nombre, dirección y teléfono. Al pulsar una fila, aquí verás
            el resto de la información disponible del cliente.
          </p>
        </div>
      </div>
    </div>
  )
}
