// ⏸️ BASE DE DATOS DESCONECTADA - ver BASES-DE-DATOS.md para reconectar
import DatabasesClient from './DatabasesClient'
import { TABLE_GROUPS, type TableGroup, type AllowedTable } from '@/lib/databases'

export default async function DatabasesPage() {
  const tableGroups: TableGroup[] = TABLE_GROUPS.map((group) => ({
    name: group.name,
    tables: group.tables.map((t) => ({
      table: t.table as AllowedTable,
      description: t.description as string,
      count: 0,
    })),
  }))

  return <DatabasesClient tableGroups={tableGroups} />
}
