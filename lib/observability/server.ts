import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

import { toEventRow, type AppEventInput } from './shared'

export async function logServerEvent(event: AppEventInput) {
  try {
    const admin = createAdminClient()
    const { error } = await admin
      .from('doa_app_events' as never)
      .insert(toEventRow(event) as never)

    if (error) {
      console.error('Observability insert failed:', error)
      return { ok: false as const, error }
    }

    return { ok: true as const }
  } catch (error) {
    console.error('Observability helper failed:', error)
    return { ok: false as const, error }
  }
}
