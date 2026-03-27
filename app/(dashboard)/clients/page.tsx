import { createClient } from '@/lib/supabase/server'
import type { Cliente, ClienteContacto, ClienteWithContactos } from '@/types/database'
import ClientsPageClient from './ClientsPageClient'

export default async function ClientsPage() {
  const supabase = await createClient()

  const [{ data: clientesRaw }, { data: contactosRaw }] = await Promise.all([
    supabase
      .from('doa_clientes_datos_generales')
      .select('*')
      .order('nombre', { ascending: true }),
    supabase
      .from('doa_clientes_contactos')
      .select('*')
      .eq('activo', true),
  ])

  const clientes: Cliente[] = clientesRaw ?? []
  const contactos: ClienteContacto[] = contactosRaw ?? []

  // Group contacts by cliente_id
  const contactosByCliente = contactos.reduce<Record<string, ClienteContacto[]>>((acc, c) => {
    if (!acc[c.cliente_id]) acc[c.cliente_id] = []
    acc[c.cliente_id].push(c)
    return acc
  }, {})

  const clientesWithContactos: ClienteWithContactos[] = clientes.map((cliente) => ({
    ...cliente,
    contactos: contactosByCliente[cliente.id] ?? [],
  }))

  return <ClientsPageClient clients={clientesWithContactos} />
}
