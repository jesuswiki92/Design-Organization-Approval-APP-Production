import type {
  EstadoCotizacion,
  EstadoProyecto,
  EstadoProyectoLegacy,
  EstadoProyectoPersistido,
  EstadoProyectoWorkflow,
} from '@/types/database'

export const QUOTATION_STATES: EstadoCotizacion[] = [
  'new_entry',
  'new',
  'unassigned',
  'ongoing',
  'pending_customer',
  'pending_internal',
  'rfi_sent',
  'quotation_sent',
  'won',
  'cancelled',
]

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

export const QUOTATION_STATE_CONFIG: Record<EstadoCotizacion, WorkflowConfig> = {
  new_entry: {
    label: 'New entry',
    shortLabel: 'New entry',
    color: 'text-slate-700',
    bg: 'bg-white',
    border: 'border-slate-300',
    dot: 'bg-slate-500',
  },
  new: {
    label: 'New',
    shortLabel: 'New',
    color: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  unassigned: {
    label: 'Unassigned',
    shortLabel: 'Unassigned',
    color: 'text-zinc-700',
    bg: 'bg-zinc-50',
    border: 'border-zinc-200',
    dot: 'bg-zinc-400',
  },
  ongoing: {
    label: 'On going',
    shortLabel: 'Ongoing',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  pending_customer: {
    label: 'Pending customer',
    shortLabel: 'Pending customer',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  pending_internal: {
    label: 'Pending internal',
    shortLabel: 'Pending internal',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
  rfi_sent: {
    label: 'RFI sent',
    shortLabel: 'RFI sent',
    color: 'text-cyan-700',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    dot: 'bg-cyan-500',
  },
  quotation_sent: {
    label: 'Quotation sent',
    shortLabel: 'Quote sent',
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  won: {
    label: 'Won',
    shortLabel: 'Won',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  cancelled: {
    label: 'Cancelled',
    shortLabel: 'Cancelled',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
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

const QUOTATION_TRANSITIONS: Record<EstadoCotizacion, EstadoCotizacion[]> = {
  new_entry: ['new', 'unassigned', 'cancelled'],
  new: ['unassigned', 'ongoing', 'cancelled'],
  unassigned: ['ongoing', 'cancelled'],
  ongoing: ['pending_customer', 'pending_internal', 'rfi_sent', 'quotation_sent', 'cancelled'],
  pending_customer: ['ongoing', 'quotation_sent', 'cancelled'],
  pending_internal: ['ongoing', 'quotation_sent', 'cancelled'],
  rfi_sent: ['ongoing', 'quotation_sent', 'cancelled'],
  quotation_sent: ['pending_customer', 'won', 'cancelled'],
  won: [],
  cancelled: [],
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

const QUOTATION_REASON_REQUIRED = new Set<EstadoCotizacion>([
  'pending_customer',
  'pending_internal',
  'cancelled',
])

const PROJECT_REASON_REQUIRED = new Set<EstadoProyecto>([
  'op_02_pending_info',
  'op_03_pending_tests',
])

export function getQuotationStatusMeta(status: string) {
  return QUOTATION_STATE_CONFIG[status as EstadoCotizacion] ?? QUOTATION_STATE_CONFIG.new_entry
}

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

export function getAllowedQuotationTransitions(status: string) {
  return QUOTATION_TRANSITIONS[status as EstadoCotizacion] ?? []
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

export function requiresWorkflowReason(entity: 'quotation' | 'project', state: string) {
  if (entity === 'quotation') return QUOTATION_REASON_REQUIRED.has(state as EstadoCotizacion)
  return PROJECT_REASON_REQUIRED.has(state as EstadoProyecto)
}

export function isQuotationState(value: string): value is EstadoCotizacion {
  return QUOTATION_STATES.includes(value as EstadoCotizacion)
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
