'use client'

/**
 * ============================================================================
 * TABLERO DE PROYECTOS (VISTA KANBAN POR FASE + ESTADO)
 * ============================================================================
 *
 * Vista Tablero tipo Kanban para proyectos. Espejo del patron de
 * `QuotationStatesBoard` (Quotations) pero aplicado a la maquina v2 de 13
 * estados agrupados en 4 fases.
 *
 * ESTRUCTURA:
 *   - 4 grupos de fase (Ejecucion, Validacion, Entrega, Cierre), cada uno
 *     engloba sus 2-5 columnas de estado.
 *   - Cabeceras y colores derivados de `PROJECT_EXECUTION_STATE_CONFIG` +
 *     paleta propia de cada fase.
 *   - Scroll horizontal (13 columnas no caben en pantalla).
 *
 * DECISION (v1, read-only):
 *   NO drag-and-drop. La razon: el Tablero de Quotations tampoco usa DnD —
 *   usa un `select` en cada card para cambiar estado. En Proyectos muchas
 *   transiciones requieren formulario (planificar, validar, preparar-entrega,
 *   enviar-entrega, confirmar-entrega, cerrar), asi que un drag ingenuo
 *   corrompe la maquina de estados. La primera iteracion es READ-ONLY: clic
 *   en card -> /engineering/projects/[id]. Cambios de estado se hacen desde
 *   el detalle (tabs horas/deliverables/validacion/entrega/cierre).
 *
 * TODO(tablero-v2): añadir DnD con `@dnd-kit/core` y commit inline solo para
 *   transiciones triviales (devuelto_a_ejecucion -> en_ejecucion via /retomar,
 *   cerrado -> archivado_proyecto via /archivar). Para el resto, abrir modal
 *   con redirect a la tab correspondiente del detalle.
 *
 * TOGGLE LISTA/TABLERO:
 *   Los botones en la cabecera son Links — la Lista vive en
 *   /engineering/portfolio, el Tablero aqui. No se comparte estado local:
 *   cada vista es un Server Component con su propia fetch.
 * ============================================================================
 */

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { LayoutGrid, List, Search } from 'lucide-react'

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
import { cn } from '@/lib/utils'

/** Agrupacion canonica de estados por fase (misma que en workflow-states.ts) */
const PHASE_TO_STATES: Record<ProjectExecutionPhase, ProjectExecutionState[]> = {
  ejecucion: [
    PROJECT_EXECUTION_STATES.PROYECTO_ABIERTO,
    PROJECT_EXECUTION_STATES.PLANIFICACION,
    PROJECT_EXECUTION_STATES.EN_EJECUCION,
    PROJECT_EXECUTION_STATES.REVISION_INTERNA,
    PROJECT_EXECUTION_STATES.LISTO_PARA_VALIDACION,
  ],
  validacion: [
    PROJECT_EXECUTION_STATES.EN_VALIDACION,
    PROJECT_EXECUTION_STATES.VALIDADO,
    PROJECT_EXECUTION_STATES.DEVUELTO_A_EJECUCION,
  ],
  entrega: [
    PROJECT_EXECUTION_STATES.PREPARANDO_ENTREGA,
    PROJECT_EXECUTION_STATES.ENTREGADO,
    PROJECT_EXECUTION_STATES.CONFIRMACION_CLIENTE,
  ],
  cierre: [
    PROJECT_EXECUTION_STATES.CERRADO,
    PROJECT_EXECUTION_STATES.ARCHIVADO_PROYECTO,
  ],
}

const PHASE_ORDER: ProjectExecutionPhase[] = [
  PROJECT_EXECUTION_PHASES.EJECUCION,
  PROJECT_EXECUTION_PHASES.VALIDACION,
  PROJECT_EXECUTION_PHASES.ENTREGA,
  PROJECT_EXECUTION_PHASES.CIERRE,
]

/**
 * Devuelve el codigo de estado a usar para tablero: prioriza `estado_v2`
 * (maquina v2). Si falta, el proyecto queda en una "columna limbo"
 * — mostrado en `proyecto_abierto` por defecto como fallback razonable.
 */
function resolveTableroState(project: ProjectCardData): string {
  return project.estado_v2 ?? PROJECT_EXECUTION_STATES.PROYECTO_ABIERTO
}

export function TableroClient({ projects }: { projects: ProjectCardData[] }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((project) => {
      return (
        project.titulo.toLowerCase().includes(q) ||
        project.numero_proyecto.toLowerCase().includes(q) ||
        (project.cliente_nombre ?? '').toLowerCase().includes(q) ||
        (project.aeronave ?? '').toLowerCase().includes(q) ||
        (project.tcds_code_short ?? '').toLowerCase().includes(q) ||
        (project.owner ?? '').toLowerCase().includes(q)
      )
    })
  }, [projects, search])

  /** Agrupar proyectos por estado_v2 */
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
      ejecucion: 0,
      validacion: 0,
      entrega: 0,
      cierre: 0,
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-5 text-slate-900">
      {/* Cabecera + toggle Lista/Tablero */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
          <Link
            href="/engineering/portfolio"
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
              'text-slate-500 hover:text-slate-950',
            )}
          >
            <List size={14} />
            Lista
          </Link>
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
              'bg-sky-600 text-white shadow-sm',
            )}
          >
            <LayoutGrid size={14} />
            Tablero
          </span>
        </div>

        <div className="relative max-w-xs min-w-[200px] flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Buscar proyectos..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-950 placeholder-slate-400 transition-colors focus:border-sky-300 focus:outline-none"
          />
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-sky-200 bg-white/90 px-3 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Columnas
            </p>
            <p className="text-sm font-semibold text-slate-950">{totalColumns}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-white/90 px-3 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Proyectos
            </p>
            <p className="text-sm font-semibold text-slate-950">{totalCards}</p>
          </div>
        </div>
      </div>

      {/* Hint scroll horizontal */}
      <div className="rounded-[18px] border border-sky-100 bg-white/85 px-4 py-2 text-xs text-slate-600 shadow-sm">
        Scroll horizontal habilitado. Las columnas estan agrupadas por fase
        (Ejecucion, Validacion, Entrega, Cierre). Clic en una card para abrir
        el proyecto.
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
                />
              ))}
            </PhaseColumnGroup>
          ))}
        </div>
      </div>
    </div>
  )
}
