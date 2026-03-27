'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bot, FileText, FolderSearch, Plane, Shield } from 'lucide-react';

import { TopBar } from '@/components/layout/TopBar';

const experts = [
  {
    icon: Shield,
    name: 'Experto en Certificacion',
    description: 'Consulta sobre CS-25, FAR 23, Part 21, AMC/GM y procedimientos DOA',
    href: '/tools/experto',
  },
  {
    icon: Plane,
    name: 'Experto en Aeronaves',
    description: 'TCDS, manuales de flota, configuraciones aprobadas y variantes',
  },
  {
    icon: FolderSearch,
    name: 'Experto en Proyectos',
    description: 'Busqueda semantica sobre expedientes historicos de la empresa',
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
    description: 'Inicio de nuevo expediente de certificacion',
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
      <TopBar title="Tools" subtitle="Soporte a la ingenieria" />

      <div className="flex gap-6 p-6">
        <div className="flex-1" style={{ flexBasis: '66.666%' }}>
          <div className="mb-4 flex items-center gap-2">
            <Bot size={20} style={{ color: '#6366F1' }} />
            <h2 className="text-base font-semibold" style={{ color: '#E8E9F0' }}>
              Expertos IA
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            {experts.map((expert) => {
              const Icon = expert.icon;

              return (
                <div
                  key={expert.name}
                  className="flex items-center gap-4 rounded-xl p-5 transition-all duration-150 hover:brightness-110"
                  style={{
                    backgroundColor: '#1A1D27',
                    border: '1px solid #2A2D3E',
                  }}
                >
                  <div
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: 'rgba(99,102,241,0.12)' }}
                  >
                    <Icon size={22} style={{ color: '#6366F1' }} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: '#E8E9F0' }}>
                      {expert.name}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed" style={{ color: '#6B7280' }}>
                      {expert.description}
                    </p>
                  </div>

                  {expert.href ? (
                    <Link
                      href={expert.href}
                      className="flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 hover:opacity-90 active:scale-95"
                      style={{
                        backgroundColor: '#6366F1',
                        color: '#ffffff',
                      }}
                    >
                      Abrir chat
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenChat(expert.name)}
                      className="flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 hover:opacity-90 active:scale-95"
                      style={{
                        backgroundColor: '#6366F1',
                        color: '#ffffff',
                      }}
                    >
                      Abrir chat
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-xs leading-relaxed" style={{ color: '#6B7280' }}>
            * Los expertos IA asisten al ingeniero. Verificar siempre antes de usar en expediente oficial.
          </p>
        </div>

        <div className="flex-shrink-0" style={{ flexBasis: '33.333%' }}>
          <div className="mb-4 flex items-center gap-2">
            <FileText size={20} style={{ color: '#6366F1' }} />
            <h2 className="text-base font-semibold" style={{ color: '#E8E9F0' }}>
              Formularios
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            {forms.map((form) => (
              <div
                key={form.name}
                className="relative rounded-xl p-4 transition-all duration-150 hover:brightness-110"
                style={{
                  backgroundColor: '#1A1D27',
                  border: '1px solid #2A2D3E',
                }}
              >
                {form.phase2 && (
                  <span
                    className="absolute top-3 right-3 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: '#2A2D3E',
                      color: '#6B7280',
                    }}
                  >
                    Fase 2
                  </span>
                )}

                <p className="text-sm font-semibold" style={{ color: '#E8E9F0' }}>
                  {form.name}
                </p>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: '#6B7280' }}>
                  {form.description}
                </p>

                <button
                  type="button"
                  className="mt-3 w-full rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 hover:brightness-110 active:scale-95"
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

      {openChat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setOpenChat(null)}
        >
          <div
            className="flex min-w-80 flex-col items-center gap-3 rounded-2xl p-8"
            style={{ backgroundColor: '#1A1D27', border: '1px solid #2A2D3E' }}
            onClick={(event) => event.stopPropagation()}
          >
            <Bot size={32} style={{ color: '#6366F1' }} />
            <p className="text-base font-semibold" style={{ color: '#E8E9F0' }}>
              {openChat}
            </p>
            <p className="text-sm" style={{ color: '#6B7280' }}>
              Chat proximamente disponible
            </p>
            <button
              type="button"
              onClick={() => setOpenChat(null)}
              className="mt-2 rounded-lg px-5 py-2 text-sm font-medium"
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
