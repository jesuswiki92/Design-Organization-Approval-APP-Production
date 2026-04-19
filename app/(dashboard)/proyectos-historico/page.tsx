/**
 * ============================================================================
 * PAGINA SERVIDOR DE PROYECTOS HISTORICOS (LISTADO)
 * ============================================================================
 *
 * Esta pagina carga desde la base de datos (Supabase) todos los proyectos
 * historicos de la empresa y los pasa al componente visual (cliente) para
 * que se muestren en pantalla como una tabla con buscador.
 *
 * QUE HACE:
 *   1. Se conecta a Supabase (base de datos en la nube)
 *   2. Pide todos los registros de la tabla "proyectos_historico"
 *   3. Los ordena por numero de proyecto
 *   4. Envia esos datos al componente visual ProyectosHistoricoPageClient
 *
 * NOTA TECNICA: Este es un "Server Component" (componente de servidor).
 * Eso significa que el codigo se ejecuta en el servidor ANTES de que la
 * pagina llegue al navegador. Esto es mas rapido y seguro para cargar datos.
 * ============================================================================
 */

// Funcion para conectarse a la base de datos Supabase desde el servidor
import { createClient } from '@/lib/supabase/server'
import type { ProyectoHistoricoRow } from '@/types/database'

// Componente visual (del lado del cliente) que muestra la tabla de proyectos
import ProyectosHistoricoPageClient from './ProyectosHistoricoPageClient'

/**
 * Funcion principal de la pagina.
 * Se ejecuta en el servidor cada vez que alguien visita /proyectos-historico.
 */
export default async function ProyectosHistoricoPage() {
  // Paso 1: Conectar con Supabase
  const supabase = await createClient()

  // Paso 2: Pedir todos los proyectos historicos, ordenados por numero de proyecto
  const { data: projectRows, error } = await supabase
    .from('proyectos_historico')
    .select('*')
    .order('numero_proyecto', { ascending: true })

  // Si hay un error de base de datos, lo registramos en la consola del servidor
  if (error) {
    console.error('Error cargando proyectos historicos desde proyectos_historico:', error)
  }

  // Si no llegan datos, usamos una lista vacia para evitar errores
  const projects: ProyectoHistoricoRow[] = projectRows ?? []

  // Paso 3: Pasar los proyectos al componente visual que los muestra en pantalla
  return <ProyectosHistoricoPageClient projects={projects} />
}
