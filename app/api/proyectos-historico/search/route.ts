import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return Response.json([])
  }

  const supabase = await createClient()
  const pattern = `%${q}%`

  const { data, error } = await supabase
    .from('doa_proyectos_historico')
    .select('id, numero_proyecto, titulo, descripcion, estado, aeronave, msn, cliente_nombre, anio, created_at')
    .or(`numero_proyecto.ilike.${pattern},titulo.ilike.${pattern},cliente_nombre.ilike.${pattern},aeronave.ilike.${pattern},msn.ilike.${pattern},descripcion.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(15)

  if (error) {
    console.error('Error searching proyectos historico:', error)
    return Response.json([], { status: 500 })
  }

  return Response.json(data ?? [])
}
