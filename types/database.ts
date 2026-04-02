// Tipos de la base de datos activa (tablas doa_*)

// ─── doa_clientes_* tables ────────────────────────────────────────────────────

export interface Cliente {
  id: string
  nombre: string
  cif_vat: string | null
  pais: string
  ciudad: string | null
  direccion: string | null
  telefono: string | null
  web: string | null
  activo: boolean
  notas: string | null
  created_at: string
  dominio_email: string | null
  tipo_cliente: 'aerolinea' | 'mro' | 'privado' | 'fabricante' | 'otro' | null
}

export interface ClienteContacto {
  id: string
  cliente_id: string
  nombre: string
  apellidos: string | null
  email: string
  telefono: string | null
  cargo: string | null
  es_principal: boolean
  activo: boolean
  created_at: string
}

export interface ClienteWithContactos extends Cliente {
  contactos: ClienteContacto[]
}

// ─── doa_aeronaves_modelos ────────────────────────────────────────────────────

export interface AeronaveModelo {
  id: string
  fabricante: string
  familia: string
  modelo: string
  activo: boolean
}

// ─── doa_usuarios ─────────────────────────────────────────────────────────────

export interface UsuarioDoa {
  id: string
  nombre: string
  apellidos: string | null
  email: string | null
  rol: string
  titulo: string | null
  activo: boolean
}

export type EstadoProyectoLegacy =
  | 'oferta'
  | 'activo'
  | 'en_revision'
  | 'pendiente_aprobacion_cve'
  | 'pendiente_aprobacion_easa'
  | 'en_pausa'
  | 'cancelado'
  | 'cerrado'
  | 'guardado_en_base_de_datos'

export type EstadoProyectoWorkflow =
  | 'op_00_prepay'
  | 'op_01_data_collection'
  | 'op_02_pending_info'
  | 'op_03_pending_tests'
  | 'op_04_under_evaluation'
  | 'op_05_in_work'
  | 'op_06_customer_review'
  | 'op_07_internal_review'
  | 'op_08_pending_signature'
  | 'op_09_pending_authority'
  | 'op_10_ready_for_delivery'
  | 'op_11_delivered'
  | 'op_12_closed'
  | 'op_13_invoiced'

export type EstadoProyecto = EstadoProyectoWorkflow
export type EstadoProyectoPersistido = EstadoProyectoWorkflow | EstadoProyectoLegacy

// ─── doa_proyectos_generales ──────────────────────────────────────────────────

export interface Proyecto {
  id: string
  numero_proyecto: string
  oferta_id?: string | null
  titulo: string
  descripcion: string | null
  cliente_id: string | null
  modelo_id: string | null
  tipo_modificacion: string
  clasificacion_cambio: 'menor' | 'mayor' | 'stc' | 'reparacion' | 'otro' | null
  base_certificacion: string | null
  estado: EstadoProyectoPersistido
  estado_updated_at?: string | null
  estado_updated_by?: string | null
  estado_motivo?: string | null
  fecha_apertura: string | null
  fecha_cierre: string | null
  fecha_prevista: string | null
  horas_estimadas: number | null
  horas_reales: number | null
  presupuesto_euros: number | null
  owner_id: string | null
  checker_id: string | null
  approval_id: string | null
  cve_id: string | null
  num_aeronaves_afectadas: number
  resumen_ejecutivo: string | null
  created_at: string
}

export interface ProyectoConRelaciones extends Proyecto {
  cliente: Cliente | null
  modelo: AeronaveModelo | null
  owner: UsuarioDoa | null
  estado_historial?: ProyectoEstadoHistorial[]
}

// ─── doa_proyectos_documentos ─────────────────────────────────────────────────

export interface ProyectoDocumento {
  id: string
  proyecto_id: string
  tipo_documento: string
  nombre: string
  estado: 'pendiente' | 'en_redaccion' | 'en_revision' | 'aprobado'
  version: string
  url: string | null
  notas: string | null
  fecha_ultima_revision: string | null
  created_at: string
}

// ─── doa_proyectos_hitos ──────────────────────────────────────────────────────

export interface ProyectoHito {
  id: string
  proyecto_id: string
  descripcion: string
  fecha_prevista: string | null
  completado: boolean
  fecha_completado: string | null
  orden: number
  created_at: string
}

// ─── doa_proyectos_tareas ─────────────────────────────────────────────────────

export interface ProyectoTarea {
  id: string
  proyecto_id: string
  titulo: string
  descripcion: string | null
  responsable_id: string | null
  prioridad: 'baja' | 'media' | 'alta' | 'urgente'
  estado: 'pendiente' | 'en_curso' | 'completada' | 'bloqueada'
  fecha_limite: string | null
  horas_estimadas: number | null
  horas_reales: number | null
  created_at: string
}

// Estados: ver lib/workflow-states.ts → CONSULTA_ESTADOS
export interface ConsultaEntrante {
  id: string
  created_at: string
  asunto: string | null
  remitente: string | null
  cuerpo_original: string | null
  clasificacion: string | null
  respuesta_ia: string | null
  estado: string
  numero_entrada?: string | null
  url_formulario?: string | null
  correo_cliente_enviado_at?: string | null
  correo_cliente_enviado_by?: string | null
  ultimo_borrador_cliente?: string | null
}

export type WorkflowStateScope = 'incoming_queries' | 'quotation_board'

export type WorkflowStateColorToken =
  | 'sky'
  | 'cyan'
  | 'emerald'
  | 'amber'
  | 'violet'
  | 'indigo'
  | 'slate'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'rose'

export interface WorkflowStateConfigRow {
  id?: string
  scope: WorkflowStateScope
  state_code: string
  label: string
  short_label: string | null
  description: string | null
  color_token: WorkflowStateColorToken
  sort_order: number
  is_system: boolean
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface ProyectoEstadoHistorial {
  id: string
  proyecto_id: string
  estado_anterior: string | null
  estado_nuevo: string
  motivo: string | null
  changed_at: string
  changed_by: string | null
}
