import { createClient } from '@/lib/supabase/server'
import type { Cliente, ClienteContacto, ClienteWithContactos } from '@/types/database'
import ClientsPageClient from './ClientsPageClient'

export default async function ClientsPage() {
  const supabase = await createClient()

  let clientesRaw: Cliente[] | null = null
  let contactosRaw: ClienteContacto[] | null = null

  try {
    const [{ data: cData, error: clientesError }, { data: ctData, error: contactosError }] =
      await Promise.all([
        supabase
          .from('doa_clientes_datos_generales')
          .select('*')
          .order('nombre', { ascending: true }),
        supabase.from('doa_clientes_contactos').select('*').eq('activo', true),
      ])

    if (clientesError) console.error('Error fetching doa_clientes_datos_generales:', clientesError)
    if (contactosError) console.error('Error fetching doa_clientes_contactos:', contactosError)

    clientesRaw = cData as Cliente[] | null
    contactosRaw = ctData as ClienteContacto[] | null
  } catch (err) {
    console.error('Unexpected error fetching clients data:', err)
  }

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
