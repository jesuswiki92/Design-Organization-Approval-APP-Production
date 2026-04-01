import 'server-only'

import { cache } from 'react'

import { isMissingSchemaError } from '@/lib/supabase/errors'
import { createClient } from '@/lib/supabase/server'
import type { WorkflowStateConfigRow, WorkflowStateScope } from '@/types/database'

export const getWorkflowStateConfigRows = cache(
  async (scopes: WorkflowStateScope[]): Promise<WorkflowStateConfigRow[]> => {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('doa_workflow_state_config')
        .select(
          'id, scope, state_code, label, short_label, description, color_token, sort_order, is_system, is_active, created_at, updated_at',
        )
        .in('scope', scopes)
        .order('scope', { ascending: true })
        .order('sort_order', { ascending: true })

      if (error) {
        if (!isMissingSchemaError(error)) {
          console.error('Error cargando workflow state config:', error)
        }

        return []
      }

      return (data ?? []) as WorkflowStateConfigRow[]
    } catch (error) {
      console.error('Unexpected workflow state config error:', error)
      return []
    }
  },
)
