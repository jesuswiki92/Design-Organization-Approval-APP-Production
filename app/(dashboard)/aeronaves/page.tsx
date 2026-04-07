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

// Componente visual (del lado del cliente) que muestra la tabla de aeronaves
import AeronavesPageClient from './AeronavesPageClient'

/**
 * Estructura de datos de una aeronave.
 * Cada campo corresponde a una columna de la tabla "doa_aeronaves"
 * en Supabase.
 */
export interface AeronaveRow {
  id: string                        // Identificador unico del registro
  tcds_code: string                 // Codigo TCDS completo (ej: "EASA.A.064")
  tcds_code_short: string           // Codigo TCDS abreviado (ej: "A.064")
  tcds_issue: string | null         // Numero de edicion del TCDS
  tcds_date: string | null          // Fecha de emision del TCDS
  fabricante: string | null         // Fabricante de la aeronave (ej: "Airbus")
  pais: string | null               // Pais del fabricante (ej: "France")
  tipo: string | null               // Tipo de aeronave (ej: "Aeroplane")
  modelo: string | null             // Modelo especifico (ej: "A320-214")
  motor: string | null              // Motor instalado (ej: "CFM56-5B4")
  mtow_kg: number | null            // Peso maximo al despegue en kg
  mlw_kg: number | null             // Peso maximo al aterrizaje en kg
  regulacion_base: string | null    // Regulacion de certificacion (ej: "CS-25")
  categoria: string | null          // Categoria de la aeronave
  msn_elegibles: string | null      // MSN elegibles (puede ser una lista larga)
  notas: string | null              // Notas adicionales
  created_at: string                // Fecha de creacion del registro
}

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
