/**
 * ESTADOS DE FLUJOS DE TRABAJO DE LA APLICACION
 *
 * Este es uno de los archivos mas importantes de la app. Define TODOS los estados
 * posibles por los que pueden pasar las entidades principales del sistema:
 *
 * 1. COTIZACIONES (Quotations): Los estados del tablero visual donde se mueven
 *    las ofertas comerciales (desde que llega una consulta hasta que se cierra).
 *
 * 2. CONSULTAS ENTRANTES (Incoming Queries): Los estados por los que pasa una
 *    consulta de un cliente desde que se recibe hasta que se archiva.
 *
 * 3. PROYECTOS DE INGENIERIA: Los estados operativos de un proyecto (desde OP-00
 *    hasta OP-13), mas los estados "legacy" (antiguos) que se conservan por
 *    compatibilidad con datos existentes.
 *
 * Para cada tipo de estado se define:
 * - Los codigos posibles (por ejemplo: "entrada_recibida", "triage", etc.)
 * - La configuracion visual (nombre, color, descripcion)
 * - Las transiciones permitidas (de que estado se puede pasar a cual)
 * - Funciones auxiliares para consultar y validar estados
 *
 * REGLA IMPORTANTE: Nunca escribir nombres de estados directamente en el codigo.
 * Siempre usar las constantes definidas aqui (ej: CONSULTA_ESTADOS.NUEVO).
 */

import type {
  EstadoProyecto,
  EstadoProyectoLegacy,
  EstadoProyectoPersistido,
  EstadoProyectoWorkflow,
} from '@/types/database'

// ==========================================
// ESTADOS VISUALES DE QUOTATIONS (COTIZACIONES)
// Estos son los estados del tablero Kanban donde se gestionan las ofertas comerciales
// ==========================================

// Codigos de los estados posibles en el tablero de cotizaciones.
// Cada constante representa una columna del tablero Kanban.
export const QUOTATION_BOARD_STATES = {
  ENTRADA_RECIBIDA: 'entrada_recibida',       // Acaba de llegar una consulta comercial
  TRIAGE: 'triage',                             // Se clasifica la urgencia y el tipo de trabajo
  ALCANCE_DEFINIDO: 'alcance_definido',         // Ya se sabe exactamente que se va a cotizar
  OFERTA_EN_REDACCION: 'oferta_en_redaccion',   // Se esta escribiendo la propuesta/cotizacion
  REVISION_INTERNA: 'revision_interna',         // Un compañero revisa la oferta antes de enviarla
  PENDIENTE_ENVIO: 'pendiente_envio',           // La oferta esta lista para enviar al cliente
  SEGUIMIENTO_CIERRE: 'seguimiento_cierre',     // Ya se envio, se hace seguimiento hasta cerrar
} as const

// Tipo que representa cualquier estado valido del tablero de cotizaciones
export type QuotationBoardState =
  typeof QUOTATION_BOARD_STATES[keyof typeof QUOTATION_BOARD_STATES]

// Estructura de la configuracion visual de cada estado del tablero de cotizaciones
// Define como se ve cada estado en la interfaz: nombre, color del texto, fondo, borde y punto
type QuotationBoardConfig = {
  label: string        // Nombre completo del estado (ej: "Entrada recibida")
  shortLabel: string   // Nombre abreviado para espacios pequeños (ej: "Entrada")
  description: string  // Explicacion breve de que significa estar en este estado
  color: string        // Color del texto (clase CSS de Tailwind)
  bg: string           // Color de fondo (clase CSS de Tailwind)
  border: string       // Color del borde (clase CSS de Tailwind)
  dot: string          // Color del punto/indicador (clase CSS de Tailwind)
}

// Configuracion visual completa de cada estado del tablero de cotizaciones.
// Aqui se define el nombre, la descripcion y los colores de cada columna del tablero.
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

/**
 * Obtiene la informacion visual de un estado del tablero de cotizaciones.
 *
 * Si el estado no se reconoce (por ejemplo, porque viene de datos antiguos),
 * devuelve una configuracion por defecto en gris para que no se rompa la interfaz.
 *
 * @param state - El codigo del estado (ej: "entrada_recibida", "triage")
 * @returns Objeto con el nombre, descripcion y colores del estado
 */
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
// Estos estados representan el ciclo de vida de una consulta comercial
// desde que llega por email/formulario hasta que se archiva.
// ==========================================

// Codigos de los estados posibles para las consultas entrantes
export const CONSULTA_ESTADOS = {
  NUEVO: 'nuevo',                                   // Consulta recien recibida, sin procesar
  ESPERANDO_FORMULARIO: 'esperando_formulario',      // Se le envio un formulario al cliente, esperando respuesta
  FORMULARIO_RECIBIDO: 'formulario_recibido',        // El cliente respondio el formulario, hay que revisarlo
  ARCHIVADO: 'archivado',                            // Consulta cerrada y archivada
} as const

// Tipo que representa cualquier estado valido de una consulta entrante
export type EstadoConsulta = typeof CONSULTA_ESTADOS[keyof typeof CONSULTA_ESTADOS]

// Configuracion visual de cada estado de consulta: nombre visible, colores y descripcion
export const CONSULTA_STATE_CONFIG: Record<EstadoConsulta, { label: string; color: string; description: string }> = {
  nuevo: {
    label: 'Nueva entrada',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    description: 'Nueva consulta recibida, pendiente de revisión por ingeniero',
  },
  esperando_formulario: {
    label: 'Formulario enviado',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    description: 'Formulario enviado al cliente, pendiente de respuesta',
  },
  formulario_recibido: {
    label: 'Formulario recibido. Revisar',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    description: 'Formulario recibido del cliente, pendiente de revisión interna',
  },
  archivado: {
    label: 'Archivado',
    color: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    description:
      'Consulta archivada. Se conserva en Supabase pero no aparece en la UI operativa',
  },
}

/**
 * Obtiene la informacion visual de un estado de consulta entrante.
 *
 * Similar a getQuotationBoardStatusMeta pero para consultas.
 * Si el estado no se reconoce, devuelve una configuracion por defecto en gris.
 *
 * @param estado - El codigo del estado de la consulta (ej: "nuevo", "archivado")
 * @returns Objeto con el nombre visible, colores y descripcion del estado
 */
export function getConsultaStatusMeta(estado: string) {
  const config = CONSULTA_STATE_CONFIG[estado as EstadoConsulta]
  if (!config) return { label: estado, color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', description: 'Estado desconocido' }
  return config
}

// Transiciones permitidas entre estados de consultas.
// Define A QUE estado se puede mover una consulta DESDE cada estado.
// Por ejemplo: desde "nuevo" se puede pasar a "esperando_formulario" o a "archivado",
// pero desde "archivado" no se puede mover a ningun otro estado (lista vacia).
export const CONSULTA_TRANSITIONS: Record<EstadoConsulta, EstadoConsulta[]> = {
  nuevo: ['esperando_formulario', 'archivado'],
  esperando_formulario: ['formulario_recibido', 'archivado'],
  formulario_recibido: ['archivado'],
  archivado: [],
}

/**
 * Devuelve la lista de estados a los que se puede mover una consulta
 * desde su estado actual.
 *
 * La interfaz usa esta funcion para mostrar solo los botones de cambio
 * de estado que son validos segun las reglas del flujo de trabajo.
 *
 * @param current - El estado actual de la consulta
 * @returns Lista de estados a los que se puede transicionar, o lista vacia si no hay opciones
 */
export function getAllowedConsultaTransitions(current: string): EstadoConsulta[] {
  return CONSULTA_TRANSITIONS[current as EstadoConsulta] ?? []
}

// ==========================================
// ESTADOS DE PROYECTOS DE INGENIERIA
// Estos son los estados operativos por los que pasa un proyecto de certificacion.
// Van desde OP-00 (prepago) hasta OP-13 (facturado).
// Tambien se conservan los estados "legacy" (del sistema antiguo) para
// compatibilidad con proyectos que aun tienen esos estados en la base de datos.
// ==========================================

// Lista ordenada de todos los estados operativos de un proyecto (flujo nuevo).
// El prefijo "op_XX" indica la fase del proyecto en orden cronologico.
export const PROJECT_WORKFLOW_STATES = [
  'op_00_prepay',               // OP-00: Pendiente de pago inicial
  'op_01_data_collection',      // OP-01: Recopilando datos del cliente
  'op_02_pending_info',         // OP-02: Esperando informacion adicional
  'op_03_pending_tests',        // OP-03: Esperando resultados de ensayos/pruebas
  'op_04_under_evaluation',     // OP-04: Evaluacion tecnica en curso
  'op_05_in_work',              // OP-05: Trabajo de ingenieria en progreso
  'op_06_customer_review',      // OP-06: El cliente esta revisando los entregables
  'op_07_internal_review',      // OP-07: Revision interna del equipo DOA
  'op_08_pending_signature',    // OP-08: Pendiente de firma del responsable
  'op_09_pending_authority',    // OP-09: Pendiente de aprobacion de la autoridad (AESA/EASA)
  'op_10_ready_for_delivery',   // OP-10: Listo para entregar al cliente
  'op_11_delivered',            // OP-11: Entregado al cliente
  'op_12_closed',               // OP-12: Proyecto cerrado
  'op_13_invoiced',             // OP-13: Proyecto facturado (fin del ciclo)
] as const satisfies readonly EstadoProyectoWorkflow[]

// Estados que se muestran en la vista de portafolio de proyectos
// (por ahora son los mismos que los estados de workflow)
export const PROJECT_PORTFOLIO_STATES: EstadoProyecto[] = [
  ...PROJECT_WORKFLOW_STATES,
]

// Estados del sistema ANTIGUO ("legacy") que todavia existen en la base de datos.
// Estos estados ya no se usan para proyectos nuevos, pero algunos proyectos antiguos
// los conservan. La app los muestra con estilo gris para distinguirlos de los nuevos.
const PROJECT_LEGACY_BRIDGE_STATES = [
  'oferta',                        // Fase de oferta (antiguo)
  'activo',                        // Proyecto activo (antiguo)
  'en_revision',                   // En revision (antiguo)
  'pendiente_aprobacion_cve',      // Pendiente de aprobacion CVE (antiguo)
  'pendiente_aprobacion_easa',     // Pendiente de aprobacion EASA (antiguo)
  'en_pausa',                      // Proyecto pausado (antiguo)
  'cancelado',                     // Proyecto cancelado (antiguo)
  'cerrado',                       // Proyecto cerrado (antiguo)
  'guardado_en_base_de_datos',     // Solo guardado como registro (antiguo)
] as const satisfies readonly EstadoProyectoLegacy[]

// Estructura de la configuracion visual de cada estado de proyecto
type WorkflowConfig = {
  label: string        // Nombre completo del estado
  shortLabel: string   // Nombre abreviado
  color: string        // Color del texto
  bg: string           // Color de fondo
  border: string       // Color del borde
  dot: string          // Color del punto indicador
}

// Configuracion visual de cada estado operativo de proyecto (flujo nuevo).
// Define como se muestra cada estado en el tablero y las listas de la app.
// Cada estado tiene un color diferente para identificarlo visualmente.
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

// Configuracion visual de los estados legacy (antiguos).
// Todos se muestran en gris (slate) para distinguirlos de los estados operativos nuevos.
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

// Transiciones permitidas entre estados de proyecto (flujo nuevo).
// Define las reglas de negocio: desde cada estado, solo se puede avanzar
// a ciertos estados especificos. Por ejemplo, desde OP-05 (en trabajo)
// se puede ir a OP-02 (esperando info), OP-03 (esperando ensayos),
// OP-06 (revision del cliente) o OP-07 (revision interna).
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

// Transiciones desde estados legacy hacia estados del nuevo flujo de trabajo.
// Esto permite "migrar" un proyecto del sistema antiguo al nuevo.
// Por ejemplo, un proyecto en estado "activo" (legacy) puede moverse a OP-05 (en trabajo).
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

// Mapeo automatico de estados legacy a su equivalente en el nuevo flujo.
// Se usa para saber "a que fase operativa corresponde" un proyecto antiguo.
// Por ejemplo, un proyecto "activo" (legacy) equivale a OP-05 (en trabajo).
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

// Estados que requieren que el usuario escriba una RAZON al cambiar a ellos.
// Si un proyecto pasa a "esperando info" o "esperando ensayos", el ingeniero
// debe explicar que informacion o ensayos faltan.
const PROJECT_REASON_REQUIRED = new Set<EstadoProyecto>([
  'op_02_pending_info',
  'op_03_pending_tests',
])

/**
 * Obtiene la informacion visual de un estado de proyecto (nombre, colores, etc.).
 *
 * Funciona tanto con estados del nuevo flujo (op_00 a op_13) como con estados
 * legacy (oferta, activo, etc.). Si el estado no se reconoce, devuelve
 * una configuracion por defecto en gris.
 *
 * @param status - El codigo del estado del proyecto
 * @returns Objeto con el nombre, colores y estilo visual del estado
 */
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

/**
 * Devuelve la lista de estados a los que se puede mover un proyecto
 * desde su estado actual.
 *
 * Funciona tanto para estados nuevos como legacy. Los botones de la interfaz
 * usan esta funcion para mostrar solo las opciones validas al usuario.
 *
 * @param status - El estado actual del proyecto
 * @returns Lista de estados permitidos como destino, o lista vacia si no hay opciones
 */
export function getAllowedProjectTransitions(status: string) {
  if (isProjectWorkflowState(status)) {
    return PROJECT_TRANSITIONS[status] ?? []
  }

  if (isProjectLegacyState(status)) {
    return PROJECT_LEGACY_TRANSITIONS[status] ?? []
  }

  return []
}

/**
 * Indica si cambiar a un determinado estado requiere que el usuario
 * escriba una razon o justificacion.
 *
 * Actualmente solo aplica a proyectos y a los estados OP-02 (esperando info)
 * y OP-03 (esperando ensayos).
 *
 * @param entity - El tipo de entidad (por ahora solo "project")
 * @param state - El estado al que se quiere cambiar
 * @returns true si se debe pedir una razon al usuario, false si no
 */
export function requiresWorkflowReason(entity: 'project', state: string) {
  return PROJECT_REASON_REQUIRED.has(state as EstadoProyecto)
}

/**
 * Verifica si un texto es un estado valido del nuevo flujo de trabajo de proyectos
 * (op_00 a op_13).
 */
export function isProjectWorkflowState(value: string): value is EstadoProyecto {
  return PROJECT_WORKFLOW_STATES.includes(value as EstadoProyecto)
}

/**
 * Verifica si un texto es un estado del sistema antiguo (legacy) de proyectos.
 */
export function isProjectLegacyState(value: string): value is EstadoProyectoLegacy {
  return PROJECT_LEGACY_BRIDGE_STATES.includes(value as EstadoProyectoLegacy)
}

/**
 * Verifica si un texto es cualquier tipo de estado de proyecto valido (nuevo o legacy).
 * Actualmente solo verifica estados del nuevo flujo.
 */
export function isProjectState(value: string): value is EstadoProyecto {
  return isProjectWorkflowState(value)
}

/**
 * Convierte cualquier estado de proyecto (nuevo o legacy) a su equivalente
 * en el flujo operativo nuevo.
 *
 * Si ya es un estado del nuevo flujo, lo devuelve tal cual.
 * Si es un estado legacy, busca su equivalente en el mapeo.
 * Si no se reconoce, devuelve null.
 *
 * @param status - El estado actual del proyecto (puede ser nuevo o legacy)
 * @returns El estado operativo equivalente, o null si no se puede determinar
 */
export function getProjectOperationalState(status: string): EstadoProyecto | null {
  if (isProjectWorkflowState(status)) return status
  if (isProjectLegacyState(status)) return PROJECT_LEGACY_TO_WORKFLOW[status] ?? null
  return null
}

/**
 * Verifica si un texto es un estado de proyecto que existe en la base de datos
 * (ya sea del nuevo flujo o del sistema legacy).
 *
 * Esto es util para validar datos que vienen de Supabase antes de procesarlos.
 */
export function isProjectStatePersisted(value: string): value is EstadoProyectoPersistido {
  return isProjectWorkflowState(value) || isProjectLegacyState(value)
}
