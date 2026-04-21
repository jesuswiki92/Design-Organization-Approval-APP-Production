/**
 * ============================================================================
 * PAGINA SERVIDOR DE CLIENTES
 * ============================================================================
 *
 * Esta page carga todos los clients y sus contacts desde la base de
 * data (Supabase) y los prepara para que el componente visual
 * (ClientsPageClient) los muestre en pantalla.
 *
 * QUE CARGA:
 *   1. Todos los clients de la table "doa_clients"
 *   2. Todos los contacts de la table "doa_client_contacts"
 *
 * PROCESAMIENTO:
 *   - Agrupa los contacts por client (usando client_id)
 *   - Combina cada client con sus contacts en un unico objeto
 *   - Pasa la lista completa al componente visual
 *
 * NOTA TECNICA: Las requests a Supabase se hacen en paralelo con
 * Promise.all para cargar mas rapido. Los contacts se priorizan
 * por: primary primero, is_active despues, date de creacion al final.
 * ============================================================================
 */

// Conexion a Supabase desde el servidor
import { createClient } from '@/lib/supabase/server'
// Tipos de data para clients y contacts
import type { Client, ClientContact, ClientWithContacts } from '@/types/database'
// Componente visual interactivo que muestra la table de clients
import ClientsPageClient from './ClientsPageClient'

/**
 * Funcion primary de la page de Clients.
 * Se ejecuta en el servidor cuando alguien visita /clients.
 */
export default async function ClientsPage() {
  const supabase = await createClient()

  // Paso 1: Cargar clients y contacts en paralelo
  const [{ data: clientRows, error: clientError }, { data: contactRows, error: contactError }] =
    await Promise.all([
      // Todos los clients ordenados por name
      supabase
        .from('doa_clients')
        .select('*')
        .order('name', { ascending: true }),
      // Todos los contacts, priorizando principales y activos
      supabase
        .from('doa_client_contacts')
        .select('*')
        .order('is_primary', { ascending: false })
        .order('active', { ascending: false })
        .order('created_at', { ascending: true }),
    ])

  // Registrar errores de base de data si los hay
  if (clientError) {
    console.error('Error cargando clients desde doa_clients:', clientError)
  }

  if (contactError) {
    console.error('Error cargando contacts desde doa_client_contacts:', contactError)
  }

  // Paso 2: Prepare data
  const clients: Client[] = clientRows ?? []
  const contacts: ClientContact[] = contactRows ?? []

  // Paso 3: Agrupar contacts por client (mapa de client_id -> [contacts])
  const contactsByClientId = contacts.reduce<Record<string, ClientContact[]>>((acc, contact) => {
    if (!acc[contact.client_id]) {
      acc[contact.client_id] = []
    }

    acc[contact.client_id].push(contact)
    return acc
  }, {})

  // Paso 4: Combinar cada client con sus contacts
  const clientsWithContacts: ClientWithContacts[] = clients.map((client) => ({
    ...client,
    contacts: contactsByClientId[client.id] ?? [],
  }))

  // Paso 5: Pasar todo al componente visual
  return <ClientsPageClient clients={clientsWithContacts} />
}
