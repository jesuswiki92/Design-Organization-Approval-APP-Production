/**
 * ============================================================================
 * PAGINA SERVIDOR DE PROYECTOS HISTORICOS (LISTADO)
 * ============================================================================
 *
 * Esta page carga desde la base de data (Supabase) todos los projects
 * historicos de la empresa y los pasa al componente visual (client) para
 * que se muestren en pantalla como una table con buscador.
 *
 * QUE HACE:
 *   1. Se conecta a Supabase (base de data en la nube)
 *   2. Pide todos los registros de la table "doa_historical_projects"
 *   3. Los ordena por numero de project
 *   4. Envia esos data al componente visual HistoricalProjectsPageClient
 *
 * NOTA TECNICA: Este es un "Server Component" (componente de servidor).
 * Eso significa que el codigo se ejecuta en el servidor ANTES de que la
 * page llegue al navegador. Esto es mas rapido y seguro para cargar data.
 * ============================================================================
 */

// Funcion para conectarse a la base de data Supabase desde el servidor
import { createClient } from '@/lib/supabase/server'
import type { HistoricalProjectRow } from '@/types/database'

// Componente visual (del lado del client) que muestra la table de projects
import HistoricalProjectsPageClient from './HistoricalProjectsPageClient'

/**
 * Funcion primary de la page.
 * Se ejecuta en el servidor cada vez que alguien visita /historical-projects.
 */
export default async function ProyectosHistoricoPage() {
  // Paso 1: Conectar con Supabase
  const supabase = await createClient()

  // Paso 2: Pedir todos los projects historicos, ordenados por numero de project
  const { data: projectRows, error } = await supabase
    .from('doa_historical_projects')
    .select('*')
    .order('project_number', { ascending: true })

  // Si hay un error de base de data, lo registramos en la consola del servidor
  if (error) {
    console.error('Error cargando projects historicos desde doa_historical_projects:', error)
  }

  // Si no llegan data, usamos una lista vacia para evitar errores
  const projects: HistoricalProjectRow[] = projectRows ?? []

  // Paso 3: Pasar los projects al componente visual que los muestra en pantalla
  return <HistoricalProjectsPageClient projects={projects} />
}
