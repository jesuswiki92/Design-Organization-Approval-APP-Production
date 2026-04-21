'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import { trackUiEvent } from '@/lib/observability/client'

export function RouteViewTracker({ scope }: { scope: 'auth' | 'dashboard' }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastTrackedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname) return

    const query = searchParams?.toString() ?? ''
    const routeKey = query ? `${pathname}?${query}` : pathname
    if (lastTrackedRef.current === routeKey) return

    lastTrackedRef.current = routeKey

    void trackUiEvent({
      eventName: 'app.page_view',
      eventCategory: 'navigation',
      outcome: 'info',
      route: pathname,
      metadata: {
        scope,
        has_query_string: Boolean(query),
      },
    })
  }, [pathname, scope, searchParams])

  return null
}
