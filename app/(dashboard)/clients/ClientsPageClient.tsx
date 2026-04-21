/**
 * ============================================================================
 * COMPONENTE VISUAL DE LA PAGINA DE CLIENTES — patron magazine (warm executive)
 * ============================================================================
 *
 * Replica el patron del prototipo standalone:
 *   - Headline serif con metrica ("{N} clients, {M} active this year.")
 *   - Subtitulo en sans corta
 *   - Botones "Export CSV" (outline) + "+ Add client" (ink filled)
 *   - Grid 3 columnas de cards con avatar circular de color por client
 *     y footer "N contacts" / "Since YYYY" (italic serif)
 *
 * Al hacer click en una card se abre el ClientDetailPanel existente
 * en un overlay lateral (se conserva la logica previa).
 * ============================================================================
 */

'use client'

import { useMemo, useState } from 'react'
import { Search, Plus, Download } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { cn } from '@/lib/utils'
import type { ClientWithContacts } from '@/types/database'

import { ClientDetailPanel } from './ClientDetailPanel'

/** Paleta controlada de avatares — solo tonos warm executive */
const AVATAR_PALETTE: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: '#3d4a2e', fg: '#f5f3ee' }, // verde oscuro
  { bg: '#2f4aa8', fg: '#f5f3ee' }, // cobalt
  { bg: '#8a5a2b', fg: '#f5f3ee' }, // umber
  { bg: '#4a3a2a', fg: '#f5f3ee' }, // dark umber
  { bg: '#545250', fg: '#f5f3ee' }, // ink slate
  { bg: '#6b8e5a', fg: '#242220' }, // sage
  { bg: '#a85425', fg: '#f5f3ee' }, // warn orange
  { bg: '#3d322a', fg: '#f5f3ee' }, // ink deep
]

/** Hash estable -> indice de paleta, da un color consistente por client */
function colorForClient(key: string): { bg: string; fg: string } {
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  const idx = Math.abs(hash) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[idx]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function yearOf(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return String(d.getFullYear())
}

export default function ClientsPageClient({
  clients,
}: {
  clients: ClientWithContacts[]
}) {
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClientWithContacts | null>(null)

  const filtered = useMemo(() => {
    if (search === '') return clients
    const q = search.toLowerCase()
    return clients.filter((client) => {
      return (
        client.name.toLowerCase().includes(q) ||
        (client.city ?? '').toLowerCase().includes(q) ||
        (client.country ?? '').toLowerCase().includes(q) ||
        (client.vat_tax_id ?? '').toLowerCase().includes(q)
      )
    })
  }, [clients, search])

  const total = clients.length
  const activeThisYear = clients.filter((c) => c.is_active).length

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[color:var(--paper)]">
      <TopBar title="Clients" subtitle="Base de data de clients" />

      <div className="flex min-h-0 flex-1 gap-5 p-5 text-[color:var(--ink)]">
        <div className="flex min-h-0 flex-1 flex-col gap-5">
          {/* Headline serif + metricas */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-[family-name:var(--font-heading)] text-[34px] leading-tight tracking-tight text-[color:var(--ink)]">
                {total} clients,{' '}
                <em className="italic text-[color:var(--ink-2)]">
                  {activeThisYear} active this year.
                </em>
              </h2>
              <p className="mt-1 text-sm text-[color:var(--ink-3)]">
                People and companies we&apos;ve supported. Click a card to see full history.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] px-4 text-sm font-medium text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--paper-3)]"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[color:var(--ink)] px-4 text-sm font-medium text-[color:var(--paper)] transition-colors hover:bg-[color:var(--ink-2)]"
              >
                <Plus className="h-4 w-4" />
                Add client
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-3)]"
            />
            <input
              type="text"
              placeholder="Search by name, city, country or VAT…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2)] py-2 pl-9 pr-3 text-sm text-[color:var(--ink)] transition-colors placeholder:text-[color:var(--ink-3)] focus:border-[color:var(--umber)] focus:outline-none focus:ring-2 focus:ring-[color:var(--umber)]/20"
            />
          </div>

          {/* Grid */}
          <div className="min-h-0 flex-1 overflow-auto pr-1">
            {filtered.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-[color:var(--line)] bg-transparent px-6 py-16 text-center text-sm text-[color:var(--ink-3)]">
                {search
                  ? `No se encontraron clients para "${search}"`
                  : 'No hay clients registrados.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((client) => {
                  const { bg, fg } = colorForClient(client.id || client.name)
                  const city = client.city ?? ''
                  const country = client.country ?? ''
                  const locationLine = [city, country].filter(Boolean).join(' · ').toUpperCase()
                  const isSelected = selectedClient?.id === client.id
                  const contactsCount = client.contacts.length
                  const activeContacts = client.contacts.filter((c) => c.is_active).length

                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => setSelectedClient(isSelected ? null : client)}
                      className={cn(
                        'group flex w-full flex-col gap-3 rounded-[20px] border bg-[color:var(--paper-2)] p-4 text-left transition-colors',
                        isSelected
                          ? 'border-[color:var(--umber)]'
                          : 'border-[color:var(--line)] hover:border-[color:var(--line-strong)]',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-wider"
                          style={{ backgroundColor: bg, color: fg }}
                          aria-hidden="true"
                        >
                          {getInitials(client.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-[family-name:var(--font-heading)] text-[17px] leading-tight text-[color:var(--ink)]">
                            {client.name}
                          </p>
                          {locationLine ? (
                            <p className="mt-1 truncate font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
                              {locationLine}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-end justify-between gap-3 border-t border-[color:var(--line)] pt-3">
                        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
                          {contactsCount} contacts
                          {activeContacts > 0 ? ` · ${activeContacts} active` : ''}
                        </span>
                        <span className="font-[family-name:var(--font-heading)] text-[13px] italic text-[color:var(--ink-3)]">
                          Since {yearOf(client.created_at)}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Panel lateral de detalle (se conserva) */}
        {selectedClient ? (
          <div className="min-h-0 w-[360px] shrink-0">
            <ClientDetailPanel
              client={selectedClient}
              onClose={() => setSelectedClient(null)}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
