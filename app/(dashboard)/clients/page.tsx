import { createClient } from '@/lib/supabase/server'
import type { Cliente } from '@/types/database'
import ClientsPageClient from './ClientsPageClient'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('doa_clientes_datos_generales')
    .select('*')
    .order('nombre', { ascending: true })

  if (error) {
    console.error('Error cargando clientes desde doa_clientes_datos_generales:', error)
  }

  const clients: Cliente[] = data ?? []

  return <ClientsPageClient clients={clients} />
}
