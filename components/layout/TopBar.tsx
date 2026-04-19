'use client'

import Link from 'next/link'
import { Bot, LogOut } from 'lucide-react'
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
        metadata: {
          source: 'topbar',
        },
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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-sky-100 bg-white/85 px-6 backdrop-blur-sm">
      <div>
        <h1 className="text-base font-semibold text-[color:var(--ams-ink)]">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/tools/experto"
          className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-[color:var(--ams-navy)] transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ams-navy-light)]"
        >
          <Bot className="h-3.5 w-3.5" />
          <span>Experto</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ams-navy-light)]"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
