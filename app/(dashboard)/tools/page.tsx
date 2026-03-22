'use client';

import { TopBar } from '@/components/layout/TopBar';
import { Bot, Shield, Plane, FolderSearch, FileText } from 'lucide-react';
import { useState } from 'react';

const experts = [
  {
    icon: Shield,
    name: 'Experto en Certificación',
    description: 'Consulta sobre CS-25, FAR 23, Part 21, AMC/GM y procedimientos DOA',
  },
  {
    icon: Plane,
    name: 'Experto en Aeronaves',
    description: 'TCDS, manuales de flota, configuraciones aprobadas y variantes',
  },
  {
    icon: FolderSearch,
    name: 'Experto en Proyectos',
    description: 'Búsqueda semántica sobre expedientes históricos de la empresa',
  },
];

const forms = [
  {
    name: 'Alta de cliente',
    description: 'Registro de nuevo cliente en la base de datos',
    phase2: false,
  },
  {
    name: 'Intake de proyecto',
    description: 'Inicio de nuevo expediente de certificación',
    phase2: false,
  },
  {
    name: 'Non-conformity',
    description: 'Registro de hallazgo o no conformidad interna',
    phase2: true,
  },
];

export default function ToolsPage() {
  const [openChat, setOpenChat] = useState<string | null>(null);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F1117' }}>
      <TopBar title="Tools" subtitle="Soporte a la ingeniería" />

      <div className="p-6 flex gap-6">
        {/* LEFT: Expertos IA (2/3) */}
        <div className="flex-1" style={{ flexBasis: '66.666%' }}>
          {/* Section header */}
          <div className="flex items-center gap-2 mb-4">
            <Bot size={20} style={{ color: '#6366F1' }} />
            <h2 className="text-base font-semibold" style={{ color: '#E8E9F0' }}>
              Expertos IA
            </h2>
          </div>

          {/* Expert cards */}
          <div className="flex flex-col gap-3">
            {experts.map((expert) => {
              const Icon = expert.icon;
              return (
                <div
                  key={expert.name}
                  className="rounded-xl p-5 flex items-center gap-4 transition-all duration-150 hover:brightness-110"
                  style={{
                    backgroundColor: '#1A1D27',
                    border: '1px solid #2A2D3E',
                  }}
                >
                  <div
                    className="flex-shrink-0 flex items-center justify-center rounded-lg"
                    style={{
                      width: 44,
                      height: 44,
                      backgroundColor: 'rgba(99,102,241,0.12)',
                    }}
                  >
                    <Icon size={22} style={{ color: '#6366F1' }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: '#E8E9F0' }}>
                      {expert.name}
                    </p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#6B7280' }}>
                      {expert.description}
                    </p>
                  </div>

                  <button
                    onClick={() => setOpenChat(expert.name)}
                    className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 hover:opacity-90 active:scale-95"
                    style={{
                      backgroundColor: '#6366F1',
                      color: '#ffffff',
                    }}
                  >
                    Abrir chat
                  </button>
                </div>
              );
            })}
          </div>

          {/* Disclaimer */}
          <p className="mt-4 text-xs leading-relaxed" style={{ color: '#6B7280' }}>
            * Los expertos IA asisten al ingeniero. Verificar siempre antes de usar en expediente oficial.
          </p>
        </div>

        {/* RIGHT: Formularios (1/3) */}
        <div className="flex-shrink-0" style={{ flexBasis: '33.333%' }}>
          {/* Section header */}
          <div className="flex items-center gap-2 mb-4">
            <FileText size={20} style={{ color: '#6366F1' }} />
            <h2 className="text-base font-semibold" style={{ color: '#E8E9F0' }}>
              Formularios
            </h2>
          </div>

          {/* Form cards */}
          <div className="flex flex-col gap-3">
            {forms.map((form) => (
              <div
                key={form.name}
                className="rounded-xl p-4 relative transition-all duration-150 hover:brightness-110"
                style={{
                  backgroundColor: '#1A1D27',
                  border: '1px solid #2A2D3E',
                }}
              >
                {form.phase2 && (
                  <span
                    className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: '#2A2D3E',
                      color: '#6B7280',
                    }}
                  >
                    Fase 2
                  </span>
                )}

                <p className="font-semibold text-sm" style={{ color: '#E8E9F0' }}>
                  {form.name}
                </p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: '#6B7280' }}>
                  {form.description}
                </p>

                <button
                  className="mt-3 w-full px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 hover:brightness-110 active:scale-95"
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #2A2D3E',
                    color: '#E8E9F0',
                  }}
                >
                  Abrir
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat modal placeholder */}
      {openChat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setOpenChat(null)}
        >
          <div
            className="rounded-2xl p-8 flex flex-col items-center gap-3"
            style={{ backgroundColor: '#1A1D27', border: '1px solid #2A2D3E', minWidth: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Bot size={32} style={{ color: '#6366F1' }} />
            <p className="font-semibold text-base" style={{ color: '#E8E9F0' }}>
              {openChat}
            </p>
            <p className="text-sm" style={{ color: '#6B7280' }}>
              Chat — próximamente disponible
            </p>
            <button
              onClick={() => setOpenChat(null)}
              className="mt-2 px-5 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: '#2A2D3E', color: '#E8E9F0' }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
