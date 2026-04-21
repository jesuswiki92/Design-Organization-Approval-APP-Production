/**
 * CONFIGURACION DE TABLAS Y BASES DE DATOS DE LA APLICACION
 *
 * Este archivo define todas las tablas de la base de data que la app puede consultar,
 * organizadas en grupos tematicos. Se usa principalmente en la seccion de administracion
 * "Database Viewer" donde se pueden ver los data crudos de cada table.
 *
 * Cada table tiene un name technical (el que usa Supabase) y una description
 * en espanol que explica que data contiene.
 *
 * Tambien se definen aqui las tablas de type RAG (Retrieval Augmented Generation),
 * que son tablas especiales que almacenan documents procesados por inteligencia
 * artificial para search semantica (search por significado, no solo por palabras).
 */

// Cuantas filas se muestran por page en el visor de tablas
export const TABLE_PAGE_SIZE = 50

// Lista completa de tablas agrupadas por area funcional
// Cada grupo tiene un name y una lista de tablas con su name technical y description
export const TABLE_GROUPS = [
  {
    name: 'Clients',
    tables: [
      {
        table: 'doa_clients',
        description: 'Data generales de clients, operadores y manufacturers.',
      },
      {
        table: 'doa_client_contacts',
        description: 'Contactos comerciales y tecnicos asociados a cada client.',
      },
    ],
  },
  {
    name: 'Consultas y projects',
    tables: [
      {
        table: 'doa_incoming_requests',
        description: 'Consultas comerciales entrantes procesadas desde email y forms.',
      },
      {
        table: 'doa_general_projects',
        description: 'Registro maestro de projects y expedientes de ingenieria.',
      },
    ],
  },
  {
    name: 'Usuarios',
    tables: [
      {
        table: 'doa_usuarios',
        description: 'Usuarios internos, roles, titulaciones y status de actividad.',
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
        description: 'Table auxiliar de síntomas y classification usada en pruebas o flujos de IA.',
      },
    ],
  },
  {
    name: 'RAG/Vectores',
    tables: [
      {
        table: 'DocumentacionCertificacion',
        description: 'Corpus de certificacion indexado para search semantica.',
      },
      {
        table: 'documents',
        description: 'Documents vectorizados y metadatos usados por el sistema RAG.',
      },
      {
        table: 'doa_chunks',
        description: 'Chunks indexados del corpus DOA para recuperación semántica.',
      },
    ],
  },
] as const

/**
 * Tipo que representa cualquier name de table permitido en la app.
 * Se genera automaticamente a partir de la lista TABLE_GROUPS de arriba,
 * asi que si se agrega una table new alli, este type se actualiza solo.
 */
export type AllowedTable = (typeof TABLE_GROUPS)[number]['tables'][number]['table']

/**
 * Tipo que describe la estructura de un grupo de tablas tal como se muestra
 * en la interfaz del visor de base de data, incluyendo el conteo de filas.
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
// verificar si un name de table es valido.
export const ALLOWED_TABLE_SET = new Set<string>(ALLOWED_TABLES)

// Conjunto de tablas que pertenecen al sistema RAG (search semantica con IA).
// Estas tablas contienen documents procesados y fragmentos de text ("chunks")
// que la inteligencia artificial usa para responder preguntas sobre certificacion.
export const RAG_TABLE_SET = new Set<AllowedTable>(['DocumentacionCertificacion', 'documents', 'doa_chunks'])
