/**
 * ============================================================================
 * PAGINA DE CONFIGURACION (SETTINGS) DEL DOA OPERATIONS HUB
 * ============================================================================
 *
 * Pagina principal de ajustes del sistema. Muestra tarjetas placeholder
 * para futuros modulos de configuracion (perfil, notificaciones, etc.).
 *
 * NOTA: El modulo TCDS RAG Engine se movio a /tools/tcds-rag porque es
 * una herramienta operativa, no un ajuste de configuracion.
 *
 * NOTA TECNICA: Es un Server Component (no tiene 'use client') porque
 * no necesita interactividad directa — cada tarjeta es un enlace.
 * ============================================================================
 */

import { User, Bell, Shield, Palette } from 'lucide-react'

// Barra superior reutilizable con titulo y subtitulo
import { TopBar } from '@/components/layout/TopBar'

/**
 * Tarjetas de configuracion planificadas.
 * Estos modulos aun no estan implementados — se muestran como roadmap.
 */
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

/** Componente principal de la pagina de Settings */
export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      {/* Barra superior con titulo */}
      <TopBar title="Settings" subtitle="Configuracion general de la aplicacion" />

      <main className="flex-1 space-y-6 overflow-y-auto p-6 text-slate-900">
        {/* === SECCION CABECERA: descripcion general === */}
        <section className="rounded-[24px] border border-sky-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_55%,#e0f2fe_100%)] px-6 py-5 shadow-[0_18px_45px_rgba(148,163,184,0.16)]">
          <h2 className="text-2xl font-semibold text-slate-950">
            Configuracion general
          </h2>
          <p className="mt-1 text-sm leading-7 text-slate-600">
            Gestiona los parametros globales, perfil y preferencias del DOA
            Operations Hub. Los modulos de configuracion se activaran
            progresivamente.
          </p>
        </section>

        {/* === CUADRICULA DE TARJETAS PLANIFICADAS === */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plannedSettings.map((card) => {
            const Icon = card.icon
            return (
              <div
                key={card.title}
                className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]"
              >
                {/* Icono y estado */}
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                    <Icon className="h-5 w-5 text-slate-400" />
                  </div>
                  {/* Insignia de estado */}
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    {card.status}
                  </span>
                </div>

                {/* Titulo y descripcion */}
                <h3 className="mt-4 text-sm font-semibold text-slate-950">
                  {card.title}
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">
                  {card.description}
                </p>
              </div>
            )
          })}
        </section>

        {/* === PIE: mensaje informativo === */}
        <p className="text-center text-xs text-slate-400">
          Estos modulos se activaran conforme se desarrollen las funcionalidades correspondientes.
        </p>
      </main>
    </div>
  )
}
