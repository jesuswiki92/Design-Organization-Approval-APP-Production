/**
 * ============================================================================
 * ACCIONES DE SERVIDOR PARA PROYECTOS HISTORICOS
 * ============================================================================
 *
 * Acciones que se ejecutan en el servidor para operaciones de escritura
 * sobre la table doa_historical_projects.
 *
 * NOTA: Las foreign keys tienen CASCADE DELETE configurado, por lo que
 * al eliminar un project historical se eliminan automaticamente sus
 * documents (doa_historical_project_documents) y archivos
 * (doa_historical_projects_archivos). NO se elimina el client
 * (doa_clients).
 * ============================================================================
 */

'use server'

import { requireUserAction } from '@/lib/auth/require-user'
import { logServerEvent } from '@/lib/observability/server'

/**
 * Elimina un project historical de la base de data.
 * El CASCADE en las FK se encarga de borrar documents y archivos asociados.
 * No elimina data del client.
 *
 * TODO(RLS): authz no garantiza ownership — depende de RLS [audit Fase pre-prod]
 * doa_historical_projects no tiene owner_user_id; se registra un severity=warn
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
    .from('doa_historical_projects')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)

  return { success: true }
}
