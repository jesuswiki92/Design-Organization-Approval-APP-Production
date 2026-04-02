import { createClient } from '@/lib/supabase/server'
import type { Cliente, ClienteContacto, ClienteWithContactos } from '@/types/database'
import ClientsPageClient from './ClientsPageClient'

export default async function ClientsPage() {
  const supabase = await createClient()
  const [{ data: clientRows, error: clientError }, { data: contactRows, error: contactError }] =
    await Promise.all([
      supabase
        .from('doa_clientes_datos_generales')
        .select('*')
        .order('nombre', { ascending: true }),
      supabase
        .from('doa_clientes_contactos')
        .select('*')
        .order('es_principal', { ascending: false })
        .order('activo', { ascending: false })
        .order('created_at', { ascending: true }),
    ])

  if (clientError) {
    console.error('Error cargando clientes desde doa_clientes_datos_generales:', clientError)
  }

  if (contactError) {
    console.error('Error cargando contactos desde doa_clientes_contactos:', contactError)
  }

  const clients: Cliente[] = clientRows ?? []
  const contacts: ClienteContacto[] = contactRows ?? []
  const contactsByClientId = contacts.reduce<Record<string, ClienteContacto[]>>((acc, contact) => {
    if (!acc[contact.cliente_id]) {
      acc[contact.cliente_id] = []
    }

    acc[contact.cliente_id].push(contact)
    return acc
  }, {})

  const clientsWithContacts: ClienteWithContactos[] = clients.map((client) => ({
    ...client,
    contactos: contactsByClientId[client.id] ?? [],
  }))

  return <ClientsPageClient clients={clientsWithContacts} />
}
