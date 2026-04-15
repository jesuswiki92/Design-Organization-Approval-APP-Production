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

import { requireUserAction } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'

/**
 * Elimina un proyecto historico de la base de datos.
 * El CASCADE en las FK se encarga de borrar documentos y archivos asociados.
 * No elimina datos del cliente.
 *
 * TODO(RLS): authz no garantiza ownership — depende de RLS [audit Fase pre-prod]
 * doa_proyectos_historico no tiene owner_user_id; se registra un severity=warn
 * cuando un non-admin ejecuta la accion (ownership real se delega a RLS).
 */
export async function deleteProyectoHistorico(id: string) {
  const { user, supabase } = await requireUserAction()

  const isAdmin =
    (user.user_metadata as { role?: unknown } | null)?.role === 'admin'
  if (!isAdmin) {
    await logServerEvent({
      eventName: 'proyecto_historico.delete.non_admin',
      eventCategory: 'security',
      outcome: 'info',
      severity: 'warn',
      actorUserId: user.id,
      entityType: 'proyecto_historico',
      entityId: id,
      metadata: { reason: 'rls_pending' },
    })
  }

  const { error } = await supabase
    .from('doa_proyectos_historico')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)

  return { success: true }
}
