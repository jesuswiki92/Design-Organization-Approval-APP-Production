/**
 * ============================================================================
 * TIPOS DE LA BASE DE DATOS - DOA Operations Hub
 * ============================================================================
 *
 * Este archivo define la estructura de todos los datos que maneja la aplicacion.
 * Cada "interface" (interfaz) es como una plantilla que describe los campos
 * de una tabla en la base de datos de Supabase.
 *
 * Por ejemplo, si tenemos una tabla de "clientes", aqui se describe que un
 * cliente tiene nombre, telefono, pais, etc.
 *
 * Estas definiciones se usan en toda la aplicacion para asegurar que los
 * datos siempre tengan el formato correcto.
 *
 * Nota: "string" significa texto, "number" significa numero, "boolean"
 * significa verdadero/falso, y "null" significa que el campo puede estar vacio.
 * ============================================================================
 */

// ─── doa_clientes_* tables ────────────────────────────────────────────────────

/**
 * CLIENTE
 * Representa una empresa u organizacion que nos contrata servicios de ingenieria.
 * Pueden ser aerolineas, talleres de mantenimiento (MRO), operadores privados, etc.
 * Corresponde a la tabla "doa_clientes" en la base de datos.
 */
export interface Cliente {
  // Identificador unico del cliente (generado automaticamente)
  id: string
  // Nombre comercial de la empresa (ej: "Iberia", "Vueling", etc.)
  nombre: string
  // CIF o numero de identificacion fiscal / VAT (puede estar vacio)
  cif_vat: string | null
  // Pais donde tiene su sede principal
  pais: string
  // Ciudad de la sede (puede estar vacio)
  ciudad: string | null
  // Direccion postal completa (puede estar vacio)
  direccion: string | null
  // Telefono de contacto general (puede estar vacio)
  telefono: string | null
  // Pagina web de la empresa (puede estar vacio)
  web: string | null
  // Indica si el cliente esta activo o ha sido dado de baja
  activo: boolean
  // Notas internas sobre el cliente (puede estar vacio)
  notas: string | null
  // Fecha y hora en que se creo el registro del cliente
  created_at: string
  // Dominio del correo electronico de la empresa (ej: "iberia.com"), se usa para identificar correos entrantes
  dominio_email: string | null
  // Tipo de cliente segun su actividad en aviacion:
  //   - 'aerolinea': compania aerea que opera vuelos
  //   - 'mro': taller de mantenimiento (Maintenance, Repair & Overhaul)
  //   - 'privado': operador privado de aeronaves
  //   - 'fabricante': fabricante de aeronaves o componentes
  //   - 'otro': cualquier otro tipo
  tipo_cliente: 'aerolinea' | 'mro' | 'privado' | 'fabricante' | 'otro' | null
}

/**
 * CONTACTO DE CLIENTE
 * Representa a una persona concreta dentro de una empresa cliente.
 * Cada cliente puede tener varios contactos (ej: el ingeniero jefe,
 * el responsable de compras, etc.).
 * Corresponde a la tabla "doa_clientes_contactos" en la base de datos.
 */
export interface ClienteContacto {
  // Identificador unico del contacto
  id: string
  // Referencia al cliente al que pertenece este contacto
  cliente_id: string
  // Nombre de pila de la persona de contacto
  nombre: string
  // Apellidos (puede estar vacio)
  apellidos: string | null
  // Correo electronico del contacto (obligatorio para comunicaciones)
  email: string
  // Telefono directo del contacto (puede estar vacio)
  telefono: string | null
  // Cargo o puesto en la empresa (ej: "Director de Ingenieria") (puede estar vacio)
  cargo: string | null
  // Indica si es el contacto principal de ese cliente (el que se usa por defecto)
  es_principal: boolean
  // Indica si este contacto esta activo o ha sido dado de baja
  activo: boolean
  // Fecha y hora en que se creo el registro
  created_at: string
}

/**
 * CLIENTE CON SUS CONTACTOS
 * Es una version ampliada de Cliente que incluye la lista de todas
 * las personas de contacto asociadas. Se usa cuando necesitamos
 * mostrar un cliente junto con todos sus contactos en la misma pantalla.
 */
export interface ClienteWithContactos extends Cliente {
  // Lista de todas las personas de contacto de este cliente
  contactos: ClienteContacto[]
}

// ─── doa_aeronaves_modelos ────────────────────────────────────────────────────

/**
 * MODELO DE AERONAVE
 * Representa un modelo concreto de avion sobre el que podemos trabajar.
 * Se usa para asociar proyectos de ingenieria con el tipo de avion afectado.
 * Ejemplo: fabricante "Airbus", familia "A320", modelo "A320-214".
 * Corresponde a la tabla "doa_aeronaves_modelos" en la base de datos.
 */
export interface AeronaveModelo {
  // Identificador unico del modelo
  id: string
  // Fabricante de la aeronave (ej: "Airbus", "Boeing", "Embraer")
  fabricante: string
  // Familia o serie del avion (ej: "A320", "B737", "E-Jet")
  familia: string
  // Modelo especifico dentro de la familia (ej: "A320-214", "B737-800")
  modelo: string
  // Indica si este modelo esta activo en nuestro catalogo
  activo: boolean
}

// ─── doa_usuarios ─────────────────────────────────────────────────────────────

/**
 * USUARIO DE LA DOA
 * Representa a un miembro del equipo de la organizacion de diseno (DOA).
 * Estos son los ingenieros y responsables internos que trabajan en los proyectos.
 * Se asignan como propietarios, revisores o aprobadores de proyectos.
 * Corresponde a la tabla "doa_usuarios" en la base de datos.
 */
export interface UsuarioDoa {
  // Identificador unico del usuario
  id: string
  // Nombre de pila del usuario
  nombre: string
  // Apellidos del usuario (puede estar vacio)
  apellidos: string | null
  // Correo electronico corporativo (puede estar vacio)
  email: string | null
  // Rol dentro de la DOA (ej: "ingeniero", "CVE", "jefe de proyecto")
  rol: string
  // Titulo profesional o cargo (ej: "Senior Engineer") (puede estar vacio)
  titulo: string | null
  // Indica si el usuario esta activo en el equipo
  activo: boolean
}

/**
 * ESTADOS DE PROYECTO (SISTEMA ANTIGUO)
 * Estos son los estados que se usaban antes en la app.
 * Se mantienen para poder leer proyectos antiguos que todavia tienen
 * estos valores en la base de datos, pero los nuevos proyectos
 * usan el sistema de workflow nuevo (ver mas abajo).
 *
 * Los estados antiguos eran:
 *   - 'oferta': el proyecto era solo una propuesta/cotizacion
 *   - 'activo': proyecto en curso
 *   - 'en_revision': en proceso de revision tecnica
 *   - 'pendiente_aprobacion_cve': esperando aprobacion del CVE (ingeniero verificador)
 *   - 'pendiente_aprobacion_easa': esperando aprobacion de EASA (autoridad europea)
 *   - 'en_pausa': proyecto temporalmente detenido
 *   - 'cancelado': proyecto cancelado definitivamente
 *   - 'guardado_en_base_de_datos': archivado en la base de datos
 *
 * NOTA: 'cerrado' fue eliminado de legacy porque ahora existe como estado
 * del nuevo flujo simplificado.
 */
export type EstadoProyectoLegacy =
  | 'oferta'
  | 'activo'
  | 'en_revision'
  | 'pendiente_aprobacion_cve'
  | 'pendiente_aprobacion_easa'
  | 'en_pausa'
  | 'cancelado'
  | 'guardado_en_base_de_datos'

/**
 * ESTADOS DE PROYECTO (SISTEMA NUEVO - SIMPLIFICADO)
 * Flujo simplificado de estados de proyecto. Cada proyecto pasa por
 * estas fases generales desde su creacion hasta su cierre.
 *
 * Los estados son:
 *   nuevo - Proyecto recien creado
 *   en_progreso - Trabajo de ingenieria en curso
 *   revision - En proceso de revision tecnica
 *   aprobacion - Pendiente de aprobacion
 *   entregado - Documentacion entregada al cliente
 *   cerrado - Proyecto completado y cerrado
 */
export type EstadoProyectoWorkflow =
  | 'nuevo'
  | 'en_progreso'
  | 'revision'
  | 'aprobacion'
  | 'entregado'
  | 'cerrado'

/**
 * ESTADO DE PROYECTO (para uso en la app)
 * Solo acepta los estados del sistema nuevo (workflow).
 * Se usa cuando la app necesita ASIGNAR un nuevo estado a un proyecto.
 */
export type EstadoProyecto = EstadoProyectoWorkflow

/**
 * ESTADO DE PROYECTO PERSISTIDO (tal como esta guardado en la base de datos)
 * Acepta tanto los estados nuevos como los antiguos, porque en la base de datos
 * pueden existir proyectos viejos con estados del sistema anterior.
 * Se usa cuando la app LEE un estado desde la base de datos.
 */
export type EstadoProyectoPersistido = EstadoProyectoWorkflow | EstadoProyectoLegacy

// ─── doa_proyectos ───────────────────────────────────────────────────────────

/**
 * PROYECTO DE INGENIERIA (ACTIVO)
 * Es la pieza central de la aplicacion. Representa un trabajo de ingenieria
 * aeronautica que realizamos para un cliente (ej: una modificacion en un avion,
 * una reparacion, un cambio de diseno, etc.).
 *
 * Cada proyecto pasa por las fases del workflow (ver EstadoProyectoWorkflow)
 * y tiene asignados responsables internos (owner, checker, approval, CVE).
 *
 * Corresponde a la tabla "doa_proyectos" en la base de datos.
 * Los campos coinciden 1:1 con las columnas de la migracion
 * 202604051200_create_doa_proyectos.sql.
 */
export interface Proyecto {
  // Identificador unico del proyecto
  id: string
  // Numero de proyecto interno (ej: "IM.A.226-0002") - referencia diaria
  numero_proyecto: string
  // Titulo descriptivo del proyecto (ej: "Antenna installation in Cessna 208B")
  titulo: string
  // Descripcion detallada del trabajo a realizar (puede estar vacia)
  descripcion: string | null

  // --- Relaciones ---
  // Referencia a la consulta entrante de la que nacio este proyecto (puede estar vacia)
  consulta_id: string | null
  // Nombre del cliente (texto libre, denormalizado)
  cliente_nombre: string | null
  // Referencia al cliente en doa_clientes (puede estar vacia)
  client_id: string | null

  // --- Aeronave ---
  // Tipo de aeronave (ej: "Cessna 208B")
  aeronave: string | null
  // Modelo de aeronave (ej: "208B")
  modelo: string | null
  // Numeros de serie de fabrica (MSN)
  msn: string | null
  // Codigo TCDS completo (ej: "EASA.IM.A.226")
  tcds_code: string | null
  // Codigo TCDS corto (ej: "IM.A.226")
  tcds_code_short: string | null

  // --- Estado (workflow) ---
  // Estado actual del proyecto dentro del flujo simplificado
  estado: EstadoProyectoPersistido

  // --- Equipo asignado (texto por ahora) ---
  // Ingeniero responsable del proyecto (el "dueno")
  owner: string | null
  // Ingeniero que revisa el trabajo (checker)
  checker: string | null
  // Persona que da la aprobacion final interna
  approval: string | null
  // CVE (Compliance Verification Engineer)
  cve: string | null

  // --- Fechas ---
  // Fecha en que se inicio el proyecto
  fecha_inicio: string | null
  // Fecha estimada de entrega
  fecha_entrega_estimada: string | null
  // Fecha en que se cerro el proyecto
  fecha_cierre: string | null

  // --- Carpeta ---
  // Ruta del proyecto en el filesystem
  ruta_proyecto: string | null

  // --- Metadata ---
  // Prioridad del proyecto: baja, normal, alta, urgente
  prioridad: string | null
  // Ano del proyecto
  anio: number | null
  // Notas internas
  notas: string | null

  // --- Timestamps ---
  created_at: string
  updated_at: string
}

/**
 * PROYECTO CON SUS RELACIONES
 * Version ampliada del Proyecto que incluye los datos completos del cliente
 * y el historial de cambios de estado. Se usa en las pantallas de detalle
 * donde necesitamos ver toda la informacion junta sin hacer consultas
 * adicionales.
 */
export interface ProyectoConRelaciones extends Proyecto {
  // Datos completos del cliente (no solo su ID)
  cliente: Cliente | null
  // Historial de todos los cambios de estado que ha tenido el proyecto
  estado_historial?: ProyectoEstadoHistorial[]
}

// ─── doa_proyectos_documentos ─────────────────────────────────────────────────

/**
 * DOCUMENTO DE PROYECTO
 * Representa un documento tecnico asociado a un proyecto de ingenieria.
 * Ejemplos: planos, informes de analisis, instrucciones de instalacion,
 * certificados, etc. Cada documento tiene un control de versiones y
 * un flujo de aprobacion propio.
 * Corresponde a la tabla "doa_proyectos_documentos" en la base de datos.
 */
export interface ProyectoDocumento {
  // Identificador unico del documento
  id: string
  // Referencia al proyecto al que pertenece este documento
  proyecto_id: string
  // Tipo de documento (ej: "plano", "informe", "instruccion", "certificado")
  tipo_documento: string
  // Nombre del documento (ej: "STC-A320-WiFi-Install-Instructions-Rev2.pdf")
  nombre: string
  // Estado del documento en su proceso de elaboracion:
  //   - 'pendiente': aun no se ha empezado a redactar
  //   - 'en_redaccion': se esta escribiendo activamente
  //   - 'en_revision': terminado y en proceso de revision tecnica
  //   - 'aprobado': revisado y aprobado oficialmente
  estado: 'pendiente' | 'en_redaccion' | 'en_revision' | 'aprobado'
  // Numero de version del documento (ej: "1.0", "2.1")
  version: string
  // Enlace al archivo del documento almacenado (puede estar vacio si aun no se ha subido)
  url: string | null
  // Notas o comentarios sobre el documento (puede estar vacio)
  notas: string | null
  // Fecha de la ultima revision realizada al documento
  fecha_ultima_revision: string | null
  // Fecha y hora en que se creo el registro
  created_at: string
}

// ─── doa_proyectos_hitos ──────────────────────────────────────────────────────

/**
 * HITO DE PROYECTO
 * Representa un punto clave o entregable importante dentro de un proyecto.
 * Los hitos son como "checkpoints" que marcan momentos criticos del proyecto
 * (ej: "Entrega del primer borrador", "Aprobacion del CVE", "Envio a EASA").
 * Sirven para hacer seguimiento del progreso general del proyecto.
 * Corresponde a la tabla "doa_proyectos_hitos" en la base de datos.
 */
export interface ProyectoHito {
  // Identificador unico del hito
  id: string
  // Referencia al proyecto al que pertenece este hito
  proyecto_id: string
  // Descripcion del hito (ej: "Entrega de documentacion al cliente")
  descripcion: string
  // Fecha prevista para alcanzar este hito
  fecha_prevista: string | null
  // Indica si el hito ya se ha completado (true) o esta pendiente (false)
  completado: boolean
  // Fecha en que realmente se completo el hito (se rellena al marcarlo como completado)
  fecha_completado: string | null
  // Numero de orden para mostrar los hitos en secuencia (1, 2, 3...)
  orden: number
  // Fecha y hora en que se creo el registro
  created_at: string
}

// ─── doa_proyectos_tareas ─────────────────────────────────────────────────────

/**
 * TAREA DE PROYECTO
 * Representa una tarea concreta de trabajo dentro de un proyecto.
 * A diferencia de los hitos (que son puntos de control), las tareas son
 * las actividades reales que alguien debe realizar (ej: "Redactar informe
 * de cumplimiento", "Revisar planos electricos", "Preparar documentacion STC").
 * Cada tarea se asigna a un responsable y tiene control de horas.
 * Corresponde a la tabla "doa_proyectos_tareas" en la base de datos.
 */
export interface ProyectoTarea {
  // Identificador unico de la tarea
  id: string
  // Referencia al proyecto al que pertenece esta tarea
  proyecto_id: string
  // Titulo breve de la tarea (ej: "Redactar informe de analisis de cargas")
  titulo: string
  // Descripcion detallada de lo que hay que hacer (puede estar vacia)
  descripcion: string | null
  // Referencia al usuario de la DOA responsable de ejecutar esta tarea
  responsable_id: string | null
  // Nivel de prioridad de la tarea:
  //   - 'baja': puede esperar, no es urgente
  //   - 'media': prioridad normal
  //   - 'alta': debe hacerse pronto
  //   - 'urgente': requiere atencion inmediata
  prioridad: 'baja' | 'media' | 'alta' | 'urgente'
  // Estado actual de la tarea:
  //   - 'pendiente': aun no se ha empezado
  //   - 'en_curso': alguien esta trabajando en ella
  //   - 'completada': ya esta terminada
  //   - 'bloqueada': no se puede avanzar (falta informacion, depende de otra tarea, etc.)
  estado: 'pendiente' | 'en_curso' | 'completada' | 'bloqueada'
  // Fecha limite para completar la tarea
  fecha_limite: string | null
  // Horas estimadas para completar la tarea
  horas_estimadas: number | null
  // Horas realmente empleadas (se actualiza durante el trabajo)
  horas_reales: number | null
  // Fecha y hora en que se creo el registro
  created_at: string
}

/**
 * CONSULTA ENTRANTE
 * Representa una solicitud o consulta que nos llega de un cliente potencial
 * o existente (normalmente por email o formulario web). Es el punto de
 * entrada del negocio: alguien nos pregunta si podemos hacer un trabajo.
 *
 * Estas consultas se gestionan en el tablero de "Quotations" (cotizaciones)
 * y pueden evolucionar hasta convertirse en un proyecto de ingenieria.
 *
 * Los estados posibles se definen en lib/workflow-states.ts (CONSULTA_ESTADOS).
 * Corresponde a la tabla "doa_consultas_entrantes" en la base de datos.
 */
export interface ConsultaEntrante {
  // Identificador unico de la consulta
  id: string
  // Fecha y hora en que se recibio la consulta
  created_at: string
  // Asunto del correo o titulo de la consulta (puede estar vacio)
  asunto: string | null
  // Quien envio la consulta - email o nombre del remitente (puede estar vacio)
  remitente: string | null
  // Texto original del correo o mensaje recibido (puede estar vacio)
  cuerpo_original: string | null
  // Clasificacion automatica de la consulta hecha por la IA (puede estar vacia)
  clasificacion: string | null
  // Respuesta sugerida por la IA para enviar al cliente (puede estar vacia)
  respuesta_ia: string | null
  // Estado actual de la consulta dentro del flujo de cotizaciones
  estado: string
  // Numero de entrada asignado para seguimiento interno (ej: "ENT-2024-0001")
  numero_entrada?: string | null
  // URL del formulario web si la consulta llego por formulario
  url_formulario?: string | null
  // Fecha y hora en que se envio la respuesta al cliente por correo
  correo_cliente_enviado_at?: string | null
  // Quien envio la respuesta al cliente
  correo_cliente_enviado_by?: string | null
  // Ultimo borrador de respuesta preparado para el cliente
  ultimo_borrador_cliente?: string | null
  // Numero del TCDS (Type Certificate Data Sheet - ficha tecnica del certificado de tipo de la aeronave)
  tcds_number?: string | null
  // Fabricante de la aeronave sobre la que se consulta (ej: "Airbus", "Boeing")
  aircraft_manufacturer?: string | null
  // Modelo de la aeronave sobre la que se consulta (ej: "A320-200")
  aircraft_model?: string | null
  // Numero de aeronaves afectadas por la consulta
  aircraft_count?: number | null
  // MSN (Manufacturer Serial Number - numero de serie de fabrica de la aeronave)
  aircraft_msn?: string | null
  // URL al PDF del TCDS descargado para referencia
  tcds_pdf_url?: string | null
  // Tipo de trabajo solicitado: "proyecto_nuevo" o "modificacion_existente"
  work_type?: string | null
  // Codigo del proyecto existente (solo si work_type = "modificacion_existente")
  existing_project_code?: string | null
  // Resumen de la modificacion solicitada
  modification_summary?: string | null
  // Objetivo operativo que se busca lograr
  operational_goal?: string | null
  // Indica si el cliente dispone de equipamiento: "si", "no", "no_aplica"
  has_equipment?: string | null
  // Detalles del equipamiento (si has_equipment = "si")
  equipment_details?: string | null
  // Indica si el cliente tiene planos o documentacion: "si" o "no"
  has_drawings?: string | null
  // Indica si existe una modificacion similar previa: "si", "no", "no_seguro"
  has_previous_mod?: string | null
  // Referencia a la modificacion previa (si has_previous_mod = "si")
  previous_mod_ref?: string | null
  // Indica si el cliente tiene documentacion del fabricante: "si" o "no"
  has_manufacturer_docs?: string | null
  // Fecha objetivo deseada por el cliente
  target_date?: string | null
  // Indica si es una situacion AOG (Aircraft on Ground): "si" o "no"
  is_aog?: string | null
  // Ubicacion actual de la aeronave
  aircraft_location?: string | null
  // Notas adicionales del cliente
  additional_notes?: string | null
  // Cuerpo de la respuesta enviada al cliente (guardado para mostrar en el hilo de emails)
  reply_body?: string | null
  // Fecha y hora en que se envio la respuesta al cliente
  reply_sent_at?: string | null
}

/**
 * AMBITO DE ESTADOS DE WORKFLOW
 * Define a que seccion de la app pertenece un estado de workflow.
 *   - 'incoming_queries': estados para las consultas entrantes (la bandeja de entrada)
 *   - 'quotation_board': estados para el tablero de cotizaciones/ofertas
 *
 * Esto permite que cada seccion de la app tenga sus propios estados
 * independientes sin mezclarse.
 */
export type WorkflowStateScope = 'incoming_queries' | 'quotation_board' | 'project_board'

/**
 * COLORES PARA ESTADOS
 * Cada estado del workflow tiene un color asociado para identificarlo
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
 * Define las propiedades de cada columna/estado que aparece en los tableros
 * tipo Kanban de la app. Esto permite personalizar los estados sin tocar codigo:
 * se pueden crear nuevos estados, cambiar colores, reordenar, etc.
 * Corresponde a la tabla "doa_workflow_state_config" en la base de datos.
 */
export interface WorkflowStateConfigRow {
  // Identificador unico del estado (generado automaticamente)
  id?: string
  // A que seccion de la app pertenece este estado (consultas o cotizaciones)
  scope: WorkflowStateScope
  // Codigo interno del estado (ej: "new", "in_review", "quoted")
  state_code: string
  // Nombre completo del estado para mostrar al usuario (ej: "En Revision")
  label: string
  // Nombre corto para espacios reducidos (puede estar vacio)
  short_label: string | null
  // Descripcion de lo que significa este estado (puede estar vacia)
  description: string | null
  // Color de la columna en el tablero
  color_token: WorkflowStateColorToken
  // Numero de orden para mostrar las columnas en secuencia (1, 2, 3...)
  sort_order: number
  // Indica si es un estado del sistema (no se puede borrar) o creado por el usuario
  is_system: boolean
  // Indica si este estado esta activo o ha sido desactivado
  is_active: boolean
  // Fecha y hora de creacion del registro
  created_at?: string
  // Fecha y hora de la ultima modificacion
  updated_at?: string
}

/**
 * HISTORIAL DE CAMBIOS DE ESTADO DE UN PROYECTO
 * Cada vez que un proyecto cambia de estado (ej: de "En trabajo" a
 * "Revision interna"), se guarda un registro aqui. Esto permite ver
 * la trazabilidad completa: quien cambio el estado, cuando y por que.
 * Es importante para auditorias y para entender la historia de un proyecto.
 * Corresponde a la tabla "doa_proyectos_estado_historial" en la base de datos.
 */
export interface ProyectoEstadoHistorial {
  // Identificador unico del registro de historial
  id: string
  // Referencia al proyecto cuyo estado cambio
  proyecto_id: string
  // Estado en el que estaba ANTES del cambio (puede ser vacio si es el primer estado)
  estado_anterior: string | null
  // Nuevo estado al que paso el proyecto
  estado_nuevo: string
  // Motivo o justificacion del cambio de estado (puede estar vacio)
  motivo: string | null
  // Fecha y hora exacta en que se realizo el cambio
  changed_at: string
  // Quien realizo el cambio de estado (puede estar vacio)
  changed_by: string | null
}

// ─── doa_conteo_horas_proyectos ─────────────────────────────────────────────

/**
 * CONTEO DE HORAS DE PROYECTO (PUNCH-CLOCK)
 * Cada fila representa un evento de inicio o fin de trabajo en un proyecto.
 * Sesion de trabajo en un proyecto. Una fila = un periodo inicio-fin.
 * Al pulsar "Iniciar" se crea la fila con inicio. Al pulsar "Parar" se
 * actualiza la misma fila con fin y duracion_minutos calculada.
 * Corresponde a la tabla "doa_conteo_horas_proyectos" en la base de datos.
 */
export interface ConteoHorasProyecto {
  id: string
  proyecto_id: string
  numero_proyecto: string
  // Fecha y hora de inicio de la sesion de trabajo
  inicio: string
  // Fecha y hora de fin (null si la sesion sigue abierta)
  fin: string | null
  // Duracion en minutos (calculada al parar, null si aun abierta)
  duracion_minutos: number | null
  usuario: string | null
  created_at: string
}

// ─── mdl_contenido (Master Document List - JSONB) ───────────────────────────

/** Documento individual dentro del MDL (Master Document List) de un proyecto historico */
export interface MdlDocumento {
  ref: string
  titulo: string
  edicion: string
  fecha: string
  estado: string // "Active" | "Superseded"
}

/** Estructura del campo JSONB mdl_contenido en doa_proyectos_historico */
export interface MdlContenido {
  entregables: MdlDocumento[]
  no_entregables: MdlDocumento[]
}

// ─── doa_emails ──────────────────────────────────────────────────────────────

/**
 * EMAIL ASOCIADO A UNA CONSULTA
 * Representa un correo electronico (entrante o saliente) vinculado a una consulta.
 * Los emails son registros INMUTABLES: una vez insertados, NUNCA se actualizan.
 * El hilo se mantiene via consulta_id (agrupa todos los emails de una consulta)
 * y orden cronologico por fecha.
 * Corresponde a la tabla "doa_emails" en la base de datos.
 */
export interface DoaEmail {
  // Identificador unico del email
  id: string
  // Referencia a la consulta entrante a la que pertenece este email
  consulta_id: string
  // Direccion del email: 'entrante' (del cliente) o 'saliente' (nuestra respuesta)
  direccion: 'entrante' | 'saliente'
  // Direccion de correo del remitente
  de: string
  // Direccion de correo del destinatario (puede estar vacio)
  para: string | null
  // Asunto del correo
  asunto: string
  // Cuerpo del correo
  cuerpo: string
  // Fecha original del correo en el servidor de correo
  fecha: string
  // Identificador unico RFC Message-ID (inmutable)
  mensaje_id: string | null
  // Referencia al mensaje_id del correo padre (para hilos)
  en_respuesta_a: string | null
  // Fecha y hora en que se inserto el registro en la base de datos
  created_at: string
}

// ─── doa_proyectos_historico_archivos ────────────────────────────────────────

/** Archivo individual dentro de una familia documental de un proyecto historico */
export interface ProyectoHistoricoArchivo {
  id: string
  documento_id: string
  nombre_archivo: string
  codigo_documento: string | null
  edicion: string | null
  formato: string
  es_edicion_vigente: boolean
  ruta_relativa: string | null
  contenido_md: string | null
  created_at: string
}
