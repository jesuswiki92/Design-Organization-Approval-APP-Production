/**
 * CONFIGURACION VISUAL DE ESTADOS DE FLUJOS DE TRABAJO (LADO CLIENTE)
 *
 * Este archivo es el "engine de estilos" de los statuses de flujo de trabajo.
 * Se encarga de convertir los data de configuracion guardados en la base de data
 * (table doa_workflow_state_config) en objetos listos para pintar en la interfaz.
 *
 * Funciones principales:
 * - Define los COLORES disponibles para los statuses (sky, cyan, emerald, amber, etc.)
 * - Proporciona valores POR DEFECTO para los statuses de cotizaciones y requests
 *   (en caso de que no haya configuracion personalizada en la base de data)
 * - "Resuelve" la configuracion final combinando los valores por defecto con
 *   las personalizaciones que el admin haya guardado en Supabase
 * - Ofrece funciones para obtener la informacion visual de un status especifico
 *
 * Este archivo se puede usar tanto en el servidor como en el navegador
 * (a diferencia de workflow-state-config.server.ts que solo funciona en el servidor).
 */

import type {
  WorkflowStateColorToken,
  WorkflowStateConfigRow,
  WorkflowStateScope,
} from '@/types/database'
import {
  INCOMING_REQUEST_STATUSES,
  INCOMING_REQUEST_STATUS_CONFIG,
  PROJECT_STATE_CONFIG,
  PROJECT_WORKFLOW_STATES,
  QUOTATION_BOARD_STATE_CONFIG,
  QUOTATION_BOARD_STATES,
  type IncomingRequestStatus,
  type QuotationBoardState,
} from '@/lib/workflow-states'

// Los dos ambitos (scopes) de flujos de trabajo que existen en la app.
// Cada uno tiene sus propios statuses y se configura de forma independiente.
export const WORKFLOW_STATE_SCOPES = {
  INCOMING_QUERIES: 'incoming_queries',
  QUOTATION_BOARD: 'quotation_board',
  PROJECT_BOARD: 'project_board',
} as const satisfies Record<string, WorkflowStateScope>

// Lista de colores disponibles para asignar a los statuses.
// Cada color tiene variantes para text, fondo, borde y punto indicador.
// Un administrador puede elegir cualquiera de estos colores al personalizar un status.
export const WORKFLOW_STATE_COLOR_TOKENS = [
  'sky',
  'cyan',
  'emerald',
  'amber',
  'violet',
  'indigo',
  'slate',
  'blue',
  'green',
  'yellow',
  'rose',
] as const satisfies readonly WorkflowStateColorToken[]

// Estilo de la "etiqueta" (badge) que muestra el name del status.
// Se usa en las pastillas/chips de status que aparecen junto a cada request o cotizacion.
export type WorkflowBadgeStyle = {
  color: string  // Clases CSS combinadas (fondo, text y borde de la etiqueta)
}

// Estilo visual de las columnas del tablero Kanban.
// Cada columna del tablero tiene su propio fondo, borde y color de text.
export type WorkflowBoardAccent = {
  bg: string      // Color de fondo de la columna
  border: string  // Color del borde de la columna
  dot: string     // Color del punto indicador
  text: string    // Color del text del encabezado
  chip: string    // Estilo de las tarjetas dentro de la columna
}

// Tipo que representa un status de flujo de trabajo completamente resuelto,
// es decir, con todos sus data (los de la base de data + los estilos visuales calculados).
// Este es el type que reciben los componentes de la interfaz para pintar los statuses.
export type ResolvedWorkflowStateMeta = WorkflowStateConfigRow & {
  short_label: string               // Name corto del status
  badge: WorkflowBadgeStyle          // Estilo de la etiqueta/pastilla
  boardAccent: WorkflowBoardAccent   // Estilo de la columna del tablero
}

// Mapa internal para buscar configuraciones por defecto por codigo de status
type WorkflowStateDefaultsMap = Record<string, WorkflowStateConfigRow>

// MAPA MAESTRO DE ESTILOS POR COLOR
// Para cada color disponible, define exactamente que clases CSS se usan
// en la etiqueta (badge), en el tablero (boardAccent) y en el editor de statuses.
// Este mapa es el que convierte un name de color (ej: "sky") en clases CSS reales.
const COLOR_STYLE_MAP: Record<
  WorkflowStateColorToken,
  { badge: WorkflowBadgeStyle; boardAccent: WorkflowBoardAccent; editorChip: string; label: string }
> = {
  sky: {
    label: 'Sky',
    badge: { color: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
    boardAccent: {
      bg: 'bg-sky-50',
      border: 'border-sky-200',
      dot: 'bg-sky-500',
      text: 'text-sky-700',
      chip: 'border-sky-200 bg-white/90 text-sky-700',
    },
    editorChip: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  cyan: {
    label: 'Cyan',
    badge: { color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    boardAccent: {
      bg: 'bg-cyan-50',
      border: 'border-cyan-200',
      dot: 'bg-cyan-500',
      text: 'text-cyan-700',
      chip: 'border-cyan-200 bg-white/90 text-cyan-700',
    },
    editorChip: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  },
  emerald: {
    label: 'Emerald',
    badge: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    boardAccent: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      dot: 'bg-emerald-500',
      text: 'text-emerald-700',
      chip: 'border-emerald-200 bg-white/90 text-emerald-700',
    },
    editorChip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  amber: {
    label: 'Amber',
    badge: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    boardAccent: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      dot: 'bg-amber-500',
      text: 'text-amber-700',
      chip: 'border-amber-200 bg-white/90 text-amber-700',
    },
    editorChip: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  violet: {
    label: 'Violet',
    badge: { color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
    boardAccent: {
      bg: 'bg-violet-50',
      border: 'border-violet-200',
      dot: 'bg-violet-500',
      text: 'text-violet-700',
      chip: 'border-violet-200 bg-white/90 text-violet-700',
    },
    editorChip: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  indigo: {
    label: 'Indigo',
    badge: { color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
    boardAccent: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      dot: 'bg-indigo-500',
      text: 'text-indigo-700',
      chip: 'border-indigo-200 bg-white/90 text-indigo-700',
    },
    editorChip: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  },
  slate: {
    label: 'Slate',
    badge: { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
    boardAccent: {
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      dot: 'bg-slate-500',
      text: 'text-slate-700',
      chip: 'border-slate-200 bg-white/90 text-slate-700',
    },
    editorChip: 'border-slate-200 bg-slate-50 text-slate-700',
  },
  blue: {
    label: 'Blue',
    badge: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    boardAccent: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      dot: 'bg-blue-500',
      text: 'text-blue-700',
      chip: 'border-blue-200 bg-white/90 text-blue-700',
    },
    editorChip: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  green: {
    label: 'Green',
    badge: { color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    boardAccent: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      dot: 'bg-green-500',
      text: 'text-green-700',
      chip: 'border-green-200 bg-white/90 text-green-700',
    },
    editorChip: 'border-green-200 bg-green-50 text-green-700',
  },
  yellow: {
    label: 'Yellow',
    badge: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    boardAccent: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      dot: 'bg-yellow-500',
      text: 'text-yellow-700',
      chip: 'border-yellow-200 bg-white/90 text-yellow-700',
    },
    editorChip: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  },
  rose: {
    label: 'Rose',
    badge: { color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
    boardAccent: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      dot: 'bg-rose-500',
      text: 'text-rose-700',
      chip: 'border-rose-200 bg-white/90 text-rose-700',
    },
    editorChip: 'border-rose-200 bg-rose-50 text-rose-700',
  },
}

// VALORES POR DEFECTO PARA LOS ESTADOS DEL TABLERO DE COTIZACIONES
// Estos son los statuses que se usan si no hay configuracion personalizada
// guardada en la base de data. Incluyen todos los data necesarios:
// name, description, color, sort_order de aparicion y si son de sistema.
const QUOTATION_BOARD_DEFAULT_ROWS: WorkflowStateConfigRow[] = [
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.REQUEST_RECEIVED,
    label: QUOTATION_BOARD_STATE_CONFIG.request_received.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.request_received.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.request_received.description,
    color_token: 'sky',
    sort_order: 10,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.FORM_SENT,
    label: QUOTATION_BOARD_STATE_CONFIG.form_sent.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.form_sent.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.form_sent.description,
    color_token: 'cyan',
    sort_order: 20,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.FORM_RECEIVED,
    label: QUOTATION_BOARD_STATE_CONFIG.form_received.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.form_received.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.form_received.description,
    color_token: 'green',
    sort_order: 30,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.DEFINE_SCOPE,
    label: QUOTATION_BOARD_STATE_CONFIG.define_scope.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.define_scope.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.define_scope.description,
    color_token: 'emerald',
    sort_order: 40,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.AWAITING_CLIENT_RESPONSE,
    label: QUOTATION_BOARD_STATE_CONFIG.awaiting_client_response.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.awaiting_client_response.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.awaiting_client_response.description,
    color_token: 'cyan',
    sort_order: 43,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.SCOPE_DEFINED,
    label: QUOTATION_BOARD_STATE_CONFIG.scope_defined.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.scope_defined.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.scope_defined.description,
    color_token: 'green',
    sort_order: 50,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.QUOTE_IN_REVIEW,
    label: QUOTATION_BOARD_STATE_CONFIG.quote_in_review.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.quote_in_review.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.quote_in_review.description,
    color_token: 'amber',
    sort_order: 60,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.QUOTE_SENT,
    label: QUOTATION_BOARD_STATE_CONFIG.quote_sent.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.quote_sent.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.quote_sent.description,
    color_token: 'violet',
    sort_order: 70,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.QUOTE_ACCEPTED,
    label: QUOTATION_BOARD_STATE_CONFIG.quote_accepted.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.quote_accepted.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.quote_accepted.description,
    color_token: 'indigo',
    sort_order: 80,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.QUOTE_REJECTED,
    label: QUOTATION_BOARD_STATE_CONFIG.quote_rejected.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.quote_rejected.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.quote_rejected.description,
    color_token: 'slate',
    sort_order: 85,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.FINAL_REVIEW,
    label: QUOTATION_BOARD_STATE_CONFIG.final_review.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.final_review.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.final_review.description,
    color_token: 'rose',
    sort_order: 90,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.QUOTATION_BOARD,
    state_code: QUOTATION_BOARD_STATES.PROJECT_OPENED,
    label: QUOTATION_BOARD_STATE_CONFIG.project_opened.label,
    short_label: QUOTATION_BOARD_STATE_CONFIG.project_opened.shortLabel,
    description: QUOTATION_BOARD_STATE_CONFIG.project_opened.description,
    color_token: 'slate',
    sort_order: 95,
    is_system: true,
    is_active: true,
  },
]

// VALORES POR DEFECTO PARA LOS ESTADOS DE CONSULTAS ENTRANTES
// Similar a los de cotizaciones, pero para el flujo de requests comerciales.
const INCOMING_QUERY_DEFAULT_ROWS: WorkflowStateConfigRow[] = [
  {
    scope: WORKFLOW_STATE_SCOPES.INCOMING_QUERIES,
    state_code: INCOMING_REQUEST_STATUSES.NEW,
    label: INCOMING_REQUEST_STATUS_CONFIG.new.label,
    short_label: 'Entrada',
    description: INCOMING_REQUEST_STATUS_CONFIG.new.description,
    color_token: 'blue',
    sort_order: 10,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.INCOMING_QUERIES,
    state_code: INCOMING_REQUEST_STATUSES.AWAITING_FORM,
    label: INCOMING_REQUEST_STATUS_CONFIG.awaiting_form.label,
    short_label: 'Sent',
    description: INCOMING_REQUEST_STATUS_CONFIG.awaiting_form.description,
    color_token: 'yellow',
    sort_order: 20,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.INCOMING_QUERIES,
    state_code: INCOMING_REQUEST_STATUSES.FORM_RECEIVED,
    label: INCOMING_REQUEST_STATUS_CONFIG.form_received.label,
    short_label: 'Revisar',
    description: INCOMING_REQUEST_STATUS_CONFIG.form_received.description,
    color_token: 'green',
    sort_order: 30,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.INCOMING_QUERIES,
    state_code: INCOMING_REQUEST_STATUSES.ARCHIVED,
    label: INCOMING_REQUEST_STATUS_CONFIG.archived.label,
    short_label: 'Archived',
    description: INCOMING_REQUEST_STATUS_CONFIG.archived.description,
    color_token: 'slate',
    sort_order: 90,
    is_system: true,
    is_active: true,
  },
]

// VALORES POR DEFECTO PARA LOS ESTADOS DEL TABLERO DE PROYECTOS
// Estos son los statuses que se usan si no hay configuracion personalizada
// guardada en la base de data para el tablero de projects de ingenieria.
const PROJECT_BOARD_DEFAULT_ROWS: WorkflowStateConfigRow[] = [
  {
    scope: WORKFLOW_STATE_SCOPES.PROJECT_BOARD,
    state_code: PROJECT_WORKFLOW_STATES[0], // 'new'
    label: PROJECT_STATE_CONFIG.new.label,
    short_label: PROJECT_STATE_CONFIG.new.shortLabel,
    description: 'Project recien creado, pending de asignar y arrancar',
    color_token: 'green',
    sort_order: 1,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.PROJECT_BOARD,
    state_code: PROJECT_WORKFLOW_STATES[1], // 'in_progress'
    label: PROJECT_STATE_CONFIG.in_progress.label,
    short_label: PROJECT_STATE_CONFIG.in_progress.shortLabel,
    description: 'Trabajo de ingenieria en curso',
    color_token: 'blue',
    sort_order: 2,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.PROJECT_BOARD,
    state_code: PROJECT_WORKFLOW_STATES[2], // 'review'
    label: PROJECT_STATE_CONFIG.review.label,
    short_label: PROJECT_STATE_CONFIG.review.shortLabel,
    description: 'En process de review technical internal',
    color_token: 'amber',
    sort_order: 3,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.PROJECT_BOARD,
    state_code: PROJECT_WORKFLOW_STATES[3], // 'approval'
    label: PROJECT_STATE_CONFIG.approval.label,
    short_label: PROJECT_STATE_CONFIG.approval.shortLabel,
    description: 'Pending de approval formal',
    color_token: 'violet',
    sort_order: 4,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.PROJECT_BOARD,
    state_code: PROJECT_WORKFLOW_STATES[4], // 'delivered'
    label: PROJECT_STATE_CONFIG.delivered.label,
    short_label: PROJECT_STATE_CONFIG.delivered.shortLabel,
    description: 'Documentacion entregada al client',
    color_token: 'emerald',
    sort_order: 5,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.PROJECT_BOARD,
    state_code: PROJECT_WORKFLOW_STATES[5], // 'closed'
    label: PROJECT_STATE_CONFIG.closed.label,
    short_label: PROJECT_STATE_CONFIG.closed.shortLabel,
    description: 'Project completed y closed',
    color_token: 'slate',
    sort_order: 6,
    is_system: true,
    is_active: true,
  },
  {
    scope: WORKFLOW_STATE_SCOPES.PROJECT_BOARD,
    state_code: 'archived',
    label: PROJECT_STATE_CONFIG.archived.label,
    short_label: PROJECT_STATE_CONFIG.archived.shortLabel,
    description: 'Project archived',
    color_token: 'slate',
    sort_order: 90,
    is_system: true,
    is_active: true,
  },
]

// Agrupa los valores por defecto por ambito, para buscar rapidamente
// los defaults de requests, cotizaciones o projects segun se necesite
const DEFAULT_ROWS_BY_SCOPE: Record<WorkflowStateScope, WorkflowStateConfigRow[]> = {
  incoming_queries: INCOMING_QUERY_DEFAULT_ROWS,
  quotation_board: QUOTATION_BOARD_DEFAULT_ROWS,
  project_board: PROJECT_BOARD_DEFAULT_ROWS,
}

/**
 * Verifica si un text es un name de color valido de los disponibles
 * para statuses de flujo de trabajo.
 *
 * @param value - El text a verificar (ej: "sky", "cyan", "rojo")
 * @returns true si es un color valido, false si no
 */
export function isWorkflowStateColorToken(value: string): value is WorkflowStateColorToken {
  return (WORKFLOW_STATE_COLOR_TOKENS as readonly string[]).includes(value)
}

/**
 * Obtiene los estilos CSS completos para un color dado.
 *
 * @param colorToken - El name del color (ej: "sky", "amber")
 * @returns Objeto con los estilos de badge (etiqueta), tablero y editor
 */
export function getWorkflowStateColorStyle(colorToken: WorkflowStateColorToken) {
  return COLOR_STYLE_MAP[colorToken]
}

/**
 * Devuelve la lista de colores disponibles formateada para usar en un selector (dropdown).
 * Cada opcion incluye el valor del color, su name visible y el estilo del chip del editor.
 *
 * Se usa en el form donde el administrador elige el color de un status.
 *
 * @returns Lista de opciones de color con valor, etiqueta y estilo del chip
 */
export function getWorkflowStateColorOptions() {
  return WORKFLOW_STATE_COLOR_TOKENS.map((token) => ({
    value: token,
    label: COLOR_STYLE_MAP[token].label,
    editorChip: COLOR_STYLE_MAP[token].editorChip,
  }))
}

/**
 * Devuelve una copia de las filas por defecto de un ambito de flujo de trabajo.
 *
 * Se devuelven copias (no los originales) para evitar que cambios accidentales
 * afecten a los valores por defecto globales.
 *
 * @param scope - El ambito ("incoming_queries" o "quotation_board")
 * @returns Lista de filas de configuracion por defecto para ese ambito
 */
export function getDefaultWorkflowStateRows(scope: WorkflowStateScope) {
  return DEFAULT_ROWS_BY_SCOPE[scope].map((row) => ({ ...row }))
}

/**
 * Devuelve la lista de codigos de status permitidos para un ambito.
 * Util para validar que un codigo de status es valido antes de usarlo.
 *
 * @param scope - El ambito del flujo de trabajo
 * @returns Lista de codigos de status (ej: ["new", "awaiting_form", ...])
 */
export function getAllowedWorkflowStateCodes(scope: WorkflowStateScope) {
  return getDefaultWorkflowStateRows(scope).map((row) => row.state_code)
}

/**
 * Convierte las filas por defecto en un mapa (diccionario) indexado por codigo de status.
 * Esto permite buscar rapidamente la configuracion por defecto de un status especifico.
 * (Funcion internal, no se exporta fuera de este archivo)
 */
function getDefaultRowsMap(scope: WorkflowStateScope): WorkflowStateDefaultsMap {
  return Object.fromEntries(
    getDefaultWorkflowStateRows(scope).map((row) => [row.state_code, row]),
  )
}

/**
 * "Normaliza" una fila de configuracion, es decir, se asegura de que todos
 * los campos tengan un valor valido. Si un campo esta vacio o tiene un valor
 * incorrecto, se usa el valor por defecto en su lugar.
 *
 * Esto previene errores en la interfaz cuando la configuracion en la base de
 * data tiene data incompletos o incorrectos.
 * (Funcion internal, no se exporta fuera de este archivo)
 *
 * @param row - La fila de configuracion personalizada (puede tener campos vacios)
 * @param defaultRow - La fila por defecto que se usa como respaldo
 * @returns Una fila de configuracion con todos los campos garantizados
 */
function normalizeRow(
  row: WorkflowStateConfigRow,
  defaultRow: WorkflowStateConfigRow,
): WorkflowStateConfigRow {
  return {
    ...defaultRow,
    ...row,
    label: row.label?.trim() || defaultRow.label,
    short_label: row.short_label?.trim() || defaultRow.short_label,
    description: row.description?.trim() || defaultRow.description,
    color_token: isWorkflowStateColorToken(row.color_token)
      ? row.color_token
      : defaultRow.color_token,
    sort_order: Number.isFinite(row.sort_order) ? Math.trunc(row.sort_order) : defaultRow.sort_order,
    is_system: typeof row.is_system === 'boolean' ? row.is_system : defaultRow.is_system,
    is_active: typeof row.is_active === 'boolean' ? row.is_active : defaultRow.is_active,
  }
}

/**
 * FUNCION PRINCIPAL: "Resuelve" los statuses de un flujo de trabajo.
 *
 * Combina los valores por defecto con las personalizaciones del administrador
 * (si las hay) y devuelve la lista final de statuses con todos sus estilos
 * visuales listos para pintar en la interfaz.
 *
 * El process es:
 * 1. Carga los valores por defecto para el ambito solicitado
 * 2. Si hay filas personalizadas en la base de data, las normaliza y las aplica
 * 3. Ordena los statuses segun su campo sort_order
 * 4. Calcula los estilos CSS finales (badge y boardAccent) a partir del color asignado
 *
 * @param scope - El ambito del flujo de trabajo ("incoming_queries" o "quotation_board")
 * @param rows - Las filas personalizadas leidas de la base de data (puede estar vacia)
 * @returns Lista de statuses completamente resueltos, listos para la interfaz
 */
export function resolveWorkflowStateRows(
  scope: WorkflowStateScope,
  rows: WorkflowStateConfigRow[] = [],
): ResolvedWorkflowStateMeta[] {
  const defaultsMap = getDefaultRowsMap(scope)
  const overrides = new Map<string, WorkflowStateConfigRow>()

  for (const row of rows) {
    if (row.scope !== scope) continue
    if (!defaultsMap[row.state_code]) continue
    overrides.set(row.state_code, normalizeRow(row, defaultsMap[row.state_code]))
  }

  return Object.values(defaultsMap)
    .map((defaultRow) => overrides.get(defaultRow.state_code) ?? defaultRow)
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((row) => ({
      ...row,
      short_label: row.short_label?.trim() || row.label,
      description: row.description?.trim() || '',
      badge: getWorkflowStateColorStyle(row.color_token).badge,
      boardAccent: getWorkflowStateColorStyle(row.color_token).boardAccent,
    }))
}

/**
 * Reemplaza las filas de configuracion de un ambito especifico dentro de una
 * lista que puede contener filas de multiples ambitos.
 *
 * Esto se usa cuando el administrador guarda cambios en la configuracion de
 * statuses: se eliminan las filas antiguas del ambito modificado y se insertan
 * las nuevas, manteniendo intactas las filas de otros ambitos.
 *
 * @param rows - Lista completa de filas de todos los ambitos
 * @param scope - El ambito cuyas filas se van a reemplazar
 * @param nextRows - Las nuevas filas que van a sustituir a las anteriores
 * @returns New lista con las filas del ambito reemplazadas
 */
export function replaceWorkflowStateRowsForScope(
  rows: WorkflowStateConfigRow[],
  scope: WorkflowStateScope,
  nextRows: WorkflowStateConfigRow[],
) {
  return [
    ...rows.filter((row) => row.scope !== scope),
    ...nextRows,
  ]
}

/**
 * Obtiene la informacion visual de un status de request entrante,
 * teniendo en cuenta las personalizaciones del administrador.
 *
 * A diferencia de getIncomingRequestStatusMeta (en workflow-states.ts) que solo usa
 * valores fijos, esta funcion combina los defaults con la configuracion
 * personalizada que puede existir en la base de data.
 *
 * @param status - El codigo del status de la request (ej: "new", "archived")
 * @param rows - Las filas de configuracion leidas de la base de data (opcional)
 * @returns Objeto con name, name corto, description y color del status
 */
export function getResolvedIncomingQueryStatusMeta(
  status: string,
  rows: WorkflowStateConfigRow[] = [],
) {
  const resolvedRows = resolveWorkflowStateRows(WORKFLOW_STATE_SCOPES.INCOMING_QUERIES, rows)
  const match = resolvedRows.find((row) => row.state_code === status)

  if (!match) {
    return {
      label: status,
      shortLabel: status,
      description: 'Unknown status',
      color: COLOR_STYLE_MAP.slate.badge.color,
    }
  }

  return {
    label: match.label,
    shortLabel: match.short_label,
    description: match.description ?? '',
    color: match.badge.color,
  }
}

/**
 * Obtiene la informacion visual de un status del tablero de cotizaciones,
 * teniendo en cuenta las personalizaciones del administrador.
 *
 * Similar a getResolvedIncomingQueryStatusMeta pero para el tablero de cotizaciones.
 * Devuelve ademas el colorToken y el estilo del tablero (accent) que se necesitan
 * para pintar las columnas del tablero Kanban.
 *
 * @param state - El codigo del status de la cotizacion (ej: "request_received", "triage")
 * @param rows - Las filas de configuracion leidas de la base de data (opcional)
 * @returns Objeto con name, name corto, description, color y estilo del tablero
 */
export function getResolvedQuotationBoardStatusMeta(
  state: string,
  rows: WorkflowStateConfigRow[] = [],
) {
  const resolvedRows = resolveWorkflowStateRows(WORKFLOW_STATE_SCOPES.QUOTATION_BOARD, rows)
  const match = resolvedRows.find((row) => row.state_code === state)

  if (!match) {
    const fallback = getWorkflowStateColorStyle('slate')

    return {
      label: state,
      shortLabel: state,
      description: 'Unknown quotation status',
      colorToken: 'slate' as WorkflowStateColorToken,
      accent: fallback.boardAccent,
    }
  }

  return {
    label: match.label,
    shortLabel: match.short_label,
    description: match.description ?? '',
    colorToken: match.color_token,
    accent: match.boardAccent,
  }
}

/**
 * Verifica si un text es un codigo de status valido para requests entrantes.
 *
 * @param value - El text a verificar
 * @returns true si es un codigo de status de request valido, false si no
 */
export function isIncomingQueryStateCode(value: string): value is IncomingRequestStatus {
  return getAllowedWorkflowStateCodes(WORKFLOW_STATE_SCOPES.INCOMING_QUERIES).includes(value)
}

/**
 * Verifica si un text es un codigo de status valido para el tablero de cotizaciones.
 *
 * @param value - El text a verificar
 * @returns true si es un codigo de status de cotizacion valido, false si no
 */
export function isQuotationBoardStateCode(value: string): value is QuotationBoardState {
  return getAllowedWorkflowStateCodes(WORKFLOW_STATE_SCOPES.QUOTATION_BOARD).includes(value)
}

/**
 * Obtiene la informacion visual de un status del tablero de projects,
 * teniendo en cuenta las personalizaciones del administrador.
 *
 * Similar a getResolvedQuotationBoardStatusMeta pero para el tablero de projects.
 * Devuelve el colorToken y el estilo del tablero (accent) que se necesitan
 * para pintar las columnas del tablero Kanban de projects.
 *
 * @param state - El codigo del status del project (ej: "new", "in_progress")
 * @param rows - Las filas de configuracion leidas de la base de data (opcional)
 * @returns Objeto con name, name corto, description, color y estilo del tablero
 */
export function getResolvedProjectBoardStatusMeta(
  state: string,
  rows: WorkflowStateConfigRow[] = [],
) {
  const resolvedRows = resolveWorkflowStateRows(WORKFLOW_STATE_SCOPES.PROJECT_BOARD, rows)
  const match = resolvedRows.find((row) => row.state_code === state)

  if (!match) {
    const fallback = getWorkflowStateColorStyle('slate')

    return {
      label: state,
      shortLabel: state,
      description: 'Status de project desconocido',
      colorToken: 'slate' as WorkflowStateColorToken,
      accent: fallback.boardAccent,
      badge: fallback.badge,
    }
  }

  return {
    label: match.label,
    shortLabel: match.short_label,
    description: match.description ?? '',
    colorToken: match.color_token,
    accent: match.boardAccent,
    badge: match.badge,
  }
}

/**
 * Verifica si un text es un codigo de status valido para el tablero de projects.
 *
 * @param value - El text a verificar
 * @returns true si es un codigo de status de project valido, false si no
 */
export function isProjectBoardStateCode(value: string): boolean {
  return getAllowedWorkflowStateCodes(WORKFLOW_STATE_SCOPES.PROJECT_BOARD).includes(value)
}
