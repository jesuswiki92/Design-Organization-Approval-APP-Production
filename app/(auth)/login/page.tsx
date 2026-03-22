'use client'

import { useState } from 'react'
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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/home')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F1117]">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#6366F1] mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-[#E8E9F0]">DOA Operations Hub</h1>
          <p className="text-sm text-[#6B7280] mt-1">Design Organization Approval</p>
        </div>

        {/* Card */}
        <div className="bg-[#1A1D27] border border-[#2A2D3E] rounded-xl p-8">
          <h2 className="text-lg font-semibold text-[#E8E9F0] mb-6">Sign in to your account</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-[#0F1117] border border-[#2A2D3E] rounded-lg px-3 py-2.5 text-sm text-[#E8E9F0] placeholder-[#6B7280] focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-colors"
                placeholder="engineer@doa.aero"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-[#0F1117] border border-[#2A2D3E] rounded-lg px-3 py-2.5 text-sm text-[#E8E9F0] placeholder-[#6B7280] focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg px-3 py-2.5 text-sm text-[#EF4444]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors mt-2"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#6B7280] mt-6">
          Part 21J Design Organization — Internal workspace
        </p>
      </div>
    </div>
  )
}
