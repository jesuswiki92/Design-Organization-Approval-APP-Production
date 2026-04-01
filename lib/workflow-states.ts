import type {
  EstadoProyecto,
  EstadoProyectoLegacy,
  EstadoProyectoPersistido,
  EstadoProyectoWorkflow,
} from '@/types/database'

// ==========================================
// ESTADOS VISUALES DE QUOTATIONS
// ==========================================

export const QUOTATION_BOARD_STATES = {
  ENTRADA_RECIBIDA: 'entrada_recibida',
  TRIAGE: 'triage',
  ALCANCE_DEFINIDO: 'alcance_definido',
  OFERTA_EN_REDACCION: 'oferta_en_redaccion',
  REVISION_INTERNA: 'revision_interna',
  PENDIENTE_ENVIO: 'pendiente_envio',
  SEGUIMIENTO_CIERRE: 'seguimiento_cierre',
} as const

export type QuotationBoardState =
  typeof QUOTATION_BOARD_STATES[keyof typeof QUOTATION_BOARD_STATES]

type QuotationBoardConfig = {
  label: string
  shortLabel: string
  description: string
  color: string
  bg: string
  border: string
  dot: string
}

export const QUOTATION_BOARD_STATE_CONFIG: Record<QuotationBoardState, QuotationBoardConfig> = {
  entrada_recibida: {
    label: 'Entrada recibida',
    shortLabel: 'Entrada',
    description: 'Consulta comercial que acaba de entrar en la bandeja',
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  triage: {
    label: 'Triage',
    shortLabel: 'Triage',
    description: 'Revisión inicial para clasificar urgencia y contexto',
    color: 'text-cyan-700',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    dot: 'bg-cyan-500',
  },
  alcance_definido: {
    label: 'Alcance definido',
    shortLabel: 'Alcance',
    description: 'El alcance ya está clarificado y listo para estimar',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  oferta_en_redaccion: {
    label: 'Oferta en redaccion',
    shortLabel: 'Redaccion',
    description: 'Se está construyendo la cotización o propuesta comercial',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  revision_interna: {
    label: 'Revision interna',
    shortLabel: 'Revision',
    description: 'La oferta pasa por validacion interna antes de salir',
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
  },
  pendiente_envio: {
    label: 'Pendiente de envio',
    shortLabel: 'Envio',
    description: 'Lista para enviarse al cliente desde la app',
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  seguimiento_cierre: {
    label: 'Seguimiento / cierre',
    shortLabel: 'Cierre',
    description: 'Cotizacion enviada, seguimiento activo o cierre final',
    color: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  },
}

export function getQuotationBoardStatusMeta(state: string) {
  const config = QUOTATION_BOARD_STATE_CONFIG[state as QuotationBoardState]
  if (!config) {
    return {
      label: state,
      shortLabel: state,
      description: 'Estado de quotations desconocido',
      color: 'text-slate-600',
      bg: 'bg-slate-100',
      border: 'border-slate-200',
      dot: 'bg-slate-400',
    }
  }

  return config
}

// ==========================================
// ESTADOS DE CONSULTAS ENTRANTES
// ==========================================

export const CONSULTA_ESTADOS = {
  NUEVO: 'nuevo',
  ESPERANDO_FORMULARIO: 'esperando_formulario',
  FORMULARIO_RECIBIDO: 'formulario_recibido',
} as const

export type EstadoConsulta = typeof CONSULTA_ESTADOS[keyof typeof CONSULTA_ESTADOS]

export const CONSULTA_STATE_CONFIG: Record<EstadoConsulta, { label: string; color: string; description: string }> = {
  nuevo: {
    label: 'Nuevo',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    description: 'Consulta recibida, pendiente de revisión por ingeniero',
  },
  esperando_formulario: {
    label: 'Esperando formulario',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    description: 'Email enviado al cliente con enlace al formulario',
  },
  formulario_recibido: {
    label: 'Formulario recibido',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    description: 'Cliente completó el formulario, listo para siguiente fase',
  },
}

export function getConsultaStatusMeta(estado: string) {
  const config = CONSULTA_STATE_CONFIG[estado as EstadoConsulta]
  if (!config) return { label: estado, color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', description: 'Estado desconocido' }
  return config
}

export const CONSULTA_TRANSITIONS: Record<EstadoConsulta, EstadoConsulta[]> = {
  nuevo: ['esperando_formulario'],
  esperando_formulario: ['formulario_recibido'],
  formulario_recibido: [],
}

export function getAllowedConsultaTransitions(current: string): EstadoConsulta[] {
  return CONSULTA_TRANSITIONS[current as EstadoConsulta] ?? []
}

// ==========================================
// ESTADOS DE PROYECTOS
// ==========================================

export const PROJECT_WORKFLOW_STATES = [
  'op_00_prepay',
  'op_01_data_collection',
  'op_02_pending_info',
  'op_03_pending_tests',
  'op_04_under_evaluation',
  'op_05_in_work',
  'op_06_customer_review',
  'op_07_internal_review',
  'op_08_pending_signature',
  'op_09_pending_authority',
  'op_10_ready_for_delivery',
  'op_11_delivered',
  'op_12_closed',
  'op_13_invoiced',
] as const satisfies readonly EstadoProyectoWorkflow[]

export const PROJECT_PORTFOLIO_STATES: EstadoProyecto[] = [
  ...PROJECT_WORKFLOW_STATES,
]

const PROJECT_LEGACY_BRIDGE_STATES = [
  'oferta',
  'activo',
  'en_revision',
  'pendiente_aprobacion_cve',
  'pendiente_aprobacion_easa',
  'en_pausa',
  'cancelado',
  'cerrado',
  'guardado_en_base_de_datos',
] as const satisfies readonly EstadoProyectoLegacy[]

type WorkflowConfig = {
  label: string
  shortLabel: string
  color: string
  bg: string
  border: string
  dot: string
}

export const PROJECT_STATE_CONFIG: Record<EstadoProyectoWorkflow, WorkflowConfig> = {
  op_00_prepay: {
    label: 'OP-00 Prepay',
    shortLabel: 'OP-00',
    color: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  },
  op_01_data_collection: {
    label: 'OP-01 Data collection',
    shortLabel: 'OP-01',
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  op_02_pending_info: {
    label: 'OP-02 Pending info',
    shortLabel: 'OP-02',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  op_03_pending_tests: {
    label: 'OP-03 Pending tests',
    shortLabel: 'OP-03',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
  op_04_under_evaluation: {
    label: 'OP-04 Under evaluation',
    shortLabel: 'OP-04',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  op_05_in_work: {
    label: 'OP-05 In work',
    shortLabel: 'OP-05',
    color: 'text-cyan-700',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    dot: 'bg-cyan-500',
  },
  op_06_customer_review: {
    label: 'OP-06 Customer review',
    shortLabel: 'OP-06',
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
  },
  op_07_internal_review: {
    label: 'OP-07 Internal review',
    shortLabel: 'OP-07',
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  op_08_pending_signature: {
    label: 'OP-08 Pending signature',
    shortLabel: 'OP-08',
    color: 'text-fuchsia-700',
    bg: 'bg-fuchsia-50',
    border: 'border-fuchsia-200',
    dot: 'bg-fuchsia-500',
  },
  op_09_pending_authority: {
    label: 'OP-09 Pending authority',
    shortLabel: 'OP-09',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  op_10_ready_for_delivery: {
    label: 'OP-10 Ready for delivery',
    shortLabel: 'OP-10',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  op_11_delivered: {
    label: 'OP-11 Delivered',
    shortLabel: 'OP-11',
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    dot: 'bg-teal-500',
  },
  op_12_closed: {
    label: 'OP-12 Closed',
    shortLabel: 'OP-12',
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  },
  op_13_invoiced: {
    label: 'OP-13 Invoiced',
    shortLabel: 'OP-13',
    color: 'text-emerald-800',
    bg: 'bg-emerald-100',
    border: 'border-emerald-300',
    dot: 'bg-emerald-600',
  },
}

const PROJECT_LEGACY_STATE_CONFIG: Record<EstadoProyectoLegacy, WorkflowConfig> = {
  oferta: {
    label: 'Legacy · Oferta',
    shortLabel: 'Legacy oferta',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  activo: {
    label: 'Legacy · Activo',
    shortLabel: 'Legacy activo',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  en_revision: {
    label: 'Legacy · En revision',
    shortLabel: 'Legacy revision',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  pendiente_aprobacion_cve: {
    label: 'Legacy · Pendiente CVE',
    shortLabel: 'Legacy CVE',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  pendiente_aprobacion_easa: {
    label: 'Legacy · Pendiente authority',
    shortLabel: 'Legacy authority',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  en_pausa: {
    label: 'Legacy · En pausa',
    shortLabel: 'Legacy pausa',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  cancelado: {
    label: 'Legacy · Cancelado',
    shortLabel: 'Legacy cancelado',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  cerrado: {
    label: 'Legacy · Cerrado',
    shortLabel: 'Legacy cerrado',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  guardado_en_base_de_datos: {
    label: 'Legacy · Base de datos',
    shortLabel: 'Legacy base',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
}

const PROJECT_TRANSITIONS: Record<EstadoProyecto, EstadoProyecto[]> = {
  op_00_prepay: ['op_01_data_collection'],
  op_01_data_collection: ['op_02_pending_info', 'op_03_pending_tests', 'op_04_under_evaluation'],
  op_02_pending_info: ['op_01_data_collection', 'op_04_under_evaluation'],
  op_03_pending_tests: ['op_04_under_evaluation'],
  op_04_under_evaluation: ['op_02_pending_info', 'op_03_pending_tests', 'op_05_in_work'],
  op_05_in_work: ['op_02_pending_info', 'op_03_pending_tests', 'op_06_customer_review', 'op_07_internal_review'],
  op_06_customer_review: ['op_05_in_work', 'op_07_internal_review'],
  op_07_internal_review: ['op_05_in_work', 'op_08_pending_signature'],
  op_08_pending_signature: ['op_05_in_work', 'op_09_pending_authority', 'op_10_ready_for_delivery'],
  op_09_pending_authority: ['op_05_in_work', 'op_10_ready_for_delivery'],
  op_10_ready_for_delivery: ['op_11_delivered'],
  op_11_delivered: ['op_12_closed'],
  op_12_closed: ['op_13_invoiced'],
  op_13_invoiced: [],
}

const PROJECT_LEGACY_TRANSITIONS: Partial<Record<EstadoProyectoLegacy, EstadoProyecto[]>> = {
  oferta: ['op_00_prepay'],
  guardado_en_base_de_datos: ['op_01_data_collection'],
  activo: ['op_05_in_work'],
  en_revision: ['op_07_internal_review'],
  pendiente_aprobacion_cve: ['op_08_pending_signature'],
  pendiente_aprobacion_easa: ['op_09_pending_authority'],
  en_pausa: ['op_02_pending_info', 'op_03_pending_tests', 'op_05_in_work'],
  cerrado: ['op_12_closed'],
  cancelado: [],
}

const PROJECT_LEGACY_TO_WORKFLOW: Partial<Record<EstadoProyectoLegacy, EstadoProyecto>> = {
  oferta: 'op_00_prepay',
  guardado_en_base_de_datos: 'op_01_data_collection',
  activo: 'op_05_in_work',
  en_revision: 'op_07_internal_review',
  pendiente_aprobacion_cve: 'op_08_pending_signature',
  pendiente_aprobacion_easa: 'op_09_pending_authority',
  en_pausa: 'op_02_pending_info',
  cancelado: 'op_12_closed',
  cerrado: 'op_12_closed',
}

const PROJECT_REASON_REQUIRED = new Set<EstadoProyecto>([
  'op_02_pending_info',
  'op_03_pending_tests',
])

export function getProjectStatusMeta(status: string) {
  if (isProjectWorkflowState(status)) {
    return PROJECT_STATE_CONFIG[status]
  }

  if (isProjectLegacyState(status)) {
    return PROJECT_LEGACY_STATE_CONFIG[status]
  }

  return {
    label: status,
    shortLabel: status,
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  }
}

export function getAllowedProjectTransitions(status: string) {
  if (isProjectWorkflowState(status)) {
    return PROJECT_TRANSITIONS[status] ?? []
  }

  if (isProjectLegacyState(status)) {
    return PROJECT_LEGACY_TRANSITIONS[status] ?? []
  }

  return []
}

export function requiresWorkflowReason(entity: 'project', state: string) {
  return PROJECT_REASON_REQUIRED.has(state as EstadoProyecto)
}

export function isProjectWorkflowState(value: string): value is EstadoProyecto {
  return PROJECT_WORKFLOW_STATES.includes(value as EstadoProyecto)
}

export function isProjectLegacyState(value: string): value is EstadoProyectoLegacy {
  return PROJECT_LEGACY_BRIDGE_STATES.includes(value as EstadoProyectoLegacy)
}

export function isProjectState(value: string): value is EstadoProyecto {
  return isProjectWorkflowState(value)
}

export function getProjectOperationalState(status: string): EstadoProyecto | null {
  if (isProjectWorkflowState(status)) return status
  if (isProjectLegacyState(status)) return PROJECT_LEGACY_TO_WORKFLOW[status] ?? null
  return null
}

export function isProjectStatePersisted(value: string): value is EstadoProyectoPersistido {
  return isProjectWorkflowState(value) || isProjectLegacyState(value)
}
