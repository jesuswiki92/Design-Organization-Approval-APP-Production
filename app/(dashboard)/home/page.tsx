/**
 * ============================================================================
 * PAGINA DE INICIO (HOME) DEL AMS DOA OPERATION HUB
 * ============================================================================
 *
 * Esta es la primera pagina que ve el usuario despues de iniciar sesion.
 * Funciona como un "centro de mando" que resume el estado operativo del
 * producto y da acceso rapido a los modulos principales.
 *
 * SECCIONES QUE MUESTRA:
 *   1. Cabecera: nombre de la app, version y fecha
 *   2. 4 KPIs reales (consultas, ofertas, validacion, entregas)
 *   3. Tarjetas de acceso rapido a los 4 modulos activos
 *
 * NOTA TECNICA: Es un Server Component. Los KPIs se calculan con queries
 * a Supabase; si alguna tabla/columna aun no esta conectada, se muestra
 * "—" y el card queda con el `title` indicando el motivo.
 * ============================================================================
 */

import Link from 'next/link'
import {
  Bot,
  BriefcaseBusiness,
  FolderKanban,
  Inbox,
  Layers3,
  PackageCheck,
  Receipt,
  ShieldCheck,
  ShieldHalf,
  Users,
} from 'lucide-react'

import { TopBar } from '@/components/layout/TopBar'
import { APP_RELEASE } from '@/lib/app-release'
import { createClient } from '@/lib/supabase/server'
import { PROJECT_EXECUTION_STATES, QUOTATION_BOARD_STATES } from '@/lib/workflow-states'

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
] as const

type KpiCard = {
  label: string
  value: number | null
  unavailableReason: string | null
  href: string
  cta: string
  icon: typeof Inbox
  iconBorder: string
  iconBg: string
  iconText: string
}

const DASH = '—'

/**
 * Cuenta filas en una tabla aplicando un filtro `.in('columna', valores)`.
 * Si la tabla/columna no existe, o cualquier error de Supabase, devuelve `null`
 * para que el render muestre DASH y preserve el resto de KPIs.
 */
async function countIn(
  table: string,
  column: string,
  values: readonly string[],
): Promise<{ value: number | null; reason: string | null }> {
  try {
    const supabase = await createClient()
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .in(column, values as string[])

    if (error) {
      console.error(`HomeKPI count ${table}.${column} error:`, error)
      return { value: null, reason: error.message }
    }
    return { value: count ?? 0, reason: null }
  } catch (error) {
    console.error(`HomeKPI count ${table}.${column} exception:`, error)
    return {
      value: null,
      reason: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export default async function HomePage() {
  // Cada KPI se calcula de forma independiente con try/catch aislado (dentro
  // de countIn). Si una tabla no esta conectada, ese card muestra DASH pero
  // los demas siguen funcionando.
  const [consultasTriage, ofertasRevision, proyectosValidacion, entregasPendientes] =
    await Promise.all([
      countIn('consultas_entrantes', 'estado', [
        QUOTATION_BOARD_STATES.ENTRADA_RECIBIDA,
        QUOTATION_BOARD_STATES.FORMULARIO_ENVIADO,
        QUOTATION_BOARD_STATES.FORMULARIO_RECIBIDO,
        QUOTATION_BOARD_STATES.DEFINIR_ALCANCE,
      ]),
      countIn('consultas_entrantes', 'estado', [
        QUOTATION_BOARD_STATES.OFERTA_EN_REVISION,
        QUOTATION_BOARD_STATES.OFERTA_ENVIADA,
        QUOTATION_BOARD_STATES.ALCANCE_DEFINIDO,
      ]),
      countIn('proyectos', 'estado_v2', [
        PROJECT_EXECUTION_STATES.LISTO_PARA_VALIDACION,
        PROJECT_EXECUTION_STATES.EN_VALIDACION,
      ]),
      countIn('proyectos', 'estado_v2', [
        PROJECT_EXECUTION_STATES.PREPARANDO_ENTREGA,
        PROJECT_EXECUTION_STATES.ENTREGADO,
      ]),
    ])

  const kpiCards: KpiCard[] = [
    {
      label: 'Consultas en triage',
      value: consultasTriage.value,
      unavailableReason: consultasTriage.reason,
      href: '/quotations',
      cta: 'Ver todas',
      icon: Inbox,
      iconBorder: 'border-sky-200',
      iconBg: 'bg-sky-50',
      iconText: 'text-sky-700',
    },
    {
      label: 'Ofertas en revision',
      value: ofertasRevision.value,
      unavailableReason: ofertasRevision.reason,
      href: '/quotations',
      cta: 'Ver todas',
      icon: Receipt,
      iconBorder: 'border-amber-200',
      iconBg: 'bg-amber-50',
      iconText: 'text-amber-700',
    },
    {
      label: 'Proyectos en validacion',
      value: proyectosValidacion.value,
      unavailableReason: proyectosValidacion.reason,
      href: '/engineering/validations',
      cta: 'Ver cola',
      icon: ShieldHalf,
      iconBorder: 'border-violet-200',
      iconBg: 'bg-violet-50',
      iconText: 'text-violet-700',
    },
    {
      label: 'Entregas pendientes',
      value: entregasPendientes.value,
      unavailableReason: entregasPendientes.reason,
      href: '/engineering/portfolio',
      cta: 'Ver portfolio',
      icon: PackageCheck,
      iconBorder: 'border-emerald-200',
      iconBg: 'bg-emerald-50',
      iconText: 'text-emerald-700',
    },
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Inicio" subtitle="Estado real del hub y accesos principales" />

      <main className="flex-1 space-y-6 overflow-y-auto p-6 text-slate-900">
        {/* === CABECERA === */}
        <section className="rounded-3xl border border-sky-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_55%,#e0f2fe_100%)] px-6 py-5 shadow-[0_18px_45px_rgba(148,163,184,0.16)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Panel de control AMS
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                AMS DOA Operation Hub
              </h2>
              <p className="mt-1 text-sm leading-7 text-slate-600">
                Panel de control AMS · certificacion aeronautica EASA Part 21J. Centro
                operativo para consultas comerciales, proyectos de ingenieria,
                validacion DOH/DOS y entrega de deliverables.
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

        {/* === KPIs REALES === */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((kpi) => {
            const Icon = kpi.icon
            const unavailable = kpi.value === null
            return (
              <div
                key={kpi.label}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)]"
                title={unavailable && kpi.unavailableReason
                  ? `base de datos aun no reconectada: ${kpi.unavailableReason}`
                  : undefined}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${kpi.iconBorder} ${kpi.iconBg} ${kpi.iconText}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                    KPI
                  </span>
                </div>
                <div className="mt-4">
                  <div className="font-mono text-3xl font-semibold text-slate-950">
                    {unavailable ? DASH : kpi.value}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{kpi.label}</div>
                </div>
                <Link
                  href={kpi.href}
                  className="mt-4 inline-flex w-fit items-center gap-1 text-xs font-semibold text-sky-700 transition-colors hover:text-sky-800"
                >
                  {kpi.cta}
                  <span aria-hidden>→</span>
                </Link>
              </div>
            )
          })}
        </section>

        {/* === TARJETAS DE MODULOS ACTIVOS === */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {activeAreas.map((area) => {
            const Icon = area.icon

            return (
              <Link
                key={area.title}
                href={area.href}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(148,163,184,0.12)] transition-colors hover:border-sky-300 hover:bg-sky-50/40"
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
      </main>
    </div>
  )
}
