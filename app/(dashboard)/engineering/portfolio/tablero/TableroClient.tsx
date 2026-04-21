'use client'

/**
 * ============================================================================
 * TABLERO DE PROYECTOS (VISTA KANBAN POR FASE + ESTADO)
 * ============================================================================
 *
 * Vista Tablero type Kanban para projects. Espejo del patron de
 * `QuotationStatesBoard` (Quotations) pero aplicado a la maquina v2 de 13
 * statuses agrupados en 4 fases.
 *
 * ESTRUCTURA:
 *   - 4 grupos de fase (Ejecucion, Validation, Delivery, Cierre), cada uno
 *     engloba sus 2-5 columnas de status.
 *   - Cabeceras y colores derivados de `PROJECT_EXECUTION_STATE_CONFIG` +
 *     paleta propia de cada fase.
 *   - Scroll horizontal (13 columnas no caben en pantalla).
 *
 * DECISION (v1, read-only):
 *   NO drag-and-drop. La razon: el Tablero de Quotations tampoco usa DnD —
 *   usa un `select` en cada card para cambiar status. En Projects muchas
 *   transiciones requieren form (planificar, validar, prepare-delivery,
 *   send-delivery, confirmar-delivery, close), asi que un drag ingenuo
 *   corrompe la maquina de statuses. La primera iteracion es READ-ONLY: clic
 *   en card -> /engineering/projects/[id]. Cambios de status se hacen desde
 *   el detalle (tabs horas/deliverables/validation/delivery/closure).
 *
 * TODO(tablero-v2): añadir DnD con `@dnd-kit/core` y commit inline solo para
 *   transiciones triviales (returned_to_execution -> in_execution via /resume,
 *   closed -> project_archived via /archive). Para el resto, abrir modal
 *   con redirect a la tab correspondiente del detalle.
 *
 * TOGGLE LISTA/TABLERO:
 *   Los botones en la cabecera son Links — la Lista vive en
 *   /engineering/portfolio, el Tablero aqui. No se comparte status local:
 *   cada vista es un Server Component con su propia fetch.
 * ============================================================================
 */

import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'

import { NewProjectModal } from '@/components/project/NewProjectModal'
import { PhaseColumnGroup } from '@/components/project/PhaseColumn'
import { StateColumn } from '@/components/project/StateColumn'
import type { ProjectCardData } from '@/components/project/ProjectCard'
import {
  PROJECT_EXECUTION_PHASES,
  PROJECT_EXECUTION_STATES,
  PROJECT_EXECUTION_STATE_LIST,
  type ProjectExecutionPhase,
  type ProjectExecutionState,
} from '@/lib/workflow-states'

/** Agrupacion canonica de statuses por fase (misma que en workflow-states.ts) */
const PHASE_TO_STATES: Record<ProjectExecutionPhase, ProjectExecutionState[]> = {
  execution: [
    PROJECT_EXECUTION_STATES.PROJECT_OPENED,
    PROJECT_EXECUTION_STATES.PLANNING,
    PROJECT_EXECUTION_STATES.IN_EXECUTION,
    PROJECT_EXECUTION_STATES.INTERNAL_REVIEW,
    PROJECT_EXECUTION_STATES.READY_FOR_VALIDATION,
  ],
  validation: [
    PROJECT_EXECUTION_STATES.IN_VALIDATION,
    PROJECT_EXECUTION_STATES.VALIDATED,
    PROJECT_EXECUTION_STATES.RETURNED_TO_EXECUTION,
  ],
  delivery: [
    PROJECT_EXECUTION_STATES.PREPARING_DELIVERY,
    PROJECT_EXECUTION_STATES.DELIVERED,
    PROJECT_EXECUTION_STATES.CLIENT_CONFIRMATION,
  ],
  closure: [
    PROJECT_EXECUTION_STATES.CLOSED,
    PROJECT_EXECUTION_STATES.PROJECT_ARCHIVED,
  ],
}

const PHASE_ORDER: ProjectExecutionPhase[] = [
  PROJECT_EXECUTION_PHASES.EXECUTION,
  PROJECT_EXECUTION_PHASES.VALIDATION,
  PROJECT_EXECUTION_PHASES.DELIVERY,
  PROJECT_EXECUTION_PHASES.CLOSURE,
]

/**
 * Devuelve el codigo de status a usar para tablero: prioriza `execution_status`
 * (maquina v2). Si falta, el project queda en una "columna limbo"
 * — mostrado en `project_opened` por defecto como fallback razonable.
 */
function resolveTableroState(project: ProjectCardData): string {
  return project.execution_status ?? PROJECT_EXECUTION_STATES.PROJECT_OPENED
}

export function TableroClient({ projects }: { projects: ProjectCardData[] }) {
  const [search, setSearch] = useState('')
  const [newProjectOpen, setNewProjectOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((project) => {
      return (
        project.title.toLowerCase().includes(q) ||
        project.project_number.toLowerCase().includes(q) ||
        (project.client_name ?? '').toLowerCase().includes(q) ||
        (project.aircraft ?? '').toLowerCase().includes(q) ||
        (project.tcds_code_short ?? '').toLowerCase().includes(q) ||
        (project.owner ?? '').toLowerCase().includes(q)
      )
    })
  }, [projects, search])

  /** Agrupar projects por execution_status */
  const byState = useMemo(() => {
    const map = new Map<string, ProjectCardData[]>()
    for (const code of PROJECT_EXECUTION_STATE_LIST) map.set(code, [])
    for (const project of filtered) {
      const code = resolveTableroState(project)
      const list = map.get(code)
      if (list) list.push(project)
    }
    return map
  }, [filtered])

  /** Contador total por fase (para la cabecera de fase) */
  const countsByPhase = useMemo(() => {
    const counts: Record<ProjectExecutionPhase, number> = {
      execution: 0,
      validation: 0,
      delivery: 0,
      closure: 0,
    }
    for (const phase of PHASE_ORDER) {
      for (const code of PHASE_TO_STATES[phase]) {
        counts[phase] += byState.get(code)?.length ?? 0
      }
    }
    return counts
  }, [byState])

  const totalCards = filtered.length
  const totalColumns = PROJECT_EXECUTION_STATE_LIST.length

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-5 text-[color:var(--ink)]">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs min-w-[200px] flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-4)]"
          />
          <input
            type="text"
            placeholder="Buscar projects..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2)] py-2 pl-9 pr-3 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-4)] transition-colors focus:border-[color:var(--umber)] focus:outline-none focus:ring-2 focus:ring-[color:var(--umber)]/20"
          />
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--ink)] px-4 py-2 text-sm font-medium text-[color:var(--paper)] shadow-sm transition-colors hover:bg-[color:var(--ink-2)]"
          >
            <Plus size={14} />
            Crear Project New
          </button>
          <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2)] px-3 py-1.5">
            <p className="doa-label-mono">Columnas</p>
            <p className="text-sm font-semibold text-[color:var(--ink)]">{totalColumns}</p>
          </div>
          <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2)] px-3 py-1.5">
            <p className="doa-label-mono">Projects</p>
            <p className="text-sm font-semibold text-[color:var(--ink)]">{totalCards}</p>
          </div>
        </div>
      </div>

      <NewProjectModal open={newProjectOpen} onOpenChange={setNewProjectOpen} />

      {/* Hint scroll horizontal */}
      <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2)] px-4 py-2 text-xs text-[color:var(--ink-3)]">
        Scroll horizontal habilitado. Las columnas estan agrupadas por fase
        (Ejecucion, Validation, Delivery, Cierre). Clic en una card para abrir
        el project.
      </div>

      {/* Tablero */}
      <div className="min-h-0 min-w-0 flex-1 overflow-x-auto pb-4">
        <div className="flex min-w-max gap-4 pr-2">
          {PHASE_ORDER.map((phase) => (
            <PhaseColumnGroup
              key={phase}
              phase={phase}
              projectCount={countsByPhase[phase]}
            >
              {PHASE_TO_STATES[phase].map((stateCode) => (
                <StateColumn
                  key={stateCode}
                  stateCode={stateCode}
                  projects={byState.get(stateCode) ?? []}
                  showStateSelector
                />
              ))}
            </PhaseColumnGroup>
          ))}
        </div>
      </div>
    </div>
  )
}
