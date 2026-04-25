/**
 * ============================================================================
 * PÁGINA SERVIDOR DE CLIENTES — leer de Supabase (doa_clients_v2 + doa_client_contacts_v2)
 * ============================================================================
 *
 * Solo lectura. Sin auth. Sin RLS.
 *
 * Las columnas reales en Supabase no coinciden con el TS shape `ClientWithContacts`
 * que espera el cliente — mapeamos con alias en el SELECT para no tocar tipos/UI:
 *   doa_clients_v2.cif_vat        -> vat_tax_id
 *   doa_clients_v2.active         -> is_active
 *   doa_client_contacts_v2.first_name -> name
 *   doa_client_contacts_v2.role       -> job_title
 *   doa_client_contacts_v2.active     -> is_active
 * ============================================================================
 */

import { supabaseServer } from '@/lib/supabase/server'
import type { ClientWithContacts } from '@/types/database'

import ClientsPageClient from './ClientsPageClient'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const { data, error } = await supabaseServer
    .from('doa_clients_v2')
    .select(
      `
      id,
      name,
      vat_tax_id:cif_vat,
      country,
      city,
      address,
      phone,
      website,
      is_active:active,
      notes,
      created_at,
      email_domain,
      client_type,
      contacts:doa_client_contacts_v2 (
        id,
        client_id,
        name:first_name,
        last_name,
        email,
        phone,
        job_title:role,
        is_primary,
        is_active:active,
        created_at
      )
    `,
    )
    .order('name', { ascending: true })

  if (error) {
    console.error('clients page: error fetching clients', error)
    return <ClientsPageClient clients={[]} />
  }

  const clients = (data ?? []) as unknown as ClientWithContacts[]
  return <ClientsPageClient clients={clients} />
}
