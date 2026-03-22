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
