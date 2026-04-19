'use client'

/**
 * Cliente del panel de metricas — Sprint 4.
 *
 * Render:
 *   - KPI cards (proyectos totales, abiertos, cerrados, archivados, lecciones,
 *     entregas confirmadas).
 *   - Breakdown por fase (en_cotizacion / ejecucion / validacion / entrega /
 *     cierre) y por estado_v2.
 *   - Top 10 proyectos de mayor duracion (dias_totales_cerrado_vs_abierto).
 *   - Banner amarillo si el modo fallback esta activo (MV no disponible).
 */

import Link from 'next/link'
import { useMemo } from 'react'
import {
  Archive,
  BookOpen,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Flag,
  Info,
  PlayCircle,
  Truck,
} from 'lucide-react'

import {
  CLOSURE_OUTCOME_LABELS,
  PROJECT_EXECUTION_STATES,
} from '@/lib/workflow-states'
import type { ProjectMetricsRow } from '@/types/database'

const PHASE_LABELS: Record<string, string> = {
  en_cotizacion: 'En cotizacion',
  ejecucion: 'Ejecucion',
  validacion: 'Validacion',
  entrega: 'Entrega',
  cierre: 'Cierre',
}

type Props = {
  rows: ProjectMetricsRow[]
  fallbackMode: boolean
  fallbackReason: string | null
}

const PHASE_ORDER = [
  'en_cotizacion',
  'ejecucion',
  'validacion',
  'entrega',
  'cierre',
] as const

export function MetricsClient({ rows, fallbackMode, fallbackReason }: Props) {
  const summary = useMemo(() => {
    const total = rows.length
    let abiertos = 0
    let cerrados = 0
    let archivados = 0
    let entregasConfirmadas = 0
    let lecciones = 0
    let devoluciones = 0

    const phaseCounts: Record<string, number> = {
      en_cotizacion: 0,
      ejecucion: 0,
      validacion: 0,
      entrega: 0,
      cierre: 0,
    }
    const stateCounts: Record<string, number> = {}
    const outcomeCounts: Record<string, number> = {}

    for (const r of rows) {
      const estado = r.estado_v2 ?? 'desconocido'
      stateCounts[estado] = (stateCounts[estado] ?? 0) + 1

      const fase = r.fase_actual ?? 'desconocido'
      if (fase in phaseCounts) phaseCounts[fase] += 1

      if (estado === PROJECT_EXECUTION_STATES.CERRADO) cerrados += 1
      else if (estado === PROJECT_EXECUTION_STATES.ARCHIVADO_PROYECTO)
        archivados += 1
      else abiertos += 1

      entregasConfirmadas += r.entregas_confirmadas ?? 0
      lecciones += r.lecciones_count ?? 0
      devoluciones += r.validaciones_devueltas ?? 0

      if (r.closure_outcome) {
        outcomeCounts[r.closure_outcome] =
          (outcomeCounts[r.closure_outcome] ?? 0) + 1
      }
    }

    return {
      total,
      abiertos,
      cerrados,
      archivados,
      entregasConfirmadas,
      lecciones,
      devoluciones,
      phaseCounts,
      stateCounts,
      outcomeCounts,
    }
  }, [rows])

  const topLongest = useMemo(() => {
    return [...rows]
      .filter((r) => r.dias_totales_cerrado_vs_abierto !== null)
      .sort(
        (a, b) =>
          (b.dias_totales_cerrado_vs_abierto ?? 0) -
          (a.dias_totales_cerrado_vs_abierto ?? 0),
      )
      .slice(0, 10)
  }, [rows])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 pb-8 pt-5">
      {fallbackMode && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <strong className="font-semibold">Modo fallback activo.</strong>{' '}
            La materialized view{' '}
            <code className="rounded bg-amber-100 px-1 text-[11px]">
              project_metrics_mv
            </code>{' '}
            no esta disponible. Se estan mostrando agregados en vivo (mas lentos,
            no reflejan dwell por fase). Aplica la migracion{' '}
            <code className="rounded bg-amber-100 px-1 text-[11px]">
              202604190020_project_metrics_mv.sql
            </code>{' '}
            para activar la MV.
            {fallbackReason && (
              <span className="mt-1 block text-xs text-amber-700">
                Detalle: {fallbackReason}
              </span>
            )}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi
          icon={Boxes}
          label="Proyectos totales"
          value={summary.total}
          tint="slate"
        />
        <Kpi
          icon={PlayCircle}
          label="Abiertos"
          value={summary.abiertos}
          tint="sky"
        />
        <Kpi
          icon={CheckCircle2}
          label="Cerrados"
          value={summary.cerrados}
          tint="emerald"
        />
        <Kpi
          icon={Archive}
          label="Archivados"
          value={summary.archivados}
          tint="violet"
        />
        <Kpi
          icon={Truck}
          label="Entregas confirmadas"
          value={summary.entregasConfirmadas}
          tint="amber"
        />
        <Kpi
          icon={BookOpen}
          label="Lecciones registradas"
          value={summary.lecciones}
          tint="rose"
        />
      </section>

      {/* Breakdown por fase */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <ClipboardCheck className="h-3.5 w-3.5" />
          Proyectos por fase
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {PHASE_ORDER.map((phase) => (
            <div
              key={phase}
              className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {PHASE_LABELS[phase] ?? phase}
              </p>
              <p className="mt-0.5 text-lg font-semibold text-slate-900">
                {summary.phaseCounts[phase] ?? 0}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Outcomes de cierre + estados */}
      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Flag className="h-3.5 w-3.5" />
            Outcomes de cierre
          </h3>
          {Object.keys(summary.outcomeCounts).length === 0 ? (
            <p className="text-sm text-slate-500">
              Aun no hay proyectos cerrados con outcome registrado.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {Object.entries(summary.outcomeCounts).map(([outcome, count]) => {
                const label =
                  CLOSURE_OUTCOME_LABELS[outcome as keyof typeof CLOSURE_OUTCOME_LABELS] ??
                  outcome
                return (
                  <li
                    key={outcome}
                    className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-1.5 text-sm"
                  >
                    <span className="text-slate-700">{label}</span>
                    <span className="font-semibold text-slate-900">{count}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Distribucion por estado_v2
          </h3>
          {Object.keys(summary.stateCounts).length === 0 ? (
            <p className="text-sm text-slate-500">Sin datos.</p>
          ) : (
            <ul className="space-y-1.5">
              {Object.entries(summary.stateCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([state, count]) => (
                  <li
                    key={state}
                    className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-1.5 text-sm"
                  >
                    <span className="text-slate-700">{state}</span>
                    <span className="font-semibold text-slate-900">{count}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </section>

      {/* Top 10 mayor duracion */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <PlayCircle className="h-3.5 w-3.5" />
          Top 10 proyectos de mayor duracion
        </h3>
        {topLongest.length === 0 ? (
          <p className="text-sm text-slate-500">Sin datos de duracion.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Proyecto
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Estado
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Dias
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Entregas
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Devoluciones
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Lecciones
                  </th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {topLongest.map((r, idx) => (
                  <tr
                    key={r.proyecto_id}
                    className={`border-b border-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                  >
                    <td className="px-3 py-2 text-sm font-medium text-slate-800">
                      {r.titulo}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {r.estado_v2 ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-sm font-semibold text-slate-900">
                      {r.dias_totales_cerrado_vs_abierto?.toFixed(1) ?? '—'} d
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {r.entregas_confirmadas}/{r.entregas_total}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {r.validaciones_devueltas}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {r.lecciones_count}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/engineering/projects/${r.proyecto_id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-600"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {summary.devoluciones > 0 && (
        <p className="text-xs text-slate-500">
          Total de devoluciones en validacion registradas: {summary.devoluciones}.
        </p>
      )}
    </div>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  tint: 'slate' | 'sky' | 'emerald' | 'violet' | 'amber' | 'rose'
}) {
  const tintCls: Record<typeof tint, string> = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
  }
  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${tintCls[tint]}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 opacity-80" />
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
          {label}
        </span>
      </div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}
