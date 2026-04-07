/**
 * ============================================================================
 * PAGINA SERVIDOR DE AERONAVES (LISTADO)
 * ============================================================================
 *
 * Esta pagina carga desde la base de datos (Supabase) todas las aeronaves
 * registradas en la organizacion y las pasa al componente visual (cliente)
 * para que se muestren en pantalla como una tabla agrupada por TCDS.
 *
 * QUE HACE:
 *   1. Se conecta a Supabase (base de datos en la nube)
 *   2. Pide todos los registros de la tabla "doa_aeronaves"
 *   3. Los ordena por codigo TCDS corto y modelo
 *   4. Envia esos datos al componente visual AeronavesPageClient
 *
 * NOTA TECNICA: Este es un "Server Component" (componente de servidor).
 * Eso significa que el codigo se ejecuta en el servidor ANTES de que la
 * pagina llegue al navegador. Esto es mas rapido y seguro para cargar datos.
 * ============================================================================
 */

// Funcion para conectarse a la base de datos Supabase desde el servidor
import { createClient } from '@/lib/supabase/server'
import type { AeronaveRow } from '@/types/database'

// Componente visual (del lado del cliente) que muestra la tabla de aeronaves
import AeronavesPageClient from './AeronavesPageClient'

/**
 * Funcion principal de la pagina.
 * Se ejecuta en el servidor cada vez que alguien visita /aeronaves.
 */
export default async function AeronavesPage() {
  // Paso 1: Conectar con Supabase
  const supabase = await createClient()

  // Paso 2: Pedir todas las aeronaves, ordenadas por TCDS y modelo
  const { data: aeronaveRows, error } = await supabase
    .from('doa_aeronaves')
    .select('*')
    .order('tcds_code_short', { ascending: true })
    .order('modelo', { ascending: true })

  // Si hay un error de base de datos, lo registramos en la consola del servidor
  if (error) {
    console.error('Error cargando aeronaves desde doa_aeronaves:', error)
  }

  // Si no llegan datos, usamos una lista vacia para evitar errores
  const aeronaves: AeronaveRow[] = aeronaveRows ?? []

  // Paso 3: Pasar las aeronaves al componente visual que las muestra en pantalla
  return <AeronavesPageClient aeronaves={aeronaves} />
}
