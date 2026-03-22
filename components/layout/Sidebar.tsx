'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Plane, Wrench, Users, Database, Settings, ChevronLeft, ChevronRight, Shield
} from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/home', icon: Home, label: 'Inicio' },
  { href: '/engineering/portfolio', icon: Plane, label: 'Engineering' },
  { href: '/tools', icon: Wrench, label: 'Tools' },
  { href: '/clients', icon: Users, label: 'Clientes' },
  { href: '/databases', icon: Database, label: 'Bases de datos' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full bg-[#0F1117] border-r border-[#2A2D3E] transition-all duration-200 shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-52'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-4 border-b border-[#2A2D3E]',
        sidebarCollapsed && 'justify-center px-0'
      )}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#6366F1] shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#E8E9F0] truncate">DOA Hub</p>
            <p className="text-[10px] text-[#6B7280] truncate">Part 21J</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors group',
                active
                  ? 'bg-[#6366F1]/15 text-[#6366F1]'
                  : 'text-[#6B7280] hover:text-[#E8E9F0] hover:bg-[#1A1D27]',
                sidebarCollapsed && 'justify-center px-0'
              )}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-[#6366F1]' : '')} />
              {!sidebarCollapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[#2A2D3E] py-3 px-2 space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm text-[#6B7280] hover:text-[#E8E9F0] hover:bg-[#1A1D27] transition-colors',
            sidebarCollapsed && 'justify-center px-0'
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!sidebarCollapsed && <span>Configuración</span>}
        </Link>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-[#1A1D27] border border-[#2A2D3E] flex items-center justify-center text-[#6B7280] hover:text-[#E8E9F0] transition-colors z-10"
      >
        {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  )
}
