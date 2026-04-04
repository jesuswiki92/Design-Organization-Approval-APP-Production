/**
 * ============================================================================
 * ACCIONES DE SERVIDOR PARA PROYECTOS HISTORICOS
 * ============================================================================
 *
 * Acciones que se ejecutan en el servidor para operaciones de escritura
 * sobre la tabla doa_proyectos_historico.
 *
 * NOTA: Las foreign keys tienen CASCADE DELETE configurado, por lo que
 * al eliminar un proyecto historico se eliminan automaticamente sus
 * documentos (doa_proyectos_historico_documentos) y archivos
 * (doa_proyectos_historico_archivos). NO se elimina el cliente
 * (doa_clientes_datos_generales).
 * ============================================================================
 */

'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Elimina un proyecto historico de la base de datos.
 * El CASCADE en las FK se encarga de borrar documentos y archivos asociados.
 * No elimina datos del cliente.
 */
export async function deleteProyectoHistorico(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('doa_proyectos_historico')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)

  return { success: true }
}
