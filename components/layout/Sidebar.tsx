'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Plane, Wrench, Users, Database, ChevronLeft, ChevronRight, Shield, FileText,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/uiStore'

const navItems = [
  { href: '/home', icon: Home, label: 'Inicio' },
  { href: '/engineering/portfolio', icon: Plane, label: 'Proyectos' },
  { href: '/quotations', icon: FileText, label: 'Quotations' },
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
        'relative flex h-full shrink-0 flex-col border-r border-sky-100 bg-[linear-gradient(180deg,#f3f8ff_0%,#eef6ff_100%)] transition-all duration-200',
        sidebarCollapsed ? 'w-16' : 'w-52',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-3 border-b border-sky-100 px-4 py-4',
          sidebarCollapsed && 'justify-center px-0',
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#2563eb,#38bdf8)] shadow-sm">
          <Shield className="h-4 w-4 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">DOA Hub</p>
            <p className="truncate text-[10px] text-slate-500">Part 21J</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors',
                active
                  ? 'border border-sky-100 bg-white text-sky-700 shadow-[0_6px_18px_rgba(148,163,184,0.12)]'
                  : 'text-slate-500 hover:bg-white/80 hover:text-slate-950',
                sidebarCollapsed && 'justify-center px-0',
              )}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-sky-700' : '')} />
              {!sidebarCollapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-sky-200 bg-white text-slate-500 shadow-sm transition-colors hover:text-slate-950"
      >
        {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  )
}
