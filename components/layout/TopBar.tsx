'use client'

/**
 * ============================================================================
 * TOPBAR — Warm Executive
 * ============================================================================
 * Barra superior con crumb serif-italic, buscador quieto y acceso a Expert.
 * Observabilidad (trackUiEvent) preservada en logout.
 * ============================================================================
 */

import Link from 'next/link'
import { Search, Bell, Bot, LogOut } from 'lucide-react'
import { trackUiEvent } from '@/lib/observability/client'
import { createClient } from '@/lib/supabase/client'
import { usePathname, useRouter } from 'next/navigation'

interface TopBarProps {
  title: string
  subtitle?: string
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      await trackUiEvent({
        eventName: 'auth.logout',
        eventCategory: 'auth',
        outcome: 'success',
        route: pathname,
        metadata: { source: 'topbar' },
      })

      router.push('/login')
      router.refresh()
    } catch (error) {
      await trackUiEvent({
        eventName: 'auth.logout',
        eventCategory: 'auth',
        outcome: 'failure',
        route: pathname,
        metadata: {
          source: 'topbar',
          error_name: error instanceof Error ? error.name : 'UnknownError',
        },
      })
    }
  }

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between border-b border-[color:var(--line)] px-6 backdrop-blur-sm"
      style={{ background: 'linear-gradient(180deg,rgba(251,250,247,0.92) 0%,rgba(245,243,238,0.92) 100%)' }}
    >
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="font-[family-name:var(--font-heading)] text-[18px] leading-none text-[color:var(--ink)]">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate font-[family-name:var(--font-heading)] text-[13px] italic text-[color:var(--ink-3)]">
            · {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          className="flex w-60 items-center gap-2 rounded-[10px] border border-[color:var(--line)] bg-[color:var(--paper-2)] px-3 py-1.5 text-sm text-[color:var(--ink-3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-colors hover:border-[color:var(--line-strong)]"
          type="button"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[13px]">Find anything…</span>
          <kbd className="ml-auto rounded bg-[color:var(--paper-3)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--ink-3)]">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-[9px] text-[color:var(--ink-3)] transition-colors hover:bg-[color:var(--paper-3)] hover:text-[color:var(--ink)]"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[color:var(--umber)]" />
        </button>

        <Link
          href="/tools/experto"
          className="flex items-center gap-1.5 rounded-[10px] border border-[color:var(--line-strong)] bg-[color:var(--paper-2)] px-3 py-1.5 text-[12px] font-medium text-[color:var(--ink)] shadow-[0_1px_0_rgba(74,60,36,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] transition-colors hover:bg-[color:var(--paper-3)]"
        >
          <Bot className="h-3.5 w-3.5" />
          <span>Expert</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[color:var(--ink-3)] transition-colors hover:bg-[color:var(--paper-3)] hover:text-[color:var(--err)]"
          title="Sign out"
          type="button"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
