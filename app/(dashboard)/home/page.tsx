/**
 * ============================================================================
 * HOME — "Your morning" (Warm Executive redesign)
 * ============================================================================
 *
 * Rediseño basado en el prototipo DOA Redesign.html (address "Warm
 * Executive", ajuste cool-neutral). Estructura:
 *
 *   1. Saludo serif grande + una frase que dice qué hay que mirar hoy.
 *   2. Tarjeta hero "urgent" con el item overdue.
 *   3. Dos columnas: "Today" (lista priorizada) + "Deliveries · next 14 days".
 *   4. Fila de stats demotada (4 tiles pequeños).
 *   5. "Recent activity" compacto.
 *
 * Es un Server Component: los data son estáticos para esta iteración del
 * rediseño; el handoff a data reales lo hará la siguiente fase.
 * ============================================================================
 */

import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { APP_RELEASE } from '@/lib/app-release'

// ---------------------------------------------------------------------------
// Contenidos (estáticos — reflejan el prototipo tal cual)
// ---------------------------------------------------------------------------

/** Item "urgent" que protagoniza la tarjeta hero. */
const urgent = {
  code: 'Q-26-11',
  label: 'OVERDUE 2 DAYS',
  title: 'AirNostrum cabin retrofit',
  detail: 'offer draft awaiting your review',
  href: '/quotations',
}

/** "Today" — lista de 4 items con dot de color, código, título y hora. */
const today = [
  { code: 'PRJ-0418', title: 'A320 Galley — DOS signoff',       color: 'var(--cobalt)', time: '14:00' },
  { code: 'Q-26-14',  title: 'Unknown sender — scope call',     color: 'var(--umber)',  time: '16:00' },
  { code: 'PRJ-0402', title: 'ATR repair — client review',      color: 'var(--ok)',     time: '—' },
  { code: 'Q-26-09',  title: 'Binter MRO — TCDS lookup',        color: 'var(--ink-3)',  time: '—' },
] as const

/** Timeline de deliveries, 14 días. */
const deliveries = [
  { date: 'Wed 21', code: 'PRJ-0418', what: 'DOS signoff',    color: 'var(--cobalt)', pct: 18 },
  { date: 'Fri 23', code: 'PRJ-0401', what: 'Client handoff', color: 'var(--ok)',     pct: 32 },
  { date: 'Mon 26', code: 'Q-26-05',  what: 'Offer deadline', color: 'var(--umber)',  pct: 50 },
  { date: 'Thu 29', code: 'PRJ-0402', what: 'Final report',   color: 'var(--ink-3)',  pct: 72 },
  { date: 'Mon 03', code: 'PRJ-0418', what: 'Closeout',       color: 'var(--ink-3)',  pct: 95 },
] as const

/** Stats demotadas. */
const stats = [
  { label: 'Inbound',    value: 12, delta: '+3',  tone: 'up'   as const },
  { label: 'In offer',   value:  5, delta: '—',   tone: 'flat' as const },
  { label: 'Validating', value:  3, delta: '−1',  tone: 'down' as const },
  { label: 'To deliver', value:  2, delta: '+1',  tone: 'up'   as const },
]

/** Actividad reciente. */
const activity = [
  { letter: 'M', cls: '',  text: 'María moved Q-26-12 to Scope',  when: '09:14' },
  { letter: 'A', cls: '',  text: 'You uploaded drawings-pack v3', when: 'Yst'   },
  { letter: 'e', cls: 'e', text: 'Expert summarized new inbound', when: 'Yst'   },
  { letter: 'J', cls: '',  text: 'Jorge signed DOS on PRJ-0401',  when: 'Fri'   },
  { letter: 'A', cls: '',  text: 'You closed Q-26-03 as Won',     when: 'Fri'   },
]

// ---------------------------------------------------------------------------
// Utilidades visuales
// ---------------------------------------------------------------------------

function deltaToneClasses(tone: 'up' | 'down' | 'flat') {
  if (tone === 'up')   return 'bg-[#e4ecdc] text-[color:var(--ok)]'
  if (tone === 'down') return 'bg-[#f4e0d8] text-[color:var(--warn)]'
  return 'bg-[color:var(--paper-3)] text-[color:var(--ink-3)]'
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  // Date fija del prototipo — en producción vendrá del servidor.
  const dateLabel = 'Monday, 19 April'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopBar title="Home" subtitle="your morning" />

      <main className="flex-1 overflow-y-auto px-8 py-8">
        {/* ---- Saludo ---- */}
        <header className="mb-7 max-w-3xl">
          <h1 className="font-[family-name:var(--font-heading)] text-[44px] leading-[1.05] tracking-[-0.8px] text-[color:var(--ink)]">
            Good morning,{' '}
            <em className="italic text-[color:var(--ink-3)]">Alejandro.</em>
          </h1>
          <p className="mt-2 max-w-[640px] text-[15.5px] leading-[1.55] text-[color:var(--ink-2)]">
            {dateLabel}. One item is overdue and two are due this week. The rest can wait.
          </p>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-[color:var(--ink-4)]">
            {APP_RELEASE.version} · {APP_RELEASE.releaseName}
          </p>
        </header>

        {/* ---- Tarjeta hero "urgent" ---- */}
        <Link
          href={urgent.href}
          className="mb-6 block rounded-2xl border border-[color:var(--umber)] bg-[color:var(--paper-2)] shadow-[0_0_0_1px_var(--umber)_inset,0_4px_14px_-6px_rgba(138,90,43,0.25)] transition-shadow hover:shadow-[0_0_0_1px_var(--umber)_inset,0_8px_22px_-6px_rgba(138,90,43,0.35)]"
        >
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-6 px-6 py-5">
            <div
              className="grid h-12 w-12 place-items-center rounded-[14px] text-white shadow-[0_2px_6px_rgba(138,90,43,0.3)]"
              style={{
                background: 'linear-gradient(180deg,var(--umber-2),var(--umber))',
                fontFamily: 'var(--font-heading)',
                fontSize: '22px',
              }}
            >
              !
            </div>
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em] text-[color:var(--umber)]">
                {urgent.code} · {urgent.label}
              </p>
              <p className="mt-1 font-[family-name:var(--font-heading)] text-[24px] leading-[1.2] text-[color:var(--ink)]">
                {urgent.title}{' '}
                <em className="italic text-[color:var(--ink-3)]">· {urgent.detail}</em>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <span className="rounded-[10px] border border-[color:var(--line-strong)] bg-[color:var(--paper-2)] px-3 py-[7px] text-[13px] font-medium text-[color:var(--ink)] shadow-[0_1px_0_rgba(74,60,36,0.06),inset_0_1px_0_rgba(255,255,255,0.6)]">
                Snooze
              </span>
              <span
                className="rounded-[10px] border border-[color:var(--ink)] px-3 py-[7px] text-[13px] font-medium text-[color:var(--paper)] shadow-[0_1px_2px_rgba(74,60,36,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]"
                style={{ background: 'linear-gradient(180deg,#3d322a 0%,var(--ink) 100%)' }}
              >
                Open →
              </span>
            </div>
          </div>
        </Link>

        {/* ---- Two columns: Today + Deliveries ---- */}
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          {/* Today */}
          <section className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper-2)] px-6 py-5 shadow-[0_2px_0_rgba(255,255,255,0.5)_inset,0_4px_14px_-6px_rgba(74,60,36,0.1)]">
            <h2 className="mb-4 flex items-center justify-between font-[family-name:var(--font-heading)] text-[22px] tracking-[-0.3px] text-[color:var(--ink)]">
              <span>
                Today <em className="italic text-[color:var(--ink-3)]">· {today.length} items</em>
              </span>
              <Link href="/engineering/portfolio" className="font-[family-name:var(--font-sans)] text-[12.5px] text-[color:var(--umber)] hover:underline">
                Plan week →
              </Link>
            </h2>
            <ul>
              {today.map((item, i) => (
                <li
                  key={item.code}
                  className={`grid grid-cols-[10px_80px_1fr_80px] items-center gap-3.5 py-3 ${i > 0 ? 'border-t border-[color:var(--line)]' : ''}`}
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: item.color }} />
                  <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-[color:var(--ink-3)]">
                    {item.code}
                  </span>
                  <span className="truncate text-[14px] text-[color:var(--ink)]">{item.title}</span>
                  <span className="text-right font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--ink-4)]">
                    {item.time}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Deliveries timeline */}
          <section className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper-2)] px-6 py-5 shadow-[0_2px_0_rgba(255,255,255,0.5)_inset,0_4px_14px_-6px_rgba(74,60,36,0.1)]">
            <h2 className="mb-4 font-[family-name:var(--font-heading)] text-[22px] tracking-[-0.3px] text-[color:var(--ink)]">
              Deliveries <em className="italic text-[color:var(--ink-3)]">· next 14 days</em>
            </h2>
            <ul>
              {deliveries.map((d, i) => (
                <li
                  key={`${d.date}-${d.code}`}
                  className={`grid grid-cols-[70px_1fr_80px] items-center gap-3 py-2.5 ${i > 0 ? 'border-t border-[color:var(--line)]' : ''}`}
                >
                  <span className="font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--ink-3)]">
                    {d.date}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-[color:var(--ink)]">{d.what}</p>
                    <p className="font-[family-name:var(--font-mono)] text-[10.5px] text-[color:var(--ink-4)]">
                      {d.code}
                    </p>
                  </div>
                  <div className="relative h-1 overflow-hidden rounded-[2px] bg-[color:var(--paper-3)]">
                    <div
                      className="absolute bottom-0 left-0 top-0"
                      style={{ width: `${d.pct}%`, background: d.color }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ---- Stats row (demoted) ---- */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="relative overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper-2)] px-5 py-4 shadow-[0_2px_0_rgba(255,255,255,0.5)_inset,0_4px_14px_-6px_rgba(74,60,36,0.15)]"
            >
              <span
                className="absolute left-0 right-0 top-0 h-[3px]"
                style={{ background: 'var(--umber)', opacity: 0.35 }}
              />
              <div className="flex items-center justify-between">
                <span className="font-[family-name:var(--font-heading)] text-[12.5px] italic text-[color:var(--ink-3)]">
                  {s.label}
                </span>
                <span className={`rounded-[20px] px-1.5 py-[1px] font-[family-name:var(--font-mono)] text-[11px] ${deltaToneClasses(s.tone)}`}>
                  {s.delta}
                </span>
              </div>
              <div className="mt-2 font-[family-name:var(--font-heading)] text-[36px] leading-none tracking-[-1.2px] text-[color:var(--ink)]">
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* ---- Recent activity ---- */}
        <section className="mt-6 rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper-2)] px-6 py-5 shadow-[0_2px_0_rgba(255,255,255,0.5)_inset,0_4px_14px_-6px_rgba(74,60,36,0.1)]">
          <h2 className="mb-3 font-[family-name:var(--font-heading)] text-[22px] tracking-[-0.3px] text-[color:var(--ink)]">
            Recent activity
          </h2>
          <ul>
            {activity.map((a, i) => (
              <li
                key={`${a.letter}-${i}`}
                className={`grid grid-cols-[30px_1fr_auto] items-center gap-3 py-2.5 text-[13px] ${i > 0 ? 'border-t border-[color:var(--line)]' : ''}`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full font-[family-name:var(--font-heading)] text-[13px] ${a.cls === 'e'
                    ? 'bg-[color:var(--ink)] font-[family-name:var(--font-sans)] text-[color:var(--paper)]'
                    : 'bg-[color:var(--paper-3)] text-[color:var(--ink-2)]'}`}
                >
                  {a.letter}
                </span>
                <span className="text-[color:var(--ink-2)]">{a.text}</span>
                <span className="font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--ink-4)]">
                  {a.when}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
