/**
 * ============================================================================
 * AI response cache (Block 5 / Item I — scaffold only)
 * ============================================================================
 *
 * Two-tier cache for expensive AI endpoint responses:
 *   - In-memory `Map` with TTL (L1, per-process, lost on restart).
 *   - Supabase table `ai_response_cache` for cross-process persistence (L2).
 *
 * Keys are caller-chosen strings. Values are opaque strings (typically JSON).
 *
 * Usage (opt-in per endpoint):
 *
 *   import { getCachedResponse, setCachedResponse } from '@/lib/ai/cache'
 *
 *   const cacheKey = `suggest-compliance:${sha256(prompt + model)}`
 *   const cached = await getCachedResponse(cacheKey)
 *   if (cached) return Response.json(JSON.parse(cached))
 *
 *   const fresh = await callAI(...)
 *   await setCachedResponse(cacheKey, JSON.stringify(fresh), 60 * 60) // 1h
 *   return Response.json(fresh)
 *
 * Nothing is wired up yet — endpoints opt in individually.
 */

import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

const CACHE_TABLE = 'ai_response_cache'

type MemEntry = {
  value: string
  expiresAtMs: number
}

// Module-level L1 cache. Cleared on process restart. Bounded only by usage —
// callers should pick reasonable TTLs.
const memCache = new Map<string, MemEntry>()

function nowMs(): number {
  return Date.now()
}

/**
 * Look up a cached value by key. Returns null if missing or expired.
 * Checks L1 first, then L2. A hit in L2 is promoted to L1.
 */
export async function getCachedResponse(key: string): Promise<string | null> {
  // L1
  const hit = memCache.get(key)
  if (hit && hit.expiresAtMs > nowMs()) {
    return hit.value
  }
  if (hit) {
    memCache.delete(key)
  }

  // L2
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from(CACHE_TABLE as never)
      .select('value, expires_at')
      .eq('key', key as never)
      .maybeSingle<{ value: string; expires_at: string }>()

    if (error || !data) return null

    const expiresAtMs = new Date(data.expires_at).getTime()
    if (Number.isNaN(expiresAtMs) || expiresAtMs <= nowMs()) {
      return null
    }

    // Promote to L1.
    memCache.set(key, { value: data.value, expiresAtMs })
    return data.value
  } catch (err) {
    console.error('ai-cache: L2 read failed:', err)
    return null
  }
}

/**
 * Persist a cache entry. Writes L1 immediately and L2 upsert in parallel.
 * `ttlSeconds` must be a positive integer; callers that pass <= 0 get a no-op.
 */
export async function setCachedResponse(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> {
  if (!key || ttlSeconds <= 0) return

  const expiresAtMs = nowMs() + ttlSeconds * 1000
  memCache.set(key, { value, expiresAtMs })

  try {
    const admin = createAdminClient()
    const expiresAtIso = new Date(expiresAtMs).toISOString()
    const { error } = await admin
      .from(CACHE_TABLE as never)
      .upsert(
        {
          key,
          value,
          expires_at: expiresAtIso,
        } as never,
        { onConflict: 'key' },
      )

    if (error) {
      console.error('ai-cache: L2 write failed:', error)
    }
  } catch (err) {
    console.error('ai-cache: L2 write exception:', err)
  }
}

/**
 * Purge expired entries from both tiers. Intended to be called from a cron
 * job or manual cleanup script — no automatic wiring yet.
 * Returns the number of L2 rows deleted.
 */
export async function cleanupExpired(): Promise<number> {
  const now = nowMs()
  for (const [key, entry] of memCache) {
    if (entry.expiresAtMs <= now) memCache.delete(key)
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from(CACHE_TABLE as never)
      .delete()
      .lt('expires_at', new Date(now).toISOString())
      .select('key')

    if (error) {
      console.error('ai-cache: cleanup L2 failed:', error)
      return 0
    }
    return Array.isArray(data) ? data.length : 0
  } catch (err) {
    console.error('ai-cache: cleanup L2 exception:', err)
    return 0
  }
}
