'use client'

/**
 * ============================================================================
 * SIDEBAR — Warm Executive (AMS client-branded slot)
 * ============================================================================
 * Rediseño basado en el prototipo DOA Redesign.html. Dos grupos etiquetados
 * ("Your work" / "Directory") con encabezado serif italic y status is_active
 * en papel blanco. El bloque de marca es el "client-branded slot" del diseño.
 * ============================================================================
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Plane, PlaneTakeoff, Wrench, Users, Database, ChevronLeft, ChevronRight, FileText, Clock3,
  Settings, type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/uiStore'

type NavItem = {
  href: string
  icon: LucideIcon
  label: string
  count?: string
}

// Decision sidebar (Sprint tablero-v2) mantenido: Quotations y Projects
// cada uno con una sola entrada y toggle Lista/Tablero dentro.
const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Your work',
    items: [
      { href: '/home', icon: Home, label: 'Home' },
      { href: '/engineering/portfolio', icon: Plane, label: 'Projects' },
      { href: '/historical-projects', icon: Clock3, label: 'History' },
      { href: '/quotations', icon: FileText, label: 'Quotations' },
    ],
  },
  {
    label: 'Directory',
    items: [
      { href: '/clients', icon: Users, label: 'Clients' },
      { href: '/aircraft', icon: PlaneTakeoff, label: 'Aircraft' },
      { href: '/databases', icon: Database, label: 'Databases' },
      { href: '/tools', icon: Wrench, label: 'Tools' },
      { href: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

/**
 * SVG del logo AMS — monograma sobre placa cobalto con silueta de ala/cumbre.
 * Lectura aeronáutica clara a 34px.
 */
function AmsMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="40" height="40" rx="10" fill="#2f4aa8" />
      <path
        d="M6 28 L20 10 L34 28 L27 28 L20 19 L13 28 Z"
        fill="#ffffff"
        opacity="0.95"
      />
      <circle cx="28" cy="13" r="2" fill="#e8b756" />
      <path d="M6 31 L34 31" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" />
    </svg>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  return (
    <aside
      className={cn(
        'relative flex h-full shrink-0 flex-col border-r border-[color:var(--line)] transition-all duration-200',
        sidebarCollapsed ? 'w-16' : 'w-60',
      )}
      style={{
        background: 'linear-gradient(180deg,#edeae4 0%,#e5e2db 100%)',
      }}
    >
      {/* Client-branded slot (AMS) */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 pb-5 pt-5',
          sidebarCollapsed && 'justify-center px-0',
        )}
      >
        <div className="shrink-0">
          <AmsMark size={sidebarCollapsed ? 32 : 34} />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="truncate font-[family-name:var(--font-heading)] text-[17px] leading-none text-[color:var(--ink)]">
              AMS
            </p>
            <p className="mt-1 truncate font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[color:var(--ink-3)]">
              DOA · Part 21J
            </p>
          </div>
        )}
      </div>
      <div className="mx-3 h-px bg-[color:var(--line)]" />

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navGroups.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && 'mt-4')}>
            {!sidebarCollapsed && (
              <div className="px-3 pb-1 pt-2 font-[family-name:var(--font-heading)] text-[13px] italic text-[color:var(--ink-3)]">
                {group.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map(({ href, icon: Icon, label, count }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`)
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn(
                        'group flex items-center gap-3 rounded-[9px] px-2.5 py-2 text-[13.5px] transition-colors',
                        active
                          ? 'bg-white text-[color:var(--ink)] shadow-[0_1px_2px_rgba(74,60,36,0.08),inset_0_0_0_1px_rgba(74,60,36,0.06)]'
                          : 'text-[color:var(--ink-2)] hover:bg-white/60',
                        sidebarCollapsed && 'justify-center px-0',
                      )}
                      title={sidebarCollapsed ? label : undefined}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          active ? 'text-[color:var(--umber)]' : 'text-[color:var(--ink-4)]',
                        )}
                      />
                      {!sidebarCollapsed && (
                        <>
                          <span className="truncate">{label}</span>
                          {count && (
                            <span className="ml-auto rounded-[10px] bg-white/60 px-1.5 py-[1px] font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--ink-4)]">
                              {count}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: avatar + user */}
      <div className="mx-3 h-px bg-[color:var(--line)]" />
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-4',
          sidebarCollapsed && 'justify-center px-0',
        )}
      >
        <div
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white shadow-[0_2px_4px_rgba(36,34,32,0.2)]"
          style={{
            background: 'linear-gradient(135deg,#545250 0%,#242220 100%)',
            fontFamily: 'var(--font-heading)',
            fontSize: '14px',
          }}
        >
          A
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="truncate font-[family-name:var(--font-heading)] text-[14px] leading-none text-[color:var(--ink)]">
              Alejandro
            </p>
            <p className="mt-1 truncate text-[11px] text-[color:var(--ink-3)]">
              DOA Engineer
            </p>
          </div>
        )}
      </div>

      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--line-strong)] bg-white text-[color:var(--ink-3)] shadow-sm transition-colors hover:text-[color:var(--ink)]"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  )
}
