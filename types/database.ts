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
 *   - 'cerrado': proyecto completado y cerrado
 *   - 'guardado_en_base_de_datos': archivado en la base de datos
 */
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

/**
 * ESTADOS DE PROYECTO (SISTEMA NUEVO - WORKFLOW)
 * Este es el flujo de trabajo actual que sigue un proyecto de ingenieria
 * desde que se recibe hasta que se factura. Cada estado tiene un numero
 * de orden (op_00, op_01, etc.) que indica su posicion en el proceso.
 *
 * El flujo completo es:
 *   op_00 - Prepago: esperando el pago inicial del cliente
 *   op_01 - Recopilacion de datos: reuniendo la documentacion necesaria
 *   op_02 - Pendiente de informacion: esperando datos del cliente
 *   op_03 - Pendiente de ensayos: esperando resultados de pruebas/tests
 *   op_04 - En evaluacion: analizando la viabilidad tecnica
 *   op_05 - En trabajo: realizando el trabajo de ingenieria
 *   op_06 - Revision del cliente: el cliente revisa nuestro trabajo
 *   op_07 - Revision interna: revision tecnica por nuestro equipo
 *   op_08 - Pendiente de firma: documentos listos, esperando firmas
 *   op_09 - Pendiente de autoridad: esperando aprobacion de EASA u otra autoridad
 *   op_10 - Listo para entrega: todo aprobado, preparando entrega al cliente
 *   op_11 - Entregado: documentacion entregada al cliente
 *   op_12 - Cerrado: proyecto completado y cerrado
 *   op_13 - Facturado: factura emitida y proceso totalmente finalizado
 */
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

// ─── doa_proyectos_generales ──────────────────────────────────────────────────

/**
 * PROYECTO DE INGENIERIA
 * Es la pieza central de la aplicacion. Representa un trabajo de ingenieria
 * aeronautica que realizamos para un cliente (ej: una modificacion en un avion,
 * una reparacion, un cambio de diseno, etc.).
 *
 * Cada proyecto pasa por las fases del workflow (ver EstadoProyectoWorkflow)
 * y tiene asignados responsables internos (owner, checker, approval, CVE).
 *
 * Corresponde a la tabla "doa_proyectos_generales" en la base de datos.
 */
export interface Proyecto {
  // Identificador unico del proyecto
  id: string
  // Numero de proyecto interno (ej: "DOA-2024-0042") - es la referencia que usamos dia a dia
  numero_proyecto: string
  // Referencia a la cotizacion/oferta de la que nacio este proyecto (puede estar vacia)
  oferta_id?: string | null
  // Titulo descriptivo del proyecto (ej: "Instalacion de WiFi en A320")
  titulo: string
  // Descripcion detallada del trabajo a realizar (puede estar vacia)
  descripcion: string | null
  // Referencia al cliente que nos ha contratado el trabajo
  cliente_id: string | null
  // Referencia al modelo de aeronave afectado (ej: A320-214)
  modelo_id: string | null
  // Tipo de modificacion segun normativa (ej: "modificacion mayor", "STC", etc.)
  tipo_modificacion: string
  // Clasificacion del cambio segun su complejidad y alcance regulatorio:
  //   - 'menor': cambio menor, aprobacion interna
  //   - 'mayor': cambio mayor, requiere mas revision
  //   - 'stc': Supplemental Type Certificate (certificado de tipo suplementario)
  //   - 'reparacion': diseno de reparacion
  //   - 'otro': otro tipo de clasificacion
  clasificacion_cambio: 'menor' | 'mayor' | 'stc' | 'reparacion' | 'otro' | null
  // Base de certificacion aplicable (normas EASA CS que aplican) (puede estar vacia)
  base_certificacion: string | null
  // Estado actual del proyecto dentro del flujo de trabajo (ver EstadoProyectoWorkflow)
  estado: EstadoProyectoPersistido
  // Fecha y hora del ultimo cambio de estado (puede estar vacia)
  estado_updated_at?: string | null
  // Quien realizo el ultimo cambio de estado (puede estar vacio)
  estado_updated_by?: string | null
  // Motivo o justificacion del ultimo cambio de estado (puede estar vacio)
  estado_motivo?: string | null
  // Fecha en que se abrio/inicio el proyecto
  fecha_apertura: string | null
  // Fecha en que se cerro el proyecto (se rellena al finalizar)
  fecha_cierre: string | null
  // Fecha prevista de finalizacion (la fecha limite que le damos al cliente)
  fecha_prevista: string | null
  // Horas de trabajo estimadas para completar el proyecto
  horas_estimadas: number | null
  // Horas de trabajo realmente empleadas (se va actualizando durante el proyecto)
  horas_reales: number | null
  // Presupuesto del proyecto en euros
  presupuesto_euros: number | null
  // Ingeniero responsable del proyecto (el "dueno" del proyecto)
  owner_id: string | null
  // Ingeniero que revisa el trabajo (el "checker" o verificador)
  checker_id: string | null
  // Persona que da la aprobacion final interna
  approval_id: string | null
  // CVE asignado (Compliance Verification Engineer - ingeniero que verifica cumplimiento normativo)
  cve_id: string | null
  // Numero de aeronaves afectadas por esta modificacion
  num_aeronaves_afectadas: number
  // Resumen ejecutivo del proyecto para informes y vistas rapidas (puede estar vacio)
  resumen_ejecutivo: string | null
  // Fecha y hora en que se creo el registro del proyecto
  created_at: string
}

/**
 * PROYECTO CON SUS RELACIONES
 * Version ampliada del Proyecto que incluye los datos completos del cliente,
 * el modelo de aeronave, el ingeniero responsable y el historial de cambios
 * de estado. Se usa en las pantallas de detalle donde necesitamos ver
 * toda la informacion junta sin hacer consultas adicionales.
 */
export interface ProyectoConRelaciones extends Proyecto {
  // Datos completos del cliente (no solo su ID)
  cliente: Cliente | null
  // Datos completos del modelo de aeronave
  modelo: AeronaveModelo | null
  // Datos completos del ingeniero responsable (owner)
  owner: UsuarioDoa | null
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
export type WorkflowStateScope = 'incoming_queries' | 'quotation_board'

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
