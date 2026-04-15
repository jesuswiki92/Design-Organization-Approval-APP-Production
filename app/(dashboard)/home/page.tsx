/**
 * ============================================================================
 * PAGINA DE INICIO (HOME) DEL DOA OPERATIONS HUB
 * ============================================================================
 *
 * Esta es la primera pagina que ve el usuario despues de iniciar sesion.
 * Funciona como un "centro de mando" que resume el estado de la aplicacion
 * y da acceso rapido a los modulos principales.
 *
 * SECCIONES QUE MUESTRA:
 *   1. Cabecera: nombre de la app, version actual y fecha de actualizacion
 *   2. Tarjetas de acceso rapido a los 4 modulos activos:
 *      - Quotations (ofertas comerciales)
 *      - Proyectos (workflow operativo)
 *      - Clientes (base de datos de clientes)
 *      - Asistente DOA (chat con IA)
 *   3. Estado del saneamiento: logros consolidados del sistema
 *   4. Siguiente foco: tareas pendientes recomendadas
 *
 * NOTA TECNICA: Es un Server Component (no tiene 'use client') porque
 * no necesita interactividad. Los datos que muestra son estaticos o vienen
 * de constantes definidas en el codigo.
 * ============================================================================
 */

// Link: para crear las tarjetas que llevan a cada modulo
import Link from 'next/link'
// Iconos decorativos para cada modulo y seccion
import {
  Bot,              // Robot (Asistente DOA)
  BriefcaseBusiness, // Maletin (Quotations)
  ClipboardCheck,   // Portapapeles con check (Estado del saneamiento)
  FolderKanban,     // Carpeta kanban (Proyectos)
  Layers3,          // Capas (Siguiente foco y flecha en tarjetas)
  ShieldCheck,      // Escudo con check (insignia "Baseline saneada")
  Users,            // Personas (Clientes)
} from 'lucide-react'

// Barra superior de la pagina con titulo y subtitulo
import { TopBar } from '@/components/layout/TopBar'
// Constantes de la version actual de la aplicacion
import { APP_RELEASE } from '@/lib/app-release'

/** Definicion de los 4 modulos activos que se muestran como tarjetas */
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

/** Logros del saneamiento que ya se han consolidado en la app */
const sanitationHighlights = [
  'Build y lint en verde sin depender de ignoreBuildErrors.',
  'Quotations y Proyectos ya trabajan como workflows separados.',
  'La navegacion y la proteccion de rutas se sanearon en el lote base.',
  'La documentacion ya refleja que doa_* es la fuente activa de runtime.',
]

/** Tareas pendientes recomendadas antes de ampliar funcionalidades */
const nextFocus = [
  'Aplicar y validar persistencia real del workflow con migracion + RLS.',
  'Completar el handoff quotation won -> create/activate project.',
  'Seguir con automatizaciones comerciales y operativas por separado.',
]

/** Componente principal de la pagina de inicio */
export default function HomePage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      {/* Barra superior con titulo */}
      <TopBar title="Inicio" subtitle="Estado real del hub y accesos principales" />

      <main className="flex-1 space-y-6 overflow-y-auto p-6 text-slate-900">
        {/* === SECCION CABECERA: titulo, insignia, version y fecha de actualizacion === */}
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

        {/* === TARJETAS DE MODULOS ACTIVOS: acceso rapido a cada seccion === */}
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

        {/* === PANELES INFORMATIVOS: estado del saneamiento y siguiente foco === */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {/* Panel izquierdo: logros consolidados */}
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

          {/* Panel derecho: tareas pendientes */}
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

