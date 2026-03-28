import DatabasesClient from './DatabasesClient'
import { createClient } from '@/lib/supabase/server'
import { TABLE_GROUPS, type TableGroup } from '@/lib/databases'

export default async function DatabasesPage() {
  const supabase = await createClient()

  const countResults = await Promise.all(
    TABLE_GROUPS.flatMap((group) =>
      group.tables.map(async ({ table }) => {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })

        if (error) {
          console.error(`Error fetching count for ${table}:`, error)
        }

        return [table, count ?? 0] as const
      })
    )
  )

  const counts = new Map(countResults)

  const tableGroups: TableGroup[] = TABLE_GROUPS.map((group) => ({
    name: group.name,
    tables: group.tables.map((t) => ({
      table: t.table as AllowedTable,
      description: t.description as string,
      count: counts.get(t.table) ?? 0,
    })),
  }))

  return <DatabasesClient tableGroups={tableGroups} />
}
