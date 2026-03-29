'use client'

import Link from 'next/link'
import {
  Bot,
  FileText,
  FolderSearch,
  Plane,
  Shield,
  Sparkles,
  Wrench,
} from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'

const availableTools = [
  {
    icon: Shield,
    name: 'Asistente DOA',
    description: 'Chat operativo con OpenRouter para quotations, proyectos, procedimientos y soporte general.',
    href: '/tools/experto',
    badge: 'Disponible',
  },
]

const plannedTools = [
  {
    icon: Plane,
    name: 'Experto en Aeronaves',
    description: 'Consulta especializada por flota, variantes aprobadas y referencias tecnicas.',
  },
  {
    icon: FolderSearch,
    name: 'Experto en Proyectos',
    description: 'Asistente orientado a expedientes historicos y comparacion entre proyectos.',
  },
]

const plannedWorkflows = [
  {
    name: 'Alta de cliente',
    description: 'Formulario operativo para crear clientes con datos normalizados.',
  },
  {
    name: 'Intake de proyecto',
    description: 'Alta inicial de oportunidad o expediente con datos minimos de trabajo.',
  },
  {
    name: 'Non-conformity',
    description: 'Registro estructurado de hallazgos o no conformidades internas.',
  },
]

export default function ToolsPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Tools" subtitle="Utilidades activas y roadmap inmediato" />

      <div className="flex-1 overflow-y-auto p-6 text-slate-900">
        <section className="rounded-[24px] border border-sky-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_55%,#e0f2fe_100%)] px-6 py-5 shadow-[0_18px_45px_rgba(148,163,184,0.16)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                <Sparkles className="h-3.5 w-3.5" />
                Superficie saneada
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">Herramientas disponibles hoy</h2>
              <p className="mt-1 text-sm leading-7 text-slate-600">
                Esta pantalla ya no muestra acciones falsas ni modales vacios. Solo separa lo que
                ya funciona de lo que sigue en roadmap.
              </p>
            </div>

            <div className="rounded-2xl border border-sky-200 bg-white/85 px-4 py-3 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                Criterio actual
              </div>
              <div className="mt-1 text-sm text-slate-900">
                Utilidades reales ahora.
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Roadmap visible, sin simular funciones todavia no conectadas.
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
            <div className="mb-4 flex items-center gap-2">
              <Bot size={20} className="text-sky-700" />
              <h3 className="text-base font-semibold text-slate-900">Herramientas activas</h3>
            </div>

            <div className="space-y-3">
              {availableTools.map((tool) => {
                const Icon = tool.icon

                return (
                  <div
                    key={tool.name}
                    className="flex items-center gap-4 rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.08)]"
                  >
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50">
                      <Icon size={22} className="text-sky-700" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-950">{tool.name}</p>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700">
                          {tool.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {tool.description}
                      </p>
                    </div>

                    <Link
                      href={tool.href}
                      className="flex-shrink-0 rounded-xl bg-[linear-gradient(135deg,#2563EB,#38BDF8)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:scale-95"
                    >
                      Abrir
                    </Link>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 rounded-[22px] border border-dashed border-sky-200 bg-sky-50/50 p-4 text-sm leading-7 text-slate-600">
              El asistente actual no usa base de datos ni RAG. Está preparado como chat general
              DOA para soporte operativo y redacción inicial.
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
              <div className="mb-4 flex items-center gap-2">
                <Wrench size={20} className="text-sky-700" />
                <h3 className="text-base font-semibold text-slate-900">Roadmap IA</h3>
              </div>

              <div className="space-y-3">
                {plannedTools.map((tool) => {
                  const Icon = tool.icon

                  return (
                    <div
                      key={tool.name}
                      className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600">
                          <Icon size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-950">{tool.name}</p>
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                              Roadmap
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">
                            {tool.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
              <div className="mb-4 flex items-center gap-2">
                <FileText size={20} className="text-sky-700" />
                <h3 className="text-base font-semibold text-slate-900">Workflows planificados</h3>
              </div>

              <div className="space-y-3">
                {plannedWorkflows.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-950">{item.name}</p>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                        Pendiente
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
