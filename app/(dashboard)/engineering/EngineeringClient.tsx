'use client'

import { useState, type ReactNode } from 'react'
import { LayoutGrid, List, Sparkles } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type EngineeringView = 'board' | 'list'

type EngineeringWorkItem = {
  id: string
  title: string
  summary: string
  owner: string
  due: string
  tag: string
}

type EngineeringColumn = {
  id: string
  title: string
  description: string
  accent: {
    bg: string
    border: string
    dot: string
    chip: string
  }
  cards: EngineeringWorkItem[]
}

const VIEW_OPTIONS: Array<{
  value: EngineeringView
  label: string
  icon: typeof LayoutGrid
}> = [
  { value: 'board', label: 'Tablero', icon: LayoutGrid },
  { value: 'list', label: 'Lista', icon: List },
]

const BOARD_COLUMNS: EngineeringColumn[] = [
  {
    id: 'intake',
    title: 'Intake',
    description: 'Solicitudes entrantes y peticiones de proyecto pendientes de routing.',
    accent: {
      bg: 'bg-sky-50',
      border: 'border-sky-200',
      dot: 'bg-sky-500',
      chip: 'border-sky-200 bg-white text-sky-700',
    },
    cards: [
      {
        id: 'eng-201',
        title: 'Review automation request',
        summary: 'Capturar alcance, owner y objetivo antes del primer routing.',
        owner: 'M. Lopez',
        due: 'Today',
        tag: 'Inbound',
      },
      {
        id: 'eng-202',
        title: 'Clarify platform dependency',
        summary: 'Confirmar si afecta al portal de clientes o al stack interno.',
        owner: 'S. Vega',
        due: 'Today',
        tag: 'Open',
      },
    ],
  },
  {
    id: 'discovery',
    title: 'Discovery',
    description: 'Framing del problema, restricciones y análisis técnico.',
    accent: {
      bg: 'bg-cyan-50',
      border: 'border-cyan-200',
      dot: 'bg-cyan-500',
      chip: 'border-cyan-200 bg-white text-cyan-700',
    },
    cards: [
      {
        id: 'eng-207',
        title: 'Map edge cases',
        summary: 'Definir los casos operativos que pueden romper la primera implementación.',
        owner: 'A. Ruiz',
        due: '4h',
        tag: 'Research',
      },
      {
        id: 'eng-208',
        title: 'Trace existing integrations',
        summary: 'Localizar servicios, formularios y eventos ya implicados en el flujo.',
        owner: 'C. Torres',
        due: 'Tomorrow',
        tag: 'Audit',
      },
    ],
  },
  {
    id: 'architecture',
    title: 'Architecture',
    description: 'Decisiones de diseño, límites de servicio y forma de implementación.',
    accent: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      dot: 'bg-indigo-500',
      chip: 'border-indigo-200 bg-white text-indigo-700',
    },
    cards: [
      {
        id: 'eng-214',
        title: 'Lock module boundaries',
        summary: 'Separar responsabilidades entre UI, datos y orquestación.',
        owner: 'J. Navarro',
        due: 'Today',
        tag: 'Design',
      },
      {
        id: 'eng-215',
        title: 'Define fallback strategy',
        summary: 'Especificar qué pasa cuando una dependencia falla o responde lento.',
        owner: 'D. Molina',
        due: 'Tomorrow',
        tag: 'Risk',
      },
    ],
  },
  {
    id: 'build',
    title: 'Build',
    description: 'Implementación activa con cambios de código en progreso.',
    accent: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      dot: 'bg-emerald-500',
      chip: 'border-emerald-200 bg-white text-emerald-700',
    },
    cards: [
      {
        id: 'eng-221',
        title: 'Wire stateful UI',
        summary: 'Conectar la superficie visual con estado local y handlers.',
        owner: 'L. Romero',
        due: 'Now',
        tag: 'Active',
      },
      {
        id: 'eng-222',
        title: 'Polish empty states',
        summary: 'Hacer que el canvas se vea completo incluso con datos mock.',
        owner: 'P. Diaz',
        due: 'Today',
        tag: 'UI',
      },
      {
        id: 'eng-223',
        title: 'Harden inputs',
        summary: 'Asegurar interacciones estables y sin supuestos frágiles.',
        owner: 'N. Castro',
        due: 'Today',
        tag: 'Stability',
      },
    ],
  },
  {
    id: 'verification',
    title: 'Verification',
    description: 'Tests, review y checks de corrección antes de release.',
    accent: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      dot: 'bg-amber-500',
      chip: 'border-amber-200 bg-white text-amber-700',
    },
    cards: [
      {
        id: 'eng-228',
        title: 'Smoke-test journeys',
        summary: 'Recorrer los caminos principales y validar que el cambio aguanta.',
        owner: 'R. Alonso',
        due: 'Today',
        tag: 'QA',
      },
      {
        id: 'eng-229',
        title: 'Review visual diffs',
        summary: 'Comparar el render con la composición prevista.',
        owner: 'B. Silva',
        due: '4h',
        tag: 'Review',
      },
    ],
  },
  {
    id: 'release',
    title: 'Release',
    description: 'Elementos listos para entrega y coordinación final antes del launch.',
    accent: {
      bg: 'bg-violet-50',
      border: 'border-violet-200',
      dot: 'bg-violet-500',
      chip: 'border-violet-200 bg-white text-violet-700',
    },
    cards: [
      {
        id: 'eng-236',
        title: 'Prepare handoff notes',
        summary: 'Capturar el alcance entregado y los pendientes del siguiente ciclo.',
        owner: 'V. Ortega',
        due: 'Tomorrow',
        tag: 'Ready',
      },
      {
        id: 'eng-237',
        title: 'Announce delivery',
        summary: 'Resumir qué cambió para que el equipo valide y adopte rápido.',
        owner: 'T. Campos',
        due: 'Tomorrow',
        tag: 'Launch',
      },
    ],
  },
  {
    id: 'observability',
    title: 'Observability',
    description: 'Monitorización, feedback y señales post-release.',
    accent: {
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      dot: 'bg-slate-500',
      chip: 'border-slate-200 bg-white text-slate-700',
    },
    cards: [
      {
        id: 'eng-244',
        title: 'Track adoption signals',
        summary: 'Vigilar uso y patrones de incidencias después de publicar.',
        owner: 'E. Martin',
        due: 'This week',
        tag: 'Monitor',
      },
      {
        id: 'eng-245',
        title: 'Capture follow-up bugs',
        summary: 'Recoger cualquier incidencia que requiera una segunda pasada.',
        owner: 'H. Blanco',
        due: 'This week',
        tag: 'Feedback',
      },
    ],
  },
]

const BOARD_ITEMS = BOARD_COLUMNS.flatMap((column) => column.cards.map((card) => ({ column, card })))

function EngineeringCard({ card }: { card: EngineeringWorkItem }) {
  return (
    <article className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-[0_14px_36px_rgba(15,23,42,0.07)] transition-transform hover:-translate-y-0.5 hover:border-cyan-300">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[10px] tracking-[0.24em] text-slate-500">{card.id}</p>
          <h4 className="text-sm font-semibold leading-5 text-slate-950">{card.title}</h4>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {card.tag}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">{card.summary}</p>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <span>{card.owner}</span>
        <span>{card.due}</span>
      </div>
    </article>
  )
}

function EngineeringColumnCard({ column }: { column: EngineeringColumn }) {
  return (
    <section
      className={cn(
        'flex h-full w-[320px] flex-none flex-col rounded-[30px] border bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_18px_44px_rgba(148,163,184,0.14)]',
        column.accent.border,
      )}
    >
      <div className={cn('rounded-[22px] border px-4 py-4', column.accent.bg, column.accent.border)}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full', column.accent.dot)} />
              <h3 className="text-sm font-semibold text-slate-950">{column.title}</h3>
            </div>
            <p className="max-w-[220px] text-xs leading-5 text-slate-600">{column.description}</p>
          </div>
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
              column.accent.chip,
            )}
          >
            {column.cards.length}
          </span>
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-3">
        {column.cards.map((card) => (
          <EngineeringCard key={card.id} card={card} />
        ))}

        <button
          type="button"
          className="flex w-full items-center justify-between rounded-[22px] border border-dashed border-slate-200 bg-white/80 px-4 py-3 text-left text-sm text-slate-600 transition-colors hover:border-cyan-300 hover:bg-cyan-50/60 hover:text-cyan-800"
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Visual placeholder
          </span>
          <span className="font-mono text-[10px] tracking-[0.2em] text-slate-400">MOCK</span>
        </button>
      </div>
    </section>
  )
}

function EngineeringListRow({
  column,
  card,
}: {
  column: EngineeringColumn
  card: EngineeringWorkItem
}) {
  return (
    <tr className="border-b border-slate-200/70 bg-white transition-colors hover:bg-cyan-50/50">
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', column.accent.dot)} />
          <div>
            <p className="font-mono text-[11px] text-slate-500">{card.id}</p>
            <p className="text-sm font-semibold text-slate-950">{card.title}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-top text-sm text-slate-600">{column.title}</td>
      <td className="px-4 py-3 align-top text-sm text-slate-600">{card.owner}</td>
      <td className="px-4 py-3 align-top text-sm text-slate-600">{card.due}</td>
      <td className="px-4 py-3 align-top">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {card.tag}
        </span>
      </td>
      <td className="px-4 py-3 align-top text-sm text-slate-600">{card.summary}</td>
    </tr>
  )
}

function ModeBadge({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">
      <span className="h-2 w-2 rounded-full bg-cyan-500" />
      {children}
    </div>
  )
}

export function EngineeringClient() {
  const [view, setView] = useState<EngineeringView>('board')

  return (
    <Tabs
      value={view}
      onValueChange={(nextValue) => setView(nextValue as EngineeringView)}
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden p-5 text-slate-900"
    >
      <section className="overflow-hidden rounded-[34px] border border-cyan-100 bg-[radial-gradient(circle_at_top_left,#effbff_0%,#ffffff_44%,#f8fafc_100%)] shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
        <div className="border-b border-cyan-100 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <ModeBadge>Tablero de proyectos</ModeBadge>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  Vista operativa del equipo de proyectos
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  Una superficie visual, basada en datos mock, para revisar el trabajo como tablero o como tabla ligera.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="rounded-[22px] border border-cyan-200 bg-white/90 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Estados
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{BOARD_COLUMNS.length}</p>
              </div>
              <div className="rounded-[22px] border border-cyan-200 bg-white/90 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Elementos
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{BOARD_ITEMS.length}</p>
              </div>
              <div className="rounded-[22px] border border-cyan-200 bg-white/90 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Modo
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">Mock UI</p>
              </div>
            </div>
          </div>

          <TabsList
            variant="default"
            className="mt-5 flex w-full flex-wrap gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-2"
          >
            {VIEW_OPTIONS.map((option) => {
              const Icon = option.icon

              return (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  className="rounded-[18px] px-4 py-2.5 text-sm font-semibold text-slate-500 transition-all data-active:bg-white data-active:text-slate-950 data-active:shadow-sm"
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        <TabsContent value="board" className="min-h-0">
          <div className="px-5 py-5">
            <div className="mb-4 rounded-[28px] border border-cyan-100 bg-white/85 px-4 py-3 text-sm text-slate-600 shadow-sm">
              El scroll horizontal está habilitado en el tablero. Las columnas tienen ancho fijo, así que la vista se lee como un workspace real.
            </div>

            <div className="overflow-x-auto pb-4">
              <div className="flex min-w-max gap-4 pr-2">
                {BOARD_COLUMNS.map((column) => (
                  <EngineeringColumnCard key={column.id} column={column} />
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="list" className="px-5 py-5">
          <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_42px_rgba(148,163,184,0.12)]">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-950">Lista de proyectos</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Los mismos datos mock, organizados como una tabla compacta para revisar responsables, fechas y estado.
              </p>
            </div>

            <div className="overflow-auto">
              <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {['Elemento', 'Estado', 'Responsable', 'Vence', 'Etiqueta', 'Resumen'].map((label) => (
                      <th
                        key={label}
                        className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BOARD_ITEMS.map(({ column, card }) => (
                    <EngineeringListRow key={card.id} column={column} card={card} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </section>
    </Tabs>
  )
}
