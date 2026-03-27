// DOA Operations Hub — Database Types
// All tables use prefix doa_new_

export type UserRole = 'engineer' | 'team_lead' | 'head_of_design' | 'admin'
export type ProjectStatus = 'active' | 'review' | 'approved' | 'paused' | 'closed'
export type Classification = 'minor' | 'major' | 'repair'
export type DocumentStatus = 'vigente' | 'obsoleto' | 'pendiente' | 'na'
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  avatar_url: string | null
  department: string | null
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  legal_name: string
  country: string | null
  vat_number: string | null
  contacts: ClientContact[]
  fleet: FleetEntry[]
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ClientContact {
  name: string
  email: string
  phone?: string
  role?: string
}

export interface FleetEntry {
  model: string
  registration?: string
  serial_number?: string
}

export interface Aircraft {
  id: string
  model: string
  variant: string | null
  manufacturer: string
  tcds_ref: string | null
  mtow_kg: number | null
  created_at: string
}

export interface Project {
  id: string
  code: string
  name: string
  description: string | null
  client_id: string | null
  aircraft_id: string | null
  status: ProjectStatus
  classification: Classification | null
  cert_basis: string[]
  lead_engineer_id: string | null
  tl_id: string | null
  estimated_delivery: string | null
  docs_complete_pct: number
  priority: string
  created_at: string
  updated_at: string
  // Joined fields
  client?: Client
  aircraft?: Aircraft
  lead_engineer?: Profile
  tl?: Profile
}

export interface Document {
  id: string
  project_id: string
  folder_path: string
  name: string
  edition: string
  status: DocumentStatus
  file_url: string | null
  storage_path: string | null
  author_id: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  author?: Profile
}

export interface Task {
  id: string
  project_id: string
  title: string
  description: string | null
  assignee_id: string | null
  priority: TaskPriority
  due_date: string | null
  status: TaskStatus
  estimated_hours: number | null
  actual_hours: number | null
  completed_at: string | null
  created_at: string
  updated_at: string
  assignee?: Profile
}

export interface ProjectMember {
  project_id: string
  user_id: string
  role: string
  profile?: Profile
}

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

// ─── doa_proyectos_generales ──────────────────────────────────────────────────

export interface Proyecto {
  id: string
  numero_proyecto: string
  titulo: string
  descripcion: string | null
  cliente_id: string | null
  modelo_id: string | null
  tipo_modificacion: string
  clasificacion_cambio: 'menor' | 'mayor' | 'stc' | 'reparacion' | 'otro' | null
  base_certificacion: string | null
  estado: 'oferta' | 'activo' | 'en_revision' | 'pendiente_aprobacion_cve' | 'pendiente_aprobacion_easa' | 'en_pausa' | 'cancelado' | 'cerrado'
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
