/**
 * ============================================================================
 * COMPONENTE VISUAL DEL TABLERO DE PROYECTOS (ENGINEERING)
 * ============================================================================
 *
 * Este componente muestra el tablero operativo de projects con dos vistas:
 *   - TABLERO (Board): columnas type Kanban con tarjetas de trabajo
 *   - LISTA: table compacta con todos los elementos en filas
 *
 * COLUMNAS DEL TABLERO (7 statuses del flujo de trabajo):
 *   1. Intake: solicitudes entrantes pendientes de asignar
 *   2. Discovery: analisis del problema y restricciones
 *   3. Architecture: decisiones de diseno technical
 *   4. Build: implementacion activa (codigo en progreso)
 *   5. Verification: tests y review antes de entregar
 *   6. Release: elementos listos para delivery
 *   7. Observability: monitorizacion post-delivery
 *
 * NOTA IMPORTANTE: Todos los data son MOCK (simulados). El tablero
 * esta preparado visualmente pero todavia no se conecta a la base
 * de data real. Cuando se conecte, los data vendran de Supabase.
 *
 * NOTA TECNICA: 'use client' porque necesita manejar el cambio
 * entre vistas (tablero/lista) con useState.
 * ============================================================================
 */

'use client'

// Hooks de React y tipos
import { useState, type ReactNode } from 'react'
// Iconos para las opciones de vista y placeholders
import { LayoutGrid, List, Sparkles } from 'lucide-react'

// Componentes de pestanas (tabs) de shadcn/ui
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
// Utilidad para combinar clases CSS
import { cn } from '@/lib/utils'

/** Vista activa: tablero o lista */
type EngineeringView = 'board' | 'list'

/** Estructura de un elemento de trabajo (tarjeta) */
type EngineeringWorkItem = {
  id: string       // Identificador unico
  title: string    // Titulo del elemento
  summary: string  // Resumen corto
  owner: string    // Responsable asignado
  due: string      // Date limite
  tag: string      // Etiqueta de category
}

/** Estructura de una columna del tablero */
type EngineeringColumn = {
  id: string
  title: string
  description: string
  accent: {          // Colores de la columna
    bg: string
    border: string
    dot: string
    chip: string
  }
  cards: EngineeringWorkItem[]  // Tarjetas dentro de esta columna
}

/** Opciones de vista disponibles */
const VIEW_OPTIONS: Array<{
  value: EngineeringView
  label: string
  icon: typeof LayoutGrid
}> = [
  { value: 'board', label: 'Tablero', icon: LayoutGrid },
  { value: 'list', label: 'Lista', icon: List },
]

/** Data MOCK de las columnas del tablero con sus tarjetas simuladas */
const BOARD_COLUMNS: EngineeringColumn[] = [
  {
    id: 'intake',
    title: 'Intake',
    description: 'Solicitudes entrantes y peticiones de project pendientes de routing.',
    accent: {
      bg: 'bg-[color:var(--paper-2)]',
      border: 'border-[color:var(--ink-4)]',
      dot: 'bg-sky-500',
      chip: 'border-[color:var(--ink-4)] bg-[color:var(--paper)] text-[color:var(--ink-2)]',
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
        summary: 'Confirmar si afecta al portal de clients o al stack internal.',
        owner: 'S. Vega',
        due: 'Today',
        tag: 'Open',
      },
    ],
  },
  {
    id: 'discovery',
    title: 'Discovery',
    description: 'Framing del problema, restricciones y análisis technical.',
    accent: {
      bg: 'bg-[color:var(--paper-2)]',
      border: 'border-[color:var(--ink-4)]',
      dot: 'bg-cyan-500',
      chip: 'border-[color:var(--ink-4)] bg-[color:var(--paper)] text-[color:var(--ink-2)]',
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
        summary: 'Localizar servicios, forms y eventos ya implicados en el flujo.',
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
      bg: 'bg-[color:var(--paper-2)]',
      border: 'border-[color:var(--ink-4)]',
      dot: 'bg-indigo-500',
      chip: 'border-[color:var(--ink-4)] bg-[color:var(--paper)] text-[color:var(--ink-2)]',
    },
    cards: [
      {
        id: 'eng-214',
        title: 'Lock module boundaries',
        summary: 'Separar responsabilidades entre UI, data y orquestación.',
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
      bg: 'bg-[color:var(--paper-2)]',
      border: 'border-[color:var(--ink-4)]',
      dot: 'bg-emerald-500',
      chip: 'border-[color:var(--ink-4)] bg-[color:var(--paper)] text-emerald-700',
    },
    cards: [
      {
        id: 'eng-221',
        title: 'Wire stateful UI',
        summary: 'Conectar la superficie visual con status local y handlers.',
        owner: 'L. Romero',
        due: 'Now',
        tag: 'Active',
      },
      {
        id: 'eng-222',
        title: 'Polish empty states',
        summary: 'Hacer que el canvas se vea completo incluso con data mock.',
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
      bg: 'bg-[color:var(--paper-2)]',
      border: 'border-[color:var(--ink-4)]',
      dot: 'bg-amber-500',
      chip: 'border-[color:var(--ink-4)] bg-[color:var(--paper)] text-amber-700',
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
    description: 'Elementos listos para delivery y coordinación final antes del launch.',
    accent: {
      bg: 'bg-[color:var(--paper-2)]',
      border: 'border-[color:var(--ink-4)]',
      dot: 'bg-violet-500',
      chip: 'border-[color:var(--ink-4)] bg-[color:var(--paper)] text-[color:var(--ink-2)]',
    },
    cards: [
      {
        id: 'eng-236',
        title: 'Prepare handoff notes',
        summary: 'Capturar el alcance delivered y los pendientes del siguiente ciclo.',
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
      bg: 'bg-[color:var(--paper-2)]',
      border: 'border-[color:var(--ink-4)]',
      dot: 'bg-slate-500',
      chip: 'border-[color:var(--ink-4)] bg-[color:var(--paper)] text-[color:var(--ink-2)]',
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

/** Lista plana de todos los elementos para la vista de lista */
const BOARD_ITEMS = BOARD_COLUMNS.flatMap((column) => column.cards.map((card) => ({ column, card })))

/** Tarjeta individual de un elemento de trabajo */
function EngineeringCard({ card }: { card: EngineeringWorkItem }) {
  return (
    <article className="rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] p-3.5 shadow-[0_14px_36px_rgba(15,23,42,0.07)] transition-transform hover:-translate-y-0.5 hover:border-[color:var(--ink-4)]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[10px] tracking-[0.24em] text-[color:var(--ink-3)]">{card.id}</p>
          <h4 className="text-sm font-semibold leading-5 text-slate-950">{card.title}</h4>
        </div>
        <span className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
          {card.tag}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-[color:var(--ink-3)]">{card.summary}</p>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[color:var(--ink-4)] pt-3 text-[11px] text-[color:var(--ink-3)]">
        <span>{card.owner}</span>
        <span>{card.due}</span>
      </div>
    </article>
  )
}

/** Columna completa del tablero con su cabecera y tarjetas */
function EngineeringColumnCard({ column }: { column: EngineeringColumn }) {
  return (
    <section
      className={cn(
        'flex h-full w-[320px] flex-none flex-col rounded-[30px] border bg-[color:var(--paper-2)] p-4 shadow-[0_18px_44px_rgba(148,163,184,0.14)]',
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
            <p className="max-w-[220px] text-xs leading-5 text-[color:var(--ink-3)]">{column.description}</p>
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
          className="flex w-full items-center justify-between rounded-[22px] border border-dashed border-[color:var(--ink-4)] bg-[color:var(--paper)]/80 px-4 py-3 text-left text-sm text-[color:var(--ink-3)] transition-colors hover:border-[color:var(--ink-4)] hover:bg-[color:var(--paper-3)]/60 hover:text-[color:var(--ink-2)]"
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Visual placeholder
          </span>
          <span className="font-mono text-[10px] tracking-[0.2em] text-[color:var(--ink-3)]">MOCK</span>
        </button>
      </div>
    </section>
  )
}

/** Fila de la vista lista con los data de un elemento de trabajo */
function EngineeringListRow({
  column,
  card,
}: {
  column: EngineeringColumn
  card: EngineeringWorkItem
}) {
  return (
    <tr className="border-b border-[color:var(--ink-4)]/70 bg-[color:var(--paper)] transition-colors hover:bg-[color:var(--paper-3)]/50">
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', column.accent.dot)} />
          <div>
            <p className="font-mono text-[11px] text-[color:var(--ink-3)]">{card.id}</p>
            <p className="text-sm font-semibold text-slate-950">{card.title}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-top text-sm text-[color:var(--ink-3)]">{column.title}</td>
      <td className="px-4 py-3 align-top text-sm text-[color:var(--ink-3)]">{card.owner}</td>
      <td className="px-4 py-3 align-top text-sm text-[color:var(--ink-3)]">{card.due}</td>
      <td className="px-4 py-3 align-top">
        <span className="rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]">
          {card.tag}
        </span>
      </td>
      <td className="px-4 py-3 align-top text-sm text-[color:var(--ink-3)]">{card.summary}</td>
    </tr>
  )
}

/** Insignia decorativa que muestra el modo actual del tablero */
function ModeBadge({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-2)]">
      <span className="h-2 w-2 rounded-full bg-cyan-500" />
      {children}
    </div>
  )
}

/** Componente primary del tablero de projects con vistas tablero y lista */
export function EngineeringClient() {
  // Status para la vista activa: "board" (tablero) o "list" (lista)
  const [view, setView] = useState<EngineeringView>('board')

  return (
    <Tabs
      value={view}
      onValueChange={(nextValue) => setView(nextValue as EngineeringView)}
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden p-5 text-[color:var(--ink)]"
    >
      <section className="overflow-hidden rounded-[34px] border border-[color:var(--ink-4)] bg-[radial-gradient(circle_at_top_left,#effbff_0%,#ffffff_44%,#f8fafc_100%)] shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
        <div className="border-b border-[color:var(--ink-4)] px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <ModeBadge>Tablero de projects</ModeBadge>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  Vista operativa del equipo de projects
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-[color:var(--ink-3)]">
                  Una superficie visual, basada en data mock, para revisar el trabajo como tablero o como table ligera.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
                  Statuses
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{BOARD_COLUMNS.length}</p>
              </div>
              <div className="rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
                  Elementos
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{BOARD_ITEMS.length}</p>
              </div>
              <div className="rounded-[22px] border border-[color:var(--ink-4)] bg-[color:var(--paper)]/90 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
                  Modo
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">Mock UI</p>
              </div>
            </div>
          </div>

          <TabsList
            variant="default"
            className="mt-5 flex w-full flex-wrap gap-2 rounded-[24px] border border-[color:var(--ink-4)] bg-[color:var(--paper-2)] p-2"
          >
            {VIEW_OPTIONS.map((option) => {
              const Icon = option.icon

              return (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  className="rounded-[18px] px-4 py-2.5 text-sm font-semibold text-[color:var(--ink-3)] transition-all data-active:bg-[color:var(--paper)] data-active:text-slate-950 data-active:shadow-sm"
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
            <div className="mb-4 rounded-[28px] border border-[color:var(--ink-4)] bg-[color:var(--paper)]/85 px-4 py-3 text-sm text-[color:var(--ink-3)] shadow-sm">
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
          <div className="overflow-hidden rounded-[30px] border border-[color:var(--ink-4)] bg-[color:var(--paper)] shadow-[0_18px_42px_rgba(148,163,184,0.12)]">
            <div className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)] px-5 py-4">
              <h3 className="text-base font-semibold text-slate-950">Lista de projects</h3>
              <p className="mt-1 text-sm leading-6 text-[color:var(--ink-3)]">
                Los mismos data mock, organizados como una table compacta para revisar responsables, dates y status.
              </p>
            </div>

            <div className="overflow-auto">
              <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left">
                <thead className="sticky top-0 z-10 bg-[color:var(--paper)]">
                  <tr className="border-b border-[color:var(--ink-4)] bg-[color:var(--paper-2)]">
                    {['Elemento', 'Status', 'Responsable', 'Vence', 'Etiqueta', 'Resumen'].map((label) => (
                      <th
                        key={label}
                        className="whitespace-nowrap border-b border-[color:var(--ink-4)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink-3)]"
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
