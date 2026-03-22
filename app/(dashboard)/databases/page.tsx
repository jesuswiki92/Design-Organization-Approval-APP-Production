'use client';

import { useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Database, Layers, Info } from 'lucide-react';

type Tab = 'estructuradas' | 'vectoriales';

const structuredTables = [
  {
    table: 'doa_new_projects',
    description: 'Expedientes de certificación y modificaciones',
    records: 7,
    updated: '2026-03-20',
    accent: '#3B82F6', // blue
  },
  {
    table: 'doa_new_clients',
    description: 'Clientes y operadores registrados',
    records: 4,
    updated: '2026-03-18',
    accent: '#22C55E', // green
  },
  {
    table: 'doa_new_aircraft',
    description: 'Aeronaves, variantes y configuraciones',
    records: 12,
    updated: '2026-03-19',
    accent: '#F59E0B', // amber
  },
  {
    table: 'doa_new_documents',
    description: 'Documentos técnicos y reportes internos',
    records: 31,
    updated: '2026-03-21',
    accent: '#A855F7', // purple
  },
  {
    table: 'doa_new_tasks',
    description: 'Tareas y acciones de ingeniería',
    records: 18,
    updated: '2026-03-22',
    accent: '#F97316', // orange
  },
  {
    table: 'doa_new_profiles',
    description: 'Perfiles de usuario y roles del equipo',
    records: 5,
    updated: '2026-03-15',
    accent: '#6366F1', // indigo
  },
];

const vectorCorpora = [
  {
    name: 'Certificación',
    description: 'Normativa EASA/FAA: CS-25, FAR 23, Part 21, AMC/GM',
    documents: 0,
  },
  {
    name: 'Aeronaves',
    description: 'TCDS y manuales de flota',
    documents: 0,
  },
];

function StatusDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block rounded-full"
      style={{ width: 8, height: 8, backgroundColor: color, flexShrink: 0 }}
    />
  );
}

export default function DatabasesPage() {
  const [tab, setTab] = useState<Tab>('estructuradas');

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F1117' }}>
      <TopBar title="Bases de datos" subtitle="Gestión de datos estructurados y vectoriales" />

      <div className="p-6">
        {/* Tab toggle */}
        <div
          className="inline-flex rounded-lg p-1 mb-6"
          style={{ backgroundColor: '#1A1D27', border: '1px solid #2A2D3E' }}
        >
          {(['estructuradas', 'vectoriales'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all duration-150"
              style={
                tab === t
                  ? { backgroundColor: '#6366F1', color: '#ffffff' }
                  : { backgroundColor: 'transparent', color: '#6B7280' }
              }
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* TAB 1: Estructuradas */}
        {tab === 'estructuradas' && (
          <div>
            <div className="grid grid-cols-3 gap-4">
              {structuredTables.map((item) => (
                <div
                  key={item.table}
                  className="rounded-xl p-5 flex flex-col gap-3"
                  style={{ backgroundColor: '#1A1D27', border: '1px solid #2A2D3E' }}
                >
                  {/* Top row: accent bar + status */}
                  <div className="flex items-center justify-between">
                    <span
                      className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor: `${item.accent}1A`,
                        color: item.accent,
                      }}
                    >
                      <Database size={12} className="inline mr-1" style={{ color: item.accent }} />
                      tabla
                    </span>
                    <div className="flex items-center gap-1.5">
                      <StatusDot color="#22C55E" />
                      <span className="text-xs" style={{ color: '#6B7280' }}>
                        healthy
                      </span>
                    </div>
                  </div>

                  {/* Table name */}
                  <p
                    className="text-sm font-mono font-semibold break-all"
                    style={{ color: '#E8E9F0' }}
                  >
                    {item.table}
                  </p>

                  {/* Description */}
                  <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>
                    {item.description}
                  </p>

                  {/* Meta */}
                  <div className="flex items-center justify-between text-xs" style={{ color: '#6B7280' }}>
                    <span>{item.records} registros</span>
                    <span>Act. {item.updated}</span>
                  </div>

                  {/* Button */}
                  <div className="relative group">
                    <button
                      disabled
                      className="w-full px-3 py-1.5 rounded-lg text-sm font-medium cursor-not-allowed"
                      style={{
                        backgroundColor: '#2A2D3E',
                        color: '#6B7280',
                        border: '1px solid #2A2D3E',
                      }}
                    >
                      Ver tabla
                    </button>
                    <span
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                      style={{ backgroundColor: '#2A2D3E', color: '#E8E9F0' }}
                    >
                      Próximamente
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: Vectoriales */}
        {tab === 'vectoriales' && (
          <div className="flex flex-col gap-6">
            {/* Section header */}
            <div className="flex items-center gap-2">
              <Layers size={20} style={{ color: '#6366F1' }} />
              <h2 className="text-base font-semibold" style={{ color: '#E8E9F0' }}>
                Corpus vectoriales
              </h2>
            </div>

            {/* Corpus cards */}
            <div className="grid grid-cols-2 gap-4">
              {vectorCorpora.map((corpus) => (
                <div
                  key={corpus.name}
                  className="rounded-xl p-5 flex flex-col gap-3"
                  style={{ backgroundColor: '#1A1D27', border: '1px solid #2A2D3E' }}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm" style={{ color: '#E8E9F0' }}>
                      {corpus.name}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <StatusDot color="#F59E0B" />
                      <span className="text-xs" style={{ color: '#6B7280' }}>
                        vacío
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>
                    {corpus.description}
                  </p>

                  {/* Badges row */}
                  <div className="flex items-center gap-3 text-xs" style={{ color: '#6B7280' }}>
                    <span
                      className="px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: '#2A2D3E', color: '#6B7280' }}
                    >
                      {corpus.documents} documentos indexados
                    </span>
                    <span>Actualizado: N/A</span>
                  </div>

                  {/* Button */}
                  <button
                    disabled
                    className="w-full px-3 py-2 rounded-lg text-sm font-medium cursor-not-allowed opacity-50"
                    style={{
                      backgroundColor: '#6366F1',
                      color: '#ffffff',
                    }}
                  >
                    + Añadir documentos
                  </button>
                </div>
              ))}
            </div>

            {/* Info banner */}
            <div
              className="rounded-xl p-4 flex items-start gap-3"
              style={{
                backgroundColor: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.25)',
              }}
            >
              <Info size={16} style={{ color: '#6366F1', flexShrink: 0, marginTop: 1 }} />
              <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
                La indexación de documentos se configurará en{' '}
                <span style={{ color: '#E8E9F0', fontWeight: 500 }}>Fase 2</span> junto con los
                expertos IA.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
