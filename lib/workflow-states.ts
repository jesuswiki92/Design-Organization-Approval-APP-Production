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
 * 3. PROYECTOS DE INGENIERIA: Los estados simplificados de un proyecto (nuevo,
 *    en_progreso, revision, aprobacion, entregado, cerrado), mas los estados
 *    "legacy" (antiguos) que se conservan por compatibilidad con datos existentes.
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
  ENTRADA_RECIBIDA: 'entrada_recibida',           // Acaba de llegar una consulta comercial
  FORMULARIO_ENVIADO: 'formulario_enviado',       // Formulario enviado al cliente, esperando respuesta
  FORMULARIO_RECIBIDO: 'formulario_recibido',     // Formulario recibido del cliente, pendiente de revision
  DEFINIR_ALCANCE: 'definir_alcance',             // Se esta definiendo el alcance del trabajo
  ALCANCE_DEFINIDO: 'alcance_definido',           // Alcance definido, preparar oferta comercial
  OFERTA_EN_REVISION: 'oferta_en_revision',       // Oferta preparada, en revision interna
  OFERTA_ENVIADA: 'oferta_enviada',               // Oferta enviada al cliente
  OFERTA_ACEPTADA: 'oferta_aceptada',             // El cliente acepto la oferta
  OFERTA_RECHAZADA: 'oferta_rechazada',           // El cliente rechazo la oferta
  REVISION_FINAL: 'revision_final',               // Revision final antes de abrir proyecto
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
  formulario_enviado: {
    label: 'Formulario enviado. Esperando respuesta',
    shortLabel: 'Enviado',
    description: 'Se envió el formulario al cliente, pendiente de respuesta',
    color: 'text-cyan-700',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    dot: 'bg-cyan-500',
  },
  formulario_recibido: {
    label: 'Formulario recibido. Revisar',
    shortLabel: 'Revisar',
    description: 'El cliente respondió el formulario, pendiente de revisión interna',
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    dot: 'bg-teal-500',
  },
  definir_alcance: {
    label: 'Definir alcance',
    shortLabel: 'Alcance',
    description: 'Se está definiendo el alcance técnico y comercial del trabajo',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  alcance_definido: {
    label: 'Alcance definido. Preparar oferta',
    shortLabel: 'Preparar',
    description: 'Alcance clarificado, se procede a preparar la oferta comercial',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  oferta_en_revision: {
    label: 'Oferta preparada. Revisar',
    shortLabel: 'Revisión',
    description: 'La oferta está redactada y pendiente de revisión interna',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  oferta_enviada: {
    label: 'Oferta enviada a cliente',
    shortLabel: 'Enviada',
    description: 'La oferta comercial fue enviada al cliente, esperando respuesta',
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
  },
  oferta_aceptada: {
    label: 'Oferta aceptada',
    shortLabel: 'Aceptada',
    description: 'El cliente aceptó la oferta comercial',
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  oferta_rechazada: {
    label: 'Oferta rechazada',
    shortLabel: 'Rechazada',
    description: 'El cliente rechazó la oferta comercial',
    color: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  },
  revision_final: {
    label: 'Revisión final. Abrir Proyecto',
    shortLabel: 'Final',
    description: 'Revisión final antes de crear el proyecto de ingeniería',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
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
// Flujo simplificado de estados de proyecto.
// Los proyectos pasan por 6 fases generales desde su creacion hasta su cierre.
// Se conservan los estados "legacy" (del sistema antiguo) para
// compatibilidad con proyectos que aun tienen esos estados en la base de datos.
// ==========================================

// Lista ordenada de todos los estados de un proyecto (flujo simplificado).
export const PROJECT_WORKFLOW_STATES = [
  'nuevo',          // Proyecto recien creado
  'en_progreso',    // Trabajo de ingenieria en curso
  'revision',       // En proceso de revision tecnica
  'aprobacion',     // Pendiente de aprobacion
  'entregado',      // Documentacion entregada al cliente
  'cerrado',        // Proyecto completado y cerrado
  'archivado',      // Proyecto archivado (oculto del tablero, conservado en BD)
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

// Configuracion visual de cada estado de proyecto (flujo simplificado).
// Define como se muestra cada estado en el tablero y las listas de la app.
// Cada estado tiene un color diferente para identificarlo visualmente.
export const PROJECT_STATE_CONFIG: Record<EstadoProyectoWorkflow, WorkflowConfig> = {
  nuevo: {
    label: 'Nuevo',
    shortLabel: 'Nuevo',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  en_progreso: {
    label: 'En Progreso',
    shortLabel: 'Progreso',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  revision: {
    label: 'Revision',
    shortLabel: 'Revision',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  aprobacion: {
    label: 'Aprobacion',
    shortLabel: 'Aprobacion',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  entregado: {
    label: 'Entregado',
    shortLabel: 'Entregado',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  cerrado: {
    label: 'Cerrado',
    shortLabel: 'Cerrado',
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  },
  archivado: {
    label: 'Archivado',
    shortLabel: 'Arch.',
    color: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  },
}

// Configuracion visual de los estados legacy (antiguos).
// Todos se muestran en gris (slate) para distinguirlos de los estados operativos nuevos.
const PROJECT_LEGACY_STATE_CONFIG: Record<EstadoProyectoLegacy, WorkflowConfig> = {
  oferta: {
    label: 'Legacy - Oferta',
    shortLabel: 'Legacy oferta',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  activo: {
    label: 'Legacy - Activo',
    shortLabel: 'Legacy activo',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  en_revision: {
    label: 'Legacy - En revision',
    shortLabel: 'Legacy revision',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  pendiente_aprobacion_cve: {
    label: 'Legacy - Pendiente CVE',
    shortLabel: 'Legacy CVE',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  pendiente_aprobacion_easa: {
    label: 'Legacy - Pendiente authority',
    shortLabel: 'Legacy authority',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  en_pausa: {
    label: 'Legacy - En pausa',
    shortLabel: 'Legacy pausa',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  cancelado: {
    label: 'Legacy - Cancelado',
    shortLabel: 'Legacy cancelado',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  guardado_en_base_de_datos: {
    label: 'Legacy - Base de datos',
    shortLabel: 'Legacy base',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
}

// Transiciones permitidas entre estados de proyecto (flujo simplificado).
// Define las reglas de negocio: desde cada estado, solo se puede avanzar
// a ciertos estados especificos. El flujo es lineal con posibilidad de
// retroceder en algunos casos.
const PROJECT_TRANSITIONS: Record<EstadoProyecto, EstadoProyecto[]> = {
  nuevo: ['en_progreso', 'archivado'],
  en_progreso: ['revision', 'aprobacion', 'archivado'],
  revision: ['en_progreso', 'aprobacion', 'archivado'],
  aprobacion: ['revision', 'entregado', 'archivado'],
  entregado: ['cerrado', 'archivado'],
  cerrado: ['archivado'],
  archivado: [],
}

// Transiciones desde estados legacy hacia estados del nuevo flujo de trabajo.
// Esto permite "migrar" un proyecto del sistema antiguo al nuevo.
const PROJECT_LEGACY_TRANSITIONS: Partial<Record<EstadoProyectoLegacy, EstadoProyecto[]>> = {
  oferta: ['nuevo'],
  guardado_en_base_de_datos: ['nuevo'],
  activo: ['en_progreso'],
  en_revision: ['revision'],
  pendiente_aprobacion_cve: ['aprobacion'],
  pendiente_aprobacion_easa: ['aprobacion'],
  en_pausa: ['nuevo', 'en_progreso'],
  cancelado: [],
}

// Mapeo automatico de estados legacy a su equivalente en el nuevo flujo.
// Se usa para saber "a que fase corresponde" un proyecto antiguo.
const PROJECT_LEGACY_TO_WORKFLOW: Partial<Record<EstadoProyectoLegacy, EstadoProyecto>> = {
  oferta: 'nuevo',
  guardado_en_base_de_datos: 'nuevo',
  activo: 'en_progreso',
  en_revision: 'revision',
  pendiente_aprobacion_cve: 'aprobacion',
  pendiente_aprobacion_easa: 'aprobacion',
  en_pausa: 'en_progreso',
  cancelado: 'cerrado',
}

// Estados que requieren que el usuario escriba una RAZON al cambiar a ellos.
// Por ahora no hay estados que lo requieran en el flujo simplificado,
// pero se mantiene la estructura por si se necesita en el futuro.
const PROJECT_REASON_REQUIRED = new Set<EstadoProyecto>([])

/**
 * Obtiene la informacion visual de un estado de proyecto (nombre, colores, etc.).
 *
 * Funciona tanto con estados del flujo simplificado (nuevo, en_progreso, revision,
 * aprobacion, entregado, cerrado) como con estados legacy (oferta, activo, etc.).
 * Si el estado no se reconoce, devuelve una configuracion por defecto en gris.
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
 * Actualmente no hay estados que lo requieran en el flujo simplificado,
 * pero se mantiene la estructura por si se necesita en el futuro.
 *
 * @param entity - El tipo de entidad (por ahora solo "project")
 * @param state - El estado al que se quiere cambiar
 * @returns true si se debe pedir una razon al usuario, false si no
 */
export function requiresWorkflowReason(entity: 'project', state: string) {
  return PROJECT_REASON_REQUIRED.has(state as EstadoProyecto)
}

/**
 * Verifica si un texto es un estado valido del flujo simplificado de proyectos
 * (nuevo, en_progreso, revision, aprobacion, entregado, cerrado).
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
