import { requireUserApi } from '@/lib/auth/require-user'
import { isMissingSchemaError } from '@/lib/supabase/errors'

export const runtime = 'nodejs'

function jsonResponse(status: number, error: string) {
  return Response.json({ error }, { status })
}

// TODO(RLS): authz no garantiza ownership — depende de RLS [audit Fase pre-prod]
//
// Borra un proyecto de doa_proyectos. Las tablas hijas NO tienen ON DELETE
// CASCADE, asi que hacemos cleanup explicito antes del borrado principal:
//   1. doa_proyectos_embeddings (FK: project_number text, sin cascade)
//   2. doa_conteo_horas_proyectos (FK: proyecto_id uuid, creada fuera de migrations)
// Si cualquiera de estos cleanups falla, devolvemos 500 con un mensaje claro;
// no lo silenciamos porque dejaria el proyecto sin borrar con hijos huerfanos.
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUserApi()
    if (auth instanceof Response) return auth
    const { supabase } = auth

    const { id } = await context.params

    if (!id) {
      return jsonResponse(400, 'Proyecto no válido.')
    }

    // 1) Obtener numero_proyecto para limpiar embeddings (FK por project_number text)
    const project = await supabase
      .from('doa_proyectos')
      .select('id, numero_proyecto')
      .eq('id', id)
      .maybeSingle()

    if (project.error) {
      if (isMissingSchemaError(project.error)) {
        return jsonResponse(
          409,
          'La tabla public.doa_proyectos no coincide con el esquema esperado. Aplica la migración pendiente antes de borrar proyectos.',
        )
      }
      return jsonResponse(
        500,
        `No se pudo consultar el proyecto: ${project.error.message}`,
      )
    }

    if (!project.data) {
      return jsonResponse(404, 'El proyecto indicado no existe o ya fue eliminado.')
    }

    // 2) Cleanup de doa_proyectos_embeddings por project_number.
    //    Si la tabla no existe todavia, ignoramos el error (entorno dev sin la migración).
    const embeddingsCleanup = await supabase
      .from('doa_proyectos_embeddings')
      .delete()
      .eq('project_number', project.data.numero_proyecto)

    if (embeddingsCleanup.error && !isMissingSchemaError(embeddingsCleanup.error)) {
      return jsonResponse(
        500,
        `No se pudo limpiar embeddings del proyecto: ${embeddingsCleanup.error.message}`,
      )
    }

    // 3) Cleanup de doa_conteo_horas_proyectos por proyecto_id.
    //    Idem: si no existe en este entorno, toleramos el missing-schema.
    const timeEntriesCleanup = await supabase
      .from('doa_conteo_horas_proyectos')
      .delete()
      .eq('proyecto_id', id)

    if (timeEntriesCleanup.error && !isMissingSchemaError(timeEntriesCleanup.error)) {
      return jsonResponse(
        500,
        `No se pudo limpiar el conteo de horas del proyecto: ${timeEntriesCleanup.error.message}`,
      )
    }

    // 4) Borrar el proyecto.
    const deletion = await supabase
      .from('doa_proyectos')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (deletion.error) {
      if (isMissingSchemaError(deletion.error)) {
        return jsonResponse(
          409,
          'La tabla public.doa_proyectos no coincide con el esquema esperado. Aplica la migración pendiente antes de borrar proyectos.',
        )
      }

      return jsonResponse(
        500,
        `No se pudo borrar el proyecto: ${deletion.error.message}`,
      )
    }

    if (!deletion.data) {
      return jsonResponse(404, 'El proyecto indicado no existe o ya fue eliminado.')
    }

    return Response.json({
      ok: true,
      id: deletion.data.id,
    })
  } catch (error) {
    console.error('proyecto DELETE error:', error)

    return jsonResponse(
      500,
      error instanceof Error ? error.message : 'Unexpected server error.',
    )
  }
}
