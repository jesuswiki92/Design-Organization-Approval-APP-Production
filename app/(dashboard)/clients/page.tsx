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
  Plane,
  FolderOpen,
  ChevronRight,
  MapPin,
  Hash,
  Users,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  name: string
  role: string
  email: string
  phone: string
}

interface FleetItem {
  type: string
  count: number
  registration?: string
}

interface AssociatedProject {
  code: string
  name: string
  status: 'active' | 'review' | 'approved' | 'paused' | 'closed'
}

interface Client {
  id: string
  company: string
  legalName: string
  country: string
  countryCode: string
  vat: string
  activeProjects: number
  mainContact: string
  fleet: FleetItem[]
  contacts: Contact[]
  projects: AssociatedProject[]
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_CLIENTS: Client[] = [
  {
    id: 'c1',
    company: 'Iberia MRO',
    legalName: 'Iberia Mantenimiento S.A.',
    country: 'España',
    countryCode: 'ES',
    vat: 'ESA28023432',
    activeProjects: 3,
    mainContact: 'P. Delgado',
    fleet: [
      { type: 'Airbus A320-214', count: 42, registration: 'EC-***' },
      { type: 'Airbus A321-211', count: 18, registration: 'EC-***' },
      { type: 'Airbus A350-941', count: 9, registration: 'EC-***' },
    ],
    contacts: [
      { name: 'Pablo Delgado', role: 'Engineering Manager', email: 'p.delgado@iberia.es', phone: '+34 91 587 4400' },
      { name: 'Carmen Ruiz', role: 'Airworthiness Engineer', email: 'c.ruiz@iberia.es', phone: '+34 91 587 4450' },
      { name: 'Juan Torres', role: 'Projects Coordinator', email: 'j.torres@iberia.es', phone: '+34 91 587 4520' },
    ],
    projects: [
      { code: 'DOA-2024-001', name: 'Modificación Sistema de Combustible A320', status: 'active' },
      { code: 'DOA-2023-078', name: 'Instalación IFE Premium A350', status: 'approved' },
      { code: 'DOA-2023-065', name: 'Mod. Puerta de Servicio A321', status: 'closed' },
    ],
  },
  {
    id: 'c2',
    company: 'Vueling Airlines',
    legalName: 'Vueling Airlines S.A.',
    country: 'España',
    countryCode: 'ES',
    vat: 'ESA63570975',
    activeProjects: 1,
    mainContact: 'M. López',
    fleet: [
      { type: 'Airbus A320-232', count: 71, registration: 'EC-***' },
      { type: 'Airbus A321-231', count: 25, registration: 'EC-***' },
    ],
    contacts: [
      { name: 'María López', role: 'Technical Director', email: 'm.lopez@vueling.com', phone: '+34 93 831 5000' },
      { name: 'Andreu Pujol', role: 'Fleet Engineer', email: 'a.pujol@vueling.com', phone: '+34 93 831 5010' },
    ],
    projects: [
      { code: 'DOA-2024-002', name: 'Instalación WiFi Cabin B737', status: 'review' },
      { code: 'DOA-2022-041', name: 'Retrofit LED Cabin A320', status: 'approved' },
    ],
  },
  {
    id: 'c3',
    company: 'Air Nostrum',
    legalName: 'Air Nostrum, L.A.M. S.A.',
    country: 'España',
    countryCode: 'ES',
    vat: 'ESA46159778',
    activeProjects: 0,
    mainContact: 'P. Martínez',
    fleet: [
      { type: 'ATR 72-600', count: 24, registration: 'EC-***' },
      { type: 'Bombardier CRJ-1000', count: 17, registration: 'EC-***' },
    ],
    contacts: [
      { name: 'Pedro Martínez', role: 'Director de Mantenimiento', email: 'p.martinez@airnostrum.es', phone: '+34 96 391 3940' },
    ],
    projects: [
      { code: 'DOA-2024-003', name: 'Reparación Estructura Ala ATR72', status: 'approved' },
      { code: 'DOA-2023-055', name: 'Mod. Sistema de Oxígeno CRJ', status: 'closed' },
    ],
  },
  {
    id: 'c4',
    company: 'SUMMA 112',
    legalName: 'SUMMA 112 — Servicio de Urgencias de Madrid',
    country: 'España',
    countryCode: 'ES',
    vat: 'ESS2800175C',
    activeProjects: 1,
    mainContact: 'R. Fernández',
    fleet: [
      { type: 'Airbus H135', count: 8, registration: 'EC-***' },
      { type: 'Airbus H145', count: 3, registration: 'EC-***' },
    ],
    contacts: [
      { name: 'Rafael Fernández', role: 'Fleet Coordinator', email: 'r.fernandez@summa112.es', phone: '+34 91 586 1123' },
      { name: 'Laura Sanz', role: 'Airworthiness Responsible', email: 'l.sanz@summa112.es', phone: '+34 91 586 1124' },
    ],
    projects: [
      { code: 'DOA-2024-004', name: 'STC Equipamiento Médico Emergencia', status: 'paused' },
    ],
  },
  {
    id: 'c5',
    company: 'Flexjet Spain',
    legalName: 'Flexjet International Spain S.L.',
    country: 'España',
    countryCode: 'ES',
    vat: 'ESB86543210',
    activeProjects: 1,
    mainContact: 'A. Romero',
    fleet: [
      { type: 'Pilatus PC-12/47E', count: 6, registration: 'EC-***' },
      { type: 'Bombardier Challenger 350', count: 4, registration: 'EC-***' },
    ],
    contacts: [
      { name: 'Alejandro Romero', role: 'Chief Pilot & Technical Mgr', email: 'a.romero@flexjet.es', phone: '+34 91 202 3310' },
    ],
    projects: [
      { code: 'DOA-2024-005', name: 'Análisis HIRF Aviónica PC-12', status: 'active' },
    ],
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

const PROJECT_STATUS_CONFIG = {
  active: { label: 'En curso', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  review: { label: 'En revisión', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  approved: { label: 'Aprobado', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  paused: { label: 'En pausa', color: 'text-gray-400', bg: 'bg-gray-500/10' },
  closed: { label: 'Cerrado', color: 'text-gray-500', bg: 'bg-gray-700/20' },
}

function CountryFlag({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center justify-center w-5 h-4 text-sm">
      {code === 'ES' ? '🇪🇸' : code === 'DE' ? '🇩🇪' : code === 'FR' ? '🇫🇷' : '🌐'}
    </span>
  )
}

function ClientDetailPanel({
  client,
  onClose,
}: {
  client: Client
  onClose: () => void
}) {
  return (
    <div className="w-[400px] shrink-0 flex flex-col bg-[#1A1D27] border-l border-[#2A2D3E] overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2D3E]">
        <div>
          <h2 className="text-base font-semibold text-[#E8E9F0]">{client.company}</h2>
          <p className="text-xs text-[#6B7280] mt-0.5">{client.legalName}</p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#2A2D3E] text-[#6B7280] hover:text-[#E8E9F0] transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex flex-col gap-5 px-5 py-4">
        {/* Basic info */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
            Información General
          </h3>
          <div className="flex flex-col gap-2">
            {[
              { icon: <Building2 size={13} />, label: 'Razón social', value: client.legalName },
              { icon: <MapPin size={13} />, label: 'País', value: client.country },
              { icon: <Hash size={13} />, label: 'NIF / VAT', value: client.vat },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <span className="text-[#6B7280] mt-0.5 shrink-0">{item.icon}</span>
                <div>
                  <span className="text-xs text-[#6B7280]">{item.label}</span>
                  <p className="text-sm text-[#E8E9F0]">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contacts */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-2">
            <Users size={12} />
            Contactos
          </h3>
          <div className="flex flex-col gap-3">
            {client.contacts.map((contact, idx) => (
              <div
                key={idx}
                className="bg-[#0F1117] border border-[#2A2D3E] rounded-lg p-3"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 rounded-full bg-[#6366F1]/20 border border-[#6366F1]/30 flex items-center justify-center text-[10px] font-bold text-[#6366F1] shrink-0">
                    {contact.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#E8E9F0]">{contact.name}</p>
                    <p className="text-xs text-[#6B7280]">{contact.role}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-2 text-xs text-[#6B7280] hover:text-[#6366F1] transition-colors"
                  >
                    <Mail size={11} />
                    {contact.email}
                  </a>
                  <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                    <Phone size={11} />
                    {contact.phone}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fleet */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-2">
            <Plane size={12} />
            Flota
          </h3>
          <div className="bg-[#0F1117] border border-[#2A2D3E] rounded-lg divide-y divide-[#2A2D3E]/50">
            {client.fleet.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2">
                <div>
                  <span className="text-sm text-[#E8E9F0]">{item.type}</span>
                  {item.registration && (
                    <span className="text-xs text-[#6B7280] ml-2 font-mono">{item.registration}</span>
                  )}
                </div>
                <span className="text-sm font-semibold text-[#6366F1]">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Projects */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-2">
            <FolderOpen size={12} />
            Proyectos Asociados
          </h3>
          <div className="flex flex-col gap-1.5">
            {client.projects.map((proj) => {
              const cfg = PROJECT_STATUS_CONFIG[proj.status]
              return (
                <div
                  key={proj.code}
                  className="flex items-start justify-between bg-[#0F1117] border border-[#2A2D3E] rounded-lg px-3 py-2.5 hover:border-[#6366F1]/30 transition-colors group cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-[11px] text-[#6B7280]">{proj.code}</span>
                      <span className={cn('text-[11px] px-1.5 py-0.5 rounded', cfg.color, cfg.bg)}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#E8E9F0]">{proj.name}</p>
                  </div>
                  <ExternalLink
                    size={12}
                    className="text-[#6B7280] group-hover:text-[#6366F1] transition-colors shrink-0 mt-0.5"
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

  const filtered = MOCK_CLIENTS.filter((c) => {
    if (search === '') return true
    const q = search.toLowerCase()
    return (
      c.company.toLowerCase().includes(q) ||
      c.legalName.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      c.mainContact.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col h-full bg-[#0F1117]">
      <TopBar title="Clientes" subtitle="Base de datos de clientes" />

      <div className="flex flex-1 min-h-0">
        {/* Main content */}
        <div className="flex flex-col flex-1 min-h-0 p-5 gap-4">
          {/* Toolbar */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]"
              />
              <input
                type="text"
                placeholder="Buscar clientes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#1A1D27] border border-[#2A2D3E] rounded-lg pl-9 pr-3 py-2 text-sm text-[#E8E9F0] placeholder-[#6B7280] focus:outline-none focus:border-[#6366F1]/60 transition-colors"
              />
            </div>

            <div className="flex-1" />

            <button className="flex items-center gap-2 bg-[#6366F1] hover:bg-[#5558E3] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus size={16} />
              Nuevo cliente
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-[#6B7280]">
            <span>
              <span className="text-[#E8E9F0] font-semibold">{filtered.length}</span> clientes
            </span>
            <span>
              <span className="text-blue-400 font-semibold">
                {filtered.reduce((sum, c) => sum + c.activeProjects, 0)}
              </span>{' '}
              proyectos activos
            </span>
          </div>

          {/* Table */}
          <div className="bg-[#1A1D27] border border-[#2A2D3E] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2D3E]">
                  {[
                    'Empresa',
                    'País',
                    'Proyectos activos',
                    'Contacto principal',
                    'Flota',
                    'Acciones',
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() =>
                      setSelectedClient(selectedClient?.id === client.id ? null : client)
                    }
                    className={cn(
                      'border-b border-[#2A2D3E]/50 cursor-pointer transition-colors',
                      selectedClient?.id === client.id
                        ? 'bg-[#6366F1]/5 border-[#6366F1]/20'
                        : 'hover:bg-[#1E2130]',
                    )}
                  >
                    {/* Empresa */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#6366F1]/10 border border-[#6366F1]/20 flex items-center justify-center shrink-0">
                          <Building2 size={14} className="text-[#6366F1]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#E8E9F0]">{client.company}</p>
                          <p className="text-xs text-[#6B7280] font-mono">{client.vat}</p>
                        </div>
                      </div>
                    </td>

                    {/* País */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <CountryFlag code={client.countryCode} />
                        <span className="text-sm text-[#6B7280]">{client.country}</span>
                      </div>
                    </td>

                    {/* Proyectos activos */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold',
                          client.activeProjects > 0
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-[#2A2D3E] text-[#6B7280]',
                        )}
                      >
                        {client.activeProjects}
                      </span>
                    </td>

                    {/* Contacto principal */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#6366F1]/20 border border-[#6366F1]/30 flex items-center justify-center text-[10px] font-bold text-[#6366F1] shrink-0">
                          {client.mainContact.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm text-[#6B7280]">{client.mainContact}</span>
                      </div>
                    </td>

                    {/* Flota */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Plane size={12} className="text-[#6B7280]" />
                        <span className="text-sm text-[#6B7280]">
                          {client.fleet.reduce((sum, f) => sum + f.count, 0)} aeronaves
                        </span>
                        <span className="text-xs text-[#6B7280]">
                          ({client.fleet.length} tipo{client.fleet.length !== 1 ? 's' : ''})
                        </span>
                      </div>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedClient(selectedClient?.id === client.id ? null : client)
                        }}
                        className={cn(
                          'flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors',
                          selectedClient?.id === client.id
                            ? 'bg-[#6366F1] text-white border-[#6366F1]'
                            : 'text-[#6B7280] border-[#2A2D3E] hover:border-[#6366F1]/40 hover:text-[#E8E9F0]',
                        )}
                      >
                        Ver detalle
                        <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#6B7280]">
                      No se encontraron clientes para "{search}"
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
