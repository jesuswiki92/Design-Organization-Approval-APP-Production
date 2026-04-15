import Link from 'next/link'
import { Activity, ArrowUpRight, Bell, Palette, Shield, User } from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'

const availableSettings = [
  {
    title: 'Logs operativos',
    description:
      'Consulta actividad reciente de la app, fallos observados y contexto operativo redacted.',
    icon: Activity,
    href: '/settings/logs',
    status: 'Disponible',
  },
]

const plannedSettings = [
  {
    title: 'Perfil de usuario',
    description: 'Gestiona tu nombre, correo y preferencias de cuenta.',
    icon: User,
    status: 'Proximamente',
  },
  {
    title: 'Notificaciones',
    description: 'Configura alertas por correo, push y dentro de la app.',
    icon: Bell,
    status: 'Proximamente',
  },
  {
    title: 'Permisos y roles',
    description: 'Administra roles, permisos y acceso de los miembros del equipo.',
    icon: Shield,
    status: 'Proximamente',
  },
  {
    title: 'Apariencia',
    description: 'Temas, modo oscuro y preferencias visuales de la interfaz.',
    icon: Palette,
    status: 'Proximamente',
  },
]

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Settings" subtitle="Configuracion general de la aplicacion" />

      <main className="flex-1 space-y-6 overflow-y-auto p-6 text-slate-900">
        <section className="rounded-[24px] border border-sky-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_55%,#e0f2fe_100%)] px-6 py-5 shadow-[0_18px_45px_rgba(148,163,184,0.16)]">
          <h2 className="text-2xl font-semibold text-slate-950">Configuracion general</h2>
          <p className="mt-1 text-sm leading-7 text-slate-600">
            Gestiona parametros globales, superficie operativa y preferencias del
            DOA Operations Hub. Los modulos de configuracion se activaran de forma
            progresiva.
          </p>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Disponible ahora
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Superficies ya operativas para soporte y configuracion.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {availableSettings.map((card) => {
              const Icon = card.icon

              return (
                <Link
                  key={card.title}
                  href={card.href}
                  className="group rounded-[22px] border border-sky-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)] transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_16px_34px_rgba(14,165,233,0.14)]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700">
                        {card.status}
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-sky-700" />
                    </div>
                  </div>

                  <h3 className="mt-4 text-sm font-semibold text-slate-950">
                    {card.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-500">
                    {card.description}
                  </p>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Roadmap
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Modulos previstos que todavia no tienen una superficie activa.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {plannedSettings.map((card) => {
              const Icon = card.icon

              return (
                <div
                  key={card.title}
                  className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                      <Icon className="h-5 w-5 text-slate-400" />
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                      {card.status}
                    </span>
                  </div>

                  <h3 className="mt-4 text-sm font-semibold text-slate-950">
                    {card.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-500">
                    {card.description}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        <p className="text-center text-xs text-slate-400">
          Estos modulos se activaran conforme se desarrollen las funcionalidades correspondientes.
        </p>
      </main>
    </div>
  )
}
