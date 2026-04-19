'use client'

import { Suspense, useState } from 'react'
import { RouteViewTracker } from '@/components/observability/RouteViewTracker'
import { AmsMark } from '@/components/brand/AmsMark'
import { trackUiEvent } from '@/lib/observability/client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
        metadata: {
          provider: 'password',
          email_domain: emailDomain,
          error_name: error.name,
        },
      })
      setError(error.message)
      setLoading(false)
    } else {
      await trackUiEvent({
        eventName: 'auth.login',
        eventCategory: 'auth',
        outcome: 'success',
        route: '/login',
        metadata: {
          provider: 'password',
          email_domain: emailDomain,
        },
      })
      router.push('/home')
      router.refresh()
    }
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center bg-[#F8FBFF]"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at top, rgba(15,76,129,0.08), transparent 55%), radial-gradient(ellipse at bottom, rgba(30,111,184,0.05), transparent 60%)',
      }}
    >
      <Suspense fallback={null}>
        <RouteViewTracker scope="auth" />
      </Suspense>
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <AmsMark size={48} />
            <span className="text-2xl font-bold tracking-[0.18em] text-[color:var(--ams-ink)]">AMS</span>
          </div>
          <h1 className="text-2xl font-semibold text-[color:var(--ams-ink)]">AMS DOA Operation Hub</h1>
          <p className="text-sm text-slate-500 mt-1">
            AeronauticModSpain · Aircraft Certification Platform
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-[0_10px_30px_rgba(15,76,129,0.08)]">
          <div className="flex items-center gap-2 mb-6">
            <span className="h-5 w-[3px] rounded-full bg-[color:var(--ams-navy)]" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-[color:var(--ams-ink)]">Sign in to your account</h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[color:var(--ams-navy-light)] focus:ring-2 focus:ring-[color:var(--ams-navy-light)]/30 transition-colors"
                placeholder="engineer@aeronauticmodspain.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[color:var(--ams-navy-light)] focus:ring-2 focus:ring-[color:var(--ams-navy-light)]/30 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-all mt-2 shadow-[0_4px_12px_rgba(15,76,129,0.25)] hover:shadow-[0_6px_16px_rgba(15,76,129,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ams-navy-light)] focus-visible:ring-offset-2"
              style={{ background: 'linear-gradient(135deg, var(--ams-navy) 0%, var(--ams-navy-light) 100%)' }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          EASA Part 21J Design Organization · AeronauticModSpain internal workspace
        </p>
      </div>
    </div>
  )
}
