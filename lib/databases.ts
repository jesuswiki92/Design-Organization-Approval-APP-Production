export const TABLE_PAGE_SIZE = 50

export const TABLE_GROUPS = [
  {
    name: 'Clientes',
    tables: [
      {
        table: 'doa_clientes_datos_generales',
        description: 'Datos generales de clientes, operadores y fabricantes.',
      },
      {
        table: 'doa_clientes_contactos',
        description: 'Contactos comerciales y tecnicos asociados a cada cliente.',
      },
    ],
  },
  {
    name: 'Consultas y proyectos',
    tables: [
      {
        table: 'doa_consultas_entrantes',
        description: 'Consultas comerciales entrantes procesadas desde email y formularios.',
      },
      {
        table: 'doa_proyectos_generales',
        description: 'Registro maestro de proyectos y expedientes de ingenieria.',
      },
    ],
  },
  {
    name: 'Usuarios',
    tables: [
      {
        table: 'doa_usuarios',
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
        table: 'doa_chunks',
        description: 'Chunks indexados del corpus DOA para recuperación semántica.',
      },
    ],
  },
] as const

export type AllowedTable = (typeof TABLE_GROUPS)[number]['tables'][number]['table']

export type TableGroup = {
  name: string
  tables: Array<{
    table: AllowedTable
    description: string
    count: number
  }>
}

export const ALLOWED_TABLES = TABLE_GROUPS.flatMap((group) => group.tables.map((table) => table.table))

export const ALLOWED_TABLE_SET = new Set<string>(ALLOWED_TABLES)

export const RAG_TABLE_SET = new Set<AllowedTable>(['DocumentacionCertificacion', 'documents', 'doa_chunks'])
