'use client'

import type { AppEventInput } from './shared'

const SESSION_STORAGE_KEY = 'doa.observability.session_id'

function getOrCreateSessionId() {
  if (typeof window === 'undefined') {
    return crypto.randomUUID()
  }

  const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (existing) return existing

  const nextId = crypto.randomUUID()
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, nextId)
  return nextId
}

export async function trackUiEvent(
  event: Omit<AppEventInput, 'source'> & { keepalive?: boolean },
) {
  const requestId = event.requestId ?? crypto.randomUUID()
  const sessionId = event.sessionId ?? getOrCreateSessionId()

  try {
    await fetch('/api/observability/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': requestId,
        'x-correlation-id': sessionId,
      },
      body: JSON.stringify({
        ...event,
        requestId,
        sessionId,
      }),
      credentials: 'same-origin',
      keepalive: event.keepalive ?? true,
    })
  } catch {
    // Observability nunca debe bloquear la UX.
  }
}
