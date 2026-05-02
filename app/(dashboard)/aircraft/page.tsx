/**
 * ============================================================================
 * AIRCRAFT CATALOG — server page
 * ============================================================================
 * Reads the master catalog of certified types (`public.doa_aircraft`) and
 * hands the rows down to `AircraftCatalogClient` for interactive filtering.
 *
 * The table is small (a few hundred rows max) and one row per certified type
 * variant, so we fetch everything once and let the client filter in-memory.
 * ============================================================================
 */

import { supabaseServer } from '@/lib/supabase/server'
import type { Aircraft } from '@/types/database'

import AircraftCatalogClient from './AircraftCatalogClient'

export const dynamic = 'force-dynamic'

async function loadAircraft(): Promise<Aircraft[]> {
  const { data, error } = await supabaseServer
    .from('doa_aircraft')
    .select(
      `
      id,
      tcds_code,
      tcds_code_short,
      tcds_issue,
      tcds_date,
      tcds_pdf_url,
      manufacturer,
      country,
      type,
      model,
      engine,
      mtow_kg,
      mlw_kg,
      base_regulation,
      category,
      eligible_msn,
      notes,
      created_at,
      updated_at
      `,
    )
    .order('manufacturer', { ascending: true })
    .order('type', { ascending: true })
    .order('model', { ascending: true })

  if (error) {
    console.error('aircraft page: error fetching catalog:', error)
    return []
  }

  return (data ?? []) as unknown as Aircraft[]
}

export default async function AircraftPage() {
  const aircraft = await loadAircraft()
  return <AircraftCatalogClient aircraft={aircraft} />
}
