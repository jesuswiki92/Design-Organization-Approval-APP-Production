'use client'

/**
 * ============================================================================
 * localStorage invalidation via Supabase Realtime (Block 5 / Item J — scaffold)
 * ============================================================================
 *
 * Opt-in helper: a client component can subscribe to INSERT/UPDATE/DELETE events
 * on a Supabase table and run a callback (typically "drop my localStorage cache
 * for this resource and refetch"). Returns an unsubscribe function.
 *
 * Not wired into any existing component yet — callers opt in.
 *
 * Usage pattern:
 *
 *   'use client'
 *   import { subscribeToTableChanges } from '@/lib/realtime/local-cache'
 *
 *   useEffect(() => {
 *     const off = subscribeToTableChanges('doa_proyectos', () => {
 *       localStorage.removeItem('portfolio-cache-v1')
 *       router.refresh()
 *     })
 *     return off
 *   }, [])
 *
 * Assumes the table has Realtime enabled server-side. If not, the subscription
 * silently never fires.
 */

import { createClient } from '@/lib/supabase/client'

/**
 * Subscribe to all changes (INSERT/UPDATE/DELETE) on `table` in the `public`
 * schema. `onChange` is called on every event — callers are responsible for
 * debouncing or filtering if they care about specific rows.
 *
 * @returns an unsubscribe function safe to call in a useEffect cleanup.
 */
export function subscribeToTableChanges(
  table: string,
  onChange: () => void,
): () => void {
  const supabase = createClient()
  const channelName = `local-cache:${table}:${Math.random().toString(36).slice(2, 8)}`

  const channel = supabase
    .channel(channelName)
    .on(
      // Supabase Realtime "postgres_changes" event type.
      'postgres_changes' as never,
      { event: '*', schema: 'public', table },
      () => {
        try {
          onChange()
        } catch (err) {
          console.error(
            `local-cache: onChange handler threw for ${table}:`,
            err,
          )
        }
      },
    )
    .subscribe()

  return () => {
    try {
      supabase.removeChannel(channel)
    } catch (err) {
      console.error(`local-cache: failed to unsubscribe from ${table}:`, err)
    }
  }
}
