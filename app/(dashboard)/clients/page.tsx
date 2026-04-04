/**
 * ============================================================================
 * PAGINA SERVIDOR DE CLIENTES
 * ============================================================================
 *
 * Esta pagina carga todos los clientes y sus contactos desde la base de
 * datos (Supabase) y los prepara para que el componente visual
 * (ClientsPageClient) los muestre en pantalla.
 *
 * QUE CARGA:
 *   1. Todos los clientes de la tabla "doa_clientes_datos_generales"
 *   2. Todos los contactos de la tabla "doa_clientes_contactos"
 *
 * PROCESAMIENTO:
 *   - Agrupa los contactos por cliente (usando cliente_id)
 *   - Combina cada cliente con sus contactos en un unico objeto
 *   - Pasa la lista completa al componente visual
 *
 * NOTA TECNICA: Las consultas a Supabase se hacen en paralelo con
 * Promise.all para cargar mas rapido. Los contactos se priorizan
 * por: principal primero, activo despues, fecha de creacion al final.
 * ============================================================================
 */

// Conexion a Supabase desde el servidor
import { createClient } from '@/lib/supabase/server'
// Tipos de datos para clientes y contactos
import type { Cliente, ClienteContacto, ClienteWithContactos } from '@/types/database'
// Componente visual interactivo que muestra la tabla de clientes
import ClientsPageClient from './ClientsPageClient'

/**
 * Funcion principal de la pagina de Clientes.
 * Se ejecuta en el servidor cuando alguien visita /clients.
 */
export default async function ClientsPage() {
  const supabase = await createClient()

  // Paso 1: Cargar clientes y contactos en paralelo
  const [{ data: clientRows, error: clientError }, { data: contactRows, error: contactError }] =
    await Promise.all([
      // Todos los clientes ordenados por nombre
      supabase
        .from('doa_clientes_datos_generales')
        .select('*')
        .order('nombre', { ascending: true }),
      // Todos los contactos, priorizando principales y activos
      supabase
        .from('doa_clientes_contactos')
        .select('*')
        .order('es_principal', { ascending: false })
        .order('activo', { ascending: false })
        .order('created_at', { ascending: true }),
    ])

  // Registrar errores de base de datos si los hay
  if (clientError) {
    console.error('Error cargando clientes desde doa_clientes_datos_generales:', clientError)
  }

  if (contactError) {
    console.error('Error cargando contactos desde doa_clientes_contactos:', contactError)
  }

  // Paso 2: Preparar datos
  const clients: Cliente[] = clientRows ?? []
  const contacts: ClienteContacto[] = contactRows ?? []

  // Paso 3: Agrupar contactos por cliente (mapa de cliente_id -> [contactos])
  const contactsByClientId = contacts.reduce<Record<string, ClienteContacto[]>>((acc, contact) => {
    if (!acc[contact.cliente_id]) {
      acc[contact.cliente_id] = []
    }

    acc[contact.cliente_id].push(contact)
    return acc
  }, {})

  // Paso 4: Combinar cada cliente con sus contactos
  const clientsWithContacts: ClienteWithContactos[] = clients.map((client) => ({
    ...client,
    contactos: contactsByClientId[client.id] ?? [],
  }))

  // Paso 5: Pasar todo al componente visual
  return <ClientsPageClient clients={clientsWithContacts} />
}
