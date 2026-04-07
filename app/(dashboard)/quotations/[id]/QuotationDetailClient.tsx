/**
 * ============================================================================
 * COMPONENTE VISUAL DE DETALLE DE UNA QUOTATION
 * ============================================================================
 *
 * Este componente muestra la ficha completa de una quotation (oferta
 * comercial) con toda su informacion operativa. Es la vista a la que
 * llega el usuario cuando pulsa "Ver detalle" en el tablero.
 *
 * QUE MUESTRA:
 *   - Boton "Volver a Quotations" para regresar al listado
 *   - Insignia con el estado actual de la quotation (ej: "En revision")
 *   - Cabecera con codigo, titulo, nota y etiquetas de metadata
 *   - Metricas clave: Owner, Due date, Amount, Requested date
 *   - Bloque 01: Resumen ejecutivo (contexto, objetivo, restricciones)
 *   - Bloque 02: Alcance tecnico (scope, assumptions, inputs pendientes)
 *   - Bloque 03: Pricing y estrategia comercial (precio, horas, hitos)
 *   - Snapshot: Estado operativo actual (estado, canal, siguiente paso)
 *   - Bloque 04: Historial y coordinacion (timeline, checklist)
 *
 * NOTA: Actualmente la ficha busca la quotation en los "lanes" (columnas)
 * del tablero visual. Cuando se conecte el backend real, se cargara
 * directamente desde Supabase.
 *
 * NOTA TECNICA: 'use client' porque necesita cargar datos del localStorage
 * (columnas personalizadas) y recalcular la vista al cambiar datos.
 * ============================================================================
 */

'use client'

// Link: navegacion entre paginas sin recargar
import Link from 'next/link'
// Hooks de React para manejar estados, efectos y calculos optimizados
import { useEffect, useMemo, useState } from 'react'
// Iconos decorativos para las metricas y secciones
import {
  ArrowLeft,        // Flecha de "volver atras"
  Blocks,           // Icono de bloques (campo cliente/customer)
  BriefcaseBusiness, // Maletin (campo owner)
  CircleGauge,      // Medidor circular (campo amount/importe)
  Clock3,           // Reloj (campo due date)
  FileSpreadsheet,  // Hoja de calculo (campo fecha de solicitud)
  Layers3,          // Capas (campo estado)
  NotebookTabs,     // Libreta (campo canal)
  Radar,            // Radar (campo siguiente paso)
} from 'lucide-react'

// Utilidad para combinar clases CSS condicionalmente
import { cn } from '@/lib/utils'
// Tipo de datos para la configuracion de estados del workflow
import type { WorkflowStateConfigRow } from '@/types/database'

// Funciones para trabajar con los datos del tablero de quotations
import {
  defaultQuotationLanes,             // Genera las columnas por defecto del tablero
  findQuotationCardById,             // Busca una tarjeta por ID en todas las columnas
  loadStoredCustomQuotationLanes,    // Carga columnas personalizadas del localStorage
  type QuotationLane,                // Tipo de datos de una columna del tablero
} from '../quotation-board-data'

/**
 * Bloque reutilizable para mostrar una seccion de informacion.
 * Cada bloque tiene: etiqueta superior (eyebrow), titulo, texto descriptivo
 * y una lista de items. Se usa para los bloques 01, 02, 03 y 04 de la ficha.
 */
function DetailBlock({
  eyebrow,
  title,
  body,
  items,
}: {
  eyebrow: string
  title: string
  body: string
  items: string[]
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Componente principal de la ficha de detalle de una quotation.
 * Recibe el ID de la quotation y la configuracion de estados.
 * Busca la tarjeta correspondiente en las columnas del tablero y muestra
 * toda su informacion organizada en bloques.
 */
export function QuotationDetailClient({
  id,
  initialStateConfigRows,
}: {
  id: string
  initialStateConfigRows: WorkflowStateConfigRow[]
}) {
  // Estado para las columnas personalizadas creadas por el usuario
  const [customLanes, setCustomLanes] = useState<QuotationLane[]>([])

  // Cargar las columnas personalizadas del navegador al montar el componente
  useEffect(() => {
    // Load browser-local custom lanes after mount to keep the first render deterministic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomLanes(loadStoredCustomQuotationLanes())
  }, [])

  // Combinar columnas por defecto con las personalizadas
  const lanes = useMemo(
    () => [...defaultQuotationLanes(initialStateConfigRows), ...customLanes],
    [customLanes, initialStateConfigRows],
  )
  // Buscar la tarjeta de la quotation por su ID en todas las columnas
  const detail = useMemo(() => findQuotationCardById(lanes, id), [id, lanes])

  if (!detail) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 pb-8 pt-5">
        <Link
          href="/quotations"
          className="inline-flex items-center gap-2 self-start rounded-full border border-sky-200 bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(37,99,235,0.22)] transition-colors hover:bg-sky-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Quotations
        </Link>

        <section className="rounded-[34px] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_52%,#f8fafc_100%)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Quotation no encontrada
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              No hemos encontrado una quotation con ese identificador en la capa visual
              actual. Cuando conectemos backend, esta página leerá el detalle real.
            </p>
          </div>
        </section>
      </div>
    )
  }

  const { lane, card } = detail

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 pb-8 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/quotations"
          className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(37,99,235,0.22)] transition-colors hover:bg-sky-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Quotations
        </Link>

        <div
          className={cn(
            'inline-flex items-center gap-2 rounded-full border bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] shadow-sm',
            lane.accent.border,
            lane.accent.text,
          )}
        >
          <span className={cn('h-2.5 w-2.5 rounded-full', lane.accent.dot)} />
          {lane.title}
        </div>
      </div>

      <section className="rounded-[34px] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_52%,#f8fafc_100%)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="space-y-3">
            <p className="font-mono text-xs text-slate-500">{card.code}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              {card.title}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">{card.note}</p>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              {[
                card.customer,
                card.aircraft,
                card.channel,
                `Prioridad ${card.priority}`,
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="grid min-w-[260px] gap-3 sm:grid-cols-2">
            {[
              {
                label: 'Owner',
                value: card.owner,
                icon: BriefcaseBusiness,
              },
              {
                label: 'Due',
                value: card.due,
                icon: Clock3,
              },
              {
                label: 'Amount',
                value: card.amount,
                icon: CircleGauge,
              },
              {
                label: 'Requested',
                value: card.requestDate,
                icon: FileSpreadsheet,
              },
            ].map((metric) => {
              const Icon = metric.icon

              return (
                <div
                  key={metric.label}
                  className="rounded-[22px] border border-sky-200 bg-white/90 px-4 py-4 shadow-sm"
                >
                  <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <Icon className="h-3.5 w-3.5" />
                    {metric.label}
                  </div>
                  <p className="mt-3 text-base font-semibold text-slate-950">{metric.value}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="space-y-5">
          <DetailBlock
            eyebrow="Bloque 01"
            title="Resumen ejecutivo de la quotation"
            body="Este bloque concentrará la visión completa de la oportunidad comercial: contexto, necesidad del cliente, tipo de modificación y mensaje ejecutivo."
            items={[
              'Contexto comercial de entrada',
              'Objetivo y deliverable esperado',
              'Restricciones principales detectadas',
            ]}
          />

          <DetailBlock
            eyebrow="Bloque 02"
            title="Alcance técnico y supuestos"
            body="Aquí prepararemos el alcance confirmado, límites de responsabilidad, assumptions de certificación y cualquier dependencia externa."
            items={[
              'Scope breakdown por disciplina',
              'Assumptions técnicas y regulatorias',
              'Inputs pendientes del cliente o de partners',
            ]}
          />

          <DetailBlock
            eyebrow="Bloque 03"
            title="Pricing, esfuerzo y estrategia comercial"
            body="Este módulo servirá para fijar precio, esfuerzo interno, estructura de hitos y razonamiento económico antes del envío."
            items={[
              'Modelo de pricing y margen objetivo',
              'Horas por disciplina y buffers',
              'Hitos de facturación y condiciones comerciales',
            ]}
          />
        </div>

        <div className="space-y-5">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Snapshot
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              Estado operativo actual
            </h2>
            <div className="mt-4 space-y-3">
              {[
                { label: 'Estado', value: lane.title, icon: Layers3 },
                { label: 'Canal', value: card.channel, icon: NotebookTabs },
                { label: 'Siguiente paso', value: card.nextStep, icon: Radar },
                { label: 'Customer', value: card.customer, icon: Blocks },
              ].map((item) => {
                const Icon = item.icon

                return (
                  <div
                    key={item.label}
                    className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{item.value}</p>
                  </div>
                )
              })}
            </div>
          </section>

          <DetailBlock
            eyebrow="Bloque 04"
            title="Historial, coordinación y próximos pasos"
            body="Dejamos preparado un espacio para timeline de actividad, comentarios internos, dependencias y tareas necesarias para avanzar."
            items={[
              'Timeline de interacciones',
              'Coordinación con ingeniería y ventas',
              'Checklist de cierre o envío',
            ]}
          />
        </div>
      </div>
    </div>
  )
}
