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
    name: 'Proyectos',
    tables: [
      {
        table: 'doa_proyectos_generales',
        description: 'Registro maestro de proyectos y expedientes de ingenieria.',
      },
      {
        table: 'doa_proyectos_documentos',
        description: 'Documentos vinculados al desarrollo y certificacion de proyectos.',
      },
      {
        table: 'doa_proyectos_hitos',
        description: 'Hitos planificados y completados para el seguimiento del proyecto.',
      },
      {
        table: 'doa_proyectos_tareas',
        description: 'Tareas operativas y tecnicas asignadas dentro de cada proyecto.',
      },
      {
        table: 'doa_solicitudes',
        description: 'Solicitudes de trabajo, cambios o soporte recibidas por la organizacion.',
      },
      {
        table: 'doa_ofertas',
        description: 'Ofertas comerciales y propuestas emitidas para nuevas oportunidades.',
      },
    ],
  },
  {
    name: 'Aeronaves',
    tables: [
      {
        table: 'doa_aeronaves_modelos',
        description: 'Catalogo de fabricantes, familias y modelos de aeronaves.',
      },
      {
        table: 'doa_aeronaves_registro',
        description: 'Registro operativo de aeronaves, matriculas y configuraciones.',
      },
      {
        table: 'doa_aeronaves_tcds',
        description: 'Referencias TCDS y datos de certificacion asociados a modelos.',
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

export const RAG_TABLE_SET = new Set<AllowedTable>(['DocumentacionCertificacion', 'documents'])
