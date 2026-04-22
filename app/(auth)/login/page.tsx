/**
 * ============================================================================
 * LOGIN — Warm Executive (AMS client-branded)
 * ============================================================================
 * Pantalla de entrada. Mantiene el flujo supabase.auth.signInWithPassword y
 * la observabilidad (trackUiEvent) intactos; solo cambia la identidad visual.
 * ============================================================================
 */

'use client'

import { Suspense, useState } from 'react'
import { RouteViewTracker } from '@/components/observability/RouteViewTracker'
import { trackUiEvent } from '@/lib/observability/client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

/** Logo AMS: placa cobalto con ala/cumbre blanca y destello dorado. */
function AmsLogo({ size = 56 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="40" height="40" rx="11" fill="#2f4aa8" />
      <path d="M6 28 L20 10 L34 28 L27 28 L20 19 L13 28 Z" fill="#ffffff" opacity="0.95" />
      <circle cx="28" cy="13" r="2.3" fill="#e8b756" />
      <path d="M6 31 L34 31" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" />
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const emailDomain = email.includes('@') ? email.split('@').at(-1)?.toLowerCase() ?? null : null

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      await trackUiEvent({
        eventName: 'auth.login',
        eventCategory: 'auth',
        outcome: 'failure',
        route: '/login',
        metadata: { provider: 'password', email_domain: emailDomain, error_name: error.name },
      })
      setError(error.message)
      setLoading(false)
    } else {
      await trackUiEvent({
        eventName: 'auth.login',
        eventCategory: 'auth',
        outcome: 'success',
        route: '/login',
        metadata: { provider: 'password', email_domain: emailDomain },
      })
      router.push('/home')
      router.refresh()
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: 'linear-gradient(180deg,#edeae4 0%,#f5f3ee 60%,#ebe8e1 100%)' }}
    >
      <Suspense fallback={null}>
        <RouteViewTracker scope="auth" />
      </Suspense>
      <div className="w-full max-w-[420px]">
        {/* Cabecera marca */}
        <div className="mb-8 flex flex-col items-center text-center">
          <AmsLogo size={56} />
          <h1 className="mt-5 font-[family-name:var(--font-heading)] text-[34px] leading-[1.05] tracking-[-0.6px] text-[color:var(--ink)]">
            DOA Operations Hub
          </h1>
          <p className="mt-1 font-[family-name:var(--font-heading)] text-[15px] italic text-[color:var(--ink-3)]">
            AMS — Aeronautic Modification Spain
          </p>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-[color:var(--ink-4)]">
            EASA.21J.064 · Madrid · ES
          </p>
        </div>

        {/* Card de login */}
        <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper-2)] p-7 shadow-[0_2px_0_rgba(255,255,255,0.5)_inset,0_24px_60px_-28px_rgba(74,60,36,0.35)]">
          <h2 className="mb-5 font-[family-name:var(--font-heading)] text-[22px] leading-none text-[color:var(--ink)]">
            Sign in{' '}
            <em className="italic text-[color:var(--ink-3)]">to continue</em>
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="engineer@ams.aero"
                className="w-full rounded-[10px] border border-[color:var(--line-strong)] bg-[color:var(--paper)] px-3 py-2.5 text-sm text-[color:var(--ink)] placeholder-[color:var(--ink-4)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] focus:border-[color:var(--umber)] focus:outline-none focus:ring-2 focus:ring-[color:var(--umber)]/25"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.14em] text-[color:var(--ink-3)]">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-[10px] border border-[color:var(--line-strong)] bg-[color:var(--paper)] px-3 py-2.5 text-sm text-[color:var(--ink)] placeholder-[color:var(--ink-4)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] focus:border-[color:var(--umber)] focus:outline-none focus:ring-2 focus:ring-[color:var(--umber)]/25"
              />
            </div>

            {error && (
              <div className="rounded-[10px] border border-[color:var(--err)]/30 bg-[color:var(--err)]/10 px-3 py-2.5 text-sm text-[color:var(--err)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-[10px] border border-[color:var(--ink)] px-4 py-2.5 text-sm font-medium text-[color:var(--paper)] shadow-[0_1px_2px_rgba(74,60,36,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: 'linear-gradient(180deg,#3d322a 0%,var(--ink) 100%)' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center font-[family-name:var(--font-heading)] text-[12px] italic text-[color:var(--ink-3)]">
          Part 21J Design Organization — internal workspace
        </p>
      </div>
    </div>
  )
}
