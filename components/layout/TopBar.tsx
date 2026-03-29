'use client'

import Link from 'next/link'
import { Search, Bell, Bot, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface TopBarProps {
  title: string
  subtitle?: string
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-sky-100 bg-white/85 px-6 backdrop-blur-sm">
      <div>
        <h1 className="text-base font-semibold text-slate-950">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        <button className="flex w-52 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-500 transition-colors hover:border-sky-200 hover:text-slate-950">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs">Buscar...</span>
          <kbd className="ml-auto rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-400 shadow-sm">⌘K</kbd>
        </button>

        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-sky-50 hover:text-slate-950">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
        </button>

        <Link
          href="/tools/experto"
          className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100"
        >
          <Bot className="h-3.5 w-3.5" />
          <span>Experto</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
