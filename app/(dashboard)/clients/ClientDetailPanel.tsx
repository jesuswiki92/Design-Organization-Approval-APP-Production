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

import type { ClientContact, ClientWithContacts } from '@/types/database'

const TIPO_LABEL: Record<string, string> = {
  airline: 'Aerolínea',
  mro: 'MRO',
  private: 'Privado',
  manufacturer: 'Manufacturer',
  other: 'Other',
}

function formatAddress(client: ClientWithContacts) {
  return [client.address, client.city, client.country].filter(Boolean).join(', ')
}

function formatContactName(contact: ClientContact) {
  return [contact.name, contact.last_name].filter(Boolean).join(' ')
}

export function ClientDetailPanel({
  client,
  onClose,
}: {
  client: ClientWithContacts
  onClose?: () => void
}) {
  const address = formatAddress(client)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
      <div className="flex items-center justify-between border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{client.name}</h2>
          {client.vat_tax_id ? (
            <p className="mt-0.5 font-mono text-xs text-[color:var(--ink-3)]">{client.vat_tax_id}</p>
          ) : null}
        </div>
        {onClose ? (
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--ink-3)] transition-colors hover:bg-[color:var(--paper-3)] hover:text-slate-950"
          >
            <X size={15} />
          </button>
        ) : null}
      </div>

      <div className="px-5 py-3">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-[color:var(--ink-3)] hover:text-[color:var(--ink-2)] [&::-webkit-details-marker]:hidden">
            <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
            <span>Ver ficha completa</span>
          </summary>

          <div className="flex flex-col gap-5 pt-4">
            <div className="flex flex-col gap-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                Ficha completa
              </h3>
              <div className="grid gap-3">
                {[
                  { icon: <Building2 size={13} />, label: 'Name', value: client.name },
                  address
                    ? {
                        icon: <MapPin size={13} />,
                        label: 'Address / ubicación',
                        value: address,
                      }
                    : null,
                  client.phone
                    ? { icon: <Phone size={13} />, label: 'Phone', value: client.phone }
                    : null,
                  client.vat_tax_id
                    ? { icon: <Hash size={13} />, label: 'NIF / VAT', value: client.vat_tax_id }
                    : null,
                  client.website
                    ? { icon: <Globe size={13} />, label: 'Web', value: client.website }
                    : null,
                  client.email_domain
                    ? {
                        icon: <Globe size={13} />,
                        label: 'Dominio email',
                        value: client.email_domain,
                      }
                    : null,
                  client.client_type
                    ? {
                        icon: <Building2 size={13} />,
                        label: 'Tipo de client',
                        value: TIPO_LABEL[client.client_type] ?? client.client_type,
                      }
                    : null,
                  {
                    icon: <BadgeCheck size={13} />,
                    label: 'Status',
                    value: client.is_active ? 'Active' : 'Inactivo',
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
                    <div key={item!.label} className="rounded-[18px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-3">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 shrink-0 text-[color:var(--ink-3)]">{item!.icon}</span>
                        <div>
                          <span className="text-xs text-[color:var(--ink-3)]">{item!.label}</span>
                          <p className="text-sm text-slate-950">{item!.value}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {client.notes ? (
              <div className="flex flex-col gap-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                  Notes
                </h3>
                <p className="whitespace-pre-wrap text-sm text-[color:var(--ink-3)]">{client.notes}</p>
              </div>
            ) : null}

            <div className="flex flex-col gap-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ink-3)]">
                Contactos
              </h3>

              {client.contacts.length > 0 ? (
                <div className="grid gap-3">
                  {client.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="rounded-[18px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <UserRound size={13} className="shrink-0 text-[color:var(--ink-3)]" />
                            <p className="truncate text-sm font-medium text-slate-950">
                              {formatContactName(contact)}
                            </p>
                            {contact.is_primary ? (
                              <span className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-2)]">
                                Primary
                              </span>
                            ) : null}
                            {!contact.is_active ? (
                              <span className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
                                Inactivo
                              </span>
                            ) : null}
                          </div>
                          {contact.job_title ? (
                            <p className="mt-1 text-xs text-[color:var(--ink-3)]">{contact.job_title}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-[color:var(--ink-3)]">
                        <div className="flex items-center gap-2">
                          <Mail size={13} className="shrink-0 text-[color:var(--ink-3)]" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                        {contact.phone ? (
                          <div className="flex items-center gap-2">
                            <Phone size={13} className="shrink-0 text-[color:var(--ink-3)]" />
                            <span>{contact.phone}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[18px] border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-4 py-4 text-sm text-[color:var(--ink-3)]">
                  Este client no tiene contacts registrados todavía.
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
    <div className="flex h-full min-h-0 flex-col rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
      <div className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">Detalle del client</h2>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full rounded-[26px] border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-6 text-center">
          <p className="text-sm font-semibold text-slate-950">Selecciona un client</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--ink-3)]">
            La zona izquierda muestra name, address y phone. Al pulsar una fila, aquí verás
            el resto de la información disponible del client.
          </p>
        </div>
      </div>
    </div>
  )
}
