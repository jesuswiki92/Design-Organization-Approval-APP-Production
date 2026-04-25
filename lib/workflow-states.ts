/**
 * ============================================================================
 * WORKFLOW-STATE INVARIANTS (Block 5 / Item K)
 * ============================================================================
 *
 * Namespaces defined here (must remain disjoint — do not cross-reference codes
 * between them):
 *
 *   1. `request` (incoming queries)
 *        - Constants: `INCOMING_REQUEST_STATUSES`
 *        - DB table:  `doa_incoming_requests.status`
 *        - Check:     `doa_incoming_requests_estado_check`
 *
 *   2. `quotation_board`
 *        - Constants: `QUOTATION_BOARD_STATES`
 *        - DB table:  `doa_incoming_requests.status` (shared column, but the
 *                     valid codes for the Kanban view are a superset here —
 *                     see audit doc 07 for the intentional overlap).
 *
 *   3. `project_execution` (machine v2)
 *        - Constants: `PROJECT_EXECUTION_STATES`, `PROJECT_EXECUTION_PHASES`
 *        - DB column: `doa_projects.execution_status`, `doa_projects.current_phase`
 *        - Check:     `doa_projects_execution_status_check`,
 *                     `doa_projects_current_phase_check`
 *
 * DAG guarantees that MUST hold for the app to be correct:
 *   (a) Every transition invoked from server code (API routes / actions) must
 *       be present in the DAG for its namespace. Hardcoded strings are
 *       forbidden; always reference the constants.
 *   (b) Every target of every DAG edge must be a valid code in the same
 *       namespace's enumeration.
 *   (c) The DB CHECK constraints must mirror the TypeScript enumerations
 *       exactly — drift between the two is a P0 bug (the app will silently
 *       reject transitions the DAG considers valid, or accept transitions
 *       the DB rejects).
 *
 * Test hint (not implemented yet — follow-up):
 *   A drift-detection script should SELECT the CHECK constraint definitions
 *   from `pg_constraint` and parse the enumerated strings, then compare them
 *   against `Object.values(INCOMING_REQUEST_STATUSES)`, `Object.values(QUOTATION_BOARD_STATES)`,
 *   `Object.values(PROJECT_EXECUTION_STATES)`, and `Object.values(PROJECT_EXECUTION_PHASES)`.
 *   Any symmetric difference is a drift. Fail the script on non-empty diff.
 * ============================================================================
 *
 * ESTADOS DE FLUJOS DE TRABAJO DE LA APLICACION
 *
 * Este es uno de los archivos mas importantes de la app. Define TODOS los statuses
 * posibles por los que pueden pasar las entidades principales del sistema:
 *
 * 1. COTIZACIONES (Quotations): Los statuses del tablero visual donde se mueven
 *    las quotes comerciales (desde que llega una request hasta que se cierra).
 *
 * 2. CONSULTAS ENTRANTES (Incoming Queries): Los statuses por los que pasa una
 *    request de un client desde que se recibe hasta que se archiva.
 *
 * 3. PROYECTOS DE INGENIERIA: Los statuses simplificados de un project (new,
 *    in_progress, review, approval, delivered, closed), mas los statuses
 *    "legacy" (antiguos) que se conservan por compatibilidad con data existentes.
 *
 * Para cada type de status se define:
 * - Los codigos posibles (por ejemplo: "request_received", "triage", etc.)
 * - La configuracion visual (name, color, description)
 * - Las transiciones permitidas (de que status se puede pasar a cual)
 * - Funciones auxiliares para consultar y validar statuses
 *
 * REGLA IMPORTANTE: Nunca escribir nombres de statuses directamente en el codigo.
 * Siempre usar las constantes definidas aqui (ej: INCOMING_REQUEST_STATUSES.NEW).
 */

import type {
  ProjectStatus,
  LegacyProjectStatus,
  PersistedProjectStatus,
  ProjectWorkflowStatus,
} from '@/types/database'

// ==========================================
// ESTADOS VISUALES DE QUOTATIONS (COTIZACIONES)
// Estos son los statuses del tablero Kanban donde se gestionan las quotes comerciales
// ==========================================

// Codigos de los statuses posibles en el tablero de cotizaciones.
// Cada constante representa una columna del tablero Kanban.
export const QUOTATION_BOARD_STATES = {
  REQUEST_RECEIVED: 'request_received',           // Acaba de llegar una commercial request
  FORM_SENT: 'form_sent',       // Form sent al client, awaiting response
  FORM_RECEIVED: 'form_received',     // Form received del client, awaiting review
  DEFINE_SCOPE: 'define_scope',             // Se esta definiendo el alcance del trabajo (preliminar)
  AWAITING_CLIENT_RESPONSE: 'awaiting_client_response', // Email sent al client manualmente, awaiting response
  SCOPE_DEFINED: 'scope_defined',           // Alcance definido, prepare quote commercial
  QUOTE_IN_REVIEW: 'quote_in_review',       // Oferta preparada, en review internal
  QUOTE_SENT: 'quote_sent',               // Oferta sent al client
  QUOTE_ACCEPTED: 'quote_accepted',             // El client acepto la quote
  QUOTE_REJECTED: 'quote_rejected',           // El client rechazo la quote
  FINAL_REVIEW: 'final_review',               // Review final antes de abrir project
  PROJECT_OPENED: 'project_opened',           // Project ya creado desde la request (terminal en tablero)
} as const

// Tipo que representa cualquier status valido del tablero de cotizaciones
export type QuotationBoardState =
  typeof QUOTATION_BOARD_STATES[keyof typeof QUOTATION_BOARD_STATES]

// Estructura de la configuracion visual de cada status del tablero de cotizaciones
// Define como se ve cada status en la interfaz: name, color del text, fondo, borde y punto
type QuotationBoardConfig = {
  label: string        // Name completo del status (ej: "Request received")
  shortLabel: string   // Name abreviado para espacios pequeños (ej: "Entrada")
  description: string  // Explicacion breve de que significa estar en este status
  color: string        // Color del text (clase CSS de Tailwind)
  bg: string           // Color de fondo (clase CSS de Tailwind)
  border: string       // Color del borde (clase CSS de Tailwind)
  dot: string          // Color del punto/indicador (clase CSS de Tailwind)
}

// Configuracion visual completa de cada status del tablero de cotizaciones.
// Aqui se define el name, la description y los colores de cada columna del tablero.
export const QUOTATION_BOARD_STATE_CONFIG: Record<QuotationBoardState, QuotationBoardConfig> = {
  request_received: {
    label: 'Request received',
    shortLabel: 'Request',
    description: 'Commercial request that has just arrived in the inbox',
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  form_sent: {
    label: 'Form sent. Awaiting response',
    shortLabel: 'Sent',
    description: 'Form sent to the client; awaiting response',
    color: 'text-cyan-700',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    dot: 'bg-cyan-500',
  },
  form_received: {
    label: 'General form received. Review',
    shortLabel: 'General form received',
    description: 'Client submitted the form; awaiting internal review',
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    dot: 'bg-teal-500',
  },
  define_scope: {
    label: 'Define scope. Preliminary',
    shortLabel: 'Preliminary scope',
    description: 'Technical and commercial scope is being defined',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  awaiting_client_response: {
    label: 'Awaiting client response',
    shortLabel: 'Awaiting client',
    description: 'Email sent to the client; awaiting response. Transitioned manually when the email is sent.',
    color: 'text-cyan-700',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    dot: 'bg-cyan-500',
  },
  scope_defined: {
    label: 'Scope defined. Prepare quote',
    shortLabel: 'Prepare',
    description: 'Scope clarified; prepare the commercial quote',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  quote_in_review: {
    label: 'Quote prepared. Review',
    shortLabel: 'Review',
    description: 'Quote drafted and awaiting internal review',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  quote_sent: {
    label: 'Quote sent to client',
    shortLabel: 'Sent',
    description: 'Commercial quote sent to the client; awaiting response',
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
  },
  quote_accepted: {
    label: 'Quote accepted',
    shortLabel: 'Accepted',
    description: 'Client accepted the commercial quote',
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  quote_rejected: {
    label: 'Quote rejected',
    shortLabel: 'Rejected',
    description: 'Client rejected the commercial quote',
    color: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  },
  final_review: {
    label: 'Final review. Open project',
    shortLabel: 'Final',
    description: 'Review final antes de crear el project de ingeniería',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  project_opened: {
    label: 'Project opened',
    shortLabel: 'Open',
    description: 'The engineering project has already been created from this request',
    color: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  },
}

/**
 * Obtiene la informacion visual de un status del tablero de cotizaciones.
 *
 * Si el status no se reconoce (por ejemplo, porque viene de data antiguos),
 * devuelve una configuracion por defecto en gris para que no se rompa la interfaz.
 *
 * @param state - El codigo del status (ej: "request_received", "triage")
 * @returns Objeto con el name, description y colores del status
 */
export function getQuotationBoardStatusMeta(state: string) {
  const config = QUOTATION_BOARD_STATE_CONFIG[state as QuotationBoardState]
  if (!config) {
    return {
      label: state,
      shortLabel: state,
      description: 'Unknown quotation status',
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
// Estos statuses representan el ciclo de vida de una commercial request
// desde que llega por email/form hasta que se archiva.
// ==========================================

// Codigos de los statuses posibles para las requests entrantes
export const INCOMING_REQUEST_STATUSES = {
  NEW: 'new',                                   // Request recien received, sin procesar
  AWAITING_FORM: 'awaiting_form',      // Se le send un form al client, awaiting response
  FORM_RECEIVED: 'form_received',        // El client respondio el form, hay que revisarlo
  ARCHIVED: 'archived',                            // Request cerrada y archivada
} as const

// Tipo que representa cualquier status valido de una request entrante
export type IncomingRequestStatus = typeof INCOMING_REQUEST_STATUSES[keyof typeof INCOMING_REQUEST_STATUSES]

// Configuracion visual de cada status de request: name visible, colores y description
export const INCOMING_REQUEST_STATUS_CONFIG: Record<IncomingRequestStatus, { label: string; color: string; description: string }> = {
  new: {
    label: 'New request',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    description: 'New request received, awaiting review por ingeniero',
  },
  awaiting_form: {
    label: 'Form sent',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    description: 'Form sent al client, awaiting response',
  },
  form_received: {
    label: 'General form received. Review',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    description: 'Form received del client, awaiting review internal',
  },
  archived: {
    label: 'Archived',
    color: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    description:
      'Request archivada. Se conserva en Supabase pero no aparece en la UI operativa',
  },
}

/**
 * Obtiene la informacion visual de un status de request entrante.
 *
 * Similar a getQuotationBoardStatusMeta pero para requests.
 * Si el status no se reconoce, devuelve una configuracion por defecto en gris.
 *
 * @param status - El codigo del status de la request (ej: "new", "archived")
 * @returns Objeto con el name visible, colores y description del status
 */
export function getIncomingRequestStatusMeta(status: string) {
  const config = INCOMING_REQUEST_STATUS_CONFIG[status as IncomingRequestStatus]
  if (!config) return { label: status, color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', description: 'Unknown status' }
  return config
}

// Transiciones permitidas entre statuses de requests.
// Define A QUE status se puede mover una request DESDE cada status.
// Por ejemplo: desde "new" se puede pasar a "awaiting_form" o a "archived",
// pero desde "archived" no se puede mover a ningun other status (lista vacia).
export const INCOMING_REQUEST_TRANSITIONS: Record<IncomingRequestStatus, IncomingRequestStatus[]> = {
  new: ['awaiting_form', 'archived'],
  awaiting_form: ['form_received', 'archived'],
  form_received: ['archived'],
  archived: [],
}

/**
 * Devuelve la lista de statuses a los que se puede mover una request
 * desde su status actual.
 *
 * La interfaz usa esta funcion para mostrar solo los botones de cambio
 * de status que son validos segun las reglas del flujo de trabajo.
 *
 * @param current - El status actual de la request
 * @returns Lista de statuses a los que se puede transicionar, o lista vacia si no hay opciones
 */
export function getAllowedIncomingRequestTransitions(current: string): IncomingRequestStatus[] {
  return INCOMING_REQUEST_TRANSITIONS[current as IncomingRequestStatus] ?? []
}

// ==========================================
// ESTADOS DE PROYECTOS DE INGENIERIA
// Flujo simplificado de statuses de project.
// Los projects pasan por 6 fases generales desde su creacion hasta su closure.
// Se conservan los statuses "legacy" (del sistema antiguo) para
// compatibilidad con projects que aun tienen esos statuses en la base de data.
// ==========================================

// Codigos de los statuses de un project de ingenieria.
// Usar siempre estas constantes en lugar de hardcodear strings.
export const PROJECT_STATES = {
  NEW: 'new',                // Project recien creado
  IN_PROGRESS: 'in_progress',    // Trabajo de ingenieria en curso
  REVIEW: 'review',          // En process de review technical
  APPROVAL: 'approval',      // Pending de approval
  DELIVERED: 'delivered',        // Documentacion entregada al client
  CLOSED: 'closed',            // Project completed y closed
  ARCHIVED: 'archived',        // Project archived (oculto del tablero, conservado en BD)
} as const satisfies Record<string, ProjectWorkflowStatus>

// Lista ordenada de todos los statuses de un project (flujo simplificado).
export const PROJECT_WORKFLOW_STATES = [
  PROJECT_STATES.NEW,
  PROJECT_STATES.IN_PROGRESS,
  PROJECT_STATES.REVIEW,
  PROJECT_STATES.APPROVAL,
  PROJECT_STATES.DELIVERED,
  PROJECT_STATES.CLOSED,
  PROJECT_STATES.ARCHIVED,
] as const satisfies readonly ProjectWorkflowStatus[]

// Statuses que se muestran en la vista de portafolio de projects
// (por ahora son los mismos que los statuses de workflow)
export const PROJECT_PORTFOLIO_STATES: ProjectStatus[] = [
  ...PROJECT_WORKFLOW_STATES,
]

// Statuses del sistema ANTIGUO ("legacy") que todavia existen en la base de data.
// Estos statuses ya no se usan para projects nuevos, pero algunos projects antiguos
// los conservan. La app los muestra con estilo gris para distinguirlos de los nuevos.
const PROJECT_LEGACY_STATUS_VALUES = [
  'quote',                        // Fase de quote (antiguo)
  'active',                        // Project is_active (antiguo)
  'in_review',                   // En review (antiguo)
  'pending_cve_approval',      // Pending de approval CVE (antiguo)
  'pending_easa_approval',     // Pending de approval EASA (antiguo)
  'paused',                      // Project pausado (antiguo)
  'canceled',                     // Project canceled (antiguo)
  'saved_to_database',     // Solo guardado como registro (antiguo)
] as const satisfies readonly LegacyProjectStatus[]

// Estructura de la configuracion visual de cada status de project
type WorkflowConfig = {
  label: string        // Name completo del status
  shortLabel: string   // Name abreviado
  color: string        // Color del text
  bg: string           // Color de fondo
  border: string       // Color del borde
  dot: string          // Color del punto indicador
}

// Configuracion visual de cada status de project (flujo simplificado).
// Define como se muestra cada status en el tablero y las listas de la app.
// Cada status tiene un color diferente para identificarlo visualmente.
export const PROJECT_STATE_CONFIG: Record<ProjectWorkflowStatus, WorkflowConfig> = {
  new: {
    label: 'New',
    shortLabel: 'New',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  in_progress: {
    label: 'In Progress',
    shortLabel: 'Progreso',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  review: {
    label: 'Review',
    shortLabel: 'Review',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  approval: {
    label: 'Approval',
    shortLabel: 'Approval',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  delivered: {
    label: 'Delivered',
    shortLabel: 'Delivered',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  closed: {
    label: 'Closed',
    shortLabel: 'Closed',
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  },
  archived: {
    label: 'Archived',
    shortLabel: 'Arch.',
    color: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  },
}

// Configuracion visual de los statuses legacy (antiguos).
// Todos se muestran en gris (slate) para distinguirlos de los statuses operativos nuevos.
const PROJECT_LEGACY_STATUS_CONFIG: Record<LegacyProjectStatus, WorkflowConfig> = {
  quote: {
    label: 'Legacy - Oferta',
    shortLabel: 'Legacy quote',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  active: {
    label: 'Legacy - Active',
    shortLabel: 'Legacy is_active',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  in_review: {
    label: 'Legacy - En review',
    shortLabel: 'Legacy review',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  pending_cve_approval: {
    label: 'Legacy - Pending CVE',
    shortLabel: 'Legacy CVE',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  pending_easa_approval: {
    label: 'Legacy - Pending authority',
    shortLabel: 'Legacy authority',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  paused: {
    label: 'Legacy - En pausa',
    shortLabel: 'Legacy pausa',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  canceled: {
    label: 'Legacy - Cancelado',
    shortLabel: 'Legacy canceled',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  saved_to_database: {
    label: 'Legacy - Base de data',
    shortLabel: 'Legacy base',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
}

// Transiciones permitidas entre statuses de project (flujo simplificado).
// Define las reglas de negocio: desde cada status, solo se puede avanzar
// a ciertos statuses especificos. El flujo es lineal con posibilidad de
// retroceder en algunos casos.
const PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  new: ['in_progress', 'archived'],
  in_progress: ['review', 'approval', 'archived'],
  review: ['in_progress', 'approval', 'archived'],
  approval: ['review', 'delivered', 'archived'],
  delivered: ['closed', 'archived'],
  closed: ['archived'],
  archived: [],
}

// Transiciones desde statuses legacy hacia statuses del new flujo de trabajo.
// Esto permite "migrar" un project del sistema antiguo al new.
const PROJECT_LEGACY_STATUS_TRANSITIONS: Partial<Record<LegacyProjectStatus, ProjectStatus[]>> = {
  quote: ['new'],
  saved_to_database: ['new'],
  active: ['in_progress'],
  in_review: ['review'],
  pending_cve_approval: ['approval'],
  pending_easa_approval: ['approval'],
  paused: ['new', 'in_progress'],
  canceled: [],
}

// Mapeo automatico de statuses legacy a su equivalente en el new flujo.
// Se usa para saber "a que fase corresponde" un project antiguo.
const PROJECT_LEGACY_TO_WORKFLOW_STATUS: Partial<Record<LegacyProjectStatus, ProjectStatus>> = {
  quote: 'new',
  saved_to_database: 'new',
  active: 'in_progress',
  in_review: 'review',
  pending_cve_approval: 'approval',
  pending_easa_approval: 'approval',
  paused: 'in_progress',
  canceled: 'closed',
}

// Statuses que requieren que el user_label escriba una RAZON al cambiar a ellos.
// Por ahora no hay statuses que lo requieran en el flujo simplificado,
// pero se mantiene la estructura por si se necesita en el futuro.
const PROJECT_REASON_REQUIRED = new Set<ProjectStatus>([])

/**
 * Obtiene la informacion visual de un status de project (name, colores, etc.).
 *
 * Funciona tanto con statuses del flujo simplificado (new, in_progress, review,
 * approval, delivered, closed) como con statuses legacy (quote, is_active, etc.).
 * Si el status no se reconoce, devuelve una configuracion por defecto en gris.
 *
 * @param status - El codigo del status del project
 * @returns Objeto con el name, colores y estilo visual del status
 */
export function getProjectStatusMeta(status: string) {
  if (isProjectWorkflowState(status)) {
    return PROJECT_STATE_CONFIG[status]
  }

  if (isProjectLegacyState(status)) {
    return PROJECT_LEGACY_STATUS_CONFIG[status]
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

/**
 * Devuelve la lista de statuses a los que se puede mover un project
 * desde su status actual.
 *
 * Funciona tanto para statuses nuevos como legacy. Los botones de la interfaz
 * usan esta funcion para mostrar solo las opciones validas al user_label.
 *
 * @param status - El status actual del project
 * @returns Lista de statuses permitidos como destino, o lista vacia si no hay opciones
 */
export function getAllowedProjectTransitions(status: string) {
  if (isProjectWorkflowState(status)) {
    return PROJECT_TRANSITIONS[status] ?? []
  }

  if (isProjectLegacyState(status)) {
    return PROJECT_LEGACY_STATUS_TRANSITIONS[status] ?? []
  }

  return []
}

/**
 * Indica si cambiar a un determinado status requiere que el user_label
 * escriba una razon o justificacion.
 *
 * Actualmente no hay statuses que lo requieran en el flujo simplificado,
 * pero se mantiene la estructura por si se necesita en el futuro.
 *
 * @param entity - El type de entidad (por ahora solo "project")
 * @param state - El status al que se quiere cambiar
 * @returns true si se debe pedir una razon al user_label, false si no
 */
export function requiresWorkflowReason(_entity: 'project', state: string) {
  return PROJECT_REASON_REQUIRED.has(state as ProjectStatus)
}

/**
 * Verifica si un text es un status valido del flujo simplificado de projects
 * (new, in_progress, review, approval, delivered, closed).
 */
export function isProjectWorkflowState(value: string): value is ProjectStatus {
  return PROJECT_WORKFLOW_STATES.includes(value as ProjectStatus)
}

/**
 * Verifica si un text es un status del sistema antiguo (legacy) de projects.
 */
export function isProjectLegacyState(value: string): value is LegacyProjectStatus {
  return PROJECT_LEGACY_STATUS_VALUES.includes(value as LegacyProjectStatus)
}

/**
 * Verifica si un text es cualquier type de status de project valido (new o legacy).
 * Actualmente solo verifica statuses del new flujo.
 */
export function isProjectState(value: string): value is ProjectStatus {
  return isProjectWorkflowState(value)
}

/**
 * Convierte cualquier status de project (new o legacy) a su equivalente
 * en el flujo operativo new.
 *
 * Si ya es un status del new flujo, lo devuelve tal cual.
 * Si es un status legacy, busca su equivalente en el mapeo.
 * Si no se reconoce, devuelve null.
 *
 * @param status - El status actual del project (puede ser new o legacy)
 * @returns El status operativo equivalente, o null si no se puede determinar
 */
export function getProjectOperationalState(status: string): ProjectStatus | null {
  if (isProjectWorkflowState(status)) return status
  if (isProjectLegacyState(status)) return PROJECT_LEGACY_TO_WORKFLOW_STATUS[status] ?? null
  return null
}

/**
 * Verifica si un text es un status de project que existe en la base de data
 * (ya sea del new flujo o del sistema legacy).
 *
 * Esto es util para validar data que vienen de Supabase antes de procesarlos.
 */
export function isProjectStatePersisted(value: string): value is PersistedProjectStatus {
  return isProjectWorkflowState(value) || isProjectLegacyState(value)
}

// ==========================================
// PROJECT EXECUTION STATES (Sprint 1 — new maquina de statuses v2)
// Maquina de 13 statuses que rige el ciclo de vida operativo de un project
// desde que se abre tras una quote accepted hasta que se archiva.
// Se persiste en doa_projects.execution_status (columna new, paralela a legacy.status).
// ==========================================

// Codigos de los 13 statuses de execution de un project.
// Cada constante representa una fase concreta del ciclo de vida.
export const PROJECT_EXECUTION_STATES = {
  PROJECT_OPENED: 'project_opened',               // Recently created tras quote accepted, pending de planificar
  PLANNING: 'planning',                     // Definicion de deliverables y asignacion de owners
  IN_EXECUTION: 'in_execution',                       // Trabajo technical en curso
  INTERNAL_REVIEW: 'internal_review',               // Check independiente por segundo ingeniero
  READY_FOR_VALIDATION: 'ready_for_validation',     // Todos los deliverables completados, pending validar
  IN_VALIDATION: 'in_validation',                     // DOH/DOS revisando y firmando
  VALIDATED: 'validated',                               // Approved por DOH/DOS
  RETURNED_TO_EXECUTION: 'returned_to_execution',       // Rechazado en validation, vuelve a execution
  PREPARING_DELIVERY: 'preparing_delivery',           // Generando SoC y documents de release
  DELIVERED: 'delivered',                             // SoC sent al client
  CLIENT_CONFIRMATION: 'client_confirmation',       // Client acuso recibo
  CLOSED: 'closed',                                 // Lecciones y metricas capturadas
  PROJECT_ARCHIVED: 'project_archived',           // Movido a historical, alimenta precedentes
} as const

// Tipo que representa cualquier status valido de la maquina de execution v2.
export type ProjectExecutionState =
  typeof PROJECT_EXECUTION_STATES[keyof typeof PROJECT_EXECUTION_STATES]

// Lista ordenada de los 13 statuses (sort_order canonico del flujo).
export const PROJECT_EXECUTION_STATE_LIST = [
  PROJECT_EXECUTION_STATES.PROJECT_OPENED,
  PROJECT_EXECUTION_STATES.PLANNING,
  PROJECT_EXECUTION_STATES.IN_EXECUTION,
  PROJECT_EXECUTION_STATES.INTERNAL_REVIEW,
  PROJECT_EXECUTION_STATES.READY_FOR_VALIDATION,
  PROJECT_EXECUTION_STATES.IN_VALIDATION,
  PROJECT_EXECUTION_STATES.VALIDATED,
  PROJECT_EXECUTION_STATES.RETURNED_TO_EXECUTION,
  PROJECT_EXECUTION_STATES.PREPARING_DELIVERY,
  PROJECT_EXECUTION_STATES.DELIVERED,
  PROJECT_EXECUTION_STATES.CLIENT_CONFIRMATION,
  PROJECT_EXECUTION_STATES.CLOSED,
  PROJECT_EXECUTION_STATES.PROJECT_ARCHIVED,
] as const satisfies readonly ProjectExecutionState[]

// Fases agregadas (agrupan los 13 statuses en 4 bloques).
// Se persiste en doa_projects.current_phase para permitir agrupaciones en Kanban/dashboards.
export const PROJECT_EXECUTION_PHASES = {
  EXECUTION: 'execution',     // project_opened | planning | in_execution | internal_review | ready_for_validation
  VALIDATION: 'validation',   // in_validation | validated | returned_to_execution
  DELIVERY: 'delivery',         // preparing_delivery | delivered | client_confirmation
  CLOSURE: 'closure',           // closed | project_archived
} as const

export type ProjectExecutionPhase =
  typeof PROJECT_EXECUTION_PHASES[keyof typeof PROJECT_EXECUTION_PHASES]

// Mapeo inverso: dado un status, devuelve la fase a la que pertenece.
export const PROJECT_EXECUTION_STATE_TO_PHASE: Record<ProjectExecutionState, ProjectExecutionPhase> = {
  project_opened: PROJECT_EXECUTION_PHASES.EXECUTION,
  planning: PROJECT_EXECUTION_PHASES.EXECUTION,
  in_execution: PROJECT_EXECUTION_PHASES.EXECUTION,
  internal_review: PROJECT_EXECUTION_PHASES.EXECUTION,
  ready_for_validation: PROJECT_EXECUTION_PHASES.EXECUTION,
  in_validation: PROJECT_EXECUTION_PHASES.VALIDATION,
  validated: PROJECT_EXECUTION_PHASES.VALIDATION,
  returned_to_execution: PROJECT_EXECUTION_PHASES.VALIDATION,
  preparing_delivery: PROJECT_EXECUTION_PHASES.DELIVERY,
  delivered: PROJECT_EXECUTION_PHASES.DELIVERY,
  client_confirmation: PROJECT_EXECUTION_PHASES.DELIVERY,
  closed: PROJECT_EXECUTION_PHASES.CLOSURE,
  project_archived: PROJECT_EXECUTION_PHASES.CLOSURE,
}

// Grafo de transiciones permitidas (DAG de la maquina v2).
// Desde cada status, lista los statuses a los que se puede pasar.
// project_archived es terminal.
export const PROJECT_EXECUTION_TRANSITIONS: Record<ProjectExecutionState, ProjectExecutionState[]> = {
  project_opened: [PROJECT_EXECUTION_STATES.PLANNING],
  planning: [PROJECT_EXECUTION_STATES.IN_EXECUTION],
  in_execution: [PROJECT_EXECUTION_STATES.INTERNAL_REVIEW],
  internal_review: [
    PROJECT_EXECUTION_STATES.IN_EXECUTION,           // rework
    PROJECT_EXECUTION_STATES.READY_FOR_VALIDATION,
  ],
  ready_for_validation: [PROJECT_EXECUTION_STATES.IN_VALIDATION],
  in_validation: [
    PROJECT_EXECUTION_STATES.VALIDATED,
    PROJECT_EXECUTION_STATES.RETURNED_TO_EXECUTION,
  ],
  validated: [PROJECT_EXECUTION_STATES.PREPARING_DELIVERY],
  returned_to_execution: [PROJECT_EXECUTION_STATES.IN_EXECUTION],
  preparing_delivery: [PROJECT_EXECUTION_STATES.DELIVERED],
  delivered: [PROJECT_EXECUTION_STATES.CLIENT_CONFIRMATION],
  client_confirmation: [PROJECT_EXECUTION_STATES.CLOSED],
  closed: [PROJECT_EXECUTION_STATES.PROJECT_ARCHIVED],
  project_archived: [], // terminal
}

/**
 * Verifica si un text es un codigo valido de la maquina de execution v2.
 */
export function isProjectExecutionStateCode(value: string): value is ProjectExecutionState {
  return (PROJECT_EXECUTION_STATE_LIST as readonly string[]).includes(value)
}

/**
 * Devuelve la lista de statuses a los que se puede transicionar desde el status actual.
 * La interfaz usa esta funcion para mostrar solo las opciones validas al user_label.
 */
export function getAllowedProjectExecutionTransitions(
  current: ProjectExecutionState,
): ProjectExecutionState[] {
  return PROJECT_EXECUTION_TRANSITIONS[current] ?? []
}

// Configuracion visual de cada status de execution v2 (flujo de 13 statuses).
// Sigue la misma forma que QUOTATION_BOARD_STATE_CONFIG para reusar componentes.
type ProjectExecutionConfig = {
  label: string
  shortLabel: string
  description: string
  accent: string       // Tailwind color family (sky, cyan, indigo, ...)
  color: string        // text-*-700
  bg: string           // bg-*-50
  border: string       // border-*-200
  dot: string          // bg-*-500
}

export const PROJECT_EXECUTION_STATE_CONFIG: Record<ProjectExecutionState, ProjectExecutionConfig> = {
  project_opened: {
    label: 'Project opened',
    shortLabel: 'Open',
    description: 'Recently created tras quote accepted, pending de planificar',
    accent: 'slate',
    color: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  },
  planning: {
    label: 'Planning',
    shortLabel: 'Planning',
    description: 'Definicion de deliverables y asignacion de owners',
    accent: 'sky',
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  in_execution: {
    label: 'In execution',
    shortLabel: 'In execution',
    description: 'Trabajo technical en curso',
    accent: 'cyan',
    color: 'text-cyan-700',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    dot: 'bg-cyan-500',
  },
  internal_review: {
    label: 'Internal review',
    shortLabel: 'Review',
    description: 'Check independiente por segundo ingeniero',
    accent: 'indigo',
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  ready_for_validation: {
    label: 'Ready for validation',
    shortLabel: 'Listo',
    description: 'Todos los deliverables completados, pending validar',
    accent: 'violet',
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
  },
  in_validation: {
    label: 'In validation',
    shortLabel: 'Validation',
    description: 'DOH/DOS revisando y firmando',
    accent: 'amber',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  validated: {
    label: 'Validated',
    shortLabel: 'Validated',
    description: 'Approved por DOH/DOS',
    accent: 'lime',
    color: 'text-lime-700',
    bg: 'bg-lime-50',
    border: 'border-lime-200',
    dot: 'bg-lime-500',
  },
  returned_to_execution: {
    label: 'Returned to execution',
    shortLabel: 'Returned',
    description: 'Rechazado en validation, vuelve a execution',
    accent: 'rose',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  preparing_delivery: {
    label: 'Preparing delivery',
    shortLabel: 'Delivery prep',
    description: 'Generando SoC y documents de release',
    accent: 'teal',
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    dot: 'bg-teal-500',
  },
  delivered: {
    label: 'Delivered',
    shortLabel: 'Delivered',
    description: 'SoC sent al client',
    accent: 'emerald',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  client_confirmation: {
    label: 'Client confirmation',
    shortLabel: 'Confirmado',
    description: 'Client acuso recibo',
    accent: 'green',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  closed: {
    label: 'Closed',
    shortLabel: 'Closed',
    description: 'Lecciones y metricas capturadas',
    accent: 'emerald',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  project_archived: {
    label: 'Archived',
    shortLabel: 'Archived',
    description: 'Movido a historical, alimenta precedentes',
    accent: 'slate',
    color: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  },
}

/**
 * Obtiene la informacion visual de un status de la maquina de execution v2.
 * Si el codigo no se reconoce, devuelve configuracion por defecto en gris.
 */
export function getProjectExecutionStateMeta(code: string) {
  if (isProjectExecutionStateCode(code)) {
    return PROJECT_EXECUTION_STATE_CONFIG[code]
  }

  return {
    label: code,
    shortLabel: code,
    description: 'Unknown execution status',
    accent: 'slate',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  }
}

/**
 * Devuelve la fase agregada (execution | validation | delivery | closure) a la
 * que pertenece un status de execution v2.
 */
export function getProjectExecutionPhase(code: string): ProjectExecutionPhase | null {
  if (isProjectExecutionStateCode(code)) {
    return PROJECT_EXECUTION_STATE_TO_PHASE[code]
  }
  return null
}

// ==========================================
// VALIDATION ROLES & DECISIONS (Sprint 2)
// Etiquetas legibles para la UI de validation. Los codigos canonicos viven en
// types/database.ts como `ValidationRole` / `ValidationDecision`.
// ==========================================

export const VALIDATION_ROLE_LABELS: Record<'doh' | 'dos' | 'reviewer', string> = {
  doh: 'DOH (Design Organisation Head)',
  dos: 'DOS (Design Office Signatory)',
  reviewer: 'Reviewer',
}

export const VALIDATION_DECISION_LABELS: Record<'approved' | 'returned' | 'pending', string> = {
  approved: 'Approved',
  returned: 'Returned to execution',
  pending: 'Pending',
}

export const OBSERVATION_SEVERITY_LABELS: Record<'info' | 'warn' | 'blocker', string> = {
  info: 'Informational',
  warn: 'Warning',
  blocker: 'Blocking',
}

/**
 * Statuses de deliverable considerados "listos" para validation. Si un
 * deliverable esta en cualquier other status, el project no puede transicionar
 * a `in_validation`.
 */
export const DELIVERABLE_VALIDATION_READY_STATES: readonly string[] = [
  'completed',
  'not_applicable',
]

// ==========================================
// CLOSURE OUTCOMES & LESSON TAXONOMY (Sprint 4)
// Etiquetas legibles para la UI de closure. Los codigos canonicos viven en
// types/database.ts.
// ==========================================

export const CLOSURE_OUTCOMES = {
  SUCCESSFUL: 'successful',
  SUCCESSFUL_WITH_RESERVATIONS: 'successful_with_reservations',
  PROBLEMATIC: 'problematic',
  ABORTED: 'aborted',
} as const

export const CLOSURE_OUTCOME_LABELS: Record<
  'successful' | 'successful_with_reservations' | 'problematic' | 'aborted',
  string
> = {
  successful: 'Successful',
  successful_with_reservations: 'Successful with reservations',
  problematic: 'Problematic',
  aborted: 'Aborted',
}

export const LESSON_CATEGORY_LABELS: Record<
  | 'technical'
  | 'process'
  | 'client'
  | 'quality'
  | 'planning'
  | 'tools'
  | 'regulatory'
  | 'other',
  string
> = {
  technical: 'Technical',
  process: 'Proceso',
  client: 'Client',
  quality: 'Calidad',
  planning: 'Planning',
  tools: 'Tools',
  regulatory: 'Regulatory',
  other: 'Other',
}

export const LESSON_TYPE_LABELS: Record<
  'positive' | 'negative' | 'improvement' | 'risk',
  string
> = {
  positive: 'Positive',
  negative: 'Negative',
  improvement: 'Improvement',
  risk: 'Risk',
}
