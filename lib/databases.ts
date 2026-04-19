/**
 * CONFIGURACION DE TABLAS Y BASES DE DATOS DE LA APLICACION
 *
 * Este archivo define todas las tablas de la base de datos que la app puede consultar,
 * organizadas en grupos tematicos. Se usa principalmente en la seccion de administracion
 * "Database Viewer" donde se pueden ver los datos crudos de cada tabla.
 *
 * Cada tabla tiene un nombre tecnico (el que usa Supabase) y una descripcion
 * en espanol que explica que datos contiene.
 *
 * Tambien se definen aqui las tablas de tipo RAG (Retrieval Augmented Generation),
 * que son tablas especiales que almacenan documentos procesados por inteligencia
 * artificial para busqueda semantica (busqueda por significado, no solo por palabras).
 */

// Cuantas filas se muestran por pagina en el visor de tablas
export const TABLE_PAGE_SIZE = 50

// Lista completa de tablas agrupadas por area funcional
// Cada grupo tiene un nombre y una lista de tablas con su nombre tecnico y descripcion
export const TABLE_GROUPS = [
  {
    name: 'Clientes',
    tables: [
      {
        table: 'clientes_datos_generales',
        description: 'Datos generales de clientes, operadores y fabricantes.',
      },
      {
        table: 'clientes_contactos',
        description: 'Contactos comerciales y tecnicos asociados a cada cliente.',
      },
    ],
  },
  {
    name: 'Consultas y proyectos',
    tables: [
      {
        table: 'consultas_entrantes',
        description: 'Consultas comerciales entrantes procesadas desde email y formularios.',
      },
      {
        table: 'proyectos',
        description: 'Registro maestro de proyectos y expedientes de ingenieria.',
      },
    ],
  },
  {
    name: 'Usuarios',
    tables: [
      {
        table: 'usuarios',
        description: 'Usuarios internos, roles, titulaciones y estado de actividad.',
      },
    ],
  },
  {
    name: 'Chat e IA',
    tables: [
      {
        table: 'chat_sessions',
        description: 'Sesiones de conversación del asistente y su contexto operativo.',
      },
      {
        table: 'chat_history',
        description: 'Historial de mensajes almacenados para cada sesión de chat.',
      },
      {
        table: 'salud_sintomas',
        description: 'Tabla auxiliar de síntomas y clasificación usada en pruebas o flujos de IA.',
      },
    ],
  },
  {
    name: 'RAG/Vectores',
    tables: [
      {
        table: 'DocumentacionCertificacion',
        description: 'Corpus de certificacion indexado para busqueda semantica.',
      },
      {
        table: 'documents',
        description: 'Documentos vectorizados y metadatos usados por el sistema RAG.',
      },
      {
        table: 'chunks',
        description: 'Chunks indexados del corpus DOA para recuperación semántica.',
      },
    ],
  },
] as const

/**
 * Tipo que representa cualquier nombre de tabla permitido en la app.
 * Se genera automaticamente a partir de la lista TABLE_GROUPS de arriba,
 * asi que si se agrega una tabla nueva alli, este tipo se actualiza solo.
 */
export type AllowedTable = (typeof TABLE_GROUPS)[number]['tables'][number]['table']

/**
 * Tipo que describe la estructura de un grupo de tablas tal como se muestra
 * en la interfaz del visor de base de datos, incluyendo el conteo de filas.
 */
export type TableGroup = {
  name: string
  tables: Array<{
    table: AllowedTable
    description: string
    count: number
  }>
}

// Lista plana con solo los nombres de todas las tablas permitidas
// (sin agrupar, util para validaciones rapidas)
export const ALLOWED_TABLES = TABLE_GROUPS.flatMap((group) => group.tables.map((table) => table.table))

// Conjunto (Set) de nombres de tablas permitidas para busquedas rapidas.
// Usar un Set es mas eficiente que buscar en un array cuando se necesita
// verificar si un nombre de tabla es valido.
export const ALLOWED_TABLE_SET = new Set<string>(ALLOWED_TABLES)

// Conjunto de tablas que pertenecen al sistema RAG (busqueda semantica con IA).
// Estas tablas contienen documentos procesados y fragmentos de texto ("chunks")
// que la inteligencia artificial usa para responder preguntas sobre certificacion.
export const RAG_TABLE_SET = new Set<AllowedTable>(['DocumentacionCertificacion', 'documents', 'chunks'])
