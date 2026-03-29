import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/server'
import type {
  Cliente,
  ConsultaEntrante,
  Oferta,
  OfertaConRelaciones,
  Proyecto,
} from '@/types/database'

import { isIncomingQueryPending, toIncomingQuery } from './incoming-queries'
import { QuotationsClient } from './QuotationsClient'

function isMissingSchemaError(message: string) {
  return (
    message.includes('Could not find the table') ||
    message.includes('column') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  )
}

function buildIncomingQueriesSchemaBanner(message: string) {
  if (message.includes('estado')) {
    return {
      tone: 'warning' as const,
      title: 'Bandeja de consultas entrantes en modo degradado',
      message:
        'La columna `estado` aun no existe en `public.doa_consultas_entrantes`. Se esta mostrando un fallback para que la pagina siga cargando, pero la migracion de Supabase sigue pendiente.',
    }
  }

  return {
    tone: 'warning' as const,
    title: 'Esquema pendiente en consultas entrantes',
    message:
      'La tabla `public.doa_consultas_entrantes` no coincide con el esquema esperado. Aplica la migracion de Supabase pendiente para restaurar el comportamiento completo.',
  }
}

export default async function QuotationsPage() {
  const supabase = await createClient()

  const consultasQuery = await supabase
    .from('doa_consultas_entrantes')
    .select('*')
    .or('estado.is.null,estado.eq.nuevo')
    .order('created_at', { ascending: false })
    .limit(12)

  let consultasData = consultasQuery.data
  let consultasError = consultasQuery.error
  let incomingQueriesBanner:
    | {
        tone: 'warning' | 'error'
        title: string
        message: string
      }
    | null = null

  if (consultasError && isMissingSchemaError(consultasError.message)) {
    incomingQueriesBanner = buildIncomingQueriesSchemaBanner(consultasError.message)
    const fallbackQuery = await supabase
      .from('doa_consultas_entrantes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(12)

    consultasData = fallbackQuery.data
    consultasError = fallbackQuery.error

    if (consultasError) {
      incomingQueriesBanner = {
        tone: 'error',
        title: 'No se pudo cargar consultas entrantes',
        message:
          'La tabla `public.doa_consultas_entrantes` sigue sin responder con el esquema esperado. Aplica la migracion de Supabase pendiente y vuelve a cargar la pagina.',
      }
    }
  }

  const [
    { data: ofertasData, error: ofertasError },
    { data: clientesData, error: clientesError },
    { data: proyectosData, error: proyectosError },
  ] = await Promise.all([
    supabase.from('doa_ofertas').select('*').order('created_at', { ascending: false }),
    supabase.from('doa_clientes_datos_generales').select('*'),
    supabase.from('doa_proyectos_generales').select('*').not('oferta_id', 'is', null),
  ])

  if (ofertasError) console.error('Error fetching doa_ofertas:', ofertasError)
  if (clientesError) console.error('Error fetching doa_clientes_datos_generales:', clientesError)
  if (proyectosError) console.error('Error fetching doa_proyectos_generales for quotations:', proyectosError)
  if (consultasError) console.error('Error fetching doa_consultas_entrantes:', consultasError)

  const clientes = new Map(
    ((clientesData ?? []) as Cliente[]).map((cliente) => [cliente.id, cliente]),
  )

  const proyectosPorOferta = new Map(
    ((proyectosData ?? []) as (Proyecto & { oferta_id?: string | null })[])
      .filter((proyecto) => proyecto.oferta_id)
      .map((proyecto) => [proyecto.oferta_id as string, proyecto]),
  )

  const quotations: OfertaConRelaciones[] = ((ofertasData ?? []) as Oferta[]).map((oferta) => ({
    ...oferta,
    cliente: oferta.cliente_id ? clientes.get(oferta.cliente_id) ?? null : null,
    proyecto_relacionado: proyectosPorOferta.get(oferta.id) ?? null,
  }))

  const incomingQueries = ((consultasData ?? []) as ConsultaEntrante[])
    .map(toIncomingQuery)
    .filter(isIncomingQueryPending)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_42%,#f8fafc_100%)]">
      <TopBar title="Quotations" subtitle="Seguimiento comercial previo al proyecto" />
      <QuotationsClient
        quotations={quotations}
        incomingQueries={incomingQueries}
        incomingQueriesBanner={incomingQueriesBanner}
      />
    </div>
  )
}
