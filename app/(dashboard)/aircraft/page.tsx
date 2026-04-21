/**
 * ============================================================================
 * PAGINA SERVIDOR DE AERONAVES (LISTADO)
 * ============================================================================
 *
 * Esta page carga desde la base de data (Supabase) todas las aircraft
 * registradas en la organizacion y las pasa al componente visual (client)
 * para que se muestren en pantalla como una table agrupada por TCDS.
 *
 * QUE HACE:
 *   1. Se conecta a Supabase (base de data en la nube)
 *   2. Pide todos los registros de la table "doa_aircraft"
 *   3. Los ordena por codigo TCDS corto y model
 *   4. Envia esos data al componente visual AircraftPageClient
 *
 * NOTA TECNICA: Este es un "Server Component" (componente de servidor).
 * Eso significa que el codigo se ejecuta en el servidor ANTES de que la
 * page llegue al navegador. Esto es mas rapido y seguro para cargar data.
 * ============================================================================
 */

// Funcion para conectarse a la base de data Supabase desde el servidor
import { createClient } from '@/lib/supabase/server'
import type { AircraftRow } from '@/types/database'

// Componente visual (del lado del client) que muestra la table de aircraft
import AircraftPageClient from './AircraftPageClient'

/**
 * Funcion primary de la page.
 * Se ejecuta en el servidor cada vez que alguien visita /aircraft.
 */
export default async function AeronavesPage() {
  // Paso 1: Conectar con Supabase
  const supabase = await createClient()

  // Paso 2: Pedir todas las aircraft, ordenadas por TCDS y model
  const { data: aeronaveRows, error } = await supabase
    .from('doa_aircraft')
    .select('*')
    .order('tcds_code_short', { ascending: true })
    .order('model', { ascending: true })

  // Si hay un error de base de data, lo registramos en la consola del servidor
  if (error) {
    console.error('Error cargando aircraft desde doa_aircraft:', error)
  }

  // Si no llegan data, usamos una lista vacia para evitar errores
  const aircraft: AircraftRow[] = aeronaveRows ?? []

  // Paso 3: Pasar las aircraft al componente visual que las muestra en pantalla
  return <AircraftPageClient aircraft={aircraft} />
}
