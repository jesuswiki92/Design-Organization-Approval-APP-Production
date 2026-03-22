'use client'

import { Search, Bell, Bot, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/store/uiStore'

interface TopBarProps {
  title: string
  subtitle?: string
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const router = useRouter()
  const supabase = createClient()
  const { openSidePanel } = useUIStore()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-[#0F1117] border-b border-[#2A2D3E] shrink-0">
      {/* Left: Page title */}
      <div>
        <h1 className="text-base font-semibold text-[#E8E9F0]">{title}</h1>
        {subtitle && <p className="text-xs text-[#6B7280]">{subtitle}</p>}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button className="flex items-center gap-2 bg-[#1A1D27] border border-[#2A2D3E] rounded-lg px-3 py-1.5 text-sm text-[#6B7280] hover:text-[#E8E9F0] hover:border-[#6366F1]/50 transition-colors w-52">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs">Buscar...</span>
          <kbd className="ml-auto text-[10px] bg-[#2A2D3E] px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>

        {/* Notifications */}
        <button className="relative w-8 h-8 flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#E8E9F0] hover:bg-[#1A1D27] transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#EF4444] rounded-full" />
        </button>

        {/* AI Expert */}
        <button
          onClick={() => openSidePanel('ai-expert')}
          className="flex items-center gap-1.5 bg-[#6366F1]/10 border border-[#6366F1]/30 hover:bg-[#6366F1]/20 text-[#6366F1] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        >
          <Bot className="w-3.5 h-3.5" />
          <span>AI Expert</span>
        </button>

        {/* Avatar / Logout */}
        <button
          onClick={handleLogout}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#EF4444] hover:bg-[#1A1D27] transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
