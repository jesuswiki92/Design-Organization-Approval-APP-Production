/**
 * ============================================================================
 * TIPOS DE LA BASE DE DATOS - DOA Operations Hub
 * ============================================================================
 *
 * Este archivo define la estructura de todos los data que maneja la aplicacion.
 * Cada "interface" (interfaz) es como una template que describe los campos
 * de una table en la base de data de Supabase.
 *
 * Por ejemplo, si tenemos una table de "clients", aqui se describe que un
 * client tiene name, phone, country, etc.
 *
 * Estas definiciones se usan en toda la aplicacion para asegurar que los
 * data siempre tengan el formato correcto.
 *
 * Nota: "string" significa text, "number" significa numero, "boolean"
 * significa verdadero/falso, y "null" significa que el campo puede estar vacio.
 * ============================================================================
 */

// ─── doa_clientes_* tables ────────────────────────────────────────────────────

/**
 * CLIENTE
 * Representa una empresa u organizacion que nos contrata servicios de ingenieria.
 * Pueden ser aerolineas, talleres de mantenimiento (MRO), operadores privados, etc.
 * Corresponde a la table "doa_clientes" en la base de data.
 */
export interface Client {
  // Identificador unico del client (generado automaticamente)
  id: string
  // Name commercial de la empresa (ej: "Iberia", "Vueling", etc.)
  name: string
  // CIF o numero de identificacion fiscal / VAT (puede estar vacio)
  vat_tax_id: string | null
  // Country donde tiene su sede primary
  country: string
  // City de la sede (puede estar vacio)
  city: string | null
  // Address postal completa (puede estar vacio)
  address: string | null
  // Phone de contacto general (puede estar vacio)
  phone: string | null
  // Page website de la empresa (puede estar vacio)
  website: string | null
  // Indica si el client esta is_active o ha sido dado de low
  is_active: boolean
  // Notes internas sobre el client (puede estar vacio)
  notes: string | null
  // Date y hora en que se creo el registro del client
  created_at: string
  // Dominio del email electronico de la empresa (ej: "iberia.com"), se usa para identificar emails entrantes
  email_domain: string | null
  // Tipo de client segun su actividad en aviacion:
  //   - 'airline': compania aerea que opera vuelos
  //   - 'mro': taller de mantenimiento (Maintenance, Repair & Overhaul)
  //   - 'private': operador private de aircraft
  //   - 'manufacturer': manufacturer de aircraft o componentes
  //   - 'other': cualquier other type
  client_type: 'airline' | 'mro' | 'private' | 'manufacturer' | 'other' | null
}

/**
 * CONTACTO DE CLIENTE
 * Representa a una persona concreta dentro de una empresa client.
 * Cada client puede tener varios contacts (ej: el ingeniero jefe,
 * el responsable de compras, etc.).
 * Corresponde a la table "doa_client_contacts" en la base de data.
 */
export interface ClientContact {
  // Identificador unico del contacto
  id: string
  // Referencia al client al que pertenece este contacto
  client_id: string
  // Name de pila de la persona de contacto
  name: string
  // Apellidos (puede estar vacio)
  last_name: string | null
  // Email electronico del contacto (obligatorio para comunicaciones)
  email: string
  // Phone directo del contacto (puede estar vacio)
  phone: string | null
  // Cargo o puesto en la empresa (ej: "Director de Ingenieria") (puede estar vacio)
  job_title: string | null
  // Indica si es el contacto primary de ese client (el que se usa por defecto)
  is_primary: boolean
  // Indica si este contacto esta is_active o ha sido dado de low
  is_active: boolean
  // Date y hora en que se creo el registro
  created_at: string
}

/**
 * CLIENTE CON SUS CONTACTOS
 * Es una version ampliada de Client que incluye la lista de todas
 * las personas de contacto asociadas. Se usa cuando necesitamos
 * mostrar un client junto con todos sus contacts en la misma pantalla.
 */
export interface ClientWithContacts extends Client {
  // Lista de todas las personas de contacto de este client
  contacts: ClientContact[]
}

// ─── doa_aircraft_models ────────────────────────────────────────────────────

/**
 * MODELO DE AERONAVE
 * Representa un model concreto de avion sobre el que podemos trabajar.
 * Se usa para asociar projects de ingenieria con el type de avion afectado.
 * Ejemplo: manufacturer "Airbus", family "A320", model "A320-214".
 * Corresponde a la table "doa_aircraft_models" en la base de data.
 */
export interface AircraftModel {
  // Identificador unico del model
  id: string
  // Manufacturer de la aircraft (ej: "Airbus", "Boeing", "Embraer")
  manufacturer: string
  // Familia o serie del avion (ej: "A320", "B737", "E-Jet")
  family: string
  // Model especifico dentro de la family (ej: "A320-214", "B737-800")
  model: string
  // Indica si este model esta is_active en nuestro catalogo
  is_active: boolean
}

/**
 * FILA DE AERONAVE
 * Representa un registro de la table "doa_aircraft".
 */
export interface AircraftRow {
  id: string
  tcds_code: string
  tcds_code_short: string
  tcds_issue: string | null
  tcds_date: string | null
  manufacturer: string | null
  country: string | null
  type: string | null
  model: string | null
  engine: string | null
  mtow_kg: number | null
  mlw_kg: number | null
  base_regulation: string | null
  category: string | null
  eligible_msns: string | null
  notes: string | null
  created_at: string
}

// ─── doa_usuarios ─────────────────────────────────────────────────────────────

/**
 * USUARIO DE LA DOA
 * Representa a un miembro del equipo de la organizacion de diseno (DOA).
 * Estos son los ingenieros y responsables internos que trabajan en los projects.
 * Se asignan como propietarios, revisores o aprobadores de projects.
 * Corresponde a la table "doa_usuarios" en la base de data.
 */
export interface DoaUser {
  // Identificador unico del user_label
  id: string
  // Name de pila del user_label
  name: string
  // Apellidos del user_label (puede estar vacio)
  last_name: string | null
  // Email electronico corporativo (puede estar vacio)
  email: string | null
  // Rol dentro de la DOA (ej: "ingeniero", "CVE", "jefe de project")
  role: string
  // Titulo profesional o job_title (ej: "Senior Engineer") (puede estar vacio)
  title: string | null
  // Indica si el user_label esta is_active en el equipo
  is_active: boolean
}

/**
 * ESTADOS DE PROYECTO (SISTEMA ANTIGUO)
 * Estos son los statuses que se usaban antes en la app.
 * Se mantienen para poder leer projects antiguos que todavia tienen
 * estos valores en la base de data, pero los nuevos projects
 * usan el sistema de workflow new (ver mas abajo).
 *
 * Los statuses antiguos eran:
 *   - 'quote': el project era solo una propuesta/cotizacion
 *   - 'active': project en curso
 *   - 'in_review': en process de review technical
 *   - 'pending_cve_approval': awaiting approval del CVE (ingeniero verificador)
 *   - 'pending_easa_approval': awaiting approval de EASA (autoridad europea)
 *   - 'paused': project temporalmente detenido
 *   - 'canceled': project canceled definitivamente
 *   - 'saved_to_database': archived en la base de data
 *
 * NOTA: 'closed' fue eliminado de legacy porque ahora existe como status
 * del new flujo simplificado.
 */
export type LegacyProjectStatus =
  | 'quote'
  | 'active'
  | 'in_review'
  | 'pending_cve_approval'
  | 'pending_easa_approval'
  | 'paused'
  | 'canceled'
  | 'saved_to_database'

/**
 * ESTADOS DE PROYECTO (SISTEMA NEW - SIMPLIFICADO)
 * Flujo simplificado de statuses de project. Cada project pasa por
 * estas fases generales desde su creacion hasta su closure.
 *
 * Los statuses son:
 *   new - Project recien creado
 *   in_progress - Trabajo de ingenieria en curso
 *   review - En process de review technical
 *   approval - Pending de approval
 *   delivered - Documentacion entregada al client
 *   closed - Project completed y closed
 */
export type ProjectWorkflowStatus =
  | 'new'
  | 'in_progress'
  | 'review'
  | 'approval'
  | 'delivered'
  | 'closed'
  | 'archived'

/**
 * ESTADO DE PROYECTO (para uso en la app)
 * Solo acepta los statuses del sistema new (workflow).
 * Se usa cuando la app necesita ASIGNAR un new status a un project.
 */
export type ProjectStatus = ProjectWorkflowStatus

/**
 * ESTADO DE PROYECTO PERSISTIDO (tal como esta guardado en la base de data)
 * Acepta tanto los statuses nuevos como los antiguos, porque en la base de data
 * pueden existir projects viejos con statuses del sistema anterior.
 * Se usa cuando la app LEE un status desde la base de data.
 */
export type PersistedProjectStatus = ProjectWorkflowStatus | LegacyProjectStatus

// ─── doa_projects ───────────────────────────────────────────────────────────

/**
 * PROYECTO DE INGENIERIA (ACTIVO)
 * Es la pieza central de la aplicacion. Representa un trabajo de ingenieria
 * aeronautica que realizamos para un client (ej: una modificacion en un avion,
 * una reparacion, un cambio de diseno, etc.).
 *
 * Cada project pasa por las fases del workflow (ver ProjectWorkflowStatus)
 * y tiene asignados responsables internos (owner, checker, approval, CVE).
 *
 * Corresponde a la table "doa_projects" en la base de data.
 * Los campos coinciden 1:1 con las columnas de la migracion
 * 202604051200_create_doa_projects.sql.
 */
export interface Project {
  // Identificador unico del project
  id: string
  // Numero de project internal (ej: "IM.A.226-0002") - referencia diaria
  project_number: string
  // Titulo descriptivo del project (ej: "Antenna installation in Cessna 208B")
  title: string
  // Description detallada del trabajo a realizar (puede estar vacia)
  description: string | null

  // --- Relaciones ---
  // Referencia a la request entrante de la que nacio este project (puede estar vacia)
  incoming_request_id: string | null
  // Name del client (text libre, denormalizado)
  client_name: string | null
  // Referencia al client en doa_clientes (puede estar vacia)
  client_id: string | null

  // --- Aircraft ---
  // Tipo de aircraft (ej: "Cessna 208B")
  aircraft: string | null
  // Model de aircraft (ej: "208B")
  model: string | null
  // Numeros de serie de fabrica (MSN)
  msn: string | null
  // Codigo TCDS completo (ej: "EASA.IM.A.226")
  tcds_code: string | null
  // Codigo TCDS corto (ej: "IM.A.226")
  tcds_code_short: string | null

  // --- Status (workflow) ---
  // Status actual del project dentro del flujo simplificado (legacy)
  status: PersistedProjectStatus
  // Status actual segun la maquina de execution v2 (13 statuses, Sprint 1+).
  // Paralelo a `status`; se considera el new campo autoritativo del ciclo de vida.
  execution_status: string | null
  // Fase agregada: 'execution' | 'validation' | 'delivery' | 'closure'.
  current_phase: string | null
  // Marca temporal de la ultima transicion de `execution_status`.
  status_updated_at: string | null
  // User que ejecuto la ultima transicion (auth.users.id).
  status_updated_by: string | null

  // --- Equipo asignado (text por ahora) ---
  // Ingeniero responsable del project (el "dueno")
  owner: string | null
  // Ingeniero que revisa el trabajo (checker)
  checker: string | null
  // Persona que da la approval final internal
  approval: string | null
  // CVE (Compliance Verification Engineer)
  cve: string | null

  // --- Dates ---
  // Date en que se started_at el project
  start_date: string | null
  // Date estimada de delivery
  estimated_delivery_date: string | null
  // Date en que se cerro el project
  closed_at: string | null

  // --- Folder ---
  // Path del project en el filesystem (legacy — solo simulacion local)
  project_path: string | null
  // ID de la carpeta del proyecto en Google Drive, poblado por el workflow
  // n8n "AMS - Crear Carpeta Drive Proyecto" al abrir el proyecto.
  drive_folder_id: string | null
  // Link directo (https://drive.google.com/drive/folders/{id}) que la UI
  // renderiza como boton "Abrir carpeta Drive". Null hasta que la carpeta
  // se haya creado.
  drive_folder_url: string | null

  // --- Metadata ---
  // Prioridad del project: low, normal, high, urgent
  priority: string | null
  // Ano del project
  year: number | null
  // Notes internas
  notes: string | null

  // --- Timestamps ---
  created_at: string
  updated_at: string
}

/**
 * PROYECTO CON SUS RELACIONES
 * Version ampliada del Project que incluye los data completos del client
 * y el historial de cambios de status. Se usa en las pantallas de detalle
 * donde necesitamos ver toda la informacion junta sin hacer requests
 * adicionales.
 */
export interface ProjectWithRelations extends Project {
  // Data completos del client (no solo su ID)
  client: Client | null
  // Historial de todos los cambios de status que ha tenido el project
  estado_historial?: ProjectStatusHistory[]
}

// ─── doa_projects_documentos ─────────────────────────────────────────────────

/**
 * DOCUMENTO DE PROYECTO
 * Representa un document technical asociado a un project de ingenieria.
 * Ejemplos: planos, informes de analisis, instrucciones de instalacion,
 * certificados, etc. Cada document tiene un control de versiones y
 * un flujo de approval propio.
 * Corresponde a la table "doa_projects_documentos" en la base de data.
 */
// ─── doa_project_deliverables ─────────────────────────────────────────────────

/**
 * DELIVERABLE DE PROYECTO (Sprint 1+)
 * Fila de la table `doa_project_deliverables`. Cada fila representa un
 * document/trabajo concreto que el project debe entregar (por ejemplo, cada
 * template G12-xx seleccionada durante la request se convierte en un
 * deliverable). Se puebla automaticamente al planificar el project
 * (POST /api/projects/[id]/plan) a partir de las selecciones de
 * compliance de la request origen.
 */
export type DeliverableStatus =
  | 'pending'
  | 'in_progress'
  | 'in_review'
  | 'completed'
  | 'blocked'
  | 'not_applicable'

export interface ProjectDeliverable {
  id: string
  project_id: string
  template_code: string | null
  subpart_easa: string | null
  title: string
  description: string | null
  owner_user_id: string | null
  status: DeliverableStatus
  storage_path: string | null
  current_version: number
  sort_order: number
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// ─── doa_project_validations (Sprint 2) ─────────────────────────────────────

/** Capacidad en la que un user_label toma una decision de validation. */
export type ValidationRole = 'doh' | 'dos' | 'reviewer'

/** Decision tomada sobre un project que esta en validation. */
export type ValidationDecision = 'approved' | 'returned' | 'pending'

/** Severidad de una observation puntual sobre un deliverable. */
export type ObservationSeverity = 'info' | 'warn' | 'blocker'

/**
 * Observacion estructurada dentro del array `observations` de
 * `doa_project_validations`. `deliverable_id` es opcional; si se omite, la
 * observation aplica al project completo.
 */
export interface ValidationObservation {
  deliverable_id?: string | null
  text: string
  severity?: ObservationSeverity
}

/**
 * Snapshot mínimo de cada deliverable en el momento de la decision, guardado
 * dentro de `doa_project_validations.deliverables_snapshot`.
 */
export interface DeliverableSnapshot {
  id: string
  title: string
  status: DeliverableStatus
  current_version: number
}

/** Fila de la table `doa_project_validations`. */
export interface ProjectValidation {
  id: string
  project_id: string
  validator_user_id: string
  role: ValidationRole
  decision: ValidationDecision
  comments: string | null
  observations: ValidationObservation[]
  deliverables_snapshot: DeliverableSnapshot[] | null
  created_at: string
}

// ─── doa_project_signatures (Sprint 2) ──────────────────────────────────────

/** Rol en la firma (mas amplio que ValidationRole). */
export type SignerRole = 'doh' | 'dos' | 'staff' | 'manager' | 'cvc'

/** Evento al que corresponde la firma. */
export type SignatureType =
  | 'validation_approval'
  | 'validation_return'
  | 'delivery_release'
  | 'closure'

/** Fila de la table `doa_project_signatures`. */
export interface ProjectSignature {
  id: string
  project_id: string
  validation_id: string | null
  signer_user_id: string
  signer_role: SignerRole
  signature_type: SignatureType
  payload_hash: string
  hmac_signature: string
  hmac_key_id: string
  signed_payload: Record<string, unknown>
  created_at: string
}

// ─── doa_project_deliveries (Sprint 3) ──────────────────────────────────────

/** Status del dispatch de una delivery (Statement of Compliance). */
export type DeliveryDispatchStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'client_confirmed'

/** Fila de la table `doa_project_deliveries`. */
export interface ProjectDelivery {
  id: string
  project_id: string
  validation_id: string | null
  signature_id: string | null
  sent_by_user_id: string
  recipient_email: string
  recipient_name: string | null
  cc_emails: string[] | null
  subject: string
  body: string | null
  soc_pdf_storage_path: string | null
  soc_pdf_sha256: string | null
  attachments: unknown
  n8n_execution_id: string | null
  dispatch_status: DeliveryDispatchStatus
  dispatched_at: string | null
  client_confirmed_at: string | null
  client_confirmation_token: string | null
  created_at: string
  updated_at: string
}

/**
 * Canonical payload that is both rendered into the Statement of Compliance
 * PDF and signed via HMAC on the `delivery_release` signature. It MUST be
 * deterministic: same inputs -> same serialization -> same hash.
 *
 * Rendered by: lib/pdf/soc-renderer.tsx
 * Built by:    lib/pdf/canonical-payload.ts (buildSoCCanonicalPayload)
 */
export interface StatementOfCompliancePayload {
  document: {
    id: string // e.g. SoC-{project_number}-{ISO}
    title: string
    generated_at: string // ISO
    company: {
      name: string
      approval_no: string
    }
  }
  project: {
    id: string
    project_number: string
    title: string
    description: string | null
    client_name: string | null
  }
  validation: {
    id: string
    role: ValidationRole
    decision: ValidationDecision
    validator_user_id: string
    validator_email: string | null
    decided_at: string
  }
  deliverables: Array<{
    id: string
    template_code: string | null
    title: string
    subpart_easa: string | null
    current_version: number
    status: DeliverableStatus
  }>
  compliance_reference: {
    regulation: 'EASA Part 21 Subpart J'
    clauses: string[]
  }
  signature: {
    validation_signature_id: string
    hmac_key_id: string
    hmac_signature_first8: string
    hmac_signature_last8: string
    signed_by_user_id: string
    signed_at: string
  }
}

export interface ProjectDocument {
  // Identificador unico del document
  id: string
  // Referencia al project al que pertenece este document
  project_id: string
  // Tipo de document (ej: "drawing", "report", "instruction", "certificate")
  document_type: string
  // Name del document (ej: "STC-A320-WiFi-Install-Instructions-Rev2.pdf")
  name: string
  // Status del document en su process de elaboracion:
  //   - 'pending': aun no se ha empezado a redactar
  //   - 'drafting': se esta escribiendo activamente
  //   - 'in_review': terminado y en process de review technical
  //   - 'approved': revisado y approved oficialmente
  status: 'pending' | 'drafting' | 'in_review' | 'approved'
  // Numero de version del document (ej: "1.0", "2.1")
  version: string
  // Enlace al archivo del document almacenado (puede estar vacio si aun no se ha subido)
  url: string | null
  // Notes o comments sobre el document (puede estar vacio)
  notes: string | null
  // Date de la ultima review realizada al document
  last_review_date: string | null
  // Date y hora en que se creo el registro
  created_at: string
}

// ─── doa_projects_hitos ──────────────────────────────────────────────────────

/**
 * HITO DE PROYECTO
 * Representa un punto clave o entregable importante dentro de un project.
 * Los hitos son como "checkpoints" que marcan momentos criticos del project
 * (ej: "Delivery del primer borrador", "Approval del CVE", "Envio a EASA").
 * Sirven para hacer seguimiento del progreso general del project.
 * Corresponde a la table "doa_projects_hitos" en la base de data.
 */
export interface ProjectMilestone {
  // Identificador unico del hito
  id: string
  // Referencia al project al que pertenece este hito
  project_id: string
  // Description del hito (ej: "Delivery de documentacion al client")
  description: string
  // Date prevista para alcanzar este hito
  planned_date: string | null
  // Indica si el hito ya se ha completed (true) o esta pending (false)
  completed: boolean
  // Date en que realmente se completo el hito (se rellena al marcarlo como completed)
  completed_at: string | null
  // Numero de sort_order para mostrar los hitos en secuencia (1, 2, 3...)
  sort_order: number
  // Date y hora en que se creo el registro
  created_at: string
}

// ─── doa_projects_tareas ─────────────────────────────────────────────────────

/**
 * TAREA DE PROYECTO
 * Representa una tarea concreta de trabajo dentro de un project.
 * A diferencia de los hitos (que son puntos de control), las tareas son
 * las actividades reales que alguien debe realizar (ej: "Redactar report
 * de cumplimiento", "Revisar planos electricos", "Prepare documentacion STC").
 * Cada tarea se asigna a un responsable y tiene control de horas.
 * Corresponde a la table "doa_projects_tareas" en la base de data.
 */
export interface ProjectTask {
  // Identificador unico de la tarea
  id: string
  // Referencia al project al que pertenece esta tarea
  project_id: string
  // Titulo breve de la tarea (ej: "Redactar report de analisis de cargas")
  title: string
  // Description detallada de lo que hay que hacer (puede estar vacia)
  description: string | null
  // Referencia al user_label de la DOA responsable de ejecutar esta tarea
  responsable_id: string | null
  // Nivel de priority de la tarea:
  //   - 'low': puede esperar, no es urgent
  //   - 'medium': priority normal
  //   - 'high': debe hacerse pronto
  //   - 'urgent': requiere atencion inmediata
  priority: 'low' | 'medium' | 'high' | 'urgent'
  // Status actual de la tarea:
  //   - 'pending': aun no se ha empezado
  //   - 'in_progress': alguien esta trabajando en ella
  //   - 'completed': ya esta terminada
  //   - 'blocked': no se puede avanzar (falta informacion, depende de otra tarea, etc.)
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  // Date limite para completar la tarea
  due_date: string | null
  // Horas estimadas para completar la tarea
  estimated_hours: number | null
  // Horas realmente empleadas (se actualiza durante el trabajo)
  actual_hours: number | null
  // Date y hora en que se creo el registro
  created_at: string
}

/**
 * CONSULTA ENTRANTE
 * Representa una solicitud o request que nos llega de un client potencial
 * o existente (normalmente por email o form website). Es el punto de
 * entrada del negocio: alguien nos pregunta si podemos hacer un trabajo.
 *
 * Estas requests se gestionan en el tablero de "Quotations" (cotizaciones)
 * y pueden evolucionar hasta convertirse en un project de ingenieria.
 *
 * Los statuses posibles se definen en lib/workflow-states.ts (INCOMING_REQUEST_STATUSES).
 * Corresponde a la table "doa_incoming_requests" en la base de data.
 */
export interface IncomingRequest {
  // Identificador unico de la request
  id: string
  // Date y hora en que se recibio la request
  created_at: string
  // Subject del email o title de la request (puede estar vacio)
  subject: string | null
  // Quien send la request - email o name del sender (puede estar vacio)
  sender: string | null
  // Texto original del email o mensaje received (puede estar vacio)
  original_body: string | null
  // Classification automatica de la request hecha por la IA (puede estar vacia)
  classification: string | null
  // Response sugerida por la IA para send al client (puede estar vacia)
  ai_reply: string | null
  // Status actual de la request dentro del flujo de cotizaciones
  status: string
  // Numero de entrada asignado para seguimiento internal (ej: "ENT-2024-0001")
  entry_number?: string | null
  // URL del form website si la request llego por form
  form_url?: string | null
  // Date y hora en que se send la response al client por email
  client_email_sent_at?: string | null
  // Quien send la response al client
  client_email_sent_by?: string | null
  // Ultimo borrador de response preparado para el client
  last_client_draft?: string | null
  // Numero del TCDS (Type Certificate Data Sheet - ficha technical del certificate de type de la aircraft)
  tcds_number?: string | null
  // Manufacturer de la aircraft sobre la que se request (ej: "Airbus", "Boeing")
  aircraft_manufacturer?: string | null
  // Model de la aircraft sobre la que se request (ej: "A320-200")
  aircraft_model?: string | null
  // Numero de aircraft afectadas por la request
  aircraft_count?: number | null
  // MSN (Manufacturer Serial Number - numero de serie de fabrica de la aircraft)
  aircraft_msn?: string | null
  // URL al PDF del TCDS descargado para referencia
  tcds_pdf_url?: string | null
  // Lista de URLs publicas de los planos / drawings adjuntos por el client
  // (columna jsonb en la table; array de URLs). Puede ser null si no se adjuntaron.
  installation_drawings_urls?: string[] | null
  // Tipo de trabajo solicitado: "new_project" o "existing_modification"
  work_type?: string | null
  // Codigo del project existente (solo si work_type = "existing_modification")
  existing_project_code?: string | null
  // Resumen de la modificacion solicitada
  modification_summary?: string | null
  // Objetivo operativo que se busca lograr
  operational_goal?: string | null
  // Indica si el client dispone de equipamiento: "yes", "no", "not_applicable"
  has_equipment?: string | null
  // Detalles del equipamiento (si has_equipment = "yes")
  equipment_details?: string | null
  // Indica si el client tiene planos o documentacion: "yes" o "no"
  has_drawings?: string | null
  // Indica si existe una modificacion similar previa: "yes", "no", "not_sure"
  has_previous_mod?: string | null
  // Referencia a la modificacion previa (si has_previous_mod = "yes")
  previous_mod_ref?: string | null
  // Indica si el client tiene documentacion del manufacturer: "yes" o "no"
  has_manufacturer_docs?: string | null
  // Date objetivo deseada por el client
  target_date?: string | null
  // Indica si es una situacion AOG (Aircraft on Ground): "yes" o "no"
  is_aog?: string | null
  // Ubicacion actual de la aircraft
  aircraft_location?: string | null
  // Notes adicionales del client
  additional_notes?: string | null
  // Cuerpo de la response sent al client (guardado para mostrar en el hilo de emails)
  reply_body?: string | null
  // Date y hora en que se send la response al client
  reply_sent_at?: string | null
}

/**
 * AMBITO DE ESTADOS DE WORKFLOW
 * Define a que seccion de la app pertenece un status de workflow.
 *   - 'incoming_queries': statuses para las requests entrantes (la bandeja de entrada)
 *   - 'quotation_board': statuses para el tablero de cotizaciones/quotes
 *
 * Esto permite que cada seccion de la app tenga sus propios statuses
 * independientes sin mezclarse.
 */
export type WorkflowStateScope = 'incoming_queries' | 'quotation_board' | 'project_board'

/**
 * COLORES PARA ESTADOS
 * Cada status del workflow tiene un color asociado para identificarlo
 * visualmente en el tablero. Estos son los colores disponibles
 * (corresponden a la paleta de colores de Tailwind CSS).
 */
export type WorkflowStateColorToken =
  | 'sky'       // azul cielo
  | 'cyan'      // cian
  | 'emerald'   // verde esmeralda
  | 'amber'     // ambar/naranja
  | 'violet'    // violeta
  | 'indigo'    // indigo/azul oscuro
  | 'slate'     // gris pizarra
  | 'blue'      // azul
  | 'green'     // verde
  | 'yellow'    // amarillo
  | 'rose'      // rosa/rojo

/**
 * CONFIGURACION DE UN ESTADO DE WORKFLOW
 * Define las propiedades de cada columna/status que aparece en los tableros
 * type Kanban de la app. Esto permite personalizar los statuses sin tocar codigo:
 * se pueden crear nuevos statuses, cambiar colores, reordenar, etc.
 * Corresponde a la table "doa_workflow_state_config" en la base de data.
 */
export interface WorkflowStateConfigRow {
  // Identificador unico del status (generado automaticamente)
  id?: string
  // A que seccion de la app pertenece este status (requests o cotizaciones)
  scope: WorkflowStateScope
  // Codigo internal del status (ej: "new", "in_review", "quoted")
  state_code: string
  // Name completo del status para mostrar al user_label (ej: "En Review")
  label: string
  // Name corto para espacios reducidos (puede estar vacio)
  short_label: string | null
  // Description de lo que significa este status (puede estar vacia)
  description: string | null
  // Color de la columna en el tablero
  color_token: WorkflowStateColorToken
  // Numero de sort_order para mostrar las columnas en secuencia (1, 2, 3...)
  sort_order: number
  // Indica si es un status del sistema (no se puede borrar) o creado por el user_label
  is_system: boolean
  // Indica si este status esta is_active o ha sido desactivado
  is_active: boolean
  // Date y hora de creacion del registro
  created_at?: string
  // Date y hora de la ultima modificacion
  updated_at?: string
}

/**
 * HISTORIAL DE CAMBIOS DE ESTADO DE UN PROYECTO
 * Cada vez que un project cambia de status (ej: de "En trabajo" a
 * "Internal review"), se guarda un registro aqui. Esto permite ver
 * la trazabilidad completa: quien cambio el status, cuando y por que.
 * Es importante para auditorias y para entender la historia de un project.
 * Corresponde a la table "doa_project_status_history" en la base de data.
 */
export interface ProjectStatusHistory {
  // Identificador unico del registro de historial
  id: string
  // Referencia al project cuyo status cambio
  project_id: string
  // Status en el que estaba ANTES del cambio (puede ser vacio si es el primer status)
  previous_status: string | null
  // New status al que paso el project
  new_status: string
  // Motivo o justificacion del cambio de status (puede estar vacio)
  motivo: string | null
  // Date y hora exacta en que se realizo el cambio
  changed_at: string
  // Quien realizo el cambio de status (puede estar vacio)
  changed_by: string | null
}

// ─── doa_project_time_entries ─────────────────────────────────────────────

/**
 * CONTEO DE HORAS DE PROYECTO (PUNCH-CLOCK)
 * Cada fila representa un evento de started_at o ended_at de trabajo en un project.
 * Sesion de trabajo en un project. Una fila = un periodo started_at-ended_at.
 * Al pulsar "Iniciar" se crea la fila con started_at. Al pulsar "Parar" se
 * actualiza la misma fila con ended_at y duration_minutes calculada.
 * Corresponde a la table "doa_project_time_entries" en la base de data.
 */
export interface ProjectTimeEntry {
  id: string
  project_id: string
  project_number: string
  // Date y hora de started_at de la sesion de trabajo
  started_at: string
  // Date y hora de ended_at (null si la sesion sigue abierta)
  ended_at: string | null
  // Duracion en minutos (calculada al parar, null si aun abierta)
  duration_minutes: number | null
  user_label: string | null
  created_at: string
}

// ─── mdl_content (Master Document List - JSONB) ───────────────────────────

/** Document individual dentro del MDL (Master Document List) de un project historical */
export interface MdlDocument {
  ref: string
  title: string
  edicion: string
  date: string
  status: string // "Active" | "Superseded"
}

/** Estructura del campo JSONB mdl_content en doa_historical_projects */
export interface MdlContent {
  entregables: MdlDocument[]
  no_entregables: MdlDocument[]
}

/**
 * FILA DE PROYECTO HISTORICO
 * Representa un registro de la table "doa_historical_projects".
 */
export interface HistoricalProjectRow {
  id: string
  project_number: string
  title: string
  description: string | null
  client_name: string | null
  year: number | null
  aircraft: string | null
  msn: string | null
  source_path: string | null
  source_folder_name: string | null
  mdl_content: MdlContent | null
  summary_md: string | null
  compliance_docs_md: Record<string, { title: string; family: string; content_md: string }> | null
  created_at: string
  updated_at: string
}

// ─── doa_emails ──────────────────────────────────────────────────────────────

/**
 * EMAIL ASOCIADO A UNA CONSULTA
 * Representa un email electronico (entrante o saliente) vinculado a una request.
 * Los emails son registros INMUTABLES: una vez insertados, NUNCA se actualizan.
 * El hilo se mantiene via incoming_request_id (agrupa todos los emails de una request)
 * y sort_order cronologico por date.
 * Corresponde a la table "doa_emails" en la base de data.
 */
export interface DoaEmail {
  // Identificador unico del email
  id: string
  // Referencia a la request entrante a la que pertenece este email
  incoming_request_id: string
  // Address del email: 'entrante' (del client) o 'saliente' (nuestra response)
  direction: 'entrante' | 'saliente'
  // Address de email del sender
  from_email: string
  // Address de email del destinatario (puede estar vacio)
  to_email: string | null
  // Subject del email
  subject: string
  // Cuerpo del email
  body: string
  // Date original del email en el servidor de email
  date: string
  // Identificador unico RFC Message-ID (inmutable)
  message_id: string | null
  // Referencia al message_id del email padre (para hilos)
  in_reply_to: string | null
  // Date y hora en que se inserto el registro en la base de data
  created_at: string
}

// ─── doa_project_closures (Sprint 4) ────────────────────────────────────────

/** Outcome del closure de un project. */
export type ClosureOutcome =
  | 'successful'
  | 'successful_with_reservations'
  | 'problematic'
  | 'aborted'

/** Snapshot jsonb de las metricas computadas al closure. */
export interface ClosureMetricsSnapshot {
  planned_hours?: number | null
  actual_hours?: number | null
  deliverables_total?: number
  deliverables_completado?: number
  deliverables_not_applicable?: number
  deliverables_bloqueado?: number
  validations_count?: number
  validations_approved?: number
  returns_count?: number
  deliveries_count?: number
  deliveries_sent?: number
  deliveries_confirmed?: number
  total_days?: number | null
  client_confirmation_days?: number | null
  [key: string]: unknown
}

/** Fila de la table `doa_project_closures`. */
export interface ProjectClosure {
  id: string
  project_id: string
  closer_user_id: string
  signature_id: string | null
  metrics: ClosureMetricsSnapshot
  outcome: ClosureOutcome
  closure_notes: string | null
  created_at: string
}

// ─── doa_project_lessons (Sprint 4) ─────────────────────────────────────────

/** Categoria de una leccion aprendida. */
export type LessonCategory =
  | 'technical'
  | 'process'
  | 'client'
  | 'quality'
  | 'planning'
  | 'tools'
  | 'regulatory'
  | 'other'

/** Tipo de leccion aprendida. */
export type LessonType = 'positive' | 'negative' | 'improvement' | 'risk'

/** Fila de la table `doa_project_lessons`. */
export interface ProjectLesson {
  id: string
  project_id: string
  closure_id: string | null
  author_user_id: string
  category: LessonCategory
  type: LessonType
  title: string
  description: string
  impact: string | null
  recommendation: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
}

/** Input para crear una leccion via API. */
export interface LessonInput {
  category: LessonCategory
  type: LessonType
  title: string
  description: string
  impact?: string | null
  recommendation?: string | null
  tags?: string[] | null
}

// ─── doa_project_metrics_mv (Sprint 4) ──────────────────────────────────────

/** Fila de la materialized view doa_project_metrics_mv. */
export interface ProjectMetricsRow {
  project_id: string
  title: string
  client_id: string | null
  execution_status: string | null
  current_phase: string | null
  created_at: string
  status_updated_at: string | null
  deliverables_total: number
  deliverables_completado: number
  deliverables_not_applicable: number
  deliverables_bloqueado: number
  validations_total: number
  validations_approved: number
  validations_returned: number
  deliveries_total: number
  deliveries_sent: number
  deliveries_confirmed: number
  planned_hours: number | null
  actual_hours: number | null
  days_in_execution: number | null
  days_in_validation: number | null
  days_in_delivery: number | null
  total_days_closed_vs_opened: number | null
  closure_outcome: ClosureOutcome | null
  lessons_count: number
}

// ─── doa_historical_projects_archivos ────────────────────────────────────────

/** Archivo individual dentro de una family documental de un project historical */
export interface HistoricalProjectFile {
  id: string
  documento_id: string
  file_name: string
  document_code: string | null
  edicion: string | null
  formato: string
  es_edicion_vigente: boolean
  relative_path: string | null
  content_md: string | null
  created_at: string
}

// ===========================================================================
// Forms v2 — public intake forms with token-gated access
// ===========================================================================

/** Row in `doa_forms` — the HTML template + metadata for a public form. */
export interface DoaForm {
  slug: 'cliente_conocido' | 'cliente_desconocido'
  html: string
  description: string | null
  updated_at: string
  created_at: string
}

/**
 * Row in `doa_form_tokens`. Acts as the capability token for anonymous form
 * access. Valid while `expires_at > now()` AND `used_at IS NULL`. Single-
 * submit, multi-view. Issued by `/api/forms/issue-link`.
 */
export interface DoaFormToken {
  token: string
  slug: 'cliente_conocido' | 'cliente_desconocido'
  incoming_request_id: string
  expires_at: string
  used_at: string | null
  first_viewed_at: string | null
  view_count: number
  created_at: string
}

/** Payload accepted by `POST /api/forms/issue-link` (HMAC-signed by n8n). */
export interface IssueLinkPayload {
  incoming_request_id: string
  slug: 'cliente_conocido' | 'cliente_desconocido'
  /** Optional. Defaults to 14 days. Max 60. */
  ttl_days?: number
}

/** Response from `POST /api/forms/issue-link`. */
export interface IssueLinkResponse {
  url: string
  token: string
  expires_at: string
}
