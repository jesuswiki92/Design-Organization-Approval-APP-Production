import Link from 'next/link'
import {
  Bot,
  BriefcaseBusiness,
  ClipboardCheck,
  FolderKanban,
  Layers3,
  ShieldCheck,
  Users,
} from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { APP_RELEASE } from '@/lib/app-release'

const activeAreas = [
  {
    title: 'Quotations',
    description: 'Pipeline comercial separado para seguimiento de ofertas y handoff a proyecto.',
    href: '/quotations',
    icon: BriefcaseBusiness,
    accent: '#2563EB',
    badge: 'Activo',
  },
  {
    title: 'Proyectos',
    description: 'Workflow operativo de proyectos con estados OP-00..OP-13 y separacion de dominio.',
    href: '/engineering/portfolio',
    icon: FolderKanban,
    accent: '#0F766E',
    badge: 'Activo',
  },
  {
    title: 'Clientes',
    description: 'Base operativa de clientes, contactos y soporte para intake comercial.',
    href: '/clients',
    icon: Users,
    accent: '#D97706',
    badge: 'Activo',
  },
  {
    title: 'Asistente DOA',
    description: 'Chat con OpenRouter para soporte general sin base de datos ni RAG.',
    href: '/tools/experto',
    icon: Bot,
    accent: '#7C3AED',
    badge: 'Activo',
  },
]

const sanitationHighlights = [
  'Build y lint en verde sin depender de ignoreBuildErrors.',
  'Quotations y Proyectos ya trabajan como workflows separados.',
  'La navegacion y la proteccion de rutas se sanearon en el lote base.',
  'La documentacion ya refleja que doa_* es la fuente activa de runtime.',
]

const nextFocus = [
  'Aplicar y validar persistencia real del workflow con migracion + RLS.',
  'Completar el handoff quotation won -> create/activate project.',
  'Seguir con automatizaciones comerciales y operativas por separado.',
]

export default function HomePage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Inicio" subtitle="Estado real del hub y accesos principales" />

      <main className="flex-1 space-y-6 overflow-y-auto p-6 text-slate-900">
        <section className="rounded-[24px] border border-sky-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_55%,#e0f2fe_100%)] px-6 py-5 shadow-[0_18px_45px_rgba(148,163,184,0.16)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Baseline saneada
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">DOA Operations Hub</h2>
              <p className="mt-1 text-sm leading-7 text-slate-600">
                Esta portada ya no muestra datos simulados. Resume el estado real del producto,
                los modulos activos y el siguiente bloque de trabajo.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-sky-200 bg-white/85 px-4 py-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                  Version visible
                </div>
                <div className="mt-1 font-mono text-sm text-slate-900">{APP_RELEASE.version}</div>
                <div className="mt-1 text-xs text-slate-500">{APP_RELEASE.releaseName}</div>
              </div>

              <div className="rounded-2xl border border-sky-200 bg-white/85 px-4 py-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                  Ultima actualizacion
                </div>
                <div className="mt-1 font-mono text-sm text-slate-900">{APP_RELEASE.updatedAtLabel}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Fecha fija de release. No cambia al refrescar.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {activeAreas.map((area) => {
            const Icon = area.icon

            return (
              <Link
                key={area.title}
                href={area.href}
                className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)] transition-colors hover:border-sky-300 hover:bg-sky-50/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200"
                      style={{ backgroundColor: `${area.accent}14` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: area.accent }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-950">{area.title}</h3>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700">
                          {area.badge}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{area.description}</p>
                    </div>
                  </div>

                  <Layers3 className="mt-1 h-4 w-4 text-slate-300" />
                </div>
              </Link>
            )
          })}
        </section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700">
                <ClipboardCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Estado del saneamiento</h3>
                <p className="text-xs text-slate-500">Lo que ya se ha consolidado</p>
              </div>
            </div>

            <div className="space-y-3">
              {sanitationHighlights.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
                <Layers3 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Siguiente foco</h3>
                <p className="text-xs text-slate-500">Trabajo recomendado antes de ampliar alcance</p>
              </div>
            </div>

            <div className="space-y-3">
              {nextFocus.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

