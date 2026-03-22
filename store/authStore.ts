'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile } from '@/types/database'

interface AuthState {
  user: { id: string; email: string | undefined } | null
  profile: Profile | null
  setUser: (user: { id: string; email: string | undefined } | null) => void
  setProfile: (profile: Profile | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      clear: () => set({ user: null, profile: null }),
    }),
    { name: 'doa-auth' }
  )
)
