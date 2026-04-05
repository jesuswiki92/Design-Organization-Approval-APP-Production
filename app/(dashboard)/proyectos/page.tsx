/**
 * ============================================================================
 * PAGINA SERVIDOR DE PROYECTOS ACTIVOS
 * ============================================================================
 *
 * Pagina principal del modulo de Proyectos activos. Se encarga de cargar
 * los proyectos desde la tabla doa_proyectos en Supabase y
 * pasarlos al componente visual interactivo (ProyectosClient).
 *
 * Los proyectos cerrados se excluyen para mostrar solo los que estan en curso.
 *
 * NOTA TECNICA: La consulta se ejecuta en el servidor y los datos se pasan
 * como props al componente cliente para interactividad.
 * ============================================================================
 */

import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import type { Proyecto } from '@/types/database'
import { ProyectosClient } from './ProyectosClient'

// Forzar que la pagina se regenere en cada visita (sin cache)
export const dynamic = 'force-dynamic'

/**
 * Funcion principal de la pagina de Proyectos.
 * Se ejecuta en el servidor cada vez que alguien visita /proyectos.
 */
export default async function ProyectosPage() {
  const supabase = await createClient()

  // Cargar proyectos activos desde doa_proyectos
  // Se excluyen los cerrados para mostrar solo proyectos en curso
  const { data, error } = await supabase
    .from('doa_proyectos')
    .select('*')
    .not('estado', 'in', '("cerrado")')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(
      'Error cargando proyectos desde doa_proyectos:',
      error,
    )
  }

  const proyectos = (data ?? []) as Proyecto[]

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      {/* Barra superior con titulo de la seccion */}
      <TopBar title="Proyectos" subtitle="Proyectos activos de ingenieria" />

      {/* Componente interactivo con las vistas de tablero y lista */}
      <ProyectosClient initialProyectos={proyectos} />
    </div>
  )
}
